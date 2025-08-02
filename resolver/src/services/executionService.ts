import { randomBytes } from "crypto";
import { Wallet, JsonRpcProvider } from "ethers";
import {
  Address,
  HashLock,
  TimeLocks,
  EvmCrossChainOrder,
  AuctionDetails,
  randBigInt,
  EvmAddress,
  TonAddress,
  Extension,
} from "@1inch/cross-chain-sdk";
import { 
  ExecutionConfig, 
  ExecutionResult, 
  OrderWithMetadata,
  EscrowValidationRequest,
  SecretRequestResponse
} from '../types';
import { RelayerService } from './relayerService';
import { TonAdapter } from './tonAdapter';
import { ResolverConfig } from '../config';

const UINT_40_MAX = (1n << 40n) - 1n;

export class ExecutionService {
  private config: ExecutionConfig;
  private relayerService: RelayerService;
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private resolverConfig: ResolverConfig;

  constructor(config: ExecutionConfig, relayerService: RelayerService, resolverConfig?: ResolverConfig) {
    this.config = config;
    this.relayerService = relayerService;
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.privateKey, this.provider);
    this.resolverConfig = resolverConfig || this.loadDefaultConfig();
  }

  private loadDefaultConfig(): ResolverConfig {
    // Load default config if not provided
    const { loadConfig } = require('../config');
    return loadConfig();
  }

  /**
   * Execute a cross-chain order
   */
  async executeOrder(orderWithMetadata: OrderWithMetadata): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { order, orderHash } = orderWithMetadata;

    try {
      console.log(`Starting execution for order: ${orderHash}`);

      // Step 1: Create escrow on source chain
      const srcEscrowResult = await this.createSourceEscrow(order, orderHash);
      console.log('Source escrow created:', srcEscrowResult);

      // Step 2: Create escrow on destination chain
      const dstEscrowResult = await this.createDestinationEscrow(order, orderHash);
      console.log('Destination escrow created:', dstEscrowResult);

      // Step 3: Validate escrows with relayer
      const validationRequest: EscrowValidationRequest = {
        orderHash,
        srcEscrowAddress: srcEscrowResult.escrowAddress,
        dstEscrowAddress: dstEscrowResult.escrowAddress,
        srcChainId: order.srcChainId?.toString() || this.resolverConfig.crossChain.sourceNetworkId.toString(),
        dstChainId: order.dstChainId?.toString() || this.resolverConfig.crossChain.destinationNetworkId.toString()
      };

      console.log('Secret request validation data:', validationRequest);

      // Step 4: Request secret from relayer
      const secretResponse = await this.relayerService.requestSecret(orderHash, validationRequest);
      
      console.log('Secret response:', secretResponse);
      
      if (!secretResponse.success || !secretResponse.data?.secret) {
        console.error('Secret request failed:', secretResponse.error);
        throw new Error(`Failed to get secret from relayer: ${secretResponse.error?.message || 'Unknown error'}`);
      }

      const secret = secretResponse.data.secret;

      // Step 5: Withdraw from destination escrow
      const dstWithdrawResult = await this.withdrawFromDestinationEscrow(orderHash, secret);
      console.log('Destination withdrawal completed:', dstWithdrawResult);

      // Step 6: Withdraw from source escrow
      const srcWithdrawResult = await this.withdrawFromSourceEscrow(srcEscrowResult, secret);
      console.log('Source withdrawal completed:', srcWithdrawResult);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        orderHash,
        transactionHash: srcEscrowResult.transactionHash,
        executionTime,
        profit: this.calculateProfit(order), // Mock profit calculation
        gasUsed: srcEscrowResult.gasUsed || 0
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Execution failed for order ${orderHash}:`, error);

      return {
        success: false,
        orderHash,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }

  /**
   * Create source escrow (EVM side)
   */
  private async createSourceEscrow(order: any, orderHash: string) {
    // This would use the 1inch SDK to create the source escrow
    // For now, we'll mock the implementation based on the example script
    
    // Simulate escrow creation
    const escrowAddress = `0x${randomBytes(20).toString('hex')}`;
    const gasUsed = Math.floor(Math.random() * 200000) + 100000; // Mock gas usage
    
    return {
      escrowAddress,
      transactionHash: `0x${randomBytes(32).toString('hex')}`,
      gasUsed
    };
  }

  /**
   * Create destination escrow (TON side)
   */
  private async createDestinationEscrow(order: any, orderHash: string) {
    try {
      // Create TON order configuration
      const tonOrder = TonAdapter.createEvmToTonOrderConfig(
        { order, orderHash },
        this.resolverConfig.crossChain.tonTakerAddress
      );

      // Create destination escrow using TON adapter
      const result = await TonAdapter.createDestinationEscrow(
        this.resolverConfig.crossChain.tonLopAddress,
        tonOrder
      );

      if (!result.success) {
        throw new Error(`TON escrow creation failed: ${result.error}`);
      }

      // For testing with dummy plugins, use a valid Ethereum address format
      // In production, this would be the actual TON escrow address
      const mockEthereumAddress = `0x${randomBytes(20).toString('hex')}`;

      return {
        escrowAddress: mockEthereumAddress, // Use Ethereum format for dummy testing
        transactionHash: result.transactionHash!
      };
    } catch (error) {
      console.error('Failed to create TON destination escrow:', error);
      throw error;
    }
  }

  /**
   * Withdraw from destination escrow
   */
  private async withdrawFromDestinationEscrow(orderHash: string, secret: string) {
    try {
      // Use TON adapter to withdraw from destination escrow
      const result = await TonAdapter.withdrawFromDstEscrow({
        orderHash,
        secret
      });

      if (!result.success) {
        throw new Error(`TON withdrawal failed: ${result.error}`);
      }

      return {
        success: true,
        transactionHash: result.transactionHash!
      };
    } catch (error) {
      console.error('Failed to withdraw from TON destination escrow:', error);
      throw error;
    }
  }

  /**
   * Withdraw from source escrow
   */
  private async withdrawFromSourceEscrow(srcEscrowResult: any, secret: string) {
    // This would use the EVM adapter to withdraw from source escrow
    // For now, we'll mock the implementation
    
    return {
      success: true,
      transactionHash: `0x${randomBytes(32).toString('hex')}`
    };
  }

  /**
   * Calculate potential profit from order execution
   */
  private calculateProfit(order: any): number {
    // Mock profit calculation
    // In reality, this would compare order price with oracle price
    const makingAmount = parseFloat(order.makingAmount);
    const takingAmount = parseFloat(order.takingAmount);
    
    // Simple mock calculation
    return (takingAmount - makingAmount) * 0.01; // 1% of difference
  }

  /**
   * Check if wallet has sufficient balance for execution
   */
  async checkBalance(): Promise<boolean> {
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      const gasPrice = await this.provider.getFeeData();
      const estimatedGasCost = this.config.gasLimit * parseFloat(gasPrice.gasPrice?.toString() || '0');
      
      return balance > BigInt(estimatedGasCost);
    } catch (error) {
      console.error('Failed to check balance:', error);
      return false;
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice?.toString() || '0';
    } catch (error) {
      console.error('Failed to get gas price:', error);
      return '0';
    }
  }
} 