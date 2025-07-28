import { Address, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { LimitOrderProtocol } from '../wrappers/LimitOrderProtocol';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const lopSC = provider.open(
        LimitOrderProtocol.createFromConfig(
            {
                admin: provider.sender().address as Address,
                srcEscrowCode: await compile('SrcEscrow'),
                dstEscrowCode: await compile('DstEscrow'),
            },
            await compile('LimitOrderProtocol'),
        ),
    );

    ui.write('Deploy LimitOrderProtocol contract');

    await lopSC.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(lopSC.address);
}
