# 1inch-Leg Deploy

Deterministic, reproducible deployment pipeline for the **1inch Fusion+ "leg" stack** (Limit-Order-Protocol, Cross-Chain Escrow, Resolver + helpers).

# Pre-requsites

* foundry
* deployer account with ETH for gas
* maker account with ETH for gas
* taker account with ETH for gas
* Etherscan API key
* RPC URL


# Deployment

* Set `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `RPC_URL`, `NETWORK_ID` and `WETH_ADDRESS` in `.env` and run following commands one by one. Update `.env` file manually with the required outputs (addresses) of the commands in corrsponding `.env` setting.

The addresses of the contracts should be determenistic on all networks as Create3 deployer is used.


```sh
forge script script/00_DeployCreate3Deployer.s.sol --tc DeployCreate3Deployer \
    --fork-url $SEPOLIA_RPC_URL \
    --private-key $DEPLOYER_PRIVATE_KEY -vvvv --broadcast

# update .env CREATE3_DEPLOYER_ADDRESS

forge script script/01_DeployMockTokens.s.sol --tc DeployMockTokens \
    --fork-url $SEPOLIA_RPC_URL \
    --private-key $DEPLOYER_PRIVATE_KEY --broadcast -vvvv

# update .env MOCK_ERC20_ADDRESS and ERC20_TRUE_ADDRESS

forge script script/02_DeployLOP.s.sol --tc DeployLOP \
   --fork-url $SEPOLIA_RPC_URL \
   --private-key $DEPLOYER_PRIVATE_KEY --broadcast -vvvv

# update .env LOP_ADDRESS

forge script script/03_DeployEscrowFactory.s.sol --tc DeployEscrowFactory \
   --fork-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY \ 
   --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY -vvv 

# update .env ESCROW_FACTORY_ADDRESS

forge script script/04_DeployResolver.s.sol --tc DeployResolver \
   --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY \
   --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY -vvv

# update .env RESOLVER_ADDRESS

forge script script/05_FundTestAccounts.s.sol --tc FundTestAccounts \
   --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY \
   --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY -vvv 

```