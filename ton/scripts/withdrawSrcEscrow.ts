import { NetworkProvider } from '@ton/blueprint';
import { SrcEscrow } from '../wrappers/SrcEscrow';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const srcEscrowAddress = await ui.inputAddress('Enter src escrow address:');
    const secret = BigInt(await ui.input('Enter secret:'));

    const srcEscrowSC = provider.open(SrcEscrow.createFromAddress(srcEscrowAddress));
    await srcEscrowSC.sendWithdraw(provider.sender(), secret);

    ui.write('Withdraw transaction was sent...');
}
