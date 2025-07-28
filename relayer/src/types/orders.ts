/**
 * Order interface based on Fusion protocol format with cross-chain support
 * This represents the core order structure that will be signed
 */
export interface Order {
  maker: string;                    // Maker's address
  srcAssetAddress: string;          // Source token address (e.g., USDC on Ethereum)
  dstAssetAddress: string;          // Destination token address (e.g., USDT on TON)
  makerTraits: string;              // Hashlock (secret hash)
  salt: string;                     // Order uniqueness
  srcAmount: string;                // Amount of source token
  dstAmount: string;                // Amount of destination token
  receiver: string;                 // Receiver address (usually zero)
  
  // Cross-chain specific fields
  srcChainId?: number;              // Source chain ID
  dstChainId?: number;              // Destination chain ID
  srcEscrowAddress?: string;        // Source escrow address
  dstEscrowAddress?: string;        // Destination escrow address
}

/**
 * Order with metadata for database storage and API responses
 */
export interface OrderWithMetadata {
  order: Order;
  orderHash: string;                // EIP-712 order hash
  secret?: string;                  // Generated secret (encrypted)
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order status enumeration
 */
export enum OrderStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Signed order data structure
 */
export interface SignedOrder {
  order: Order;
  signature: string;                // EIP-712 signature
}

/**
 * Order data for API requests
 */
export interface OrderDataRequest {
  order: {
    maker: string;
    srcAssetAddress: string;
    dstAssetAddress: string;
    srcAmount: string;
    dstAmount: string;
    receiver: string;
    
    // Cross-chain specific fields
    srcChainId?: number;
    dstChainId?: number;
    srcEscrowAddress?: string;
    dstEscrowAddress?: string;
  };
}

/**
 * Order data response with hashlock
 */
export interface OrderDataResponse {
  orderToSign: Order;
  orderHash: string;
}

/**
 * Order creation request
 */
export interface OrderCreationRequest {
  signedOrder: SignedOrder;
}

/**
 * Order creation response
 */
export interface OrderCreationResponse {
  orderHash: string;
  status: OrderStatus;
  createdAt: Date;
}

/**
 * Order query filters
 */
export interface OrderQueryFilters {
  status?: OrderStatus;
  maker?: string;
  makerAsset?: string;
  takerAsset?: string;
  limit?: number;
  offset?: number;
}

/**
 * Order query response
 */
export interface OrderQueryResponse {
  orders: OrderWithMetadata[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Order database record structure
 */
export interface OrderRecord {
  id: number;
  order_hash: string;
  maker: string;
  taker: string;
  maker_token: string;
  taker_token: string;
  maker_amount: string;
  taker_amount: string;
  source_chain: string;
  destination_chain: string;
  source_escrow: string;
  destination_escrow: string;
  hashlock: string;
  secret?: string;
  status: string;
  order_data: any;
  signed_data?: any;
  created_at: Date;
  updated_at: Date;
}

/**
 * EIP-712 domain for order signing
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/**
 * EIP-712 types for order signing
 */
export interface EIP712Types {
  [key: string]: Array<{
    name: string;
    type: string;
  }>;
  Order: Array<{
    name: string;
    type: string;
  }>;
}

/**
 * Order validation result
 */
export interface OrderValidationResult {
  valid: boolean;
  errors?: string[];
  details?: any;
}

/**
 * Order amount validation
 */
export interface AmountValidation {
  valid: boolean;
  makingAmount: bigint;
  takingAmount: bigint;
  error?: string;
}

/**
 * Address validation result
 */
export interface AddressValidation {
  valid: boolean;
  address: string;
  error?: string;
}

/**
 * Order hash calculation result
 */
export interface OrderHashResult {
  orderHash: string;
  domain: EIP712Domain;
  types: EIP712Types;
}

/**
 * Secret generation result
 */
export interface SecretGenerationResult {
  secret: string;
  hashlock: string;
  encryptedSecret: string;
}

/**
 * Secret request parameters
 */
export interface SecretRequestParams {
  requester: string;
  validationProof?: any;
}

/**
 * Secret request response
 */
export interface SecretRequestResponse {
  secret: string;
  orderHash: string;
  validationResult?: {
    srcEscrow: any;
    dstEscrow: any;
  };
  sharedAt: Date;
}

/**
 * Secret validation result
 */
export interface SecretValidationResult {
  valid: boolean;
  error?: string;
  details?: any;
}

/**
 * Order status transition
 */
export interface OrderStatusTransition {
  from: OrderStatus;
  to: OrderStatus;
  reason?: string;
  timestamp: Date;
}

/**
 * Order statistics
 */
export interface OrderStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  cancelled: number;
}

/**
 * Order validation context
 */
export interface OrderValidationContext {
  order: Order;
  signature?: string;
  signer?: string;
  chainId?: number;
}

/**
 * Order API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Order error codes
 */
export enum OrderErrorCode {
  INVALID_ORDER = 'INVALID_ORDER',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  ORDER_ALREADY_EXISTS = 'ORDER_ALREADY_EXISTS',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_HASHLOCK = 'INVALID_HASHLOCK',
  ORDER_EXPIRED = 'ORDER_EXPIRED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  CHAIN_NOT_SUPPORTED = 'CHAIN_NOT_SUPPORTED',
  SECRET_ALREADY_SHARED = 'SECRET_ALREADY_SHARED',
  INVALID_SECRET_REQUEST = 'INVALID_SECRET_REQUEST',
  ESCROW_VALIDATION_FAILED = 'ESCROW_VALIDATION_FAILED'
}

/**
 * Order validation schemas for Joi
 */
export const OrderValidationSchemas = {
  maker: /^0x[a-fA-F0-9]{40}$/,
  asset: /^0x[a-fA-F0-9]{40}$/,
  amount: /^[0-9]+$/,
  hashlock: /^0x[a-fA-F0-9]{64}$/,
  salt: /^[0-9]+$/,
  signature: /^0x[a-fA-F0-9]{130}$/
};

/**
 * Order constants
 */
export const OrderConstants = {
  MAX_MAKING_AMOUNT: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  MAX_TAKING_AMOUNT: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  DEFAULT_RECEIVER: '0x0000000000000000000000000000000000000000',
  MIN_SALT: '1',
  MAX_SALT: '115792089237316195423570985008687907853269984665640564039457584007913129639935'
}; 