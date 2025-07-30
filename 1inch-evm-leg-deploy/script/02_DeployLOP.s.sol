// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";

// Import LimitOrderProtocol from submodule
import {LimitOrderProtocol} from "limit-order-protocol/contracts/LimitOrderProtocol.sol";

// Import CREATE3 deployer
import {Create3Deployer} from "../lib/Create3Deployer.sol";

// Import constants
import {Constants} from "./utils/Constants.sol";

/**
 * @title Deploy LimitOrderProtocol Script
 * @dev Deploys LimitOrderProtocol using CREATE3 with existing Sepolia WETH
 */
contract DeployLOP is Script {
    function run() external {
        // Validate we're on the correct network
        Constants.validateChainId();

        console.log(
            "=== Deploying LimitOrderProtocol via CREATE3 on Sepolia ==="
        );
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);
        console.log("WETH Address:", Constants.WETH_ADDRESS);

        // Validate WETH address
        Constants.validateAddress(Constants.WETH_ADDRESS, "WETH_ADDRESS");

        // Get CREATE3Deployer address from environment
        address create3DeployerAddr = vm.envAddress("CREATE3_DEPLOYER_ADDRESS");
        Constants.validateAddress(
            create3DeployerAddr,
            "CREATE3_DEPLOYER_ADDRESS"
        );

        Create3Deployer create3Deployer = Create3Deployer(create3DeployerAddr);
        console.log("Using CREATE3Deployer at:", address(create3Deployer));

        // Predict LOP address before deployment
        address predictedLOP = create3Deployer.addressOf(Constants.LOP_SALT);
        console.log("\n=== Predicted Address ===");
        console.log("LimitOrderProtocol will be deployed at:", predictedLOP);

        vm.startBroadcast();

        // Deploy LimitOrderProtocol with CREATE3
        address lopAddress = create3Deployer.deploy(
            Constants.LOP_SALT,
            abi.encodePacked(
                type(LimitOrderProtocol).creationCode,
                abi.encode(Constants.WETH_ADDRESS)
            )
        );

        vm.stopBroadcast();

        // Verify address matches prediction
        require(lopAddress == predictedLOP, "LOP address mismatch");

        // Cast to contract for testing (payable cast needed for contract with fallback)
        LimitOrderProtocol lop = LimitOrderProtocol(payable(lopAddress));

        // Verify deployment
        console.log("\n=== Deployment Results ===");
        console.log("LimitOrderProtocol deployed at:", address(lop));
        console.log("Owner:", lop.owner());
        console.log("WETH Address (configured):", Constants.WETH_ADDRESS);
        console.log("Paused:", lop.paused());

        // Test basic functionality
        console.log("\n=== Basic Validation ===");
        // Note: With CREATE3, the owner will be set by the deployment context
        // We just verify it's set to a valid address (not zero)
        require(lop.owner() != address(0), "DeployLOP: Owner not set");
        require(!lop.paused(), "DeployLOP: Contract should not be paused");
        require(
            lop.DOMAIN_SEPARATOR() != bytes32(0),
            "DeployLOP: Domain separator not set"
        );

        console.log("CREATE3Deployer:", address(create3Deployer));
        console.log("Script deployer:", msg.sender);
        console.log("LOP owner:", lop.owner());
        console.log(
            "Owner is valid (non-zero):",
            lop.owner() != address(0) ? "YES" : "NO"
        );

        console.log("All validations passed");

        // Export address for use in subsequent scripts
        console.log("\n=== Environment Variables ===");
        console.log("LOP_ADDRESS=", address(lop));

        console.log("\n=== CREATE3 Benefits ===");
        console.log(
            "This LOP address will be IDENTICAL on all networks using the same CREATE3Deployer!"
        );
        console.log("Salt 'LOP_SALT' always produces:", address(lop));

        console.log("\n=== Next Steps ===");
        console.log("1. Update .env file with LOP_ADDRESS");
        console.log("2. Run: forge script script/03_DeployEscrowFactory.s.sol");
        console.log("Domain Separator:", vm.toString(lop.DOMAIN_SEPARATOR()));
    }
}
