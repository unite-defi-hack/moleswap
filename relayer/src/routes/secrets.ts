import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { 
  ApiResponse, 
  SecretRequestResponse, 
  OrderErrorCode,
  OrderStatus
} from '../types/orders';
import { 
  validateOrderForSecretSharing, 
  getOrderSecret,
  updateOrderStatus
} from '../database/orderService';

import { EscrowValidationService } from '../services/escrowValidationService';
import { validateSecretRequest } from '../types/validation';
import { decryptSecret, getEncryptionKey } from '../utils/secretGeneration';

const router = Router();

// POST /api/secrets/:orderHash - Request secret
router.post('/:orderHash', async (req: Request, res: Response) => {
  try {
    const { orderHash } = req.params;
    const requestData = req.body;
    
    logger.info('Requesting secret for order', { 
      orderHash, 
      requestData: {
        srcEscrowAddress: requestData.srcEscrowAddress,
        dstEscrowAddress: requestData.dstEscrowAddress,
        srcChainId: requestData.srcChainId,
        dstChainId: requestData.dstChainId
      }
    });
    
    // Validate order hash format
    if (!orderHash || !orderHash.startsWith('0x') || orderHash.length !== 66) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: 'Invalid order hash format',
          details: { orderHash }
        }
      };
      return res.status(400).json(response);
    }
    
    // Validate request body
    const validation = validateSecretRequest(requestData);
    if (!validation.valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: 'Invalid request data',
          details: { errors: validation.errors }
        }
      };
      return res.status(400).json(response);
    }
    
    const { srcEscrowAddress, dstEscrowAddress, srcChainId, dstChainId } = validation.value!;
    
    // Validate order for secret sharing
    const orderValidation = await validateOrderForSecretSharing(orderHash);
    if (!orderValidation.valid) {
      logger.error('Order validation failed', { 
        orderHash, 
        error: orderValidation.error,
        order: orderValidation.order 
      });
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: orderValidation.error || 'Order validation failed',
          details: { orderHash }
        }
      };
      return res.status(400).json(response);
    }
    
    // Get plugin registry from app
    const pluginRegistry = req.app.get('pluginRegistry');
    if (!pluginRegistry) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.ESCROW_VALIDATION_FAILED,
          message: 'Plugin system not available',
          details: { orderHash }
        }
      };
      return res.status(500).json(response);
    }
    
    // Initialize escrow validation service
    const escrowValidationService = new EscrowValidationService(pluginRegistry);
    
    // Check for existing validations first
    const existingValidations = await escrowValidationService.checkExistingValidations(
      orderHash,
      srcEscrowAddress,
      dstEscrowAddress
    );
    
    let validationResult;
    if (existingValidations) {
      logger.info('Using existing escrow validations', { orderHash });
      validationResult = existingValidations;
    } else {
      // Perform escrow validation
      logger.info('Performing new escrow validation', { orderHash });
      validationResult = await escrowValidationService.validateEscrows({
        orderHash,
        srcEscrowAddress,
        dstEscrowAddress,
        srcChainId,
        dstChainId
      });
    }
    
    // Check if validation passed
    if (!validationResult.allValid) {
      // Return error response with validation result
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.ESCROW_VALIDATION_FAILED,
          message: 'Escrow validation failed',
          details: { 
            orderHash,
            validationResult: {
              srcEscrow: {
                ...validationResult.srcEscrow,
                balance: validationResult.srcEscrow.balance?.toString()
              },
              dstEscrow: {
                ...validationResult.dstEscrow,
                balance: validationResult.dstEscrow.balance?.toString()
              }
            }
          }
        }
      };
      return res.status(400).json(response);
    }
    
    // Get the stored secret for this order
    const storedSecret = await getOrderSecret(orderHash);
    if (!storedSecret) {
      logger.error('No secret found for order', { orderHash });
      
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: 'No secret found for this order',
          details: { orderHash }
        }
      };
      return res.status(500).json(response);
    }

    // Try to decrypt the secret if it's encrypted, otherwise use it as-is
    let secret: string;
    try {
      // Check if the stored secret looks like it's encrypted (base64 format)
      // Base64 strings don't start with 0x and contain only A-Z, a-z, 0-9, +, /, =
      if (storedSecret.match(/^[A-Za-z0-9+/=]+$/) && !storedSecret.startsWith('0x')) {
        // Looks like base64, try to decrypt it
        const encryptionKey = getEncryptionKey();
        secret = decryptSecret(storedSecret, encryptionKey);
      } else {
        // Not encrypted, use as-is (could be hex string or other format)
        secret = storedSecret;
      }
    } catch (error) {
      logger.error('Error processing secret:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: 'Failed to process stored secret',
          details: { orderHash }
        }
      };
      return res.status(500).json(response);
    }

    // Verify the secret matches the order's secret_hash
    const order = orderValidation.order!;
    const expectedHash = ethers.keccak256(secret);
    if (expectedHash !== order.secret_hash) {
      logger.error('Stored secret does not match order secret_hash', {
        orderHash,
        orderSecretHash: order.secret_hash,
        secretHash: expectedHash
      });
      
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: 'Secret validation failed - hashlock mismatch',
          details: { orderHash }
        }
      };
      return res.status(500).json(response);
    }
    
    // Update order status to COMPLETED since secret was successfully retrieved
    try {
      await updateOrderStatus(orderHash, OrderStatus.COMPLETED, 'Secret successfully retrieved');
      logger.info('Order status updated to COMPLETED', { orderHash });
    } catch (error) {
      logger.error('Failed to update order status to COMPLETED', { 
        orderHash, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Don't fail the request if status update fails, just log it
    }
    
    // Return the secret to the requester
    const response: ApiResponse<SecretRequestResponse> = {
      success: true,
      data: {
        secret: secret,
        orderHash,
        validationResult: {
          srcEscrow: {
            ...validationResult.srcEscrow,
            balance: validationResult.srcEscrow.balance?.toString()
          },
          dstEscrow: {
            ...validationResult.dstEscrow,
            balance: validationResult.dstEscrow.balance?.toString()
          }
        },
        sharedAt: new Date()
      }
    };
    
    logger.info('Secret shared successfully', { 
      orderHash,
      srcEscrowAddress,
      dstEscrowAddress,
      secretPrefix: secret.slice(0, 10) + '...' // Log partial secret for security
    });
    
    return res.json(response);
    
  } catch (error) {
    logger.error('Error requesting secret:', error);
    throw createError('Failed to request secret', 500);
  }
});

export { router as secretRoutes }; 