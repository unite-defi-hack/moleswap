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
import {
  OrderConfig as MoleSwapTonToEvmOrder,
} from "moleswap-ton";
import { TonAdapter } from "./lib/tonAdapter";
import { parseEther, parseUnits } from "ethers";

const UINT_40_MAX = (1n << 40n) - 1n;

const safeBigInt = (val: string, fallback = 0n): bigint => {
  try {
    return val ? BigInt(val) : fallback;
  } catch {
    return fallback;
  }
};

async function createOrder(
  config: MoleswapConfig
): Promise<{
  orderData: MoleSwapTonToEvmOrder;
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

  const tonToEvmOrderMoleSwap = await TonAdapter.createTonToEvmOrderConfig(tonOrderFusion);

  return {
    orderData: tonToEvmOrderMoleSwap,
    secret: secret,
  };
}

async function main() {
  try {
    // TON part of the order - Intent / Escrow / Withdrawal
    const config = initMoleswapConfig();
    const { orderData, secret } = await createOrder(config);

    await TonAdapter.sendCreateOrder(orderData);

    const srcEscrowAddress = await TonAdapter.calculateSrcEscrowAddress(config.tonLopAddress, orderData.order_hash!);
    console.log("Src escrow address (for debugging):", srcEscrowAddress);
    await new Promise((resolve) => setTimeout(resolve, 10000)); // mine block

    await TonAdapter.claimOrder(orderData.order_hash!);

    await new Promise((resolve) => setTimeout(resolve, 26000)); // 36sec withdrawal timeout

    await TonAdapter.withdrawFromSrcEscrow({
      orderHash: orderData.order_hash!.toString(),
      secret: secret,
    });

    // EVM part of the order - TODO
  } catch (error) {
    console.error("Error creating TON → EVM order:", error);
    process.exit(1);
  }
}

main();
