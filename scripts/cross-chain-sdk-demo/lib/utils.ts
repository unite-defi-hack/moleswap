import { Address as TonAddress, TonClient } from "@ton/ton";
import { initMoleswapConfig, MoleswapConfig } from "./config";
import { Contract, JsonRpcProvider } from "ethers";

export async function getTonBalance(address: string) {
    const client = new TonClient({
        endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
        apiKey: process.env.TON_API_KEY,
    });

    const balance = await client.getBalance(TonAddress.parse(address));
    return balance;
}

const ERC20ABI = [
    "function balanceOf(address owner) view returns (uint256)",
];

export async function getEvmBalanceOfErc20(address: string, tokenAddress: string) {
    const config = initMoleswapConfig();
    const provider = new JsonRpcProvider(config.rpcUrl);

    const tokenContract = new Contract(tokenAddress, ERC20ABI, provider);
    const balance = await tokenContract.balanceOf(address);
    return balance;
}