import { NetworkProvider } from '@ton/blueprint';
import { DstEscrow } from '../wrappers/DstEscrow';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const dstEscrowAddress = await ui.inputAddress('Enter dst escrow address:');
    const secret = BigInt(await ui.input('Enter secret:'));

    const dstEscrowSC = provider.open(DstEscrow.createFromAddress(dstEscrowAddress));
    await dstEscrowSC.sendWithdraw(provider.sender(), secret);

    ui.write('Withdraw transaction was sent...');
}
