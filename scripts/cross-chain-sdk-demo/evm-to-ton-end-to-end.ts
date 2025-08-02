import "dotenv/config";
import { randomBytes } from "crypto";
import { Wallet, JsonRpcProvider } from "ethers";

import {
  Address,
  HashLock,
  TimeLocks,
  EvmCrossChainOrder,
  AuctionDetails,
  randBigInt,
  EvmAddress,
  TonAddress,
  Extension,
} from "@1inch/cross-chain-sdk";
import {
  initMoleswapConfig,
  MoleswapConfig,
  // signOrderWithCustomLop,
} from "./lib/config";
import { EvmAdapter, DepositResult, WithdrawResult } from "./lib/evmAdapter";
import {
  TonAdapter,
  WithdrawalResult as TonWithdrawalResult,
} from "./lib/tonAdapter";

const UINT_40_MAX = (1n << 40n) - 1n;

const safeBigInt = (val: string, fallback = 0n): bigint => {
  try {
    return val ? BigInt(val) : fallback;
  } catch {
    return fallback;
  }
};

async function createOrder(config: MoleswapConfig, maker: Wallet) {
  // ----------------------------------------------------------------------------
  // 1. Secret & Hash-lock
  // ----------------------------------------------------------------------------
  const secretBytes = randomBytes(32);
  const secret = "0x" + Buffer.from(secretBytes).toString("hex");
  const hashLock = HashLock.forSingleFill(secret);
  const secretHash = hashLock.toString();

  // ----------------------------------------------------------------------------
  // 2. Time-locks & Safety deposits (very short demo values) -------------------
  // ----------------------------------------------------------------------------
  const timeLocks = TimeLocks.new({
    srcWithdrawal: 0n,
    srcPublicWithdrawal: 12000n,
    srcCancellation: 18000n,
    srcPublicCancellation: 24000n,
    dstWithdrawal: 0n,
    dstPublicWithdrawal: 120n,
    dstCancellation: 180n,
  });

  const SRC_SAFETY_DEPOSIT = safeBigInt("1000000000000");
  const DST_SAFETY_DEPOSIT = safeBigInt("1000000000000");

  // ----------------------------------------------------------------------------
  // 3. Auction parameters (no auction - fixed price) --------------------------
  // ----------------------------------------------------------------------------
  const auctionDetails = AuctionDetails.noAuction();

  // ----------------------------------------------------------------------------
  // 4. Build Cross-Chain Order --------------------------------------------------
  // ----------------------------------------------------------------------------
  const MAKING_AMOUNT = safeBigInt("881220000000000"); // 0.00088122 ETH, ~3.31$
  const TAKING_AMOUNT = safeBigInt("200000000"); // 0.2 TON

  const nonce = randBigInt(UINT_40_MAX);

  const order = EvmCrossChainOrder.new(
    new EvmAddress(new Address(config.escrowFactoryAddress)),
    {
      makerAsset: new EvmAddress(new Address(config.tokenA)),
      takerAsset: TonAddress.NATIVE,
      makingAmount: MAKING_AMOUNT,
      takingAmount: TAKING_AMOUNT,
      maker: new EvmAddress(new Address(maker.address)),
      receiver: new TonAddress(
        "0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb"
      ),
    },
    {
      hashLock,
      srcChainId: config.sourceChainId as unknown as any,
      dstChainId: config.destinationChainId as unknown as any,
      srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
      dstSafetyDeposit: DST_SAFETY_DEPOSIT,
      timeLocks,
    },
    {
      auction: auctionDetails,
      whitelist: [
        {
          address: new EvmAddress(new Address(config.resolverProxyAddress)),
          allowFrom: 0n,
        },
      ],
    },
    {
      allowPartialFills: false,
      allowMultipleFills: false,
      nonce: nonce,
    }
  );

  // ----------------------------------------------------------------------------
  // 5. Sign the order (EIP-712) -------------------------------------------------
  // ----------------------------------------------------------------------------
  // Use abstracted signing function that handles domain consistency
  // const signature = await signOrderWithCustomLop(order, maker, config);

  const typedData = order.getTypedData(config.sourceChainId);
  console.log("typedData", typedData);

  const signature = await maker.signTypedData(
    typedData.domain,
    { Order: typedData.types.Order },
    typedData.message
  );

  const output = {
    order: order.build(),
    extension: order.extension.encode(),
    signature,
    secret,
    hashlock: secretHash,
    orderHash: order.getOrderHash(config.sourceChainId),
    expirationTime: new Date(Number(order.deadline) * 1000).toISOString(),
  };

  return output;
}

async function depositToSrcEscrow(
  orderData: Awaited<ReturnType<typeof createOrder>>,
  config: MoleswapConfig
): Promise<DepositResult> {
  // Create provider and taker wallet
  const provider = new JsonRpcProvider(config.rpcUrl);
  const taker = new Wallet(config.takerPrivateKey, provider);

  // Initialize EVM adapter
  const evmAdapter = new EvmAdapter(provider, config);

  // Re-create the order object from serialized data
  // Need to decode the extension string back to Extension object
  const extension = Extension.decode(orderData.extension);
  const order = EvmCrossChainOrder.fromDataAndExtension(
    orderData.order,
    extension
  );

  // Execute deposit (order hash patching happens inside evmAdapter)
  const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
    order,
    orderData.signature,
    taker,
    BigInt(orderData.order.makingAmount)
  );

  return depositResult;
}

async function withdrawFromSrcEscrow(
  depositResult: DepositResult,
  secret: string,
  config: MoleswapConfig
): Promise<WithdrawResult> {
  // Create provider and taker wallet
  const provider = new JsonRpcProvider(config.rpcUrl);
  const taker = new Wallet(config.takerPrivateKey, provider);

  // Initialize EVM adapter
  const evmAdapter = new EvmAdapter(provider, config);

  // Execute withdrawal to taker address
  const withdrawResult = await evmAdapter.withdrawFromSrcEscrow(
    depositResult,
    secret,
    taker.address,
    taker
  );

  return withdrawResult;
}

async function createTonDestinationEscrow(
  evmOrderData: Awaited<ReturnType<typeof createOrder>>,
  config: MoleswapConfig
) {
  // Properly decode the order to get the TonAddress receiver
  const decodedOrder = EvmCrossChainOrder.fromDataAndExtension(
    evmOrderData.order,
    Extension.decode(evmOrderData.extension)
  );

  const tonOrder = TonAdapter.createEvmToTonOrderConfig(
    evmOrderData,
    decodedOrder.receiver.toString()
  );

  const destinationResult = await TonAdapter.createDestinationEscrow(
    config.tonLopAddress,
    tonOrder
  );

  // Get the deployed escrow address
  const dstEscrowAddress = await TonAdapter.getDstEscrowAddressFromOrder(
    evmOrderData.orderHash
  );

  return {
    evmOrderHash: evmOrderData.orderHash,
    tonOrderHash: "0x" + tonOrder.order_hash?.toString(16),
    evmMaker: evmOrderData.order.maker,
    tonMaker: "0x" + tonOrder.maker_address.toString(16),
    transactionHash: destinationResult.transactionHash,
    hashlock: evmOrderData.hashlock,
    secret: evmOrderData.secret,
    dstEscrowAddress,
  };
}

async function withdrawFromTonDstEscrow(orderData: {
  orderHash: string;
  secret: string;
}): Promise<TonWithdrawalResult> {
  // Escrow address will be calculated automatically from order hash if not provided

  const result = await TonAdapter.withdrawFromDstEscrow(orderData);

  if (!result.success) {
    throw new Error(`TON withdrawal failed: ${result.error}`);
  }

  return result;
}

async function main() {
  console.log("Starting EVM to TON end-to-end workflow");
  const config = initMoleswapConfig();

  const maker = new Wallet(config.makerPrivateKey);
  const orderData = await createOrder(config, maker);

  // this should be sent to relayer

  // before resolver starts to execute order
  // there should be a pause of one block
  // due to LOP check allowedTime > block.timestamp
  console.log(
    'Waiting for one block - before "resolver" starts to execute order'
  );
  await new Promise((resolve) => setTimeout(resolve, 10000));
  // resolver deposits to src escrow
  const depositResult = await depositToSrcEscrow(orderData, config);
  console.log("Deposit to source escrow completed", depositResult);

  // resolver creates dst escrow
  const tonDstEscrowResult = await createTonDestinationEscrow(orderData, config);
  console.log("tonDstEscrowResult", tonDstEscrowResult)

  // relayer can follow up the escrows via
  // dst escrow address TON side - getDstEscrowAddressFromOrder()

  // wait for finality on both sides (also from practical point TON block has to be mined)
  console.log(
    "Waiting for finality on both sides (also from practical point TON block has to be mined)"
  );
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // at this point the relayer can share the secret with taker
  // taker withdraws from dst escrow
  const result = await withdrawFromTonDstEscrow({
    orderHash: orderData.orderHash,
    secret: orderData.secret,
  });
  console.log("Withdrawal from destination escrow completed", result);

  // taker withdraws from src escrow
  const res = await withdrawFromSrcEscrow(depositResult, orderData.secret, config);
  console.log("WithdrawFromSrcEscrow result:", res);
  console.log("Withdrawals completed ");
}

main().catch(console.error);
