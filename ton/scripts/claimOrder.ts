import { NetworkProvider } from '@ton/blueprint';
import { SrcEscrow } from '../wrappers/SrcEscrow';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const srcEscrowAddress = await ui.inputAddress('Enter src escrow address:');

    const srcEscrowSC = provider.open(SrcEscrow.createFromAddress(srcEscrowAddress));
    await srcEscrowSC.sendClaim(provider.sender());

    ui.write('Claim transaction was sent...');
}