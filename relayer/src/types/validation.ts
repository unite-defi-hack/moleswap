import Joi from 'joi';
import { OrderStatus, OrderValidationSchemas, OrderConstants } from './orders';
import { verifySecretHashlock } from '../utils/secretGeneration';

/**
 * Joi validation schemas for order-related requests
 */

// Base order schema
export const orderSchema = Joi.object({
  maker: Joi.string()
    .pattern(OrderValidationSchemas.maker)
    .required()
    .messages({
      'string.pattern.base': 'Maker must be a valid Ethereum address',
      'any.required': 'Maker address is required'
    }),
  makerAsset: Joi.string()
    .pattern(OrderValidationSchemas.asset)
    .required()
    .messages({
      'string.pattern.base': 'Maker asset must be a valid Ethereum address',
      'any.required': 'Maker asset is required'
    }),
  takerAsset: Joi.string()
    .pattern(OrderValidationSchemas.asset)
    .required()
    .messages({
      'string.pattern.base': 'Taker asset must be a valid Ethereum address',
      'any.required': 'Taker asset is required'
    }),
  makerTraits: Joi.string()
    .pattern(OrderValidationSchemas.hashlock)
    .required()
    .messages({
      'string.pattern.base': 'Maker traits must be a valid 32-byte hex string',
      'any.required': 'Maker traits (hashlock) is required'
    }),
  salt: Joi.string()
    .pattern(OrderValidationSchemas.salt)
    .min(1)
    .max(78) // Max length for BigNumber string representation
    .required()
    .messages({
      'string.pattern.base': 'Salt must be a valid number string',
      'string.min': 'Salt must be at least 1 character',
      'string.max': 'Salt exceeds maximum length',
      'any.required': 'Salt is required'
    }),
  makingAmount: Joi.string()
    .pattern(OrderValidationSchemas.amount)
    .min(1)
    .max(78)
    .required()
    .messages({
      'string.pattern.base': 'Making amount must be a valid number string',
      'string.min': 'Making amount must be at least 1',
      'string.max': 'Making amount exceeds maximum length',
      'any.required': 'Making amount is required'
    }),
  takingAmount: Joi.string()
    .pattern(OrderValidationSchemas.amount)
    .min(1)
    .max(78)
    .required()
    .messages({
      'string.pattern.base': 'Taking amount must be a valid number string',
      'string.min': 'Taking amount must be at least 1',
      'string.max': 'Taking amount exceeds maximum length',
      'any.required': 'Taking amount is required'
    }),
  receiver: Joi.string()
    .custom((value, helpers) => {
      // Check if it's empty or the zero address
      if (!value || value === '0x0000000000000000000000000000000000000000') {
        return helpers.error('any.invalid');
      }
      
      // Allow any non-empty, non-zero address format
      return value;
    })
    .default(OrderConstants.DEFAULT_RECEIVER)
    .messages({
      'any.invalid': 'Receiver must be a valid non-zero address'
    })
});



// Signed order schema (for /api/orders endpoint)
export const signedOrderSchema = Joi.object({
  order: orderSchema.required().messages({
    'any.required': 'Order is required'
  }),
  signature: Joi.string()
    .pattern(OrderValidationSchemas.signature)
    .required()
    .messages({
      'string.pattern.base': 'Signature must be a valid 65-byte hex string',
      'any.required': 'Signature is required'
    })
});

// Order creation request schema
export const orderCreationRequestSchema = Joi.object({
  signedOrder: signedOrderSchema.required().messages({
    'any.required': 'Signed order is required'
  })
});

// Complete order schema (for orders with extension, secret, and secretHash)
export const completeOrderSchema = Joi.object({
  order: orderSchema.required().messages({
    'any.required': 'Order is required'
  }),
  extension: Joi.string()
    .required()
    .messages({
      'any.required': 'Extension data is required'
    }),
  signature: Joi.string()
    .pattern(OrderValidationSchemas.signature)
    .required()
    .messages({
      'string.pattern.base': 'Signature must be a valid 65-byte hex string',
      'any.required': 'Signature is required'
    }),
  secret: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .required()
    .messages({
      'string.pattern.base': 'Secret must be a valid 32-byte hex string',
      'any.required': 'Secret is required'
    }),
  secretHash: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .required()
    .messages({
      'string.pattern.base': 'Secret hash must be a valid 32-byte hex string',
      'any.required': 'Secret hash is required'
    })
});

// Complete order creation request schema
export const completeOrderCreationRequestSchema = Joi.object({
  completeOrder: completeOrderSchema.required().messages({
    'any.required': 'Complete order is required'
  })
});

// Order query filters schema
export const orderQueryFiltersSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(OrderStatus))
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, active, completed, cancelled'
    }),
  maker: Joi.string()
    .pattern(OrderValidationSchemas.maker)
    .optional()
    .messages({
      'string.pattern.base': 'Maker must be a valid Ethereum address'
    }),
  makerAsset: Joi.string()
    .pattern(OrderValidationSchemas.asset)
    .optional()
    .messages({
      'string.pattern.base': 'Maker asset must be a valid Ethereum address'
    }),
  takerAsset: Joi.string()
    .pattern(OrderValidationSchemas.asset)
    .optional()
    .messages({
      'string.pattern.base': 'Taker asset must be a valid Ethereum address'
    }),
  srcChainId: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Source chain ID must be a number',
      'number.integer': 'Source chain ID must be an integer',
      'number.min': 'Source chain ID must be at least 1'
    }),
  dstChainId: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Destination chain ID must be a number',
      'number.integer': 'Destination chain ID must be an integer',
      'number.min': 'Destination chain ID must be at least 1'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional()
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset cannot be negative'
    })
});

// Secret request schema (for /api/secrets/:orderHash endpoint)
export const secretRequestSchema = Joi.object({
  srcEscrowAddress: Joi.string()
    .pattern(OrderValidationSchemas.maker)
    .required()
    .messages({
      'string.pattern.base': 'Source escrow address must be a valid Ethereum address',
      'any.required': 'Source escrow address is required'
    }),
  dstEscrowAddress: Joi.string()
    .pattern(OrderValidationSchemas.maker)
    .required()
    .messages({
      'string.pattern.base': 'Destination escrow address must be a valid Ethereum address',
      'any.required': 'Destination escrow address is required'
    }),
  srcChainId: Joi.string()
    .required()
    .messages({
      'any.required': 'Source chain ID is required'
    }),
  dstChainId: Joi.string()
    .required()
    .messages({
      'any.required': 'Destination chain ID is required'
    })
});

// Order hash parameter schema
export const orderHashParamSchema = Joi.object({
  orderHash: Joi.string()
    .pattern(OrderValidationSchemas.hashlock)
    .required()
    .messages({
      'string.pattern.base': 'Order hash must be a valid 32-byte hex string',
      'any.required': 'Order hash is required'
    })
});

// Order status update schema
export const orderStatusUpdateSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(OrderStatus))
    .required()
    .messages({
      'any.only': 'Status must be one of: pending, active, completed, cancelled',
      'any.required': 'Status is required'
    }),
  reason: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Reason cannot exceed 500 characters'
    })
});

/**
 * Custom validation functions
 */

// Validate that amounts are positive and within bounds
export const validateAmounts = (makingAmount: string, takingAmount: string) => {
  const errors: string[] = [];
  
  try {
    const makingBN = BigInt(makingAmount);
    const takingBN = BigInt(takingAmount);
    const maxBN = BigInt(OrderConstants.MAX_MAKING_AMOUNT);
    
    if (makingBN <= 0n) {
      errors.push('Making amount must be greater than zero');
    }
    
    if (takingBN <= 0n) {
      errors.push('Taking amount must be greater than zero');
    }
    
    if (makingBN > maxBN) {
      errors.push('Making amount exceeds maximum allowed value');
    }
    
    if (takingBN > maxBN) {
      errors.push('Taking amount exceeds maximum allowed value');
    }
    
    if (makingBN === takingBN) {
      errors.push('Making and taking amounts cannot be equal');
    }
    
  } catch (error) {
    errors.push('Invalid amount format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Validate that addresses are different
export const validateAddresses = (order: any) => {
  const errors: string[] = [];
  
  if (order.makerAsset === order.takerAsset) {
    errors.push('Maker and taker assets cannot be the same');
  }
  
  if (order.maker === order.receiver && order.receiver !== OrderConstants.DEFAULT_RECEIVER) {
    errors.push('Maker and receiver cannot be the same address');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Validate salt uniqueness
export const validateSalt = (salt: string) => {
  const errors: string[] = [];
  
  try {
    const saltBN = BigInt(salt);
    const minSalt = BigInt(OrderConstants.MIN_SALT);
    const maxSalt = BigInt(OrderConstants.MAX_SALT);
    
    if (saltBN < minSalt) {
      errors.push('Salt must be at least 1');
    }
    
    if (saltBN > maxSalt) {
      errors.push('Salt exceeds maximum allowed value');
    }
    
  } catch (error) {
    errors.push('Invalid salt format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validation helper functions
 */



export const validateSignedOrder = (data: any) => {
  const { error, value } = orderCreationRequestSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message),
      value: undefined
    };
  }
  
  // Additional custom validations
  const amountValidation = validateAmounts(
    value.signedOrder.order.makingAmount,
    value.signedOrder.order.takingAmount
  );
  
  const addressValidation = validateAddresses(value.signedOrder.order);
  const saltValidation = validateSalt(value.signedOrder.order.salt);
  
  const allErrors = [
    ...(amountValidation.errors || []),
    ...(addressValidation.errors || []),
    ...(saltValidation.errors || [])
  ];
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    value: allErrors.length === 0 ? value : undefined
  };
};

export const validateOrderQuery = (query: any) => {
  const { error, value } = orderQueryFiltersSchema.validate(query, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message),
      value: undefined
    };
  }
  
  return {
    valid: true,
    errors: [],
    value
  };
};

export const validateSecretRequest = (data: any) => {
  const { error, value } = secretRequestSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message),
      value: undefined
    };
  }
  
  // Additional validation: escrow addresses should be different
  if (value.srcEscrowAddress === value.dstEscrowAddress) {
    return {
      valid: false,
      errors: ['Source and destination escrow addresses cannot be the same'],
      value: undefined
    };
  }
  
  return {
    valid: true,
    errors: [],
    value
  };
};

export const validateOrderHash = (orderHash: string) => {
  const { error } = orderHashParamSchema.validate({ orderHash });
  
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message)
    };
  }
  
  return {
    valid: true,
    errors: []
  };
};

export const validateOrderStatusUpdate = (data: any) => {
  const { error, value } = orderStatusUpdateSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message),
      value: undefined
    };
  }
  
  return {
    valid: true,
    errors: [],
    value
  };
};

export const validateCompleteOrder = (data: any) => {
  const { error, value } = completeOrderCreationRequestSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message),
      value: undefined
    };
  }
  
  // Additional custom validations
  const amountValidation = validateAmounts(
    value.completeOrder.order.makingAmount,
    value.completeOrder.order.takingAmount
  );
  
  const addressValidation = validateAddresses(value.completeOrder.order);
  const saltValidation = validateSalt(value.completeOrder.order.salt);
  
  // Validate that secretHash matches the makerTraits (hashlock)
  const secretHashValidation = {
    valid: value.completeOrder.secretHash === value.completeOrder.order.makerTraits,
    errors: value.completeOrder.secretHash !== value.completeOrder.order.makerTraits 
      ? ['Secret hash must match the makerTraits (hashlock)'] 
      : []
  };

  // Validate that secret corresponds to secretHash
  const secretValidation = verifySecretHashlock(value.completeOrder.secret, value.completeOrder.secretHash);
  const secretValidationErrors = !secretValidation.valid 
    ? [`Secret validation failed: ${secretValidation.error}`] 
    : [];
  
  const allErrors = [
    ...(amountValidation.errors || []),
    ...(addressValidation.errors || []),
    ...(saltValidation.errors || []),
    ...(secretHashValidation.errors || []),
    ...(secretValidationErrors || [])
  ];
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    value: allErrors.length === 0 ? value : undefined
  };
}; 