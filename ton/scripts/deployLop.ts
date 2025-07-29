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

    ui.write('Deploy LimitOrderProtocol contract');

    await lopSC.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(lopSC.address);
}

function parseTimelocks(timelocksJsonPath: string): TimelocksConfig {
    const data = JSON.parse(readFileSync(timelocksJsonPath, 'utf-8'));

    return {
        srcWithdrawal: BigInt(data.srcWithdrawal),
        srcPublicWithdrawal: BigInt(data.srcPublicWithdrawal),
        srcCancellation: BigInt(data.srcCancellation),
        srcPublicCancellation: BigInt(data.srcPublicCancellation),
        dstWithdrawal: BigInt(data.dstWithdrawal),
        dstPublicWithdrawal: BigInt(data.dstPublicWithdrawal),
        dstCancellation: BigInt(data.dstCancellation),
    };
}
