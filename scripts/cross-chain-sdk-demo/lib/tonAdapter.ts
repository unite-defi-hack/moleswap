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
  JettonWallet,
  JettonMinter
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
    order: OrderConfig,
  ) {
    const config = initMoleswapConfig();
    const { client, walletContract, key } = await TonAdapter.setupTonWallet(config.tonMakerMnemonic);

    const contract = LimitOrderProtocol.createFromAddress(Address.parse(config.tonLopAddress));
    const lopSC = client.open(contract);
    const seqno = await walletContract.getSeqno();

    if (order.maker_asset.toString() === HOLE_ADDRESS.toString()) {
      await lopSC.sendCreateOrder(walletContract.sender(key.secretKey), order);
  } else {
      const lopJetton = client.open(JettonWallet.createFromAddress(order.maker_asset as Address));
      const { jettonMasterAddress } = await lopJetton.getWalletData();
      const jettonMinter = client.open(JettonMinter.createFromAddress(jettonMasterAddress));
      const jettonWalletAddr = await jettonMinter.getWalletAddress(walletContract.address);
      const jettonWallet = client.open(JettonWallet.createFromAddress(jettonWalletAddr));

      const orderHash = LimitOrderProtocol.calculateSrcOrderHash(order);
      const srcEscrowAddress = await lopSC.getSrcEscrowAddress(orderHash);
      order.asset_jetton_address = await jettonMinter.getWalletAddress(srcEscrowAddress);
      const sender = walletContract.sender(key.secretKey);
      
      const senderWithAddress = {
        ...sender,
        address: walletContract.address,
        send: sender.send
      };
      
      await jettonWallet.sendCreateOrder(
        senderWithAddress,
        order,
        lopSC.address
      );
  }

    const result = await TonAdapter.waitForTransaction(walletContract, seqno, client);
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

    return { client, walletContract, key };
  }

  static async waitForTransaction(
    walletContract: any,
    initialSeqno: number,
    client?: TonClient,
    maxAttempts: number = 60,
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

    // Try to get the actual transaction hash
    if (client) {
      try {
        const transactions = await client.getTransactions(walletContract.address, {
          limit: 5,
          inclusive: true
        });

        // Find the transaction with our seqno
        for (const tx of transactions) {
          if (tx.outMessagesCount > 0) {
            // Convert to hex format which is more URL-friendly
            const txHash = tx.hash().toString('hex');
            return {
              success: true,
              transactionHash: txHash,
              seqno: currentSeqno,
            };
          }
        }
      } catch (error) {
        console.log('Could not fetch transaction hash:', error);
      }
    }

    // Fallback to seqno-based identifier
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

    return await TonAdapter.waitForTransaction(walletContract, seqno, client);
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

    return await TonAdapter.waitForTransaction(walletContract, seqno, client);
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

      return await TonAdapter.waitForTransaction(walletContract, seqno, client);
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
    order: OrderConfig
  ): Promise<TransactionResult> {

      const config = initMoleswapConfig();
      const { walletContract, key, client } = await TonAdapter.setupTonWallet(config.tonTakerMnemonic);

      const contract = LimitOrderProtocol.createFromAddress(
        Address.parse(lopAddress)
      );
      const lopSC = client.open(contract);

      const seqno = await walletContract.getSeqno();

      if (order.taker_asset.toString() === HOLE_ADDRESS.toString()) {
        await lopSC.sendFillOrder(walletContract.sender(key.secretKey), order);
    } else {
        const lopJetton = client.open(JettonWallet.createFromAddress(order.taker_asset as Address));
        const { jettonMasterAddress } = await lopJetton.getWalletData();
        const jettonMinter = client.open(JettonMinter.createFromAddress(jettonMasterAddress));

        const jettonWalletAddr = await jettonMinter.getWalletAddress(walletContract.address);
        const jettonWallet = client.open(JettonWallet.createFromAddress(jettonWalletAddr));

        const orderHash = LimitOrderProtocol.calculateDstOrderHash(order);
        const dstEscrowAddress = await lopSC.getDstEscrowAddress(orderHash);
        order.asset_jetton_address = await jettonMinter.getWalletAddress(dstEscrowAddress);

      const sender = walletContract.sender(key.secretKey);
        const senderWithAddress = {
          ...sender,
          address: walletContract.address,
          send: sender.send
        };

        await jettonWallet.sendFillOrder(senderWithAddress, order, lopSC.address);
    }

      const result = await TonAdapter.waitForTransaction(walletContract, seqno, client);


      return result;
  }

  static createEvmToTonOrderConfig(
    evmOrderData: any,
    receiverAddress: string,
    realDestinationToken: string
  ): OrderConfig {

    let takerAssetToUse;

      try {
        const tonAddress = Address.parse(realDestinationToken);
        takerAssetToUse = tonAddress;
      } catch (error) {
        takerAssetToUse = ethAddressToBigInt(evmOrderData.order.makerAsset);
      }

    return {
      maker_address: ethAddressToBigInt(evmOrderData.order.maker),
      maker_asset: ethAddressToBigInt(evmOrderData.order.makerAsset),
      making_amount: BigInt(evmOrderData.order.makingAmount),
      receiver_address: Address.parse(receiverAddress),
      taker_address: evmOrderData.order.taker,
      taker_asset: takerAssetToUse,
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
      asset_jetton_address: HOLE_ADDRESS,
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
      asset_jetton_address: HOLE_ADDRESS,
    }

    const orderHash = LimitOrderProtocol.calculateSrcOrderHash(orderConfig);

    return {
      ...orderConfig,
      order_hash: orderHash,
    };
  }
}
