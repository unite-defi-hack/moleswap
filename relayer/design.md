# Relayer Service Design

## Architecture Overview

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   REST API      │    │   Database      │    │   Chain Plugins │
│   (Express)     │◄──►│   (SQLite)      │◄──►│   (Ethereum)    │
│                 │    │                 │    │   (TON)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Order Service │    │  Secret Service │    │ Validation      │
│                 │    │                 │    │ Service         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Detailed System Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REST API Layer                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   /orders   │  │  /secrets   │  │   /health   │  │   /metrics  │     │
│  │   (CRUD)    │  │ (validate & │  │ (status)    │  │ (monitoring)│     │
│  │             │  │   share)    │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Middleware Layer                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   CORS      │  │   Helmet    │  │Rate Limiting│  │Validation   │     │
│  │ (security)  │  │ (security)  │  │ (abuse)     │  │ (Joi)       │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Service Layer                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │OrderService │  │SecretService│  │Validation   │  │PluginService│     │
│  │(CRUD ops)   │  │(generate &  │  │Service      │  │(chain mgmt) │     │
│  │             │  │ encrypt)    │  │(escrow)     │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Database Layer                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Orders    │  │Escrow Valid.│  │   Knex.js   │  │   SQLite    │     │
│  │   Table     │  │   Table     │  │ (ORM/Mig)   │  │ (Database)  │     │
│  │(JSON data)  │  │(validation) │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Plugin Layer                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Ethereum    │  │     TON     │  │   Plugin    │  │   External  │     │
│  │  Plugin     │  │   Plugin    │  │  Registry   │  │   Chains    │     │
│  │(ethers.js)  │  │(ton-connect)│  │(dynamic)    │  │(RPC calls)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Layer (Express)
- **Routes**: `/api/orders`, `/api/secrets`, `/api/health`
- **Middleware**: CORS, Helmet, Rate Limiting, Validation
- **Error Handling**: Centralized error middleware
- **Authentication**: None required (as per protocol)
- **Validation**: Joi for request validation
- **Rate Limiting**: express-rate-limit
- **Security**: Helmet for security headers

### 2. Database Layer (SQLite)
- **Orders Table**: Store order data and secrets
- **Escrow Validations Table**: Track validation results
- **JSON Storage**: Flexible schema for order details
- **Migrations**: Knex.js for TypeScript-friendly migrations
- **ORM**: Knex.js query builder for type-safe database operations

### 3. Service Layer
- **OrderService**: Order CRUD operations with Knex.js
- **SecretService**: Secret generation and management with crypto
- **ValidationService**: Escrow validation logic
- **PluginService**: Chain plugin management
- **Logging**: Winston for structured logging

### 4. Plugin Architecture
- **Base Plugin Interface**: Common interface for all chains
- **Plugin Registry**: Dynamic plugin loading
- **Chain-Specific Logic**: EVM vs Non-EVM handling
- **Ethereum**: ethers.js for EVM interactions
- **TON**: ton-connect or tonweb for TON interactions

### Data Flow Diagram
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Maker     │    │   Relayer   │    │   Taker     │    │  Blockchains│
│  (User)     │    │   (API)     │    │  (User)     │    │  (Ethereum) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       │ 1. Create Order   │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 2. Generate       │                   │
       │                   │ Secret & Hashlock │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │ 3. Sign Order     │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 4. Store Order   │                   │
       │                   │ in Database      │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │                   │ 5. Query Orders  │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │                   │ 6. Create Escrows│
       │                   │                   │──────────────────►│
       │                   │                   │                   │
       │                   │ 7. Request Secret│                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ 8. Validate      │                   │
       │                   │ Escrows          │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │ 9. Share Secret  │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ 10. Complete Swap│
       │                   │                   │──────────────────►│
       │                   │                   │                   │
```

### Order Lifecycle Diagram
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PENDING    │    │   ACTIVE    │    │ COMPLETED   │    │  CANCELLED  │
│             │    │             │    │             │    │             │
│ • Order     │───►│ • Signed    │───►│ • Secret    │    │ • Expired   │
│   Created   │    │   Order     │    │   Shared    │    │   Order     │
│ • Secret    │    │ • Stored in │    │ • Swap      │    │ • Manual    │
│   Generated │    │   Database  │    │   Completed │    │   Cancel    │
│ • Hashlock  │    │ • Available │    │ • Order     │    │ • Invalid   │
│   Created   │    │   for Takers│    │   Closed    │    │   Signature │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Data Models

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
  secret?: string;                  // Generated secret (encrypted)
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

enum OrderStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}
```

### Escrow Validation
```typescript
interface EscrowValidation {
  orderHash: string;
  chainId: string;
  escrowAddress: string;
  escrowType: 'src' | 'dst';
  validationStatus: ValidationStatus;
  validationData: any; // JSON field
  validatedAt: Date;
}

enum ValidationStatus {
  PENDING = 'pending',
  VALID = 'valid',
  INVALID = 'invalid',
  ERROR = 'error'
}
```

## API Design

### Endpoints

#### 1. POST /api/orders/data
**Purpose**: Generate order data with hashlock for maker to sign

**Request**:
```json
{
  "order": {
    "maker": "0x71078879cd9a1d7987b74cee6b6c0d130f1a0115",
    "makerAsset": "0x10563e509b718a279de002dfc3e94a8a8f642b03",
    "takerAsset": "0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c",
    "makingAmount": "1000000000000000000",
    "takingAmount": "2000000000000000000",
    "receiver": "0x0000000000000000000000000000000000000000"
  }
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "orderToSign": {
      "maker": "0x71078879cd9a1d7987b74cee6b6c0d130f1a0115",
      "makerAsset": "0x10563e509b718a279de002dfc3e94a8a8f642b03",
      "takerAsset": "0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c",
      "makerTraits": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "salt": "8240221422984282745454410369971298296651574087129927646899272926690",
      "makingAmount": "1000000000000000000",
      "takingAmount": "2000000000000000000",
      "receiver": "0x0000000000000000000000000000000000000000"
    },
    "orderHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  }
}
```

**Error Response - Invalid Address**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ORDER",
    "message": "Invalid maker address format",
    "details": {
      "field": "maker",
      "value": "0xinvalid",
      "expected": "Ethereum address format"
    }
  }
}
```

**Error Response - Invalid Amount**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ORDER",
    "message": "Making amount must be greater than zero",
    "details": {
      "field": "makingAmount",
      "value": "0",
      "expected": "Positive integer string"
    }
  }
}
```

#### 2. POST /api/orders
**Purpose**: Create order with signed data

**Request**:
```json
{
  "signedOrder": {
    "order": {
      "maker": "0x71078879cd9a1d7987b74cee6b6c0d130f1a0115",
      "makerAsset": "0x10563e509b718a279de002dfc3e94a8a8f642b03",
      "takerAsset": "0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c",
      "makerTraits": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "salt": "8240221422984282745454410369971298296651574087129927646899272926690",
      "makingAmount": "1000000000000000000",
      "takingAmount": "2000000000000000000",
      "receiver": "0x0000000000000000000000000000000000000000"
    },
    "signature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b"
  }
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "orderHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response - Invalid Signature**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "EIP-712 signature verification failed",
    "details": {
      "signer": "0x71078879cd9a1d7987b74cee6b6c0d130f1a0115",
      "expectedSigner": "0x1234567890123456789012345678901234567890"
    }
  }
}
```

**Error Response - Order Already Exists**:
```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_EXISTS",
    "message": "Order with this hash already exists",
    "details": {
      "orderHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "existingStatus": "active"
    }
  }
}
```

**Error Response - Malformed Request**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: signature",
    "details": {
      "missingFields": ["signature"],
      "receivedFields": ["order"]
    }
  }
}
```

#### 3. GET /api/orders
**Purpose**: Query available orders (no auth required)

**Query Parameters**:
- `status`: Filter by order status (pending, active, completed, cancelled)
- `maker`: Filter by maker address
- `makerAsset`: Filter by source token
- `takerAsset`: Filter by destination token
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Pagination offset

**Success Response - With Filters**:
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "order": {
          "maker": "0x71078879cd9a1d7987b74cee6b6c0d130f1a0115",
          "makerAsset": "0x10563e509b718a279de002dfc3e94a8a8f642b03",
          "takerAsset": "0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c",
          "makerTraits": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          "salt": "8240221422984282745454410369971298296651574087129927646899272926690",
          "makingAmount": "1000000000000000000",
          "takingAmount": "2000000000000000000",
          "receiver": "0x0000000000000000000000000000000000000000"
        },
        "status": "active",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 25,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Success Response - Empty Results**:
```json
{
  "success": true,
  "data": {
    "orders": [],
    "total": 0,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Error Response - Invalid Filter**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILTER",
    "message": "Invalid status filter value",
    "details": {
      "field": "status",
      "value": "invalid_status",
      "allowedValues": ["pending", "active", "completed", "cancelled"]
    }
  }
}
```

**Error Response - Invalid Pagination**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAGINATION",
    "message": "Limit exceeds maximum allowed value",
    "details": {
      "field": "limit",
      "value": 150,
      "maxAllowed": 100
    }
  }
}
```

#### 4. POST /api/secrets/:orderHash
**Purpose**: Request secret after escrow validation

**Request**:
```json
{
  "srcEscrowAddress": "0x1234567890123456789012345678901234567890",
  "dstEscrowAddress": "0x0987654321098765432109876543210987654321",
  "srcChainId": "1",
  "dstChainId": "2"
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "secret": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "validationResult": {
      "srcEscrow": {
        "valid": true,
        "balance": "1000000000000000000",
        "chainId": "1",
        "address": "0x1234567890123456789012345678901234567890"
      },
      "dstEscrow": {
        "valid": true,
        "balance": "2000000000000000000",
        "chainId": "2",
        "address": "0x0987654321098765432109876543210987654321"
      }
    },
    "orderHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  }
}
```

**Error Response - Order Not Found**:
```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "details": {
      "orderHash": "0xinvalidhash1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    }
  }
}
```

**Error Response - Escrow Validation Failed**:
```json
{
  "success": false,
  "error": {
    "code": "ESCROW_VALIDATION_FAILED",
    "message": "Source escrow balance insufficient",
    "details": {
      "srcEscrow": {
        "valid": false,
        "balance": "500000000000000000",
        "required": "1000000000000000000",
        "chainId": "1",
        "address": "0x1234567890123456789012345678901234567890"
      },
      "dstEscrow": {
        "valid": true,
        "balance": "2000000000000000000",
        "chainId": "2",
        "address": "0x0987654321098765432109876543210987654321"
      }
    }
  }
}
```

**Error Response - Chain Not Supported**:
```json
{
  "success": false,
  "error": {
    "code": "CHAIN_NOT_SUPPORTED",
    "message": "Chain not supported by relayer",
    "details": {
      "chainId": "999",
      "supportedChains": ["1", "2", "ton"]
    }
  }
}
```

**Error Response - Invalid Escrow Address**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ESCROW_ADDRESS",
    "message": "Invalid escrow address format",
    "details": {
      "field": "srcEscrowAddress",
      "value": "0xinvalid",
      "expected": "Ethereum address format"
    }
  }
}
```

**Error Response - Secret Already Shared**:
```json
{
  "success": false,
  "error": {
    "code": "SECRET_ALREADY_SHARED",
    "message": "Secret has already been shared for this order",
    "details": {
      "orderHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "sharedAt": "2024-01-15T10:35:00Z"
    }
  }
}
```

#### 5. GET /api/health
**Purpose**: Health check endpoint for monitoring

**Success Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "uptime": 3600,
    "database": {
      "status": "connected",
      "orders": 150,
      "validations": 75
    },
    "plugins": {
      "ethereum": { "status": "healthy", "chainId": "1" },
      "ton": { "status": "healthy", "chainId": "ton" }
    }
  }
}
```

**Error Response - Service Unhealthy**:
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNHEALTHY",
    "message": "One or more services are unhealthy",
    "details": {
      "database": { "status": "disconnected", "error": "Connection timeout" },
      "plugins": {
        "ethereum": { "status": "healthy", "chainId": "1" },
        "ton": { "status": "unhealthy", "chainId": "ton", "error": "RPC timeout" }
      }
    }
  }
}
```

#### 6. GET /api/metrics
**Purpose**: Service metrics for monitoring

**Success Response**:
```json
{
  "success": true,
  "data": {
    "orders": {
      "total": 150,
      "pending": 25,
      "active": 100,
      "completed": 20,
      "cancelled": 5
    },
    "secrets": {
      "totalShared": 20,
      "totalGenerated": 150
    },
    "validations": {
      "total": 75,
      "successful": 70,
      "failed": 5
    },
    "api": {
      "requests": {
        "total": 1000,
        "orders": 400,
        "secrets": 200,
        "health": 300,
        "metrics": 100
      },
      "errors": {
        "total": 50,
        "validation": 30,
        "notFound": 10,
        "internal": 10
      }
    },
    "chains": {
      "ethereum": {
        "validations": 50,
        "successful": 48,
        "failed": 2
      },
      "ton": {
        "validations": 25,
        "successful": 22,
        "failed": 3
      }
    }
  }
}
```

#### 7. GET /api/chains
**Purpose**: Get supported chains and their status

**Success Response**:
```json
{
  "success": true,
  "data": {
    "chains": [
      {
        "chainId": "1",
        "name": "Ethereum",
        "type": "evm",
        "status": "healthy",
        "rpcUrl": "https://eth-mainnet.alchemyapi.io/v2/...",
        "escrowFactoryAddress": "0x1234567890123456789012345678901234567890",
        "blockTime": 12,
        "confirmations": 12
      },
      {
        "chainId": "ton",
        "name": "TON",
        "type": "non-evm",
        "status": "healthy",
        "rpcUrl": "https://toncenter.com/api/v2/",
        "escrowFactoryAddress": "EQ...",
        "blockTime": 5,
        "confirmations": 5
      }
    ]
  }
}
```

## Plugin Architecture

### Base Plugin Interface
```typescript
interface ChainPlugin {
  readonly chainId: string;
  readonly chainName: string;
  readonly chainType: 'evm' | 'non-evm';
  
  // Initialize plugin with configuration
  initialize(config: ChainConfig): Promise<void>;
  
  // Validate escrow contract
  validateEscrow(
    escrowAddress: string, 
    orderData: OrderData
  ): Promise<ValidationResult>;
  
  // Get escrow balance
  getEscrowBalance(escrowAddress: string): Promise<BigNumber>;
  
  // Verify escrow parameters match order
  verifyEscrowParameters(
    escrowAddress: string, 
    expectedParams: EscrowParams
  ): Promise<boolean>;
  
  // Get escrow creation events
  getEscrowEvents(escrowAddress: string): Promise<EscrowEvent[]>;
  
  // Health check
  isHealthy(): Promise<boolean>;
}

interface ValidationResult {
  valid: boolean;
  balance?: BigNumber;
  error?: string;
  details?: any;
}

interface EscrowParams {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  hashlock: string;
  timelock: number;
}
```

### Plugin Registry
```typescript
class PluginRegistry {
  private plugins: Map<string, ChainPlugin> = new Map();
  
  // Register a plugin
  register(plugin: ChainPlugin): void;
  
  // Get plugin by chain ID
  getPlugin(chainId: string): ChainPlugin | undefined;
  
  // Get all registered plugins
  getAllPlugins(): ChainPlugin[];
  
  // Load plugins from configuration
  loadPlugins(config: PluginConfig[]): Promise<void>;
}
```

### Plugin Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Plugin Registry                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Ethereum  │  │     TON     │  │   Bitcoin   │  │   Polygon   │     │
│  │   Plugin    │  │   Plugin    │  │   Plugin    │  │   Plugin    │     │
│  │             │  │             │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                 │                 │                 │           │
│         ▼                 ▼                 ▼                 ▼           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  ethers.js  │  │ ton-connect │  │   bitcoin   │  │  ethers.js  │     │
│  │   (EVM)     │  │  (Non-EVM)  │  │  (Non-EVM)  │  │   (EVM)     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Common Interface                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │validateEscrow│  │getEscrowBal.│  │verifyParams │  │getEscrowEvts│     │
│  │             │  │             │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        External Chains                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Ethereum   │  │     TON     │  │   Bitcoin   │  │   Polygon   │     │
│  │   Mainnet   │  │  Mainnet    │  │  Mainnet    │  │   Mainnet   │     │
│  │             │  │             │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Plugin Loading Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Config File │    │Plugin Registry│   │  Chain      │    │  External   │
│ (JSON)      │    │             │   │  Plugin     │    │  Blockchain  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       │ 1. Load Config   │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 2. Instantiate   │                   │
       │                   │ Plugin           │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ 3. Initialize     │
       │                   │                   │ with Config       │
       │                   │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ 4. Register      │                   │
       │                   │ Plugin           │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │                   │ 5. Health Check   │                   │
       │                   │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ 6. Ready for Use  │                   │
       │                   │                   │◄──────────────────│                   │
       │                   │                   │                   │
```

## Database Schema

### Orders Table
```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_hash TEXT UNIQUE NOT NULL,
    maker_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    order_data JSON NOT NULL,
    secret TEXT, -- encrypted
    hashlock TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_maker ON orders(maker_address);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

### Escrow Validations Table
```sql
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

CREATE INDEX idx_escrow_validations_order ON escrow_validations(order_hash);
CREATE INDEX idx_escrow_validations_chain ON escrow_validations(chain_id);
```

## Security Considerations

### Secret Management
- **Encryption**: Secrets encrypted at rest using AES-256
- **Key Management**: Encryption key stored in environment variable
- **Access Control**: Secrets only shared after validation
- **Audit Trail**: All secret access logged

### Input Validation
- **Order Validation**: EIP-712 signature verification
- **Address Validation**: Ethereum address format checking
- **Amount Validation**: Positive numbers, proper decimals
- **Rate Limiting**: Prevent abuse of API endpoints

### Error Handling
- **Graceful Degradation**: Service continues if one chain is down
- **Detailed Logging**: All errors logged with context
- **User-Friendly Messages**: Clear error messages for API users
- **Retry Logic**: Automatic retries for transient failures

### Security & Validation Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Request   │    │ Validation  │    │ Processing  │    │   Response  │
│   (Client)  │    │   Layer     │    │   Layer     │    │   (Client)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       │ 1. HTTP Request  │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 2. Rate Limiting │                   │
       │                   │ & CORS Check     │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ 3. Joi Validation│                   │
       │                   │ & Sanitization   │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ 4. Business Logic│                   │
       │                   │ Processing       │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ 5. Database      │                   │
       │                   │                   │ Operations       │                   │
       │                   │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │                   │ 6. Chain Plugin  │                   │
       │                   │                   │ Validation       │                   │
       │                   │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ 7. Response      │                   │
       │                   │ Generation       │                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │ 8. HTTP Response │                   │                   │
       │◄──────────────────│                   │                   │
       │                   │                   │                   │
```

### Secret Management Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Secret Gen. │    │ Encryption  │    │  Storage    │    │  Retrieval  │
│ (Crypto)    │    │ (AES-256)   │    │ (Database)  │    │ (Decryption)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       │ 1. Generate      │                   │                   │
       │ Random Secret    │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 2. Encrypt with  │                   │
       │                   │ Environment Key  │                   │
       │                   │──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │ 3. Store in      │                   │
       │                   │                   │ SQLite           │                   │
       │                   │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │                   │ 4. Validate      │                   │
       │                   │                   │ Escrows          │                   │
       │                   │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │                   │ 5. Decrypt &     │                   │
       │                   │                   │ Return Secret    │                   │
       │                   │                   │◄──────────────────│                   │
       │                   │                   │                   │
```

## Configuration

### Environment Variables
```bash
# Database
DATABASE_PATH=./data/relayer.db

# Server
PORT=3000
NODE_ENV=development

# Security
SECRET_KEY=your-32-byte-encryption-key
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info

# Chain Configuration
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
TON_RPC_URL=https://toncenter.com/api/v2/
```

### Chain Configuration
```json
{
  "chains": {
    "ethereum": {
      "rpcUrl": "https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY",
      "chainId": "1",
      "escrowFactoryAddress": "0x...",
      "blockTime": 12,
      "confirmations": 12
    },
    "ton": {
      "rpcUrl": "https://toncenter.com/api/v2/",
      "chainId": "ton",
      "escrowFactoryAddress": "EQ...",
      "blockTime": 5,
      "confirmations": 5
    }
  }
}
```

## Error Codes

### API Error Responses
```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### Error Codes
- `INVALID_ORDER`: Order data validation failed
- `INVALID_SIGNATURE`: EIP-712 signature verification failed
- `ORDER_NOT_FOUND`: Order hash not found
- `ESCROW_VALIDATION_FAILED`: Escrow validation failed
- `SECRET_NOT_AVAILABLE`: Secret not available for this order
- `CHAIN_NOT_SUPPORTED`: Chain not supported by relayer
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Internal server error

## Monitoring & Observability

### Metrics
- Order creation rate
- Secret request rate
- Validation success/failure rates
- Chain-specific metrics
- API response times
- Database performance

### Logging
- Structured logging with Winston
- Request/response logging
- Error logging with stack traces
- Chain plugin operation logging
- Secret access logging

### Health Checks
- Database connectivity
- Chain plugin health
- Overall service health
- Plugin-specific health checks

## Deployment

### Development
- SQLite database
- Single instance
- Local chain connections
- Debug logging

### Production
- PostgreSQL database (optional)
- Multiple instances with load balancer
- Dedicated chain RPC endpoints
- Structured logging
- Monitoring and alerting

## Tools and Libraries

### Core Framework
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3+
- **Framework**: Express.js 4.18+
- **Process Manager**: PM2 (production)

### Database
- **Database**: SQLite 3
- **ORM/Migrations**: Knex.js 3.0+
- **Query Builder**: Knex.js with TypeScript support
- **Migrations**: Knex.js migration system

### API & Middleware
- **Validation**: Joi 17.11+ for request validation
- **Rate Limiting**: express-rate-limit 7.1+
- **Security**: Helmet 7.1+ for security headers
- **CORS**: cors 2.8+ for cross-origin requests
- **Body Parsing**: express.json() and express.urlencoded()

### Blockchain Integration
- **Ethereum**: ethers.js 6.8+ for EVM interactions
- **TON**: ton-connect or tonweb for TON blockchain
- **Crypto**: Node.js crypto module for secret management
- **Signatures**: ethers.js for EIP-712 signature verification

### Utilities
- **Environment**: dotenv 16.3+ for environment variables
- **Logging**: Winston 3.11+ for structured logging
- **UUID**: uuid 9.0+ for unique identifiers
- **HTTP Client**: axios or node-fetch for external API calls

### Development Tools
- **TypeScript**: 5.3+ with strict configuration
- **Linting**: ESLint with @typescript-eslint
- **Formatting**: Prettier for code formatting
- **Testing**: Jest 29.7+ for unit and integration tests
- **Dev Server**: ts-node-dev for development with hot reload

### Production Tools
- **Process Management**: PM2 for process management
- **Monitoring**: Winston for application logging
- **Health Checks**: Custom health check endpoints
- **Error Tracking**: Winston error logging

### Security Libraries
- **Encryption**: Node.js crypto module (AES-256)
- **Hashing**: crypto module for SHA256/SHA3
- **Key Management**: Environment variables for secrets
- **Input Sanitization**: Joi validation + custom sanitizers

This design provides a solid foundation for the relayer service with clear separation of concerns, extensible plugin architecture, and comprehensive error handling. 