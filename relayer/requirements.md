# Relayer Service Requirements

## Overview
The Relayer is a REST service that acts as a central coordinator for cross-chain atomic swaps in the 1inch Network Fusion protocol. Its primary role is to manage secrets and validate escrow contracts across multiple blockchain networks.

## Core Functionality

### 1. Secret Management
- **Generate secrets** for new orders
- **Store secrets** securely with order metadata
- **Share secrets** with takers after validation
- **Validate escrow contracts** before secret distribution

### 2. Order Management
- **Create orders** with maker signatures
- **Store order details** in flexible JSON format
- **Query orders** with filtering capabilities
- **Update order status** based on escrow creation

### 3. Escrow Validation
- **Check source escrow** (EscrowSrc) creation and balance
- **Check destination escrow** (EscrowDst) creation and balance
- **Verify escrow parameters** match order requirements
- **Validate timelock periods** and withdrawal conditions

## API Endpoints

### Maker Endpoints
1. **POST /api/orders/data**
   - Generate order data with hashlock
   - Return `order_to_sign` structure
   - Store order parameters and generated secret

2. **POST /api/orders**
   - Create order with signed data
   - Validate signature and update order status
   - Return success/failure result

### Taker Endpoints
1. **GET /api/orders**
   - Query available orders with filters
   - No authentication required
   - Return order list with metadata

2. **POST /api/secrets/:orderHash**
   - Request secret for specific order
   - Validate both escrow contracts
   - Return secret if validation passes

## Technical Requirements

### Architecture
- **TypeScript** implementation for blockchain SDK compatibility
- **Plugin architecture** for easy chain support addition
- **REST API** with JSON responses
- **SQLite storage** with flexible JSON schema
- **Modular design** for hackathon flexibility

### Database Schema
```sql
-- Orders table with flexible JSON storage
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_hash TEXT UNIQUE NOT NULL,
    maker_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    order_data JSON NOT NULL,
    secret TEXT,
    hashlock TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Escrow validation records
CREATE TABLE escrow_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_hash TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    escrow_address TEXT NOT NULL,
    escrow_type TEXT NOT NULL, -- 'src' or 'dst'
    validation_status TEXT NOT NULL,
    validation_data JSON,
    validated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_hash) REFERENCES orders(order_hash)
);
```

### Order Structure
```typescript
interface Order {
  maker: string;                    // Maker's address
  makerAsset: string;               // Source token address
  takerAsset: string;               // Destination token address  
  makerTraits: string;              // Hashlock (secret hash)
  salt: string;                     // Order uniqueness
  makingAmount: string;             // Amount maker is offering
  takingAmount: string;             // Amount taker will receive
  receiver: string;                 // Receiver address (usually zero)
}

interface OrderWithMetadata {
  order: Order;
  orderHash: string;                // EIP-712 order hash
  secret?: string;                  // Generated secret (for relayer)
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}
```

### Plugin Architecture
- **Base Chain Plugin Interface**
- **EVM Chain Plugin** (Ethereum, Polygon, etc.)
- **Non-EVM Chain Plugin** (TON, BTC, etc.)
- **Plugin Registry** for dynamic loading

### Security Requirements
- **Secret encryption** at rest
- **Signature validation** for maker orders
- **Escrow parameter verification**
- **Rate limiting** for API endpoints
- **Input validation** and sanitization

## Chain Support

### Initial Chains
1. **Ethereum** (EVM)
2. **TON** (Non-EVM)


### Plugin Interface
```typescript
interface ChainPlugin {
  chainId: string;
  chainName: string;
  
  // Escrow validation
  validateEscrow(escrowAddress: string, orderData: OrderData): Promise<ValidationResult>;
  
  // Balance checking
  getEscrowBalance(escrowAddress: string): Promise<BigNumber>;
  
  // Parameter verification
  verifyEscrowParameters(escrowAddress: string, expectedParams: EscrowParams): Promise<boolean>;
  
  // Event monitoring
  getEscrowEvents(escrowAddress: string): Promise<EscrowEvent[]>;
}
```

## Configuration

### Environment Variables
- `DATABASE_PATH`: SQLite database file path
- `PORT`: API server port
- `SECRET_KEY`: Encryption key for secrets
- `CHAIN_PLUGINS`: Comma-separated list of enabled chain plugins
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

### Chain Configuration
```json
{
  "chains": {
    "ethereum": {
      "rpcUrl": "https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY",
      "chainId": "1",
      "escrowFactoryAddress": "0x...",
      "blockTime": 12
    },
    "polygon": {
      "rpcUrl": "https://polygon-rpc.com",
      "chainId": "137",
      "escrowFactoryAddress": "0x...",
      "blockTime": 2
    }
  }
}
```

## Error Handling

### Validation Errors
- Invalid order signatures
- Escrow contract not found
- Insufficient escrow balance
- Mismatched escrow parameters
- Expired timelocks

### System Errors
- Database connection failures
- Chain RPC timeouts
- Plugin loading errors
- Secret encryption/decryption failures

## Monitoring & Logging

### Metrics
- Order creation rate
- Secret request rate
- Validation success/failure rates
- Chain-specific metrics
- API response times

### Logging
- Order lifecycle events
- Escrow validation attempts
- Secret distribution events
- Error conditions with context
- Chain plugin operations