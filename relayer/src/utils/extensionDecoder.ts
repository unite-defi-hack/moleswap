import { EscrowExtension } from '@1inch/cross-chain-sdk';

/**
 * Decode extension data and extract chain information
 */
export function decodeExtension(extensionHex: string): {
  srcChainId: number;
  dstChainId: number;
  srcEscrowAddress: string;
  dstEscrowAddress: string;
} {
  try {
    // Ensure extension has 0x prefix
    const extensionWithPrefix = extensionHex.startsWith('0x') ? extensionHex : `0x${extensionHex}`;
    
    // Decode the extension using EscrowExtension
    const decodedExtension = EscrowExtension.decode(extensionWithPrefix);
    
    return {
      srcChainId: 11155111, // Sepolia - this is hardcoded in the order creation
      dstChainId: Number(decodedExtension.dstChainId),
      srcEscrowAddress: decodedExtension.address.toString(),
      dstEscrowAddress: '', // This will be created later
    };
  } catch (error) {
    console.error('Failed to decode extension:', error);
    throw new Error(`Extension decode failed: ${error}`);
  }
}

/**
 * Extract chain information from extension data
 * Returns null if extension cannot be decoded
 */
export function extractChainInfo(extensionHex: string): {
  srcChainId: number;
  dstChainId: number;
  srcEscrowAddress: string;
  dstEscrowAddress: string;
} | null {
  try {
    return decodeExtension(extensionHex);
  } catch (error) {
    console.warn('Could not decode extension, chain info will be empty:', error);
    return null;
  }
} 