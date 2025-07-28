import { db } from './connection';
import { logger } from '../utils/logger';
import { ValidationResult } from '../types/plugins';

export interface EscrowValidationRecord {
  id?: number;
  orderHash: string;
  chain: string;
  escrowAddress: string;
  validationType: 'source' | 'destination';
  isValid: boolean;
  validationDetails?: any;
  validatedAt: Date;
  createdAt?: Date;
}

export interface EscrowValidationRequest {
  orderHash: string;
  srcEscrowAddress: string;
  dstEscrowAddress: string;
  srcChainId: string;
  dstChainId: string;
}

export interface EscrowValidationResponse {
  srcEscrow: ValidationResult;
  dstEscrow: ValidationResult;
  allValid: boolean;
}

function replacerBigIntToString(_key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * Store escrow validation result
 */
export async function storeEscrowValidation(validation: EscrowValidationRecord): Promise<boolean> {
  try {
    await db('escrow_validations').insert({
      order_hash: validation.orderHash,
      chain: validation.chain,
      escrow_address: validation.escrowAddress,
      validation_type: validation.validationType,
      is_valid: validation.isValid,
      validation_details: validation.validationDetails ? JSON.stringify(validation.validationDetails, replacerBigIntToString) : null,
      validated_at: validation.validatedAt,
      created_at: validation.createdAt || new Date()
    });
    
    logger.info('Escrow validation stored', {
      orderHash: validation.orderHash,
      chain: validation.chain,
      escrowAddress: validation.escrowAddress,
      validationType: validation.validationType,
      isValid: validation.isValid
    });
    
    return true;
  } catch (error) {
    logger.error('Error storing escrow validation:', error);
    return false;
  }
}

/**
 * Get escrow validation records for an order
 */
export async function getEscrowValidations(orderHash: string): Promise<EscrowValidationRecord[]> {
  try {
    const records = await db('escrow_validations')
      .where({ order_hash: orderHash })
      .orderBy('created_at', 'desc');
    
    return records.map(record => ({
      id: record.id,
      orderHash: record.order_hash,
      chain: record.chain,
      escrowAddress: record.escrow_address,
      validationType: record.validation_type as 'source' | 'destination',
      isValid: record.is_valid,
      validationDetails: record.validation_details ? JSON.parse(record.validation_details) : undefined,
      validatedAt: new Date(record.validated_at),
      createdAt: new Date(record.created_at)
    }));
  } catch (error) {
    logger.error('Error retrieving escrow validations:', error);
    return [];
  }
}

/**
 * Check if escrow validation exists for an order
 */
export async function hasEscrowValidation(orderHash: string): Promise<boolean> {
  try {
    const count = await db('escrow_validations')
      .where({ order_hash: orderHash })
      .count('* as total')
      .first();
    
    return count ? Number(count['total']) > 0 : false;
  } catch (error) {
    logger.error('Error checking escrow validation existence:', error);
    return false;
  }
}

/**
 * Get latest escrow validation for specific escrow
 */
export async function getLatestEscrowValidation(
  orderHash: string, 
  escrowAddress: string, 
  validationType: 'source' | 'destination'
): Promise<EscrowValidationRecord | null> {
  try {
    const record = await db('escrow_validations')
      .where({
        order_hash: orderHash,
        escrow_address: escrowAddress,
        validation_type: validationType
      })
      .orderBy('created_at', 'desc')
      .first();
    
    if (!record) {
      return null;
    }
    
    return {
      id: record.id,
      orderHash: record.order_hash,
      chain: record.chain,
      escrowAddress: record.escrow_address,
      validationType: record.validation_type as 'source' | 'destination',
      isValid: record.is_valid,
      validationDetails: record.validation_details ? JSON.parse(record.validation_details) : undefined,
      validatedAt: new Date(record.validated_at),
      createdAt: new Date(record.created_at)
    };
  } catch (error) {
    logger.error('Error retrieving latest escrow validation:', error);
    return null;
  }
}

/**
 * Delete escrow validations for an order (useful for testing)
 */
export async function deleteEscrowValidations(orderHash: string): Promise<boolean> {
  try {
    const result = await db('escrow_validations')
      .where({ order_hash: orderHash })
      .del();
    
    logger.info('Deleted escrow validations', { orderHash, deletedCount: result });
    return true;
  } catch (error) {
    logger.error('Error deleting escrow validations:', error);
    return false;
  }
} 