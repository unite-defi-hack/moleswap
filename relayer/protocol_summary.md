# 1inch Network Fusion Atomic Swaps - Protocol Summary

## Overview

1inch Network Fusion Atomic Swaps is a sophisticated cross-chain atomic swap protocol that enables trustless token exchanges between EVM-compatible chains using hashlocks, timelocks, and economic incentives.

## Core Architecture

### **Key Components**
- **EscrowSrc**: Holds user tokens on source chain
- **EscrowDst**: Holds resolver tokens on destination chain  
- **EscrowFactory**: Deploys deterministic escrow clones for each swap
- **Resolvers**: Intermediaries that facilitate cross-chain swaps
- **Limit Order Protocol**: Execution engine that triggers escrow creation

### **Protocol Flow**
1. **Order Creation**: User signs order with hashlock via 1inch API
2. **Source Execution**: Resolver calls `fillOrderArgs()` → triggers `EscrowSrc` creation via postInteraction
3. **Destination Setup**: Resolver deploys `EscrowDst` with matching parameters  
4. **Secret Distribution**: 1inch backend automatically distributes secret to resolver
5. **Withdrawal**: Resolver withdraws tokens from both chains using secret
6. **Backup Mechanisms**: Public withdrawal periods and event-based secret recovery

## Technical Implementation

### **Hashlock Storage (Clever Design)**
- **NOT stored as state variable** - saves gas
- **Embedded in contract address** via CREATE2 deterministic deployment
- **Validated on every function call** by requiring exact Immutables struct
- Makes tampering impossible without changing contract address

### **Timelock Safety Mechanism**
```
Source Chain: Finality(120s) → Private Withdrawal(500s) → Public Withdrawal(1020s) → Cancellation(1530s)
Destination Chain: Finality(300s) → Private Withdrawal(540s) → Public Withdrawal(900s) → Cancellation
```

### **Limit Order Protocol Integration**
- Uses `POST_INTERACTION_CALL` flag to trigger escrow creation
- EscrowFactory implements `IPostInteraction` interface
- `fillOrderArgs()` → `_fillOrder()` → `_fill()` → `postInteraction()` → escrow deployment
- MakerAsset: Real user tokens, TakerAsset: ERC20True (fake token returning true)

### **Partial Fills with Merkle Trees**
- Orders split into N parts with N+1 secrets
- Merkle tree prevents secret reuse
- Each secret indexed by cumulative fill percentage
- Resolvers have complete Merkle tree for coordination

## Key Insights Discovered

### **Secret Generation & Distribution**
- **1inch backend generates secrets** (not users!)
- Users only see and sign hashlock in orders
- Automatic verification and distribution when escrows match
- No manual monitoring required - perfect UX

### **Order Storage & Discovery**
- **No on-chain order storage** - orders exist as EIP-712 signed messages
- Off-chain order book via 1inch API
- Event-based coordination between resolvers
- Monitoring: `SrcEscrowCreated`, `DstEscrowCreated`, `EscrowWithdrawal` events

### **Security Features**
- Safety deposits incentivize proper behavior
- Public withdrawal as backup mechanism
- Event-based secret recovery if private channels fail
- Clone contract isolation per swap
- Time-based access controls

## FAQ

### **Q: How does this protocol work?**
**A:** It's a cross-chain atomic swap using hashlocks and timelocks. Resolvers act as intermediaries, depositing tokens on destination chain while user tokens are locked in source chain escrow. Both sides can only be unlocked with the same secret, ensuring atomicity.

### **Q: What's the role of the Limit Order Protocol?**
**A:** LOP serves as the execution engine. When resolvers call `fillOrderArgs()`, it triggers the `postInteraction` callback that creates the source chain escrow. This leverages battle-tested infrastructure for order execution, gas optimization, and security.

### **Q: Where are orders stored and how do resolvers discover them?**
**A:** Orders are NOT stored on-chain. They exist as EIP-712 signed messages in 1inch's off-chain order book. Resolvers discover orders via API queries and coordinate through blockchain events (`SrcEscrowCreated`, `DstEscrowCreated`).

### **Q: Can you show the code path from fillOrderArgs to escrow creation?**
**A:** `fillOrderArgs()` → `_fillOrder()` → `_fill()` → `postInteraction()` → `EscrowFactory._postInteraction()` → `_deployEscrow()` → `Clones.cloneDeterministic()`. The magic happens in the postInteraction callback that creates the escrow clone.

### **Q: Who generates the secret and where is the hashlock created?**
**A:** Evidence suggests **1inch backend generates secrets**, not users. Users only sign orders containing hashlocks. Secrets are generated algorithmically and distributed automatically when escrows are properly deployed.

### **Q: Where is the secret hash stored in the contract?**
**A:** Clever design: hashlock is NOT stored as a state variable. Instead, it's embedded in the contract's deterministic CREATE2 address and validated on every function call by requiring the exact Immutables struct as parameter.

### **Q: How does secret revelation work if users go offline?**
**A:** This was a key insight - users DON'T need to manually reveal secrets! 1inch backend automatically:
1. Monitors escrow deployment events
2. Verifies parameters match  
3. Distributes secret to resolver via secure API
4. Enables seamless UX where users can go offline after signing

### **Q: What if the secret distribution fails?**
**A:** Multiple backup mechanisms:
- Public withdrawal periods where anyone can withdraw with correct secret
- Events emit secrets when withdrawals happen (`EscrowWithdrawal` event)
- Other resolvers can extract secrets from events and complete swaps
- Safety deposits incentivize proper completion

### **Q: How are partial fills handled?**
**A:** Using Merkle trees with N+1 secrets for N parts. Each secret corresponds to cumulative fill percentage. Resolvers have complete Merkle tree and use appropriate secret/proof based on fill amount. Prevents secret reuse and ensures proper ordering.

### **Q: What makes this protocol secure?**
**A:** Multiple layers:
- Hashlock prevents unauthorized withdrawals
- Timelocks create safe execution windows
- Safety deposits align economic incentives  
- Deterministic addresses prevent parameter tampering
- Event-based fallbacks ensure completion
- Clone isolation prevents cross-contamination

## Architecture Strengths

1. **Perfect UX**: Users sign once and go offline
2. **Trust-minimized**: No need to trust resolvers completely  
3. **Gas efficient**: No unnecessary state storage
4. **Battle-tested**: Leverages proven 1inch infrastructure
5. **Atomic guarantees**: Either both sides complete or both revert
6. **Flexible**: Supports partial fills and multiple resolvers

The protocol cleverly separates concerns: **smart contracts provide trust-minimized execution**, while **1inch backend provides automated secret management and UX**. 