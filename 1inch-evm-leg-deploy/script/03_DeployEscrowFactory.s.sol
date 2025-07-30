// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";

// Import EscrowFactory from cross-chain-swap submodule
import {EscrowFactory} from "cross-chain-swap/contracts/EscrowFactory.sol";

// Import CREATE3 deployer
import {Create3Deployer} from "../lib/Create3Deployer.sol";

// Import constants
import {Constants} from "./utils/Constants.sol";

/**
 * @title Deploy EscrowFactory Script
 * @dev Deploys EscrowFactory using CREATE3 with LOP, mock tokens, and proper configuration
 */
contract DeployEscrowFactory is Script {
    function run() external {
        // Validate we're on the correct network
        Constants.validateChainId();
        
        console.log("=== Deploying EscrowFactory via CREATE3 on Sepolia ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);
        
        // Get required addresses from environment
        address create3DeployerAddr = vm.envAddress("CREATE3_DEPLOYER_ADDRESS");
        address lopAddress = vm.envAddress("LOP_ADDRESS");
        address mockERC20Address = vm.envAddress("MOCK_ERC20_ADDRESS");
        
        // Validate all addresses
        Constants.validateAddress(create3DeployerAddr, "CREATE3_DEPLOYER_ADDRESS");
        Constants.validateAddress(lopAddress, "LOP_ADDRESS");
        Constants.validateAddress(mockERC20Address, "MOCK_ERC20_ADDRESS");
        
        Create3Deployer create3Deployer = Create3Deployer(create3DeployerAddr);
        console.log("Using CREATE3Deployer at:", address(create3Deployer));
        
        // Log configuration
        console.log("\n=== Configuration ===");
        console.log("LOP address:", lopAddress);
        console.log("Fee token (MockERC20):", mockERC20Address);
        console.log("Access token (mockERC20):", mockERC20Address);
        console.log("Fee bank owner will be:", msg.sender);
        console.log("Rescue delay:", Constants.RESCUE_DELAY, "seconds (8 days)");
        
        // Predict EscrowFactory address before deployment
        address predictedEscrowFactory = create3Deployer.addressOf(Constants.ESCROW_FACTORY_SALT);
        console.log("\n=== Predicted Address ===");
        console.log("EscrowFactory will be deployed at:", predictedEscrowFactory);
        
        vm.startBroadcast();
        
        // Deploy EscrowFactory with CREATE3
        address escrowFactoryAddress = create3Deployer.deploy(
            Constants.ESCROW_FACTORY_SALT,
            abi.encodePacked(
                type(EscrowFactory).creationCode,
                abi.encode(
                    lopAddress,                    // LOP address
                    mockERC20Address,             // fee token
                    mockERC20Address,             // access token  
                    msg.sender,                   // fee bank owner
                    Constants.RESCUE_DELAY,       // src withdraw delay
                    Constants.RESCUE_DELAY        // dst withdraw delay
                )
            )
        );
        
        vm.stopBroadcast();
        
        // Verify address matches prediction
        require(escrowFactoryAddress == predictedEscrowFactory, "EscrowFactory address mismatch");
        
        // Cast to contract for testing
        EscrowFactory escrowFactory = EscrowFactory(escrowFactoryAddress);
        
        // Verify deployment
        console.log("\n=== Deployment Results ===");
        console.log("EscrowFactory deployed at:", address(escrowFactory));
        console.log("Escrow SRC implementation:", escrowFactory.ESCROW_SRC_IMPLEMENTATION());
        console.log("Escrow DST implementation:", escrowFactory.ESCROW_DST_IMPLEMENTATION());
        
        // Test basic functionality
        console.log("\n=== Basic Validation ===");
        require(address(escrowFactory) != address(0), "DeployEscrowFactory: EscrowFactory not deployed");
        require(escrowFactory.ESCROW_SRC_IMPLEMENTATION() != address(0), "DeployEscrowFactory: SRC implementation not set");
        require(escrowFactory.ESCROW_DST_IMPLEMENTATION() != address(0), "DeployEscrowFactory: DST implementation not set");
        
        console.log("All validations passed");
        
        // Export address for use in subsequent scripts
        console.log("\n=== Environment Variables ===");
        console.log("ESCROW_FACTORY_ADDRESS=", address(escrowFactory));
        
        console.log("\n=== CREATE3 Benefits ===");
        console.log("This EscrowFactory address will be IDENTICAL on all networks!");
        console.log("Salt 'ESCROW_FACTORY_SALT' always produces:", address(escrowFactory));
        
        console.log("\n=== Next Steps ===");
        console.log("1. Update .env file with ESCROW_FACTORY_ADDRESS");
        console.log("2. Run: forge script script/04_DeployResolver.s.sol");
    }
}