/* eslint-disable no-console */
import {ethers, Wallet, JsonRpcProvider} from 'ethers'
import {
    Address,
    SupportedChains,
    TRUE_ERC20,
    EvmAddress,
    EvmCrossChainOrder
} from '@1inch/cross-chain-sdk'

export interface MoleswapConfig {
    sourceChainId: number
    destinationChainId: number
    lopAddress: string
    escrowFactoryAddress: string
    trueTokenAddress: string
    resolverProxyAddress: string
    makerPrivateKey: string
    rpcUrl: string
    tokenA: string
    tokenB: string
}

export function initMoleswapConfig(): MoleswapConfig {
    const config: MoleswapConfig = {
        sourceChainId: Number(process.env.SOURCE_NETWORK_ID!),
        destinationChainId: Number(process.env.DESTINATION_NETWORK_ID!),
        lopAddress: process.env.LOP!,
        escrowFactoryAddress: process.env.ESCROW_FACTORY!,
        trueTokenAddress: process.env.ERC20_MOCK!,
        resolverProxyAddress: process.env.RESOLVER_PROXY!,
        makerPrivateKey: process.env.MAKER_PRIV!,
        rpcUrl: process.env.RPC_URL!,
        tokenA: process.env.TOKEN_A!,
        tokenB: process.env.TOKEN_B!
    }

    validateConfig(config)

    const chainsToAdd = [config.sourceChainId, config.destinationChainId]
    chainsToAdd.forEach((chainId) => {
        if (!(SupportedChains as readonly number[]).includes(chainId)) {
            ;(SupportedChains as unknown as number[]).push(chainId)
        }
    })

    TRUE_ERC20[config.sourceChainId] = new EvmAddress(
        new Address(config.trueTokenAddress)
    )

    return config
}

export async function signOrderWithCustomLop(
    order: EvmCrossChainOrder,
    signer: Wallet,
    config: MoleswapConfig
): Promise<string> {
    const { buildOrderTypedData } = await import('@1inch/limit-order-sdk')
    
    const typedData = buildOrderTypedData(
        config.sourceChainId,
        config.lopAddress,
        "1inch Limit Order Protocol",
        "4",
        order.build()
    )

    const domainForSignature = {
        ...typedData.domain,
        chainId: config.sourceChainId,
    }

    const signature = await signer.signTypedData(
        domainForSignature,
        { Order: typedData.types.Order },
        typedData.message,
    )

    ;(order as any).getOrderHash = (_srcChainId: number) => ethers.TypedDataEncoder.hash(
        domainForSignature,
        { Order: typedData.types.Order },
        typedData.message
    )

    return signature
}

/**
 * Create a wallet with provider from config
 */
export function createWalletWithProvider(config: MoleswapConfig, rpcUrl?: string): Wallet {
    const provider = new JsonRpcProvider(rpcUrl || config.rpcUrl)
    return new Wallet(config.makerPrivateKey, provider)
}

/**
 * Validate if an address is either a valid EVM address or TON address
 */
function isValidCrossChainAddress(address: string): boolean {
    // Check if it's a valid EVM address
    if (ethers.isAddress(address)) {
        return true
    }
    
    // Check if it's a valid TON address (starts with EQ or UQ and has proper base64 format)
    if (typeof address === 'string' && (address.startsWith('EQ') || address.startsWith('UQ')) && address.length >= 48) {
        // Basic TON address format validation
        // TON addresses are base64url encoded, so we check for valid base64url characters
        const base64Pattern = /^[A-Za-z0-9_-]+$/
        return base64Pattern.test(address.slice(2)) // Remove EQ/UQ prefix
    }
    
    return false
}

function validateConfig(config: MoleswapConfig): void {
    const required = [
        'sourceChainId',
        'destinationChainId',
        'lopAddress',
        'escrowFactoryAddress',
        'trueTokenAddress',
        'resolverProxyAddress',
        'makerPrivateKey',
        'rpcUrl',
        'tokenA',
        'tokenB'
    ] as const

    const missing = required.filter((key) => !config[key])

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`
        )
    }

    if (!ethers.isAddress(config.lopAddress)) {
        throw new Error(`Invalid LOP address: ${config.lopAddress}`)
    }

    if (!ethers.isAddress(config.escrowFactoryAddress)) {
        throw new Error(
            `Invalid escrow factory address: ${config.escrowFactoryAddress}`
        )
    }

    if (!ethers.isAddress(config.trueTokenAddress)) {
        throw new Error(
            `Invalid TRUE token address: ${config.trueTokenAddress}`
        )
    }

    if (!ethers.isAddress(config.resolverProxyAddress)) {
        throw new Error(
            `Invalid resolver proxy address: ${config.resolverProxyAddress}`
        )
    }

    // Validate TOKEN_A (can be EVM or TON address)
    if (!isValidCrossChainAddress(config.tokenA)) {
        throw new Error(
            `Invalid TOKEN_A address: ${config.tokenA} (must be EVM address or TON address)`
        )
    }

    // Validate TOKEN_B (can be EVM or TON address)
    if (!isValidCrossChainAddress(config.tokenB)) {
        throw new Error(
            `Invalid TOKEN_B address: ${config.tokenB} (must be EVM address or TON address)`
        )
    }

    // Validate private key format (64 hex chars with or without 0x prefix)
    const privateKeyPattern = /^(0x)?[0-9a-fA-F]{64}$/
    if (!privateKeyPattern.test(config.makerPrivateKey)) {
        throw new Error(
            'Invalid MAKER_PRIV: must be 64 hex characters (with or without 0x prefix)'
        )
    }

    // Validate RPC URL format
    try {
        new URL(config.rpcUrl)
    } catch (error) {
        throw new Error(`Invalid RPC_URL: must be a valid URL (${config.rpcUrl})`)
    }
}