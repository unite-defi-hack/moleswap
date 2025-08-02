import { NetworkProvider } from '@ton/blueprint';
import { toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';

export async function run(provider: NetworkProvider) {
    const user = provider.sender();
    const ui = provider.ui();

    // Latest Minter (testnet): kQAyI2Zx8AGSJQlYkdMlToH7kEqj2vtlpvm5XAbnAMh9pz84
    const jettonMinterAddr = await ui.inputAddress('Enter JettonMinter address:');
    const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMinterAddr));
    const recipientAddr = await ui.inputAddress('Enter recipient address:');
    const amountRaw = await ui.input('Enter amount to mint:');
    const amount = toNano(amountRaw);

    await jettonMinter.sendMint(user, recipientAddr, amount);

    ui.write('\n Done');
}
