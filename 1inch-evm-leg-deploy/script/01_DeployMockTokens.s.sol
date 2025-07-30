// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

// Import ERC20True from cross-chain-swap submodule
import {ERC20True} from "cross-chain-swap/contracts/mocks/ERC20True.sol";

// Import CREATE3 deployer
import {Create3Deployer} from "../lib/Create3Deployer.sol";

// Import constants
import {Constants} from "./utils/Constants.sol";

/**
 * @title Mock ERC20 Token
 * @dev Standard ERC20 implementation with minting capability
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title Deploy Mock Tokens Script
 * @dev Deploys MockERC20 and ERC20True tokens using CREATE3 for deterministic addresses
 */
contract DeployMockTokens is Script {
    function run() external {
        // Validate we're on the correct network
        Constants.validateChainId();
        
        console.log("=== Deploying Mock Tokens via CREATE3 on Sepolia ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);
        
        // Get CREATE3Deployer address from environment
        address create3DeployerAddr = vm.envAddress("CREATE3_DEPLOYER_ADDRESS");
        Constants.validateAddress(create3DeployerAddr, "CREATE3_DEPLOYER_ADDRESS");
        
        Create3Deployer create3Deployer = Create3Deployer(create3DeployerAddr);
        console.log("Using CREATE3Deployer at:", address(create3Deployer));
        
        // Predict addresses before deployment
        address predictedMockERC20 = create3Deployer.addressOf(Constants.MOCK_ERC20_SALT);
        address predictedERC20True = create3Deployer.addressOf(Constants.ERC20_TRUE_SALT);
        
        console.log("\n=== Predicted Addresses ===");
        console.log("MockERC20 will be deployed at:", predictedMockERC20);
        console.log("ERC20True will be deployed at:", predictedERC20True);
        
        vm.startBroadcast();
        
        // Deploy MockERC20 with CREATE3
        address mockERC20Address = create3Deployer.deploy(
            Constants.MOCK_ERC20_SALT,
            abi.encodePacked(
                type(MockERC20).creationCode,
                abi.encode(
                    Constants.MOCK_ERC20_NAME,
                    Constants.MOCK_ERC20_SYMBOL,
                    Constants.MOCK_ERC20_DECIMALS,
                    Constants.MOCK_ERC20_INITIAL_SUPPLY
                )
            )
        );
        
        // Deploy ERC20True with CREATE3
        address erc20TrueAddress = create3Deployer.deploy(
            Constants.ERC20_TRUE_SALT,
            abi.encodePacked(type(ERC20True).creationCode)
        );
        
        vm.stopBroadcast();
        
        // Verify addresses match predictions
        require(mockERC20Address == predictedMockERC20, "MockERC20 address mismatch");
        require(erc20TrueAddress == predictedERC20True, "ERC20True address mismatch");
        
        // Cast to contracts for testing
        MockERC20 mockERC20 = MockERC20(mockERC20Address);
        ERC20True erc20True = ERC20True(erc20TrueAddress);
        
        // Log deployment results
        console.log("\n=== Deployment Results ===");
        console.log("MockERC20 deployed at:", address(mockERC20));
        console.log("  - Name:", mockERC20.name());
        console.log("  - Symbol:", mockERC20.symbol());
        console.log("  - Decimals:", mockERC20.decimals());
        console.log("  - Total Supply:", mockERC20.totalSupply());
        console.log("  - Deployer Balance:", mockERC20.balanceOf(msg.sender));
        
        console.log("\nERC20True deployed at:", address(erc20True));
        console.log("  - Always returns true for transfers");
        console.log("  - Always returns 0 for balances");
        
        // Test ERC20True functionality
        console.log("  - Test transfer() returns:", erc20True.transfer(address(0), 100));
        console.log("  - Test balanceOf() returns:", erc20True.balanceOf(msg.sender));
        
        // Export addresses for use in subsequent scripts
        console.log("\n=== Environment Variables ===");
        console.log("MOCK_ERC20_ADDRESS=", address(mockERC20));
        console.log("ERC20_TRUE_ADDRESS=", address(erc20True));
        
        console.log("\n=== CREATE3 Benefits ===");
        console.log("These addresses will be IDENTICAL on all networks using the same CREATE3Deployer!");
        console.log("Salt 'MOCK_ERC20_SALT' always produces:", address(mockERC20));
        console.log("Salt 'ERC20_TRUE_SALT' always produces:", address(erc20True));
        
        console.log("\n=== Next Steps ===");
        console.log("1. Update .env file with the addresses above");
        console.log("2. Run: forge script script/02_DeployLOP.s.sol");
    }
}