import { Address, toNano, beginCell } from "@ton/core";
import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";
import {
  LimitOrderProtocol,
  OrderConfig,
  ethAddressToBigInt,
  HOLE_ADDRESS,
  LopOp,
  DstEscrow,
} from "moleswap-ton";
import { initMoleswapConfig } from "./config";
import * as fs from "fs";

export interface TonDestinationResult {
  transactionHash: string;
  blockTime: number;
  orderHash: bigint;
}

export interface WithdrawalResult {
  success: boolean;
  transactionHash: string;
  seqno: number;
  error?: string;
}

export interface TonWalletSetup {
  client: TonClient;
  walletContract: any;
  key: any;
}

export class TonAdapter {
  static async calculateDstEscrowAddress(
    lopAddress: string,
    orderHash: bigint
  ): Promise<Address> {
    const { client } = await TonAdapter.setupTonWallet();

    // Create LOP instance and get dst escrow address from on-chain getter
    const lop = LimitOrderProtocol.createFromAddress(Address.parse(lopAddress));
    const lopContract = client.open(lop);
    const dstEscrowAddress = await lopContract.getDstEscrowAddress(orderHash);

    return dstEscrowAddress;
  }

  static async getDstEscrowAddressFromOrder(
    orderHash: string | bigint
  ): Promise<string> {
    const config = initMoleswapConfig();
    const orderHashBigInt =
      typeof orderHash === "string" ? BigInt(orderHash) : orderHash;

    const address = await TonAdapter.calculateDstEscrowAddress(
      config.tonLopAddress,
      orderHashBigInt
    );
    return address.toString();
  }

  static async setupTonWallet(): Promise<TonWalletSetup> {
    const config = initMoleswapConfig();

    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TON_API_KEY,
    });

    const key = await mnemonicToWalletKey(config.tonMnemonic.split(" "));
    const wallet = WalletContractV4.create({
      publicKey: key.publicKey,
      workchain: 0,
    });
    const walletContract = client.open(wallet);

    const expectedAddress = Address.parse(config.tonTakerAddress);
    if (!wallet.address.equals(expectedAddress)) {
      throw new Error(
        "Wallet address mismatch - check mnemonic or TON_TAKER_ADDRESS"
      );
    }

    return { client, walletContract, key };
  }

  static loadOrderData(): any {
    return JSON.parse(fs.readFileSync("./order.json", "utf8"));
  }

  static async waitForTransaction(
    walletContract: any,
    initialSeqno: number,
    maxAttempts: number = 60
  ): Promise<WithdrawalResult> {
    let currentSeqno = initialSeqno;
    let attempts = 0;

    while (currentSeqno === initialSeqno && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      currentSeqno = await walletContract.getSeqno();
      attempts++;
    }

    if (currentSeqno === initialSeqno) {
      return {
        success: false,
        transactionHash: `seqno-${initialSeqno}`,
        seqno: initialSeqno,
        error: "Transaction confirmation timeout",
      };
    }

    return {
      success: true,
      transactionHash: `seqno-${initialSeqno}`,
      seqno: currentSeqno,
    };
  }

  static async withdrawFromEscrow(orderData: {
    orderHash: string;
    secret: string;
  }): Promise<WithdrawalResult> {
    try {
      const { client, walletContract, key } = await TonAdapter.setupTonWallet();
      const config = initMoleswapConfig();
      const secret = BigInt(orderData.secret);
      const orderHash = BigInt(orderData.orderHash);

      const calculatedAddress = await TonAdapter.calculateDstEscrowAddress(
        config.tonLopAddress,
        orderHash
      );

      const seqno = await walletContract.getSeqno();
      const dstEscrow = DstEscrow.createFromAddress(calculatedAddress);
      const dstEscrowContract = client.open(dstEscrow);

      await dstEscrowContract.sendWithdraw(
        walletContract.sender(key.secretKey),
        secret
      );

      return await TonAdapter.waitForTransaction(walletContract, seqno);
    } catch (error) {
      return {
        success: false,
        transactionHash: "",
        seqno: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  static async createDestinationEscrow(
    lopAddress: string,
    tonOrder: OrderConfig
  ): Promise<TonDestinationResult> {
    try {
      const { client, walletContract, key } = await TonAdapter.setupTonWallet();

      const lopContract = LimitOrderProtocol.createFromAddress(
        Address.parse(lopAddress)
      );

      const body = beginCell()
        .storeUint(LopOp.fill_order, 32)
        .storeUint(0, 64) // queryId
        .storeUint(tonOrder.maker_address as bigint, 256)
        .storeUint(tonOrder.maker_asset as bigint, 256)
        .storeUint(tonOrder.making_amount, 128)
        .storeAddress(tonOrder.receiver_address as Address)
        .storeRef(
          beginCell()
            .storeAddress(tonOrder.taker_address as Address)
            .storeAddress(tonOrder.taker_asset as Address)
            .storeCoins(tonOrder.taking_amount)
            .endCell()
        )
        .storeRef(
          beginCell()
            .storeUint(tonOrder.order_hash!!, 256)
            .storeUint(tonOrder.hashlock, 256)
            .storeUint(tonOrder.creation_time, 32)
            .storeUint(tonOrder.expiration_time, 32)
            .endCell()
        )
        .endCell();

      const seqno = await walletContract.getSeqno();
      const message = internal({
        to: lopContract.address,
        value: toNano("0.05") + tonOrder.taking_amount,
        body,
        bounce: true,
      });

      await walletContract.sendTransfer({
        seqno,
        secretKey: key.secretKey,
        messages: [message],
      });

      return {
        transactionHash: seqno.toString(),
        blockTime: Math.floor(Date.now() / 1000),
        orderHash: tonOrder.order_hash!,
      };
    } catch (error) {
      throw new Error(
        `Failed to create destination escrow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static transformEvmOrderToTon(
    evmOrderData: any,
    tonTakerAddress: string,
    decodedOrder: any
  ): OrderConfig {
    return {
      maker_address: ethAddressToBigInt(evmOrderData.order.maker),
      maker_asset: ethAddressToBigInt(evmOrderData.order.makerAsset),
      making_amount: BigInt(evmOrderData.order.makingAmount),
      receiver_address: Address.parse(decodedOrder.receiver.toString()),
      taker_address: Address.parse(tonTakerAddress),
      taker_asset: HOLE_ADDRESS,
      taking_amount: BigInt(evmOrderData.order.takingAmount),
      order_hash: BigInt(evmOrderData.orderHash),
      creation_time: Math.floor(Date.now() / 1000),
      expiration_time: Math.floor(
        new Date(evmOrderData.expirationTime).getTime() / 1000
      ),
      hashlock: BigInt(evmOrderData.hashlock),
      salt: BigInt(evmOrderData.order.salt),
    };
  }
}
