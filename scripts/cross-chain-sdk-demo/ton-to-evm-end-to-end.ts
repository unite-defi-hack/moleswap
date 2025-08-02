import "dotenv/config";
import { randomBytes } from "crypto";
import { Address as AddressLike } from "@1inch/cross-chain-sdk";
import {
  HashLock,
  TimeLocks,
  AuctionDetails,
  randBigInt,
  TonAddress,
  EvmAddress,
  TonCrossChainOrder,
} from "@1inch/cross-chain-sdk";
import { initMoleswapConfig, MoleswapConfig } from "./lib/config";
import { TonAdapter, OrderConfig } from "./lib/tonAdapter";
import { JsonRpcProvider, parseEther, parseUnits, toBeHex, Wallet, zeroPadValue } from "ethers";
import { EvmAdapter } from "./lib/evmAdapter";

const UINT_40_MAX = (1n << 40n) - 1n;

const safeBigInt = (val: string, fallback = 0n): bigint => {
  try {
    return val ? BigInt(val) : fallback;
  } catch {
    return fallback;
  }
};

async function createOrder(config: MoleswapConfig): Promise<{
  order: TonCrossChainOrder;
  secret: string;
}> {
  // ----------------------------------------------------------------------------
  // 1. Secret & Hash-lock
  // ----------------------------------------------------------------------------
  const secretBytes = randomBytes(32);
  const secret = "0x" + Buffer.from(secretBytes).toString("hex");
  const hashLock = HashLock.forSingleFill(secret);

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
  const MAKING_AMOUNT = parseUnits("1", 8); // 0.1 TON
  const TAKING_AMOUNT = parseEther("1"); // 1 ETH

  const nonce = randBigInt(UINT_40_MAX);

  const tonOrderFusion = TonCrossChainOrder.new(
    // new EvmAddress(new Address(config.escrowFactoryAddress)),
    {
      makerAsset: TonAddress.NATIVE,
      takerAsset: new EvmAddress(new AddressLike(config.tokenA)),
      makingAmount: MAKING_AMOUNT,
      takingAmount: TAKING_AMOUNT,
      maker: new TonAddress("0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb"), // MAKER_TON
      receiver: new EvmAddress(
        new AddressLike("0x71078879cd9A1D7987B74CEe6B6c0D130f1a0115") // MAKER_ETH_PUB
      ),
    },
    {
      hashLock,
      srcChainId: config.destinationChainId as unknown as any,
      dstChainId: config.sourceChainId as unknown as any,
      srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
      dstSafetyDeposit: DST_SAFETY_DEPOSIT,
      timeLocks,
    },
    {
      auction: auctionDetails,
    },
    {
      allowPartialFills: false,
      allowMultipleFills: false,
      salt: nonce,
    }
  );

  return {
    order: tonOrderFusion,
    secret: secret,
  };
}

async function main() {
  try {
    const config = initMoleswapConfig();
    const { order, secret } = await createOrder(config);

    const moleSwapOrder = await TonAdapter.createTonToEvmOrderConfig(
      order
    );

    console.log("TON Create Order / SrcEscrow")
    const createOrderResult = await TonAdapter.sendCreateOrder(moleSwapOrder);
    console.log("TON Create Order / SrcEscrow Result:", createOrderResult)

    const srcEscrowAddress = await TonAdapter.calculateSrcEscrowAddress(config.tonLopAddress, moleSwapOrder.order_hash!);
    console.log("TON SrcEscrow address:", srcEscrowAddress);
    console.log("->>> Client should share order & secret with relayer at this point")
    console.log("....Let's wait for one block to mine....")
    await new Promise((resolve) => setTimeout(resolve, 10000)); // mine one block

    console.log("TON Claim Order")
    const claimOrderResult = await TonAdapter.claimOrder(moleSwapOrder.order_hash!);
    console.log("TON Claim Order Result:", claimOrderResult)

    console.log("EVM Deploy DstEscrow")
    const provider = new JsonRpcProvider(config.rpcUrl);
    const taker = new Wallet(config.takerPrivateKey, provider);
    const evmAdapter = new EvmAdapter(provider, config);
    const { blockHash, transactionHash: deployEscrowTxHash } =
      await evmAdapter.createDestinationEscrowFromOrder(
        taker,
        moleSwapOrder
      );
    console.log("EVM Deploy DstEscrow TX:", deployEscrowTxHash)

    const hashLockHex = zeroPadValue(toBeHex(moleSwapOrder.hashlock.toString()), 32);
    const { escrowAddress, blockTimestamp } = 
      await evmAdapter.getEscrowAddressFromEvent(blockHash, hashLockHex);

    console.log("EVM DstEscrow address:", escrowAddress)
    console.log("....Let's pretend that finalty of blocks where escrows were deployed occured....")
    console.log("---> Relay should share the secret with resolvers at this point")
    console.log("TON Withdraw from SrcEscrow")

    const withdrawFromSrcEscrowResult = await TonAdapter.withdrawFromSrcEscrow({
      orderHash: moleSwapOrder.order_hash!.toString(),
      secret: secret,
    });
    console.log("TON Withdraw from SrcEscrow Result:", withdrawFromSrcEscrowResult)

    console.log("EVM Withdraw from DstEscrow")
    const { transactionHash: withdrawTxHash } =
      await evmAdapter.withdrawFromDstEscrowWithOrder(
        escrowAddress,
        taker,
        moleSwapOrder,
        secret,
        BigInt(blockTimestamp.toString())
      );
    console.log("EVM Withdraw from DstEscrow Result:", withdrawTxHash)
  } catch (error) {
    console.error("Error creating TON → EVM order:", error);
    process.exit(1);
  }
}

main();
