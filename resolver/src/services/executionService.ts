import { randomBytes } from "crypto";
import { Wallet, JsonRpcProvider } from "ethers";
import axios from "axios";
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
  private relayerUrl: string;

  constructor(config: ExecutionConfig, relayerService: RelayerService, resolverConfig?: ResolverConfig) {
    this.config = config;
    this.relayerService = relayerService;
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.privateKey, this.provider);
    this.resolverConfig = resolverConfig || this.loadDefaultConfig();
    this.relayerUrl = process.env.RELAYER_URL || 'http://localhost:3000';
  }

  private loadDefaultConfig(): ResolverConfig {
    // Load default config if not provided
    const { loadConfig } = require('../config');
    return loadConfig();
  }

  /**
   * Execute a cross-chain order with complete atomic swap flow
   */
  async executeOrder(orderWithMetadata: OrderWithMetadata): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { order, orderHash } = orderWithMetadata;

    try {
      console.log(`🚀 Starting complete cross-chain execution for order: ${orderHash}`);

      // Step 1: Deposit to source escrow (EVM)
      console.log('📥 Step 1: Depositing to source escrow...');
      const depositResult = await this.depositToSrcEscrow(orderWithMetadata);
      console.log('✅ Source escrow deposit completed:', {
        escrowAddress: depositResult.escrowAddress,
        transactionHash: depositResult.transactionHash
      });

      // Step 2: Create destination escrow (TON)
      console.log('📥 Step 2: Creating destination escrow...');
      const destinationResult = await this.createDestinationEscrow(orderWithMetadata, depositResult);
      console.log('✅ Destination escrow created:', {
        dstEscrowAddress: destinationResult.dstEscrowAddress,
        transactionHash: destinationResult.transactionHash
      });

      // Step 3: Wait for finality on both sides
      console.log('⏳ Step 3: Waiting for finality on both sides...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Step 4: Request secret from relayer
      console.log('🔐 Step 4: Requesting secret from relayer...');
      const secret = await this.requestSecretFromRelayer(orderHash, depositResult.escrowAddress, destinationResult.dstEscrowAddress);
      console.log('✅ Secret retrieved successfully');

      // Step 5: Withdraw from TON destination escrow
      console.log('🚀 Step 5: Withdrawing from TON destination escrow...');
      const tonWithdrawResult = await this.withdrawFromDestinationEscrow(orderHash, secret);
      console.log('✅ TON withdrawal completed:', {
        transactionHash: tonWithdrawResult.transactionHash
      });

      // Step 6: Withdraw from EVM source escrow
      console.log('🚀 Step 6: Withdrawing from EVM source escrow...');
      const evmWithdrawResult = await this.withdrawFromSourceEscrow(depositResult, secret);
      console.log('✅ EVM withdrawal completed:', {
        transactionHash: evmWithdrawResult.transactionHash
      });

      console.log('🎉 Complete cross-chain atomic swap executed successfully!');

      return {
        success: true,
        orderHash,
        transactionHash: depositResult.transactionHash,
        executionTime: Date.now() - startTime,
        profit: this.calculateProfit(order),
        gasUsed: 0, // TODO: Calculate actual gas used
        additionalTransactions: {
          tonWithdraw: tonWithdrawResult.transactionHash,
          evmWithdraw: evmWithdrawResult.transactionHash
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Execution failed for order ${orderHash}:`, error);

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
  private async depositToSrcEscrow(orderWithMetadata: OrderWithMetadata): Promise<DepositResult> {
    try {
      // Initialize EVM adapter with required configuration
      const evmConfig: EvmAdapterConfig = {
        resolverProxyAddress: this.resolverConfig.crossChain.resolverProxyAddress,
        sourceChainId: this.resolverConfig.crossChain.sourceNetworkId,
        lopAddress: this.resolverConfig.crossChain.lopAddress,
        escrowFactoryAddress: this.resolverConfig.crossChain.escrowFactoryAddress,
      };

      const evmAdapter = new EvmAdapter(this.provider, evmConfig);

      console.log('🔍 Debug: Raw order data structure:', {
        hasOrderField: !!orderWithMetadata.order,
        orderType: typeof orderWithMetadata.order,
        hasExtension: !!orderWithMetadata.extension,
        hasSignature: !!orderWithMetadata.signature,
        extensionLength: orderWithMetadata.extension?.length || 0,
        signatureLength: orderWithMetadata.signature?.length || 0
      });

      // Extract data from OrderWithMetadata
      const orderData = orderWithMetadata.order;
      const extension = orderWithMetadata.extension;
      const signature = orderWithMetadata.signature;

      // Check if we have the required extension and signature fields
      if (!extension || !signature) {
        console.log("Order data available:", {
          maker: orderData.maker,
          makerAsset: orderData.makerAsset,
          takerAsset: orderData.takerAsset,
          makingAmount: orderData.makingAmount,
          takingAmount: orderData.takingAmount,
          receiver: orderData.receiver,
          hasExtension: !!extension,
          hasSignature: !!signature,
          extensionLength: extension?.length || 0,
          signatureLength: signature?.length || 0
        });
        throw new Error('Order missing required extension or signature data');
      }

      // Re-create the order object from serialized data
      const decodedExtension = Extension.decode(extension);
      const evmOrder = EvmCrossChainOrder.fromDataAndExtension(
        orderData,
        decodedExtension
      );

      // Execute deposit
      const depositResult = await evmAdapter.deployAndDepositToSrcEscrow(
        evmOrder,
        signature,
        this.wallet,
        BigInt(orderData.makingAmount)
      );

      return depositResult;
      
    } catch (error) {
      console.error('❌ Failed to deposit to source escrow:', error);
      throw error;
    }
  }

  /**
   * Create destination escrow (TON side)
   */
  private async createDestinationEscrow(orderWithMetadata: OrderWithMetadata, depositResult: DepositResult) {
    try {
      // Extract data from OrderWithMetadata
      const orderData = orderWithMetadata.order;
      const extension = orderWithMetadata.extension;
      const signature = orderWithMetadata.signature;
      const orderHash = orderWithMetadata.orderHash;

      // Validate required fields
      if (!extension || !signature) {
        throw new Error('OrderWithMetadata missing required extension or signature data');
      }

      // Re-create the order object from stored data
      const decodedExtension = Extension.decode(extension);
      const evmOrder = EvmCrossChainOrder.fromDataAndExtension(
        orderData,
        decodedExtension
      );

      // Create TON order configuration
      const tonOrder = TonAdapter.createEvmToTonOrderConfig(
        {
          order: orderData,
          extension: extension,
          signature: signature,
          orderHash: orderHash
        },
        evmOrder.receiver.toString()
      );

      // Create destination escrow using TON adapter
      const result = await TonAdapter.createDestinationEscrow(
        this.resolverConfig.crossChain.tonLopAddress,
        tonOrder
      );

      if (!result.success) {
        throw new Error(`TON escrow creation failed: ${result.error}`);
      }

      // Get the deployed escrow address
      const dstEscrowAddress = await TonAdapter.getDstEscrowAddressFromOrder(orderHash);

      return {
        dstEscrowAddress,
        transactionHash: result.transactionHash!,
        success: true
      };
    } catch (error) {
      console.error('❌ Failed to create TON destination escrow:', error);
      throw error;
    }
  }

  /**
   * Request secret from relayer API
   */
  private async requestSecretFromRelayer(orderHash: string, srcEscrowAddress: string, dstEscrowAddress: string): Promise<string> {
    try {
      // Use dummy addresses for validation since we're using dummy plugins
      const dummySrcEscrow = srcEscrowAddress || "0x0000000000000000000000000000000000000000";
      const dummyDstEscrow = "0x0000000000000000000000000000000000000000"; // Use dummy address for TON
      
      const response = await axios.post(`${this.relayerUrl}/api/secrets/${orderHash}`, {
        srcEscrowAddress: dummySrcEscrow,
        dstEscrowAddress: dummyDstEscrow,
        srcChainId: this.resolverConfig.crossChain.sourceNetworkId.toString(),
        dstChainId: this.resolverConfig.crossChain.destinationNetworkId.toString()
      });

      if (!response.data.success) {
        throw new Error(`Failed to get secret: ${response.data.error?.message || 'Unknown error'}`);
      }

      return response.data.data.secret;
    } catch (error) {
      console.error('❌ Failed to request secret from relayer:', error);
      throw error;
    }
  }

  /**
   * Withdraw from destination escrow (TON)
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
      console.error('❌ Failed to withdraw from TON destination escrow:', error);
      throw error;
    }
  }

  /**
   * Withdraw from source escrow (EVM)
   */
  private async withdrawFromSourceEscrow(depositResult: DepositResult, secret: string) {
    try {
      // Import the EvmAdapter
      const { EvmAdapter } = await import('./lib/evmAdapter');
      
      // Create EVM adapter config
      const evmConfig = {
        resolverProxyAddress: this.resolverConfig.crossChain.resolverProxyAddress,
        sourceChainId: this.resolverConfig.crossChain.sourceNetworkId,
        lopAddress: this.resolverConfig.crossChain.lopAddress,
        escrowFactoryAddress: this.resolverConfig.crossChain.escrowFactoryAddress,
      };

      const evmAdapter = new EvmAdapter(this.provider, evmConfig);

      // Execute withdrawal to taker address
      const withdrawResult = await evmAdapter.withdrawFromSrcEscrow(
        depositResult,
        secret,
        this.wallet.address,
        this.wallet
      );

      return withdrawResult;
    } catch (error) {
      console.error('❌ Failed to withdraw from EVM source escrow:', error);
      throw error;
    }
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

  /**
   * Check if an order is profitable to execute
   */
  async isOrderProfitable(order: any): Promise<boolean> {
    try {
      // Calculate potential profit
      const profit = this.calculateProfit(order);
      
      // Get current gas price for cost estimation
      const gasPrice = await this.getGasPrice();
      const estimatedGasCost = this.config.gasLimit * parseFloat(gasPrice);
      
      // Check if profit exceeds gas costs plus minimum threshold
      const minimumProfitThreshold = 0.001; // 0.001 ETH minimum profit
      const totalCost = estimatedGasCost + minimumProfitThreshold;
      
      const isProfitable = profit > totalCost;
      
      console.log('💰 Profitability check:', {
        estimatedProfit: profit,
        estimatedGasCost,
        minimumThreshold: minimumProfitThreshold,
        totalCost,
        isProfitable
      });
      
      return isProfitable;
    } catch (error) {
      console.error('Failed to check profitability:', error);
      return false;
    }
  }

  /**
   * Execute profitable orders automatically
   */
  async executeProfitableOrders(orders: OrderWithMetadata[]): Promise<ExecutionResult[]> {
    console.log(`🔍 Checking ${orders.length} orders for profitability...`);
    
    const results: ExecutionResult[] = [];
    
    for (const orderWithMetadata of orders) {
      try {
        const { order } = orderWithMetadata;
        
        // Check if order is profitable
        const isProfitable = await this.isOrderProfitable(order);
        
        if (isProfitable) {
          console.log(`💰 Order ${orderWithMetadata.orderHash} is profitable - executing...`);
          const result = await this.executeOrder(orderWithMetadata);
          results.push(result);
        } else {
          console.log(`❌ Order ${orderWithMetadata.orderHash} is not profitable - skipping`);
          results.push({
            success: false,
            orderHash: orderWithMetadata.orderHash,
            error: 'Order not profitable',
            executionTime: 0
          });
        }
      } catch (error) {
        console.error(`❌ Failed to process order ${orderWithMetadata.orderHash}:`, error);
        results.push({
          success: false,
          orderHash: orderWithMetadata.orderHash,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: 0
        });
      }
    }
    
    return results;
  }
} 