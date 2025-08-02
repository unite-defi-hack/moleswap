import { Address, beginCell, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const manifestUrl =
        'https://raw.githubusercontent.com/unite-defi-hack/moleswap/refs/heads/main/ton/scripts/jettons/mole.json';

    const tokenMinter = provider.open(
        JettonMinter.createFromConfig(
            {
                admin: provider.sender().address as Address,
                content: beginCell().storeUint(1, 8).storeStringTail(manifestUrl).endCell(),
                walletCode: await compile('JettonWallet'),
            },
            await compile('JettonMinter'),
        ),
    );
    ui.write(`Deploy JettonMinter contract...`);
    await tokenMinter.sendDeploy(provider.sender(), toNano('0.1'));
    await provider.waitForDeploy(tokenMinter.address);
}
