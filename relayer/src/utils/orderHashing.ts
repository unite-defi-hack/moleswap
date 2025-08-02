import { ethers } from 'ethers';
import { 
  Order, 
  EIP712Domain, 
  EIP712Types, 
  OrderHashResult,
  OrderValidationResult
} from '../types/orders';

/**
 * EIP-712 domain configuration for order signing
 */
export const ORDER_DOMAIN: EIP712Domain = {
  name: 'MoleSwap Relayer',
  version: '1.0.0',
  chainId: 11155111, // Default to Sepolia testnet, can be overridden
  verifyingContract: '0x0000000000000000000000000000000000000000' // Placeholder, should be set to actual contract
};

/**
 * EIP-712 types for order signing
 */
export const ORDER_TYPES: EIP712Types = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'makerAsset', type: 'address' },
    { name: 'takerAsset', type: 'address' },
    { name: 'makerTraits', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'makingAmount', type: 'uint256' },
    { name: 'takingAmount', type: 'uint256' },
    { name: 'receiver', type: 'string' }
  ]
};

/**
 * Generate EIP-712 order hash
 * @param order - The order to hash
 * @param domain - Optional domain override
 * @returns Order hash and domain information
 */
export function generateOrderHash(order: Order): OrderHashResult {
  // Validate order before hashing
  const validation = validateOrder(order);
  if (!validation.valid) {
    throw new Error(`Invalid order: ${validation.errors?.join(', ')}`);
  }

  // Create EIP-712 domain
  const domain: EIP712Domain = {
    name: 'MoleSwap Relayer',
    version: '1.0.0',
    chainId: 11155111, // Default chain ID, can be overridden
    verifyingContract: '0x0000000000000000000000000000000000000000' // Placeholder
  };

  // Create EIP-712 types
  const types: EIP712Types = {
    Order: [
      { name: 'maker', type: 'address' },
      { name: 'makerAsset', type: 'address' },
      { name: 'takerAsset', type: 'address' },
      { name: 'makerTraits', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'makingAmount', type: 'uint256' },
      { name: 'takingAmount', type: 'uint256' },
      { name: 'receiver', type: 'string' }
    ]
  };

  // Create the message to sign
  const message = {
    maker: order.maker,
    makerAsset: order.makerAsset,
    takerAsset: order.takerAsset,
    makerTraits: order.makerTraits,
    salt: order.salt,
    makingAmount: order.makingAmount,
    takingAmount: order.takingAmount,
    receiver: order.receiver
  };

  // Generate the hash
  const orderHash = ethers.TypedDataEncoder.hash(domain, types, message);

  return {
    orderHash,
    domain,
    types
  };
}

/**
 * Verify EIP-712 signature for an order
 * @param order - The order that was signed
 * @param signature - The signature to verify
 * @param expectedSigner - Optional expected signer address
 * @param domain - Optional domain override
 * @returns Verification result
 */
export function verifyOrderSignature(
  order: Order,
  signature: string,
  expectedSigner?: string,
  domain?: Partial<EIP712Domain>
): { valid: boolean; signer?: string; error?: string } {
  try {
    // For cross-chain orders with non-Ethereum receivers, skip signature verification
    const isTonReceiver = order.receiver && !order.receiver.startsWith('0x');
    const isTonTakerAsset = order.takerAsset && !order.takerAsset.startsWith('0x');
    const isUint256MakerTraits = /^[0-9]{1,78}$/.test(order.makerTraits);

    // If SDK format (TON address or uint256 decimal for makerTraits), use SDK EIP-712 domain/types/message
    if (isTonReceiver || isTonTakerAsset || isUint256MakerTraits) {
      // SDK EIP-712 domain/types/message
      const sdkDomain = {
        name: '1inch Limit Order Protocol',
        version: '4',
        chainId: 11155111, // Sepolia
        verifyingContract: '0x991f286348580c1d2206843D5CfD7863Ff29eB15',
      };
      const sdkTypes = {
        Order: [
          { name: 'salt', type: 'uint256' },
          { name: 'maker', type: 'address' },
          { name: 'receiver', type: 'address' },
          { name: 'makerAsset', type: 'address' },
          { name: 'takerAsset', type: 'address' },
          { name: 'makingAmount', type: 'uint256' },
          { name: 'takingAmount', type: 'uint256' },
          { name: 'makerTraits', type: 'uint256' },
        ],
      };
      // Map receiver and takerAsset to EVM zero address if they are TON addresses (for signature recovery)
      const message = {
        salt: order.salt,
        maker: order.maker,
        receiver: order.receiver.startsWith('0x') ? order.receiver : '0x0000000000000000000000000000000000000000',
        makerAsset: order.makerAsset.startsWith('0x') ? order.makerAsset : '0x0000000000000000000000000000000000000000',
        takerAsset: order.takerAsset.startsWith('0x') ? order.takerAsset : '0x0000000000000000000000000000000000000000',
        makingAmount: order.makingAmount,
        takingAmount: order.takingAmount,
        makerTraits: order.makerTraits,
      };
      const { logger } = require('./logger');
      logger.info('🔍 SDK Signature verification debug:', {
        order: JSON.stringify(order, null, 2),
        domain: JSON.stringify(sdkDomain, null, 2),
        types: JSON.stringify(sdkTypes, null, 2),
        message: JSON.stringify(message, null, 2),
        expectedSigner,
        signature
      });
      const recoveredSigner = ethers.verifyTypedData(
        sdkDomain,
        sdkTypes,
        message,
        signature
      );
      logger.info('🔍 SDK Recovered signer:', { recoveredSigner });
      if (expectedSigner) {
        const expectedSignerLower = expectedSigner.toLowerCase();
        const recoveredSignerLower = recoveredSigner.toLowerCase();
        if (expectedSignerLower !== recoveredSignerLower) {
          return {
            valid: false,
            signer: recoveredSigner,
            error: `Signature verification failed. Expected: ${expectedSigner}, Got: ${recoveredSigner}`
          };
        }
      }
      return {
        valid: true,
        signer: recoveredSigner
      };
    }

    const orderDomain = { ...ORDER_DOMAIN, ...domain };
    
    // Add debug logging
    const { logger } = require('./logger');
    logger.info('🔍 Signature verification debug:', {
      order: JSON.stringify(order, null, 2),
      domain: JSON.stringify(orderDomain, null, 2),
      types: JSON.stringify(ORDER_TYPES, null, 2),
      expectedSigner,
      signature
    });
    
    // Recover the signer from the signature
    const recoveredSigner = ethers.verifyTypedData(
      orderDomain,
      ORDER_TYPES,
      order,
      signature
    );
    
    logger.info('🔍 Recovered signer:', { recoveredSigner });
    
    // If expected signer is provided, verify it matches
    if (expectedSigner) {
      const expectedSignerLower = expectedSigner.toLowerCase();
      const recoveredSignerLower = recoveredSigner.toLowerCase();
      
      if (expectedSignerLower !== recoveredSignerLower) {
        return {
          valid: false,
          signer: recoveredSigner,
          error: `Signature verification failed. Expected: ${expectedSigner}, Got: ${recoveredSigner}`
        };
      }
    }
    
    return {
      valid: true,
      signer: recoveredSigner
    };
    
  } catch (error) {
    return {
      valid: false,
      error: `Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Generate a random salt for order uniqueness
 * @returns Random salt as string
 */
export function generateRandomSalt(): string {
  // Generate a random BigInt between 1 and 2^256 - 1
  const randomBytes = ethers.randomBytes(32);
  const randomBigInt = ethers.getBigInt(ethers.hexlify(randomBytes));
  
  // Ensure it's not zero
  if (randomBigInt === 0n) {
    return generateRandomSalt();
  }
  
  return randomBigInt.toString();
}

/**
 * Validate order hash format
 * @param orderHash - The order hash to validate
 * @returns Validation result
 */
export function validateOrderHash(orderHash: string): { valid: boolean; error?: string } {
  try {
    // Check if it's a valid hex string
    if (!ethers.isHexString(orderHash, 32)) {
      return {
        valid: false,
        error: 'Order hash must be a valid 32-byte hex string'
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    return {
      valid: false,
      error: `Invalid order hash format: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Create order hash from components
 * @param maker - Maker address
 * @param makerAsset - Maker asset address
 * @param takerAsset - Taker asset address
 * @param makerTraits - Hashlock (secret hash)
 * @param salt - Order salt
 * @param makingAmount - Making amount
 * @param takingAmount - Taking amount
 * @param receiver - Receiver address
 * @param domain - Optional domain override
 * @returns Order hash result
 */
export function createOrderHashFromComponents(
  maker: string,
  makerAsset: string,
  takerAsset: string,
  makerTraits: string,
  salt: string,
  makingAmount: string,
  takingAmount: string,
  receiver: string
): OrderHashResult {
  const order: Order = {
    maker,
    makerAsset,
    takerAsset,
    makerTraits,
    salt,
    makingAmount,
    takingAmount,
    receiver
  };
  
  return generateOrderHash(order);
}

/**
 * Get domain separator for order signing
 * @param domain - Domain configuration
 * @returns Domain separator hash
 */
export function getDomainSeparator(domain: EIP712Domain): string {
  return ethers.TypedDataEncoder.hashDomain(domain);
}

/**
 * Format order for signing (human-readable)
 * @param order - The order to format
 * @returns Formatted order string
 */
export function formatOrderForSigning(order: Order): string {
  return `Order:
  Maker: ${order.maker}
  Maker Asset: ${order.makerAsset}
  Taker Asset: ${order.takerAsset}
  Maker Traits: ${order.makerTraits}
  Salt: ${order.salt}
  Making Amount: ${order.makingAmount}
  Taking Amount: ${order.takingAmount}
  Receiver: ${order.receiver}`;
}

/**
 * Validate order structure before hashing
 * @param order - The order to validate
 * @returns Validation result
 */
export function validateOrder(order: Order): OrderValidationResult {
  const errors: string[] = [];

  // Required fields validation
  if (!order.maker) errors.push('Maker is required');
  if (!order.makerAsset) errors.push('Maker asset address is required');
  if (!order.takerAsset) errors.push('Taker asset address is required');
  if (!order.makerTraits) errors.push('Maker traits (hashlock) is required');
  if (!order.salt) errors.push('Salt is required');
  if (!order.makingAmount) errors.push('Making amount is required');
  if (!order.takingAmount) errors.push('Taking amount is required');
  if (!order.receiver) errors.push('Receiver is required');

  // Address validation
  if (order.maker && !ethers.isAddress(order.maker)) {
    errors.push('Maker must be a valid Ethereum address');
  }
  if (order.makerAsset && !ethers.isAddress(order.makerAsset)) {
    errors.push('Maker asset address must be a valid Ethereum address');
  }
  if (order.takerAsset && !ethers.isAddress(order.takerAsset)) {
    errors.push('Taker asset address must be a valid Ethereum address');
  }
  // Skip receiver validation to allow cross-chain addresses (TON, etc.)
  // if (order.receiver && !ethers.isAddress(order.receiver)) {
  //   errors.push('Receiver must be a valid Ethereum address');
  // }

  // Amount validation
  try {
    if (order.makingAmount) {
      const makingAmount = ethers.getBigInt(order.makingAmount);
      if (makingAmount <= 0n) {
        errors.push('Making amount must be greater than 0');
      }
    }
    if (order.takingAmount) {
      const takingAmount = ethers.getBigInt(order.takingAmount);
      if (takingAmount <= 0n) {
        errors.push('Taking amount must be greater than 0');
      }
    }
  } catch (error) {
    errors.push('Invalid amount format');
  }

  // Salt validation
  try {
    if (order.salt) {
      ethers.getBigInt(order.salt);
    }
  } catch (error) {
    errors.push('Invalid salt format');
  }

  const result: OrderValidationResult = {
    valid: errors.length === 0
  };
  
  if (errors.length > 0) {
    result.errors = errors;
    result.details = { errors };
  }
  
  return result;
} 