import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { 
  ApiResponse, 
  SecretRequestResponse, 
  SecretRequestParams,
  OrderErrorCode 
} from '../types/orders';
import { 
  validateOrderForSecretSharing, 
  storeOrderSecret 
} from '../database/orderService';
import { 
  generateSecretWithHashlock, 
  getEncryptionKey, 
  verifySecretHashlock 
} from '../utils/secretGeneration';

const router = Router();

// POST /api/secrets/:orderHash - Request secret
router.post('/:orderHash', async (req: Request, res: Response) => {
  try {
    const { orderHash } = req.params;
    const { requester, validationProof } = req.body as SecretRequestParams;
    
    logger.info('Requesting secret for order', { 
      orderHash, 
      requester,
      hasValidationProof: !!validationProof 
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
    
    // Validate requester address
    if (!requester || !requester.startsWith('0x') || requester.length !== 42) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_ADDRESS,
          message: 'Invalid requester address',
          details: { requester }
        }
      };
      return res.status(400).json(response);
    }
    
    // Validate order for secret sharing
    const orderValidation = await validateOrderForSecretSharing(orderHash);
    if (!orderValidation.valid) {
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
    
    // TODO: Implement escrow validation logic here
    // For now, we'll skip the validation and proceed with secret generation
    // In a real implementation, you would validate that:
    // 1. The requester has deposited funds in the source escrow
    // 2. The destination escrow is ready to receive funds
    // 3. All parameters match the order requirements
    
    // Generate new secret and hashlock
    const encryptionKey = getEncryptionKey();
    const { secret, hashlock, encryptedSecret } = generateSecretWithHashlock(encryptionKey);
    
    // Verify the generated secret matches the order's hashlock
    const order = orderValidation.order!;
    const secretValidation = verifySecretHashlock(secret, order.hashlock);
    if (!secretValidation.valid) {
      logger.error('Generated secret does not match order hashlock', {
        orderHash,
        generatedHashlock: hashlock,
        orderHashlock: order.hashlock
      });
      
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: 'Secret generation failed - hashlock mismatch',
          details: { orderHash }
        }
      };
      return res.status(500).json(response);
    }
    
    // Store the encrypted secret in the database
    const storageSuccess = await storeOrderSecret(orderHash, encryptedSecret);
    if (!storageSuccess) {
      logger.error('Failed to store secret in database', { orderHash });
      
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: OrderErrorCode.INVALID_SECRET_REQUEST,
          message: 'Failed to store secret',
          details: { orderHash }
        }
      };
      return res.status(500).json(response);
    }
    
    // Return the decrypted secret to the requester
    const response: ApiResponse<SecretRequestResponse> = {
      success: true,
      data: {
        secret,
        orderHash,
        sharedAt: new Date()
      }
    };
    
    logger.info('Secret shared successfully', { 
      orderHash,
      requester,
      secretPrefix: secret.slice(0, 10) + '...' // Log partial secret for security
    });
    
    return res.json(response);
    
  } catch (error) {
    logger.error('Error requesting secret:', error);
    throw createError('Failed to request secret', 500);
  }
});

export { router as secretRoutes }; 