import { readFileSync } from 'fs';
import { join } from 'path';
import { Address, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { LimitOrderProtocol } from '../wrappers/LimitOrderProtocol';
import { TimelocksConfig } from '../wrappers/types';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const timelocksJsonPath = join(__dirname, join('orders', 'timelocks.json'));
    const timelocks = parseTimelocks(timelocksJsonPath);

    const lopSC = provider.open(
        LimitOrderProtocol.createFromConfig(
            {
                admin: provider.sender().address as Address,
                srcEscrowCode: await compile('SrcEscrow'),
                dstEscrowCode: await compile('DstEscrow'),
                timelocks,
            },
            await compile('LimitOrderProtocol'),
        ),
    );

    // Latest LOP (testnet): kQC1aDFOh0byjKgc6rnj_0nicgUm5qbM2giSzDouGR-SRBQE
    ui.write('Deploy LimitOrderProtocol contract');

    await lopSC.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(lopSC.address);
}

function parseTimelocks(timelocksJsonPath: string): TimelocksConfig {
    const data = JSON.parse(readFileSync(timelocksJsonPath, 'utf-8'));

    return {
        srcWithdrawal: Number(data.srcWithdrawal),
        srcPublicWithdrawal: Number(data.srcPublicWithdrawal),
        srcCancellation: Number(data.srcCancellation),
        srcPublicCancellation: Number(data.srcPublicCancellation),
        dstWithdrawal: Number(data.dstWithdrawal),
        dstPublicWithdrawal: Number(data.dstPublicWithdrawal),
        dstCancellation: Number(data.dstCancellation),
    };
}
