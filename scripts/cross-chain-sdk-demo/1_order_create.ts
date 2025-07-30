
import 'dotenv/config'
import {randomBytes} from 'crypto'
import {Wallet} from 'ethers'

import {
    Address,
    HashLock,
    TimeLocks,
    EvmCrossChainOrder,
    AuctionDetails,
    randBigInt,
    EvmAddress,
    TonAddress,
} from '@1inch/cross-chain-sdk'
import {initMoleswapConfig, signOrderWithCustomLop} from './config'

const UINT_40_MAX = (1n << 40n) - 1n

const safeBigInt = (val: string, fallback = 0n): bigint => {
    try {
        return val ? BigInt(val) : fallback
    } catch {
        return fallback
    }
}

// Initialize Moleswap configuration
const config = initMoleswapConfig()

const maker    = new Wallet(config.makerPrivateKey)

async function main() {
    console.log('SRC_CHAIN_ID', config.sourceChainId)
    console.log('DST_CHAIN_ID', config.destinationChainId)

    // ----------------------------------------------------------------------------
    // 1. Secret & Hash-lock
    // ----------------------------------------------------------------------------
    const secretBytes = randomBytes(32)
    const secret      = '0x' + Buffer.from(secretBytes).toString('hex')
    const hashLock    = HashLock.forSingleFill(secret)
    const secretHash  = hashLock.toString()

    // ----------------------------------------------------------------------------
    // 2. Time-locks & Safety deposits (very short demo values) -------------------
    // ----------------------------------------------------------------------------
    const timeLocks = TimeLocks.new({
        srcWithdrawal:       10n,
        srcPublicWithdrawal: 12000n,
        srcCancellation:     18000n,
        srcPublicCancellation:24000n,
        dstWithdrawal:       10n,
        dstPublicWithdrawal: 120n,
        dstCancellation:     180n
    })

    const SRC_SAFETY_DEPOSIT = safeBigInt("1000000000000")
    const DST_SAFETY_DEPOSIT = safeBigInt("1000000000000")

    // ----------------------------------------------------------------------------
    // 3. Auction parameters (no auction - fixed price) --------------------------
    // ----------------------------------------------------------------------------
    const auctionDetails = AuctionDetails.noAuction()

    // ----------------------------------------------------------------------------
    // 4. Build Cross-Chain Order --------------------------------------------------
    // ----------------------------------------------------------------------------
    const MAKING_AMOUNT  = safeBigInt("881220000000000") // 0.00088122 ETH, ~3.31$
    const TAKING_AMOUNT  = safeBigInt("1000000000") // 1 TON

    const nonce = randBigInt(UINT_40_MAX)

    const order = EvmCrossChainOrder.new(
        new EvmAddress(new Address(config.escrowFactoryAddress)),
        {
            makerAsset:   new EvmAddress(new Address(config.tokenA)),
            takerAsset:   TonAddress.NATIVE,
            makingAmount: MAKING_AMOUNT,
            takingAmount: TAKING_AMOUNT,
            maker:        new EvmAddress(new Address(maker.address)),
            receiver: new TonAddress("UQCVzWSLLWSRcex7lHcMnfnk3j4cCVHrNlVGQQSzE9L6FU13"),
        },
        {
            hashLock,
            srcChainId: config.sourceChainId as unknown as any,
            dstChainId: config.destinationChainId as unknown as any,
            srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
            dstSafetyDeposit: DST_SAFETY_DEPOSIT,
            timeLocks
        },
        {
            auction: auctionDetails,
            whitelist: [
                { address: new EvmAddress(new Address(config.resolverProxyAddress)), allowFrom: 0n },
            ]
        },
        {
            allowPartialFills: false,
            allowMultipleFills: false,
            nonce: nonce
        }
    )

    // ----------------------------------------------------------------------------
    // 5. Sign the order (EIP-712) -------------------------------------------------
    // ----------------------------------------------------------------------------
    // Use abstracted signing function that handles domain consistency
    const signature = await signOrderWithCustomLop(order, maker, config)

    const output = {
        order: order.build(),
        extension: order.extension.encode(),
        signature,
        secret,
        secretHash
    }

    console.log('\n–––––––– Generated Cross-Chain Order ––––––––')
    console.log(JSON.stringify(output, null, 2))
}

main().catch(console.error)