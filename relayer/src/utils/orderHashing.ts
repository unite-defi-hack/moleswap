import { ethers } from 'ethers';
import { Order, EIP712Domain, EIP712Types, OrderHashResult } from '../types/orders';

/**
 * EIP-712 domain configuration for order signing
 */
export const ORDER_DOMAIN: EIP712Domain = {
  name: 'MoleSwap Relayer',
  version: '1.0.0',
  chainId: 1, // Default to Ethereum mainnet, can be overridden
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
    { name: 'receiver', type: 'address' }
  ]
};

/**
 * Generate EIP-712 order hash
 * @param order - The order to hash
 * @param domain - Optional domain override
 * @returns Order hash and domain information
 */
export function generateOrderHash(
  order: Order, 
  domain?: Partial<EIP712Domain>
): OrderHashResult {
  const orderDomain = { ...ORDER_DOMAIN, ...domain };
  
  // Generate the hash
  const orderHash = ethers.TypedDataEncoder.hash(orderDomain, ORDER_TYPES, order);
  
  return {
    orderHash,
    domain: orderDomain,
    types: ORDER_TYPES
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
    const orderDomain = { ...ORDER_DOMAIN, ...domain };
    
    // Recover the signer from the signature
    const recoveredSigner = ethers.verifyTypedData(
      orderDomain,
      ORDER_TYPES,
      order,
      signature
    );
    
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
  receiver: string,
  domain?: Partial<EIP712Domain>
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
  
  return generateOrderHash(order, domain);
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
export function validateOrderForHashing(order: Order): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!order.maker) errors.push('Maker address is required');
  if (!order.makerAsset) errors.push('Maker asset is required');
  if (!order.takerAsset) errors.push('Taker asset is required');
  if (!order.makerTraits) errors.push('Maker traits (hashlock) is required');
  if (!order.salt) errors.push('Salt is required');
  if (!order.makingAmount) errors.push('Making amount is required');
  if (!order.takingAmount) errors.push('Taking amount is required');
  if (!order.receiver) errors.push('Receiver is required');
  
  // Validate address formats
  if (order.maker && !ethers.isAddress(order.maker)) {
    errors.push('Invalid maker address format');
  }
  if (order.makerAsset && !ethers.isAddress(order.makerAsset)) {
    errors.push('Invalid maker asset address format');
  }
  if (order.takerAsset && !ethers.isAddress(order.takerAsset)) {
    errors.push('Invalid taker asset address format');
  }
  if (order.receiver && !ethers.isAddress(order.receiver)) {
    errors.push('Invalid receiver address format');
  }
  
  // Validate hex strings
  if (order.makerTraits && !ethers.isHexString(order.makerTraits, 32)) {
    errors.push('Maker traits must be a valid 32-byte hex string');
  }
  
  // Validate amounts
  try {
    if (order.makingAmount) {
      const makingAmount = ethers.getBigInt(order.makingAmount);
      if (makingAmount === 0n) {
        errors.push('Making amount cannot be zero');
      }
    }
    if (order.takingAmount) {
      const takingAmount = ethers.getBigInt(order.takingAmount);
      if (takingAmount === 0n) {
        errors.push('Taking amount cannot be zero');
      }
    }
  } catch (error) {
    errors.push('Invalid amount format');
  }
  
  // Validate salt
  try {
    if (order.salt) {
      const salt = ethers.getBigInt(order.salt);
      if (salt === 0n) {
        errors.push('Salt cannot be zero');
      }
    }
  } catch (error) {
    errors.push('Invalid salt format');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  } as { valid: boolean; errors?: string[] };
} 