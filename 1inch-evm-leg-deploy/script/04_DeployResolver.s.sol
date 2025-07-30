// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";

// Import Resolver from cross-chain-resolver-example submodule
import {Resolver} from "../external/cross-chain-resolver-example/contracts/src/Resolver.sol";
import {IEscrowFactory} from "../external/cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import {IOrderMixin} from "../external/limit-order-protocol/contracts/interfaces/IOrderMixin.sol";

// Import CREATE3 deployer
import {Create3Deployer} from "../lib/Create3Deployer.sol";

// Import constants
import {Constants} from "./utils/Constants.sol";

/**
 * @title Deploy Resolver Script
 * @dev Deploys Resolver using CREATE3 with EscrowFactory and LOP addresses
 */
contract DeployResolver is Script {
    function run() external {
        // Validate we're on the correct network
        Constants.validateChainId();
        
        console.log("=== Deploying Resolver via CREATE3 on Sepolia ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);
        
        // Get required addresses from environment
        address create3DeployerAddr = vm.envAddress("CREATE3_DEPLOYER_ADDRESS");
        address lopAddress = vm.envAddress("LOP_ADDRESS");
        address escrowFactoryAddress = vm.envAddress("ESCROW_FACTORY_ADDRESS");
        
        // Validate all addresses
        Constants.validateAddress(create3DeployerAddr, "CREATE3_DEPLOYER_ADDRESS");
        Constants.validateAddress(lopAddress, "LOP_ADDRESS");
        Constants.validateAddress(escrowFactoryAddress, "ESCROW_FACTORY_ADDRESS");
        
        Create3Deployer create3Deployer = Create3Deployer(create3DeployerAddr);
        console.log("Using CREATE3Deployer at:", address(create3Deployer));
        
        // Log configuration
        console.log("\n=== Configuration ===");
        console.log("EscrowFactory address:", escrowFactoryAddress);
        console.log("LOP address:", lopAddress);
        console.log("Initial owner will be:", msg.sender);
        
        // Predict Resolver address before deployment
        address predictedResolver = create3Deployer.addressOf(Constants.RESOLVER_SALT);
        console.log("\n=== Predicted Address ===");
        console.log("Resolver will be deployed at:", predictedResolver);
        
        vm.startBroadcast();
        
        // Deploy Resolver with CREATE3
        address resolverAddress = create3Deployer.deploy(
            Constants.RESOLVER_SALT,
            abi.encodePacked(
                type(Resolver).creationCode,
                abi.encode(
                    IEscrowFactory(escrowFactoryAddress),  // factory
                    IOrderMixin(lopAddress),               // lop
                    msg.sender                             // initial owner
                )
            )
        );
        
        // Transfer ownership to taker immediately after deployment
        console.log("Transferring ownership to taker:", vm.envAddress("TAKER_PUB"));
        Resolver(payable(resolverAddress)).transferOwnership(vm.envAddress("TAKER_PUB"));
        
        vm.stopBroadcast();
        
        // Verify address matches prediction
        require(resolverAddress == predictedResolver, "Resolver address mismatch");
        
        // Cast to contract for testing
        Resolver resolver = Resolver(payable(resolverAddress));
        
        // Verify deployment
        console.log("\n=== Deployment Results ===");
        console.log("Resolver deployed at:", address(resolver));
        console.log("Resolver owner:", resolver.owner());
        
        // Test basic functionality
        console.log("\n=== Basic Validation ===");
        require(address(resolver) != address(0), "DeployResolver: Resolver not deployed");
        require(resolver.owner() == vm.envAddress("TAKER_PUB"), "DeployResolver: Ownership transfer failed");
        
        console.log("All validations passed");
        
        // Export address for use in subsequent scripts
        console.log("\n=== Environment Variables ===");
        console.log("RESOLVER_ADDRESS=", address(resolver));
        
        console.log("\n=== CREATE3 Benefits ===");
        console.log("This Resolver address will be IDENTICAL on all networks!");
        console.log("Salt 'RESOLVER_SALT' always produces:", address(resolver));
        
        console.log("\n=== Next Steps ===");
        console.log("1. Update .env file with RESOLVER_ADDRESS");
        console.log("2. Resolver ownership transferred to taker");
        console.log("3. Taker can now call deploySrc function");
        console.log("4. All contracts are ready for cross-chain swaps!");
        
        console.log("\n=== Deployment Summary ===");
        console.log("CREATE3Deployer:", create3DeployerAddr);
        console.log("MockERC20:", vm.envAddress("MOCK_ERC20_ADDRESS"));
        console.log("ERC20True:", vm.envAddress("ERC20_TRUE_ADDRESS"));
        console.log("LimitOrderProtocol:", lopAddress);
        console.log("EscrowFactory:", escrowFactoryAddress);
        console.log("Resolver:", address(resolver));
    }
}