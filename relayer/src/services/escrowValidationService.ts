import { logger } from '../utils/logger';
import { PluginRegistry } from '../types/plugins';
import { 
  storeEscrowValidation, 
  getLatestEscrowValidation,
  EscrowValidationRecord,
  EscrowValidationRequest,
  EscrowValidationResponse
} from '../database/escrowValidationService';
import { getOrderByHash } from '../database/orderService';

export class EscrowValidationService {
  private pluginRegistry: PluginRegistry;

  constructor(pluginRegistry: PluginRegistry) {
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Validate both source and destination escrows for an order
   */
  async validateEscrows(request: EscrowValidationRequest): Promise<EscrowValidationResponse> {
    const { orderHash, srcEscrowAddress, dstEscrowAddress, srcChainId, dstChainId } = request;
    
    logger.info('Starting escrow validation', {
      orderHash,
      srcEscrowAddress,
      dstEscrowAddress,
      srcChainId,
      dstChainId
    });

    // Get order data for validation
    const order = await getOrderByHash(orderHash);
    if (!order) {
      throw new Error(`Order not found: ${orderHash}`);
    }

    const orderData = JSON.parse(order.order_data);
    
    // Validate source escrow
    const srcValidation = await this.validateSingleEscrow(
      orderHash,
      srcEscrowAddress,
      srcChainId,
      'source',
      orderData
    );

    // Validate destination escrow
    const dstValidation = await this.validateSingleEscrow(
      orderHash,
      dstEscrowAddress,
      dstChainId,
      'destination',
      orderData
    );

    const allValid = srcValidation.valid && dstValidation.valid;

    logger.info('Escrow validation completed', {
      orderHash,
      srcValid: srcValidation.valid,
      dstValid: dstValidation.valid,
      allValid
    });

    return {
      srcEscrow: srcValidation,
      dstEscrow: dstValidation,
      allValid
    };
  }

  /**
   * Validate a single escrow
   */
  private async validateSingleEscrow(
    orderHash: string,
    escrowAddress: string,
    chainId: string,
    validationType: 'source' | 'destination',
    orderData: any
  ): Promise<any> {
    // Get plugin for the chain
    const plugin = this.pluginRegistry.getPlugin(chainId);
    if (!plugin) {
      logger.error(`Plugin not found for chain: ${chainId}`);
      return {
        valid: false,
        error: `Chain ${chainId} is not supported`,
        chainId,
        escrowAddress,
        details: {
          validationType,
          error: 'Chain not supported'
        }
      };
    }

    try {
      // Perform escrow validation using plugin
      const validationResult = await plugin.validateEscrow(escrowAddress, orderData);
      
      // Store validation result in database
      const validationRecord: EscrowValidationRecord = {
        orderHash,
        chain: chainId,
        escrowAddress,
        validationType,
        isValid: validationResult.valid,
        validationDetails: validationResult,
        validatedAt: new Date()
      };

      await storeEscrowValidation(validationRecord);

      return validationResult;
    } catch (error) {
      logger.error(`Escrow validation failed for ${validationType} escrow:`, error);
      
      // Store failed validation
      const validationRecord: EscrowValidationRecord = {
        orderHash,
        chain: chainId,
        escrowAddress,
        validationType,
        isValid: false,
        validationDetails: {
          error: error instanceof Error ? error.message : 'Unknown error',
          validationType
        },
        validatedAt: new Date()
      };

      await storeEscrowValidation(validationRecord);

      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        chainId,
        escrowAddress,
        details: {
          validationType,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check if escrows are already validated for an order
   */
  async checkExistingValidations(
    orderHash: string,
    srcEscrowAddress: string,
    dstEscrowAddress: string
  ): Promise<EscrowValidationResponse | null> {
    const srcValidation = await getLatestEscrowValidation(orderHash, srcEscrowAddress, 'source');
    const dstValidation = await getLatestEscrowValidation(orderHash, dstEscrowAddress, 'destination');

    // If both validations exist and are recent (within last 5 minutes), return them
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (srcValidation && dstValidation && 
        srcValidation.validatedAt > fiveMinutesAgo && 
        dstValidation.validatedAt > fiveMinutesAgo) {
      
      const srcResult = {
        valid: srcValidation.isValid,
        chainId: srcValidation.chain,
        escrowAddress: srcValidation.escrowAddress,
        details: srcValidation.validationDetails
      };

      const dstResult = {
        valid: dstValidation.isValid,
        chainId: dstValidation.chain,
        escrowAddress: dstValidation.escrowAddress,
        details: dstValidation.validationDetails
      };

      return {
        srcEscrow: srcResult,
        dstEscrow: dstResult,
        allValid: srcValidation.isValid && dstValidation.isValid
      };
    }

    return null;
  }

  /**
   * Get validation history for an order
   */
  async getValidationHistory(_orderHash: string): Promise<EscrowValidationRecord[]> {
    // This would use the getEscrowValidations function from the database service
    // For now, return empty array as the function is not yet implemented in the database service
    return [];
  }
} 