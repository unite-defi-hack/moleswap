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

import { loadConfig } from "../../config";
import { TonCrossChainOrder, TimeLocks } from "@1inch/cross-chain-sdk";

/**
 * Extended OrderConfig that includes TimeLocks and safety deposits
 * for cross-chain operations
 */
export interface OrderConfig extends MoleSwapOrderConfig {
  timeLocks: TimeLocks;
  srcSafetyDeposit?: bigint;
  dstSafetyDeposit?: bigint;
  // Add the missing properties that are used in the code
  maker_address: bigint;
  maker_asset: bigint;
  making_amount: bigint;
  receiver_address: Address;
  taker_address: Address;
  taker_asset: Address;
  taking_amount: bigint;
  order_hash: bigint;
  hashlock: bigint;
  creation_time: number;
  expiration_time: number;
  salt: bigint;
  asset_jetton_address: Address;
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
    const config = loadConfig();
    const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.crossChain.tonTakerMnemonic);

    const contract = LimitOrderProtocol.createFromAddress(Address.parse(config.crossChain.tonLopAddress));
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
    const config = loadConfig();
    const { client } = await TonAdapter.setupTonWallet(config.crossChain.tonTakerMnemonic);

    const lop = LimitOrderProtocol.createFromAddress(Address.parse(lopAddress));
    const lopContract = client.open(lop);
    const srcEscrowAddress = await lopContract.getSrcEscrowAddress(orderHash);

    return srcEscrowAddress;
  }

  static async calculateDstEscrowAddress(
    lopAddress: string,
    orderHash: bigint
  ): Promise<Address> {
    const config = loadConfig();
    const { client } = await TonAdapter.setupTonWallet(config.crossChain.tonTakerMnemonic);

    // Create LOP instance and get dst escrow address from on-chain getter
    const lop = LimitOrderProtocol.createFromAddress(Address.parse(lopAddress));
    const lopContract = client.open(lop);
    const dstEscrowAddress = await lopContract.getDstEscrowAddress(orderHash);

    return dstEscrowAddress;
  }

  static async getDstEscrowAddressFromOrder(
    orderHash: string | bigint
  ): Promise<string> {
    const config = loadConfig();
    const orderHashBigInt =
      typeof orderHash === "string" ? BigInt(orderHash) : orderHash;

    const address = await TonAdapter.calculateDstEscrowAddress(
      config.crossChain.tonLopAddress,
      orderHashBigInt
    );
    return address.toString();
  }

  static async setupTonWallet(mnemonic: string): Promise<TonWalletSetup> {
    const config = loadConfig();
    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: config.crossChain.tonApiKey,
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
    const config = loadConfig();
    const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.crossChain.tonTakerMnemonic);

    const calculatedAddress = await TonAdapter.calculateSrcEscrowAddress(
      config.crossChain.tonLopAddress,
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
    const config = loadConfig();
    const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.crossChain.tonTakerMnemonic);

    const calculatedAddress = await TonAdapter.calculateSrcEscrowAddress(
      config.crossChain.tonLopAddress,
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
      const config = loadConfig();

      const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.crossChain.tonTakerMnemonic);
      const secret = BigInt(orderData.secret);
      const orderHash = BigInt(orderData.orderHash);

      const calculatedAddress = await TonAdapter.calculateDstEscrowAddress(
        config.crossChain.tonLopAddress,
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
      const config = loadConfig();
      const { walletContract, key } = await TonAdapter.setupTonWallet(config.crossChain.tonTakerMnemonic);

      const lopContract = LimitOrderProtocol.createFromAddress(
        Address.parse(lopAddress)
      );

      const body = beginCell()
        .storeUint(LopOp.fill_order, 32)
        .storeUint(0, 64) // queryId
        .storeUint(tonOrder.maker_address, 256)
        .storeUint(tonOrder.maker_asset, 256)
        .storeUint(tonOrder.making_amount, 128)
        .storeAddress(tonOrder.receiver_address)
        .storeRef(
          beginCell()
            .storeAddress(tonOrder.taker_address)
            .storeAddress(tonOrder.taker_asset)
            .storeCoins(tonOrder.taking_amount)
            .endCell()
        )
        .storeRef(
          beginCell()
            .storeUint(tonOrder.order_hash, 256)
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
        orderHash: tonOrder.order_hash,
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
    // Calculate order hash using static method
    return LimitOrderProtocol.calculateSrcOrderHash(order);
  }

  static createEvmToTonOrderConfig(
    evmOrderData: any,
    receiverAddress: string
  ): OrderConfig {
    // Helper function to safely convert to BigInt
    const safeBigInt = (value: any, fallback = 0n): bigint => {
      if (value === null || value === undefined || isNaN(value)) {
        return fallback;
      }
      try {
        return BigInt(value);
      } catch {
        return fallback;
      }
    };

    // Helper function to safely get timestamp
    const safeTimestamp = (expirationTime: any): number => {
      if (!expirationTime) {
        return Math.floor(Date.now() / 1000) + 3600; // Default 1 hour from now
      }
      try {
        const timestamp = new Date(expirationTime).getTime() / 1000;
        return isNaN(timestamp) ? Math.floor(Date.now() / 1000) + 3600 : Math.floor(timestamp);
      } catch {
        return Math.floor(Date.now() / 1000) + 3600;
      }
    };

    return {
      maker_address: ethAddressToBigInt(evmOrderData.order.maker),
      maker_asset: ethAddressToBigInt(evmOrderData.order.makerAsset),
      making_amount: safeBigInt(evmOrderData.order.makingAmount),
      receiver_address: Address.parse(receiverAddress),
      taker_address: Address.parse(receiverAddress), // Use receiver as taker for TON orders
      taker_asset: Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c"), // TON native address
      taking_amount: safeBigInt(evmOrderData.order.takingAmount),
      order_hash: safeBigInt(evmOrderData.orderHash),
      creation_time: Math.floor(Date.now() / 1000),
      expiration_time: safeTimestamp(evmOrderData.expirationTime),
      hashlock: safeBigInt(evmOrderData.hashlock),
      salt: safeBigInt(evmOrderData.order.salt),
      timeLocks: evmOrderData.timeLocks,
      srcSafetyDeposit: evmOrderData.srcSafetyDeposit ? safeBigInt(evmOrderData.srcSafetyDeposit) : 0n,
      dstSafetyDeposit: evmOrderData.dstSafetyDeposit ? safeBigInt(evmOrderData.dstSafetyDeposit) : 0n,
      asset_jetton_address: Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c"), // TON native address
    };
  }

  static async createTonToEvmOrderConfig(
    order: TonCrossChainOrder,
  ): Promise<OrderConfig> {

    const orderConfig: OrderConfig = {
      maker_address: BigInt(order.maker.toString()),
      maker_asset: BigInt(order.makerAsset.toString()),
      making_amount: order.makingAmount,
      receiver_address: Address.parse(order.receiver.toString()),
      taker_address: Address.parse(order.maker.toString()), // Use maker as taker for TON orders
      taker_asset: Address.parse(order.takerAsset.toString()),
      taking_amount: order.takingAmount,
      salt: order.salt,
      creation_time: Number(order.auctionStartTime),
      expiration_time: Number(order.auctionEndTime),
      hashlock: BigInt(order.hashLock.toString()),
      timeLocks: order.timeLocks,
      srcSafetyDeposit: order.srcSafetyDeposit,
      dstSafetyDeposit: order.dstSafetyDeposit,
      order_hash: 0n, // Will be calculated below
      asset_jetton_address: Address.parse(order.takerAsset.toString()), // Use taker asset as jetton address
    }

    const orderHash = await TonAdapter.calculateOrderHash(orderConfig);

    return {
      ...orderConfig,
      order_hash: orderHash,
    };
  }
}
