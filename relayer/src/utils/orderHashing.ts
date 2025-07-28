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
  chainId: 1, // Default to Ethereum mainnet, can be overridden
  verifyingContract: '0x0000000000000000000000000000000000000000' // Placeholder, should be set to actual contract
};

/**
 * EIP-712 types for order signing
 */
export const ORDER_TYPES: EIP712Types = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'srcAssetAddress', type: 'address' },
    { name: 'dstAssetAddress', type: 'address' },
    { name: 'makerTraits', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'srcAmount', type: 'uint256' },
    { name: 'dstAmount', type: 'uint256' },
    { name: 'receiver', type: 'address' }
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
    chainId: 1, // Default chain ID, can be overridden
    verifyingContract: '0x0000000000000000000000000000000000000000' // Placeholder
  };

  // Create EIP-712 types
  const types: EIP712Types = {
    Order: [
      { name: 'maker', type: 'address' },
      { name: 'srcAssetAddress', type: 'address' },
      { name: 'dstAssetAddress', type: 'address' },
      { name: 'makerTraits', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'srcAmount', type: 'uint256' },
      { name: 'dstAmount', type: 'uint256' },
      { name: 'receiver', type: 'address' }
    ]
  };

  // Create the message to sign
  const message = {
    maker: order.maker,
    srcAssetAddress: order.srcAssetAddress,
    dstAssetAddress: order.dstAssetAddress,
    makerTraits: order.makerTraits,
    salt: order.salt,
    srcAmount: order.srcAmount,
    dstAmount: order.dstAmount,
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
 * @param srcAssetAddress - Source asset address
 * @param dstAssetAddress - Destination asset address
 * @param makerTraits - Hashlock (secret hash)
 * @param salt - Order salt
 * @param srcAmount - Source amount
 * @param dstAmount - Destination amount
 * @param receiver - Receiver address
 * @param domain - Optional domain override
 * @returns Order hash result
 */
export function createOrderHashFromComponents(
  maker: string,
  srcAssetAddress: string,
  dstAssetAddress: string,
  makerTraits: string,
  salt: string,
  srcAmount: string,
  dstAmount: string,
  receiver: string
): OrderHashResult {
  const order: Order = {
    maker,
    srcAssetAddress,
    dstAssetAddress,
    makerTraits,
    salt,
    srcAmount,
    dstAmount,
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
  Source Asset: ${order.srcAssetAddress}
  Destination Asset: ${order.dstAssetAddress}
  Maker Traits: ${order.makerTraits}
  Salt: ${order.salt}
  Source Amount: ${order.srcAmount}
  Destination Amount: ${order.dstAmount}
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
  if (!order.srcAssetAddress) errors.push('Source asset address is required');
  if (!order.dstAssetAddress) errors.push('Destination asset address is required');
  if (!order.makerTraits) errors.push('Maker traits (hashlock) is required');
  if (!order.salt) errors.push('Salt is required');
  if (!order.srcAmount) errors.push('Source amount is required');
  if (!order.dstAmount) errors.push('Destination amount is required');
  if (!order.receiver) errors.push('Receiver is required');

  // Address validation
  if (order.maker && !ethers.isAddress(order.maker)) {
    errors.push('Maker must be a valid Ethereum address');
  }
  if (order.srcAssetAddress && !ethers.isAddress(order.srcAssetAddress)) {
    errors.push('Source asset address must be a valid Ethereum address');
  }
  if (order.dstAssetAddress && !ethers.isAddress(order.dstAssetAddress)) {
    errors.push('Destination asset address must be a valid Ethereum address');
  }
  if (order.receiver && !ethers.isAddress(order.receiver)) {
    errors.push('Receiver must be a valid Ethereum address');
  }

  // Amount validation
  try {
    if (order.srcAmount) {
      const srcAmount = ethers.getBigInt(order.srcAmount);
      if (srcAmount <= 0n) {
        errors.push('Source amount must be greater than 0');
      }
    }
    if (order.dstAmount) {
      const dstAmount = ethers.getBigInt(order.dstAmount);
      if (dstAmount <= 0n) {
        errors.push('Destination amount must be greater than 0');
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