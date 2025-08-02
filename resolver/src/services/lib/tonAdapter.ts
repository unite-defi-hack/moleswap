import { Address, toNano, beginCell } from "@ton/core";
import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";
import {
  LimitOrderProtocol,
  OrderConfig as MoleSwapOrderConfig,
  ethAddressToBigInt,
  HOLE_ADDRESS,
  LopOp,
  DstEscrow,
  SrcEscrow,
} from "moleswap-ton";

import { initMoleswapConfig } from "./config";
import { TonCrossChainOrder, TimeLocks } from "@1inch/cross-chain-sdk";

/**
 * Extended OrderConfig that includes TimeLocks and safety deposits
 * for cross-chain operations
 */
export interface OrderConfig extends MoleSwapOrderConfig {
  timeLocks: TimeLocks;
  srcSafetyDeposit?: bigint;
  dstSafetyDeposit?: bigint;
}

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

export interface TransactionResult {
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



  static async sendCreateOrder(
    orderData: OrderConfig,
  ) {

    const config = initMoleswapConfig();
    const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.tonMakerMnemonic);

    const contract = LimitOrderProtocol.createFromAddress(Address.parse(config.tonLopAddress));
    const lopContract = client.open(contract);
    const seqno = await walletContract.getSeqno();

    await lopContract.sendCreateOrder(
      walletContract.sender(key.secretKey),
      orderData
    );

    const result = await TonAdapter.waitForTransaction(walletContract, seqno);
    return result;
  }

  static async calculateSrcEscrowAddress(
    lopAddress: string,
    orderHash: bigint
  ): Promise<Address> {
    const config = initMoleswapConfig();
    const { client } = await TonAdapter.setupTonWallet(config.tonTakerMnemonic);

    const lop = LimitOrderProtocol.createFromAddress(Address.parse(lopAddress));
    const lopContract = client.open(lop);
    const srcEscrowAddress = await lopContract.getSrcEscrowAddress(orderHash);

    return srcEscrowAddress;
  }

  static async calculateDstEscrowAddress(
    lopAddress: string,
    orderHash: bigint
  ): Promise<Address> {
    const config = initMoleswapConfig();
    const { client } = await TonAdapter.setupTonWallet(config.tonTakerMnemonic);

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

  static async setupTonWallet(mnemonic: string): Promise<TonWalletSetup> {
    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TON_API_KEY,
    });

    const key = await mnemonicToWalletKey(mnemonic.split(" "));
    const wallet = WalletContractV4.create({
      publicKey: key.publicKey,
      workchain: 0,
    });
    const walletContract = client.open(wallet);

    console.log("Wallet address:", walletContract.address.toString());
    return { client, walletContract, key };
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

  static async claimOrder(orderHash: bigint): Promise<TransactionResult> {
    const config = initMoleswapConfig();
    const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.tonTakerMnemonic);

    const calculatedAddress = await TonAdapter.calculateSrcEscrowAddress(
      config.tonLopAddress,
      orderHash
    );

    const srcEscrow = SrcEscrow.createFromAddress(calculatedAddress);
    const srcEscrowContract = client.open(srcEscrow);
    const seqno = await walletContract.getSeqno();

    console.log("Claiming order from src escrow", calculatedAddress);

    await srcEscrowContract.sendClaim(
      walletContract.sender(key.secretKey)
    );

    return await TonAdapter.waitForTransaction(walletContract, seqno);
  }


  static async withdrawFromSrcEscrow(orderData: {
    orderHash: string;
    secret: string;
  }): Promise<TransactionResult> {
    const config = initMoleswapConfig();
    const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.tonTakerMnemonic);

    const calculatedAddress = await TonAdapter.calculateSrcEscrowAddress(
      config.tonLopAddress,
      BigInt(orderData.orderHash)
    );

    const srcEscrow = SrcEscrow.createFromAddress(calculatedAddress);
    const srcEscrowContract = client.open(srcEscrow);
    const seqno = await walletContract.getSeqno();

    await srcEscrowContract.sendWithdraw(walletContract.sender(key.secretKey), BigInt(orderData.secret));

    return await TonAdapter.waitForTransaction(walletContract, seqno);
  }

  static async withdrawFromDstEscrow(orderData: {
    orderHash: string;
    secret: string;
  }): Promise<WithdrawalResult> {
    try {
      const config = initMoleswapConfig();

      const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.tonTakerMnemonic);
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
      const config = initMoleswapConfig();
      const { walletContract, key } = await TonAdapter.setupTonWallet(config.tonMakerMnemonic);

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

  static async calculateOrderHash(order: OrderConfig): Promise<bigint> {
    // make onchain call to calculate order hash
    const config = initMoleswapConfig();
    const { client } = await TonAdapter.setupTonWallet(config.tonTakerMnemonic);

    const lop = LimitOrderProtocol.createFromAddress(Address.parse(config.tonLopAddress));
    const lopContract = client.open(lop);
    const orderHash = await lopContract.calculateOrderHash(order);
    return orderHash;
  }

  static createEvmToTonOrderConfig(
    evmOrderData: any,
    receiverAddress: string
  ): OrderConfig {
    return {
      maker_address: ethAddressToBigInt(evmOrderData.order.maker),
      maker_asset: ethAddressToBigInt(evmOrderData.order.makerAsset),
      making_amount: BigInt(evmOrderData.order.makingAmount),
      receiver_address: Address.parse(receiverAddress),
      taker_address: evmOrderData.order.taker,
      taker_asset: HOLE_ADDRESS,
      taking_amount: BigInt(evmOrderData.order.takingAmount),
      order_hash: BigInt(evmOrderData.orderHash),
      creation_time: Math.floor(Date.now() / 1000),
      expiration_time: Math.floor(
        new Date(evmOrderData.expirationTime).getTime() / 1000
      ),
      hashlock: BigInt(evmOrderData.hashlock),
      salt: BigInt(evmOrderData.order.salt),
      timeLocks: evmOrderData.timeLocks,
      srcSafetyDeposit: evmOrderData.srcSafetyDeposit ? BigInt(evmOrderData.srcSafetyDeposit) : 0n,
      dstSafetyDeposit: evmOrderData.dstSafetyDeposit ? BigInt(evmOrderData.dstSafetyDeposit) : 0n,
    };
  }

  static async createTonToEvmOrderConfig(
    order: TonCrossChainOrder,
  ): Promise<OrderConfig> {

    const orderConfig: OrderConfig = {
      maker_address: Address.parse(order.maker.toString()),
      maker_asset: Address.parse(order.makerAsset.toString()),
      making_amount: order.makingAmount,
      receiver_address: ethAddressToBigInt(order.receiver.toString()),
      taker_asset: ethAddressToBigInt(order.takerAsset.toString()),
      taking_amount: order.takingAmount,
      salt: order.salt,
      creation_time: Number(order.auctionStartTime),
      expiration_time: Number(order.auctionEndTime),
      hashlock: BigInt(order.hashLock.toString()),
      timeLocks: order.timeLocks,
      srcSafetyDeposit: order.srcSafetyDeposit,
      dstSafetyDeposit: order.dstSafetyDeposit,
    }

    const orderHash = await TonAdapter.calculateOrderHash(orderConfig);

    return {
      ...orderConfig,
      order_hash: orderHash,
    };
  }
}
