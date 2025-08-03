import {
  JsonRpcProvider,
  Wallet,
  TransactionRequest,
  id,
  Interface,
  toBigInt,
  toBeHex,
  zeroPadValue,
} from "ethers";
import {
  Address,
  EvmCrossChainOrder,
  TakerTraits,
  AmountMode,
  EvmAddress,
  EvmEscrowFactory,
  Immutables,
  HashLock,
  TimeLocks,
  DstImmutablesComplement,
  TonAddress,
} from "@1inch/cross-chain-sdk";
import { Signature } from "ethers";
import { MoleswapConfig } from "./config";
import { OrderConfig } from "./tonAdapter";

// ABI definitions extracted from reference implementation
const RESOLVER_ABI = [
  {
    type: "function",
    name: "deployDst",
    inputs: [
      {
        name: "dstImmutables",
        type: "tuple",
        internalType: "struct IBaseEscrow.Immutables",
        components: [
          {
            name: "orderHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "hashlock",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "maker",
            type: "uint256",
            internalType: "Address",
          },
          {
            name: "taker",
            type: "uint256",
            internalType: "Address",
          },
          {
            name: "token",
            type: "uint256",
            internalType: "Address",
          },
          {
            name: "amount",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "safetyDeposit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "timelocks",
            type: "uint256",
            internalType: "Timelocks",
          },
        ],
      },
      {
        name: "srcCancellationTimestamp",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "deploySrc",
    inputs: [
      {
        name: "immutables",
        type: "tuple",
        components: [
          { name: "orderHash", type: "bytes32" },
          { name: "hashlock", type: "bytes32" },
          { name: "maker", type: "uint256" },
          { name: "taker", type: "uint256" },
          { name: "token", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "safetyDeposit", type: "uint256" },
          { name: "timelocks", type: "uint256" },
        ],
      },
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "salt", type: "uint256" },
          { name: "maker", type: "uint256" },
          { name: "receiver", type: "uint256" },
          { name: "makerAsset", type: "uint256" },
          { name: "takerAsset", type: "uint256" },
          { name: "makingAmount", type: "uint256" },
          { name: "takingAmount", type: "uint256" },
          { name: "makerTraits", type: "uint256" },
        ],
      },
      { name: "r", type: "bytes32" },
      { name: "vs", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "takerTraits", type: "uint256" },
      { name: "args", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "arbitraryCalls",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "arguments", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      {
        name: "escrow",
        type: "address",
        internalType: "contract IEscrow",
      },
      {
        name: "secret",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "immutables",
        type: "tuple",
        internalType: "struct IBaseEscrow.Immutables",
        components: [
          {
            name: "orderHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "hashlock",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "maker",
            type: "uint256",
            internalType: "Address",
          },
          {
            name: "taker",
            type: "uint256",
            internalType: "Address",
          },
          {
            name: "token",
            type: "uint256",
            internalType: "Address",
          },
          {
            name: "amount",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "safetyDeposit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "timelocks",
            type: "uint256",
            internalType: "Timelocks",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const ESCROW_ABI = [
  {
    type: "function",
    name: "withdrawTo",
    inputs: [
      { name: "secret", type: "bytes32" },
      { name: "recipient", type: "address" },
      {
        name: "immutables",
        type: "tuple",
        components: [
          { name: "orderHash", type: "bytes32" },
          { name: "hashlock", type: "bytes32" },
          { name: "maker", type: "uint256" },
          { name: "taker", type: "uint256" },
          { name: "token", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "safetyDeposit", type: "uint256" },
          { name: "timelocks", type: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const ESCROW_FACTORY_ABI = [
  {
    type: "function",
    name: "ESCROW_SRC_IMPLEMENTATION",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ESCROW_DST_IMPLEMENTATION",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "escrow",
        type: "address",
        indexed: false,
      },
      {
        internalType: "bytes32",
        name: "hashlock",
        type: "bytes32",
        indexed: false,
      },
      {
        internalType: "Address",
        name: "taker",
        type: "uint256",
        indexed: false,
      },
    ],
    type: "event",
    name: "DstEscrowCreated",
    anonymous: false,
  },
  {
    type: "event",
    name: "SrcEscrowCreated",
    inputs: [
      {
        name: "srcImmutables",
        type: "tuple",
        indexed: false,
        components: [
          { name: "orderHash", type: "bytes32" },
          { name: "hashlock", type: "bytes32" },
          { name: "maker", type: "uint256" },
          { name: "taker", type: "uint256" },
          { name: "token", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "safetyDeposit", type: "uint256" },
          { name: "timelocks", type: "uint256" },
        ],
      },
      {
        name: "dstImmutablesComplement",
        type: "tuple",
        indexed: false,
        components: [
          { name: "maker", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "token", type: "uint256" },
          { name: "safetyDeposit", type: "uint256" },
          { name: "chainId", type: "uint256" },
        ],
      },
    ],
    anonymous: false,
  },
];

export interface DepositResult {
  escrowAddress: string;
  transactionHash: string;
  blockHash: string;
  blockTimestamp: number;
  srcEscrowEvent: [Immutables<EvmAddress>, DstImmutablesComplement<EvmAddress>];
}

export interface WithdrawResult {
  transactionHash: string;
  blockHash: string;
  blockTimestamp: number;
}

export class EvmAdapter {
  private resolverInterface = new Interface(RESOLVER_ABI);
  private factoryInterface = new Interface(ESCROW_FACTORY_ABI);
  private escrowInterface = new Interface(ESCROW_ABI);
  private srcImplementation?: Address;
  private dstImplementation?: Address;

  constructor(
    private provider: JsonRpcProvider,
    private config: MoleswapConfig
  ) {}

  /**
   * Deploy source escrow and deposit tokens
   */
  async deployAndDepositToSrcEscrow(
    order: EvmCrossChainOrder,
    signature: string,
    taker: Wallet,
    fillAmount: bigint
  ): Promise<DepositResult> {

    // Build transaction for deploySrc
    const tx = this.buildDeploySrcTransaction(order, signature, fillAmount);

    console.log("excuting source escrow");

    // Execute transaction
    const { txHash, blockTimestamp, blockHash } = await this.executeTransaction(
      taker,
      tx
    );

    // Get escrow event from transaction
    const srcEscrowEvent = await this.getSrcDeployEvent(blockHash);

    // Calculate escrow address using standard EVM approach
    const srcEscrowImplementation = await this.getSourceImplementation();
    const escrowAddress = this.calculateSrcEscrowAddress(
      srcEscrowEvent[0],
      srcEscrowImplementation
    );

    return {
      escrowAddress: escrowAddress.toString(),
      transactionHash: txHash,
      blockHash,
      blockTimestamp,
      srcEscrowEvent,
    };
  }

  async createDestinationEscrow(
    wallet: Wallet,
    orderHash: string,
    hashLock: string,
    maker: bigint,
    token: bigint,
    amount: bigint,
    timeLocks: TimeLocks,
    safetyDeposit: bigint
  ) {
    const privateCancellation = timeLocks.toSrcTimeLocks(
      toBigInt((new Date().getTime() / 1000).toFixed(0))
    ).privateCancellation;

    const tx = {
      to: this.config.resolverProxyAddress,
      data: this.resolverInterface.encodeFunctionData("deployDst", [
        {
          orderHash: orderHash,
          hashlock: hashLock,
          maker: maker,
          taker: this.config.resolverProxyAddress,
          token: token,
          amount,
          safetyDeposit,
          timelocks: timeLocks.build(),
        },
        privateCancellation,
      ]),
      value: safetyDeposit,
    };

    const { txHash, blockTimestamp, blockHash } = await this.executeTransaction(
      wallet,
      tx
    );

    return {
      transactionHash: txHash,
      blockHash,
      blockTimestamp,
    };
  }

  /**
   * Build deploySrc transaction
   */
  private buildDeploySrcTransaction(
    order: EvmCrossChainOrder,
    signature: string,
    fillAmount: bigint
  ): TransactionRequest {
    const { r, yParityAndS: vs } = Signature.from(signature);

    const takerTraits = TakerTraits.default()
      .setExtension(order.extension)
      .setAmountMode(AmountMode.maker)
      .setAmountThreshold(order.takingAmount);

    const { args, trait } = takerTraits.encode();

    const immutables = order.toSrcImmutables(
      this.config.sourceChainId,
      new EvmAddress(new Address(this.config.resolverProxyAddress)),
      fillAmount,
      order.escrowExtension.hashLockInfo
    );

    return {
      to: this.config.resolverProxyAddress,
      data: this.resolverInterface.encodeFunctionData("deploySrc", [
        immutables.build(),
        order.build(),
        r,
        vs,
        fillAmount,
        trait,
        args,
      ]),
      value: order.escrowExtension.srcSafetyDeposit,
    };
  }

  /**
   * Execute transaction and return result
   */
  private async executeTransaction(
    signer: Wallet,
    tx: TransactionRequest
  ): Promise<{ txHash: string; blockTimestamp: number; blockHash: string }> {
    // Simulate transaction first
    const gasEstimate = await this.provider.estimateGas({
      ...tx,
      from: signer.address,
    });

    // Add gas buffer
    const gasLimit = (gasEstimate * 120n) / 100n;

    // Send transaction
    const txResponse = await signer.sendTransaction({
      ...tx,
      gasLimit,
    });

    // Wait for confirmation
    const receipt = await txResponse.wait();
    if (!receipt) {
      throw new Error("Transaction failed");
    }

    const block = await this.provider.getBlock(receipt.blockNumber);
    if (!block) {
      throw new Error("Block not found");
    }

    return {
      txHash: receipt.hash,
      blockTimestamp: block.timestamp,
      blockHash: receipt.blockHash,
    };
  }

  /**
   * Get source escrow deployment event with proper handling for EVM→TON cross-chain
   */
  private async getSrcDeployEvent(
    blockHash: string
  ): Promise<[Immutables<EvmAddress>, DstImmutablesComplement<EvmAddress>]> {
    const event = this.factoryInterface.getEvent("SrcEscrowCreated")!;
    const logs = await this.provider.getLogs({
      blockHash,
      address: this.config.escrowFactoryAddress,
      topics: [event.topicHash],
    });

    if (logs.length === 0) {
      throw new Error("SrcEscrowCreated event not found");
    }

    // Decode the event log data
    const decodedLog = this.factoryInterface.decodeEventLog(
      event,
      logs[0].data,
      logs[0].topics
    );
    const srcImmutables = decodedLog.srcImmutables;
    const dstComplement = decodedLog.dstImmutablesComplement;

    return [
      Immutables.new({
        orderHash: srcImmutables.orderHash,
        hashLock: HashLock.fromString(srcImmutables.hashlock),
        maker: EvmAddress.fromBigInt(srcImmutables.maker),
        taker: EvmAddress.fromBigInt(srcImmutables.taker),
        token: EvmAddress.fromBigInt(srcImmutables.token),
        amount: srcImmutables.amount,
        safetyDeposit: srcImmutables.safetyDeposit,
        timeLocks: TimeLocks.fromBigInt(srcImmutables.timelocks),
      }),
      DstImmutablesComplement.new({
        maker: new EvmAddress(Address.fromBigInt(dstComplement.maker)),
        amount: dstComplement.amount,
        // For EVM→TON, the destination token might be TON native (0x0101...),
        // so we create a mock EVM address to avoid parsing errors
        token: this.createMockEvmAddressForTonToken(dstComplement.token),
        safetyDeposit: dstComplement.safetyDeposit,
        taker: new EvmAddress(Address.fromBigInt(dstComplement.chainId)), // chainId used as taker field
      }),
    ];
  }

  /**
   * Create a mock EVM address for TON tokens that can't be converted to EVM addresses
   */
  public createMockEvmAddressForTonToken(tokenBigInt: bigint): EvmAddress {
    // If it's the problematic 0x0101... TON token, return a mock EVM address
    // if parsable ton address return mock token
    try {
      TonAddress.fromBigInt(tokenBigInt);
      return new EvmAddress(
        new Address("0x0000000000000000000000000000000000000000")
      );
    } catch (error) {
      return new EvmAddress(Address.fromBigInt(tokenBigInt));
    }


  }

  /**
   * Withdraw from source escrow using secret
   */
  async withdrawFromSrcEscrow(
    depositResult: DepositResult,
    secret: string,
    recipient: string,
    taker: Wallet
  ): Promise<WithdrawResult> {
    const [immutables] = depositResult.srcEscrowEvent;

    // Build withdrawTo call data for the escrow contract
    const withdrawCalldata = this.escrowInterface.encodeFunctionData(
      "withdrawTo",
      [secret, recipient, immutables.build()]
    );

    // Build arbitraryCalls transaction through resolver
    const tx: TransactionRequest = {
      to: this.config.resolverProxyAddress,
      data: this.resolverInterface.encodeFunctionData("arbitraryCalls", [
        [depositResult.escrowAddress],
        [withdrawCalldata],
      ]),
    };

    // Execute withdrawal
    const { txHash, blockTimestamp, blockHash } = await this.executeTransaction(
      taker,
      tx
    );

    return {
      transactionHash: txHash,
      blockHash,
      blockTimestamp,
    };
  }

  /**
   * Get escrow address from deployment event by hashlock
   * Works for both source and destination escrows
   */
  async getEscrowAddressFromEvent(
    blockHash: string,
    hashLock: string
  ): Promise<{
    escrowAddress: string;
    blockTimestamp: number;
    eventType: "source" | "destination";
  }> {
    // Get block timestamp
    const block = await this.provider.getBlock(blockHash);
    if (!block) {
      throw new Error("Block not found");
    }

    // Try to find destination escrow event first (DstEscrowCreated)
    const dstLogs = await this.provider.getLogs({
      blockHash,
      address: this.config.escrowFactoryAddress,
      topics: [this.factoryInterface.getEvent("DstEscrowCreated")!.topicHash],
    });

    if (dstLogs.length > 0) {
      // Find the event that matches our hashlock
      for (const log of dstLogs) {
        const decodedLog = this.factoryInterface.decodeEventLog(
          "DstEscrowCreated",
          log.data,
          log.topics
        );

        // Check if hashlock matches
        if (decodedLog.hashlock.toLowerCase() === hashLock.toLowerCase()) {
          const escrowAddress = decodedLog.escrow;

          return {
            escrowAddress,
            blockTimestamp: block.timestamp,
            eventType: "destination" as const,
          };
        }
      }
    }

    // Try source escrow event (SrcEscrowCreated)
    const srcLogs = await this.provider.getLogs({
      blockHash,
      address: this.config.escrowFactoryAddress,
      topics: [this.factoryInterface.getEvent("SrcEscrowCreated")!.topicHash],
    });

    if (srcLogs.length > 0) {
      // Find the event that matches our hashlock
      for (const log of srcLogs) {
        const decodedLog = this.factoryInterface.decodeEventLog(
          "SrcEscrowCreated",
          log.data,
          log.topics
        );

        // Check if hashlock matches
        if (
          decodedLog.srcImmutables.hashlock.toLowerCase() ===
          hashLock.toLowerCase()
        ) {
          const [srcImmutables] = await this.getSrcDeployEvent(blockHash);
          const srcImplementation = await this.getSourceImplementation();
          const escrowAddress = this.calculateSrcEscrowAddress(
            srcImmutables,
            srcImplementation
          );

          return {
            escrowAddress: escrowAddress.toString(),
            blockTimestamp: block.timestamp,
            eventType: "source" as const,
          };
        }
      }
    }

    throw new Error(
      `No escrow deployment event found with hashlock ${hashLock} in block ${blockHash}`
    );
  }

  /**
   * Get source escrow event from a known block hash (for external use)
   */
  async getSrcDeployEventFromReceipt(
    blockHash: string
  ): Promise<[Immutables<EvmAddress>, DstImmutablesComplement<EvmAddress>]> {
    return this.getSrcDeployEvent(blockHash);
  }

  /**
   * Get source implementation address
   */
  private async getSourceImplementation(): Promise<Address> {
    if (!this.srcImplementation) {
      this.srcImplementation = Address.fromBigInt(
        BigInt(
          await this.provider.call({
            to: this.config.escrowFactoryAddress,
            data: id("ESCROW_SRC_IMPLEMENTATION()").slice(0, 10),
          })
        )
      );
    }
    return this.srcImplementation;
  }

  /**
   * Calculate source escrow address
   */
  private calculateSrcEscrowAddress(
    immutables: Immutables<EvmAddress>,
    implementation: Address
  ): EvmAddress {
    return new EvmEscrowFactory(
      new EvmAddress(new Address(this.config.escrowFactoryAddress))
    ).getSrcEscrowAddress(immutables, new EvmAddress(implementation));
  }

  /**
   * Complete destination escrow withdrawal using calculated address
   */
  async withdrawFromDstEscrow(
    escrowAddress: string,
    wallet: Wallet,
    orderHash: string,
    hashLock: string,
    maker: bigint,
    token: bigint,
    amount: bigint,
    timeLocks: TimeLocks,
    safetyDeposit: bigint,
    secret: string,
    deployedAt: bigint
  ): Promise<WithdrawResult> {
    const tl = timeLocks.setDeployedAt(deployedAt).build();

    const tx: TransactionRequest = {
      to: this.config.resolverProxyAddress,
      data: this.resolverInterface.encodeFunctionData("withdraw", [
        escrowAddress,
        secret,
        {
          orderHash: orderHash,
          hashlock: hashLock,
          maker: maker,
          taker: this.config.resolverProxyAddress,
          token: token,
          amount,
          safetyDeposit,
          timelocks: tl,
        },
      ]),
    };

    // Execute withdrawal
    const { txHash, blockTimestamp, blockHash } = await this.executeTransaction(
      wallet,
      tx
    );

    return {
      transactionHash: txHash,
      blockHash,
      blockTimestamp,
    };
  }

  /**
   * Streamlined method to create destination escrow using OrderConfig
   */
  async createDestinationEscrowFromOrder(
    wallet: Wallet,
    orderConfig: OrderConfig
  ) {
    const orderHash = zeroPadValue(toBeHex(orderConfig.order_hash!), 32);
    const hashLock = zeroPadValue(toBeHex(orderConfig.hashlock.toString()), 32);
    const maker = BigInt(orderConfig.receiver_address!.toString());
    const token = BigInt(orderConfig.taker_asset!.toString());
    const amount = orderConfig.taking_amount!;
    const timeLocks = orderConfig.timeLocks;
    const safetyDeposit = orderConfig.dstSafetyDeposit!;

    return this.createDestinationEscrow(
      wallet,
      orderHash,
      hashLock,
      maker,
      token,
      amount,
      timeLocks,
      safetyDeposit
    );
  }

  /**
   * Streamlined method to withdraw from destination escrow using OrderConfig
   */
  async withdrawFromDstEscrowWithOrder(
    escrowAddress: string,
    wallet: Wallet,
    orderConfig: OrderConfig,
    secret: string,
    deployedAt: bigint
  ) {
    const orderHash = zeroPadValue(toBeHex(orderConfig.order_hash!), 32);
    const hashLock = zeroPadValue(toBeHex(orderConfig.hashlock.toString()), 32);
    const maker = BigInt(orderConfig.receiver_address!.toString());
    const token = BigInt(orderConfig.taker_asset!.toString());
    const amount = orderConfig.taking_amount!;
    const timeLocks = orderConfig.timeLocks;
    const safetyDeposit = orderConfig.dstSafetyDeposit!;

    return this.withdrawFromDstEscrow(
      escrowAddress,
      wallet,
      orderHash,
      hashLock,
      maker,
      token,
      amount,
      timeLocks,
      safetyDeposit,
      secret,
      deployedAt
    );
  }
}
