import {
  JsonRpcProvider,
  Wallet,
  TransactionRequest,
  id,
  Interface,
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
} from "@1inch/cross-chain-sdk";
import { Signature } from "ethers";
import { MoleswapConfig } from "./config";

// ABI definitions extracted from reference implementation
const RESOLVER_ABI = [
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
    // Patch order hash method to ensure consistency with maker's signature
    await this.patchOrderHash(order);

    // Build transaction for deploySrc
    const tx = this.buildDeploySrcTransaction(order, signature, fillAmount);

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
    order: EvmCrossChainOrder,
    signature: string,
    taker: Wallet,
    fillAmount: bigint
  ) {

    



  };

  /**
   * Patch order hash method to ensure consistency with maker's signature
   * This is needed so that when SDK serializes back order object it calculates
   * the correct hash that matches the maker's signature
   */
  private async patchOrderHash(order: EvmCrossChainOrder): Promise<void> {
    const { buildOrderTypedData } = await import("@1inch/limit-order-sdk");

    const typedData = buildOrderTypedData(
      this.config.sourceChainId,
      this.config.lopAddress,
      "1inch Limit Order Protocol",
      "4",
      order.build()
    );

    const domainForSignature = {
      ...typedData.domain,
      chainId: this.config.sourceChainId,
    };

    // Patch the getOrderHash method to use the correct domain
    (order as any).getOrderHash = (_srcChainId: number) => {
      const { ethers } = require("ethers");
      return ethers.TypedDataEncoder.hash(
        domainForSignature,
        { Order: typedData.types.Order },
        typedData.message
      );
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
  private createMockEvmAddressForTonToken(tokenBigInt: bigint): EvmAddress {
    // If it's the problematic 0x0101... TON token, return a mock EVM address
    const tokenHex = tokenBigInt.toString(16).padStart(64, "0");
    if (tokenHex.startsWith("01010101")) {
      // Return a mock address that represents TON native token
      return new EvmAddress(
        new Address("0x0000000000000000000000000000000000000000")
      );
    }
    // Otherwise try to convert normally
    return new EvmAddress(Address.fromBigInt(tokenBigInt));
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
    return Address.fromBigInt(
      BigInt(
        await this.provider.call({
          to: this.config.escrowFactoryAddress,
          data: id("ESCROW_SRC_IMPLEMENTATION()").slice(0, 10),
        })
      )
    );
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
}
