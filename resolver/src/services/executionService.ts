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
import {EvmAdapter, EvmAdapterConfig, DepositResult} from "./lib/evmAdapter";

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

      // Step 1: deposit to source escrow
      const depositResult = await this.depositToSrcEscrow(order, orderHash);
      console.log('Source escrow deposit completed:', depositResult);

      return {
        success: true,
        orderHash,
        transactionHash: depositResult.transactionHash,
        executionTime: Date.now() - startTime,
        profit: this.calculateProfit(order), // Mock profit calculation
        gasUsed: 0 // TODO: Get actual gas used from deposit result
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
   * Deposit to source escrow (EVM side)
   */
  private async depositToSrcEscrow(order: any, orderHash: string): Promise<DepositResult> {
    try {
      // Initialize EVM adapter with required configuration
      const evmConfig: EvmAdapterConfig = {
        resolverProxyAddress: this.resolverConfig.crossChain.resolverProxyAddress,
        sourceChainId: this.resolverConfig.crossChain.sourceNetworkId,
        lopAddress: this.resolverConfig.crossChain.lopAddress,
        escrowFactoryAddress: this.resolverConfig.crossChain.escrowFactoryAddress,
      };

      const evmAdapter = new EvmAdapter(this.provider, evmConfig);

      // Check if we have the required extension and signature fields
      if (!order.extension || !order.signature) {
        console.log("Order data available:", {
          maker: order.maker,
          makerAsset: order.makerAsset,
          takerAsset: order.takerAsset,
          makingAmount: order.makingAmount,
          takingAmount: order.takingAmount,
          receiver: order.receiver,
          makerTraits: order.makerTraits, // This contains the hashlock
          extension: order.extension,
          signature: order.signature,
        });

        // For now, return a mock result since we don't have the required extension and signature
        // In production, this should be replaced with actual EVM adapter call
        const mockEscrowAddress = `0x${randomBytes(20).toString('hex')}`;
        const mockTransactionHash = `0x${randomBytes(32).toString('hex')}`;
        
        console.log("Mock deposit result - Missing extension and signature data");
        
        return {
          escrowAddress: mockEscrowAddress,
          transactionHash: mockTransactionHash,
          blockHash: `0x${randomBytes(32).toString('hex')}`,
          blockTimestamp: Math.floor(Date.now() / 1000),
          srcEscrowEvent: [] as any, // Mock event data
        };
      }

      // We have the required fields, proceed with actual EVM adapter call
      console.log("Using actual EVM adapter with extension and signature data");
      
      // Re-create the order object from serialized data
      // Need to decode the extension string back to Extension object
      const extension = Extension.decode(order.extension);
      const evmOrder = EvmCrossChainOrder.fromDataAndExtension(
        order,
        extension
      );

      // Execute deposit (order hash patching happens inside evmAdapter)
      const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
        evmOrder,
        order.signature,
        this.wallet,
        BigInt(order.makingAmount)
      );

      return depositResult;
      
    } catch (error) {
      console.error('Failed to deposit to source escrow:', error);
      throw error;
    }
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