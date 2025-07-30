// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";

// Import mock tokens
import {MockERC20} from "./01_DeployMockTokens.s.sol";

// Import constants
import {Constants} from "./utils/Constants.sol";

/**
 * @title Post-Deployment Setup Script
 * @dev Mints MockERC20 tokens and sets up approvals for end-to-end testing
 */
contract FundTestAccounts is Script {
    
    // Test amounts
    uint256 constant TOKEN_AMOUNT = 10 ether;  // 10 MockERC20 tokens each
    
    function run() external {
        // Validate we're on the correct network
        Constants.validateChainId();
        
        console.log("=== Post-Deployment Setup: Funding & Approvals on Sepolia ===");
        console.log("Chain ID:", block.chainid);
        console.log("Minter (deployer):", msg.sender);
        
        // Get required addresses from environment
        address mockERC20Address = vm.envAddress("MOCK_ERC20_ADDRESS");
        address lopAddress = vm.envAddress("LOP_ADDRESS");
        address makerAddress = vm.envAddress("MAKER_PUB");
        address takerAddress = vm.envAddress("TAKER_PUB");
        
        // Validate all addresses
        Constants.validateAddress(mockERC20Address, "MOCK_ERC20_ADDRESS");
        Constants.validateAddress(lopAddress, "LOP_ADDRESS");
        Constants.validateAddress(makerAddress, "MAKER_PUB");
        Constants.validateAddress(takerAddress, "TAKER_PUB");
        
        // Cast to contract
        MockERC20 mockERC20 = MockERC20(mockERC20Address);
        
        console.log("\n=== Configuration ===");
        console.log("MockERC20 address:", address(mockERC20));
        console.log("LimitOrderProtocol address:", lopAddress);
        console.log("Maker address:", makerAddress);
        console.log("Taker address:", takerAddress);
        console.log("Token amount per account:", TOKEN_AMOUNT);
        
        // Check current balances before minting
        console.log("\n=== Pre-Minting Balances ===");
        console.log("Maker MockERC20 balance:", mockERC20.balanceOf(makerAddress));
        console.log("Taker MockERC20 balance:", mockERC20.balanceOf(takerAddress));
        
        vm.startBroadcast();
        
        // Mint MockERC20 tokens to both maker and taker
        console.log("\n=== Minting MockERC20 Tokens ===");
        console.log("Minting", TOKEN_AMOUNT, "MockERC20 to maker...");
        mockERC20.mint(makerAddress, TOKEN_AMOUNT);
        
        console.log("Minting", TOKEN_AMOUNT, "MockERC20 to taker...");
        mockERC20.mint(takerAddress, TOKEN_AMOUNT);
        
        vm.stopBroadcast();
        
        // Set up approvals for LimitOrderProtocol (using maker's private key)
        console.log("\n=== Setting Up Approvals ===");
        console.log("Approving LOP to spend maker's MockERC20 tokens...");
        
        // Approve unlimited tokens for maker to LOP (for simplicity in testing)
        // In production, you'd approve specific amounts
        uint256 maxApproval = type(uint256).max;
        
        // Use maker's private key to make the approval
        vm.startBroadcast(vm.envUint("MAKER_PRIVATE_KEY"));
        mockERC20.approve(lopAddress, maxApproval);
        vm.stopBroadcast();
        
        // Check balances and approvals after setup
        console.log("\n=== Post-Setup Balances & Approvals ===");
        console.log("Maker MockERC20 balance:", mockERC20.balanceOf(makerAddress));
        console.log("Taker MockERC20 balance:", mockERC20.balanceOf(takerAddress));
        console.log("Maker's allowance to LOP:", mockERC20.allowance(makerAddress, lopAddress));
        
        // Validate setup was successful
        console.log("\n=== Validation ===");
        require(mockERC20.balanceOf(makerAddress) >= TOKEN_AMOUNT, "Maker MockERC20 minting failed");
        require(mockERC20.balanceOf(takerAddress) >= TOKEN_AMOUNT, "Taker MockERC20 minting failed");
        require(mockERC20.allowance(makerAddress, lopAddress) > 0, "Maker approval to LOP failed");
        
        console.log("All setup validations passed!");
        
        console.log("\n=== Next Steps ===");
        console.log("1. Maker and taker are funded with MockERC20 tokens");
        console.log("2. Maker has approved LOP to spend their tokens");
        console.log("3. Navigate to test_end_to_end/ directory");
        console.log("4. Update .env with deployed contract addresses");
        console.log("5. Run: tsx 1_order_create.tsx");
        console.log("6. Run: tsx 2_src_escrow_deposit.tsx");
        console.log("7. Run: tsx 5_src_escrow_withdraw.ts");
        
        console.log("\n=== IMPORTANT DEPLOYMENT NOTE ===");
        console.log("This script requires BOTH private keys in environment:");
        console.log("- First part (minting): Uses DEPLOYER_PRIVATE_KEY");
        console.log("- Second part (approval): Uses MAKER_PRIVATE_KEY");
        console.log("Make sure both keys are set in your environment!");
        
        console.log("\n=== Environment Variables for test_end_to_end/.env ===");
        console.log("TOKEN_A_SEPOLIA=", address(mockERC20));
        console.log("ESCROW_FACTORY_SEPOLIA=", vm.envAddress("ESCROW_FACTORY_ADDRESS"));
        console.log("LOP_SEPOLIA=", vm.envAddress("LOP_ADDRESS"));
        console.log("RESOLVER_PROXY_SEPOLIA=", vm.envAddress("RESOLVER_ADDRESS"));
    }
}