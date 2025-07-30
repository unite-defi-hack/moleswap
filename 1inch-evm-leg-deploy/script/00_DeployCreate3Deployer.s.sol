// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";

// Import CREATE3 contracts from lib/
import {Create3Deployer} from "../lib/Create3Deployer.sol";

// Import constants
import {Constants} from "./utils/Constants.sol";

/**
 * @title Deploy CREATE3 Deployer Script
 * @dev Deploys the CREATE3Deployer contract - this is the foundation for all deterministic deployments
 */
contract DeployCreate3Deployer is Script {
    function run() external {
        // Validate we're on the correct network
        Constants.validateChainId();
        
        console.log("=== Deploying CREATE3Deployer on Sepolia ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);
        
        vm.startBroadcast();
        
        // Deploy CREATE3Deployer (this will have different addresses on different networks)
        // But it will be used to create identical addresses for all other contracts
        Create3Deployer create3Deployer = new Create3Deployer();
        
        vm.stopBroadcast();
        
        // Log deployment results
        console.log("\n=== Deployment Results ===");
        console.log("CREATE3Deployer deployed at:", address(create3Deployer));
        console.log("Owner:", create3Deployer.owner());
        
        // Test basic functionality
        console.log("\n=== Basic Validation ===");
        require(create3Deployer.owner() == msg.sender, "DeployCreate3Deployer: Owner not set correctly");
        
        // Test address prediction
        bytes32 testSalt = keccak256("TEST_SALT");
        address predictedAddress = create3Deployer.addressOf(testSalt);
        console.log("Test predicted address for salt 'TEST_SALT':", predictedAddress);
        
        console.log("All validations passed");
        
        // Export address for use in subsequent scripts
        console.log("\n=== Environment Variables ===");
        console.log("CREATE3_DEPLOYER_ADDRESS=", address(create3Deployer));
        
        console.log("\n=== Next Steps ===");
        console.log("1. Update .env file with CREATE3_DEPLOYER_ADDRESS");
        console.log("2. Run: forge script script/01_DeployMockTokens.s.sol");
        
        console.log("\n=== Important Note ===");
        console.log("This CREATE3Deployer address will be DIFFERENT on each network,");
        console.log("but it will create IDENTICAL addresses for all deployed contracts using the same salts.");
    }
}