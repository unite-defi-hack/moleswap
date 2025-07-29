import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { SrcEscrow } from '../wrappers/SrcEscrow';
import { Errors, EscrowOp } from '../wrappers/opcodes';
import { ethAddressToBigInt, generateRandomBigInt, HOLE_ADDRESS } from '../wrappers/utils';
import { OrderConfig } from '../wrappers/types';
import { ethers } from 'ethers';

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

describe('SrcEscrow', () => {
    let blockchain: Blockchain;

    let srcEscrowCode: Cell;

    let deployer: SandboxContract<TreasuryContract>;
    let maker: SandboxContract<TreasuryContract>;
    let taker: SandboxContract<TreasuryContract>;
    let receiver: SandboxContract<TreasuryContract>;

    let secret: bigint;
    let order: OrderConfig;

    beforeAll(async () => {
        srcEscrowCode = await compile('SrcEscrow');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        maker = await blockchain.treasury('maker');
        taker = await blockchain.treasury('taker');
        receiver = await blockchain.treasury('receiver');

        secret = generateRandomBigInt();
        order = {
            maker_address: maker.address,
            maker_asset: HOLE_ADDRESS,
            making_amount: toNano(100),
            receiver_address: ethAddressToBigInt('0x1111111111111111111111111111111111111111'),
            taker_asset: ethAddressToBigInt('0x3333333333333333333333333333333333333333'),
            taking_amount: toNano(200),
            salt: generateRandomBigInt(),
            order_hash: generateRandomBigInt(),
            hashlock: BigInt(ethers.keccak256(ethers.toBeHex(secret))),
            creation_time: Math.floor(Date.now() / 1000),
            expiration_time: Math.floor((Date.now() + 3 * DAY) / 1000),
        };
    });

    async function createSrcEscrow(
        order: OrderConfig,
    ): Promise<{ result: any; srcEscrow: SandboxContract<SrcEscrow> }> {
        const srcEscrow = blockchain.openContract(
            SrcEscrow.createFromConfig(
                {
                    lop_address: deployer.address,
                    order_hash: order.order_hash!!,
                },
                srcEscrowCode,
            ),
        );

        // deploy SC
        let result = await srcEscrow.sendDeploy(deployer.getSender());
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: srcEscrow.address,
            deploy: true,
            success: true,
        });

        // create
        result = await srcEscrow.sendCreate(deployer.getSender(), order, 0, order.making_amount);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: srcEscrow.address,
            op: EscrowOp.create,
            success: true,
        });

        return { result, srcEscrow };
    }

    it('create a new src escrow successful', async () => {
        const { srcEscrow } = await createSrcEscrow(order);

        const escrowData = await srcEscrow.getEscrowData();
        expect(escrowData.orderHash).toEqual(order.order_hash);
        expect(escrowData.hashlock).toEqual(order.hashlock);
        expect(escrowData.creationTime).toEqual(order.creation_time);
        expect(escrowData.expirationTime).toEqual(order.expiration_time);
        expect(escrowData.makerAddress.toString()).toEqual(maker.address.toString());
        expect(escrowData.makerAssetAddress.toString()).toEqual(order.maker_asset.toString());
        expect(escrowData.makerAssetAmount).toEqual(order.making_amount);
        expect(escrowData.receiverAddress).toEqual(order.receiver_address);
        expect(escrowData.takerAssetAddress).toEqual(order.taker_asset);
        expect(escrowData.takerAssetAmount).toEqual(order.taking_amount);
    });

    it('taker should withdraw ton from src escrow successful when know the secret', async () => {
        const { srcEscrow } = await createSrcEscrow(order);
        const srcEscrowSC = blockchain.openContract(SrcEscrow.createFromAddress(srcEscrow.address));
        const takerBalanceBefore = await taker.getBalance();

        const result = await srcEscrowSC.sendWithdraw(taker.getSender(), secret);

        expect(result.transactions).toHaveTransaction({
            from: taker.address,
            to: srcEscrow.address,
            op: EscrowOp.withdraw,
            destroyed: true,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: srcEscrow.address,
            to: taker.address,
            success: true,
        });
        expect(await taker.getBalance()).toBeGreaterThanOrEqual(takerBalanceBefore + order.making_amount);
    });

    it('taker should not withdraw ton from src escrow successful when not know the secret', async () => {
        const wrongSecret = generateRandomBigInt();
        const { srcEscrow } = await createSrcEscrow(order);
        const srcEscrowSC = blockchain.openContract(SrcEscrow.createFromAddress(srcEscrow.address));
        const takerBalanceBefore = await taker.getBalance();

        const result = await srcEscrowSC.sendWithdraw(taker.getSender(), wrongSecret);

        expect(result.transactions).toHaveTransaction({
            from: taker.address,
            to: srcEscrow.address,
            op: EscrowOp.withdraw,
            destroyed: false,
            success: false,
            exitCode: Errors.wrong_secret,
        });
        expect(await taker.getBalance()).toBeLessThanOrEqual(takerBalanceBefore);
    });

    it('taker should withdraw ton to another address successful', async () => {
        const takerReceiver = await blockchain.treasury('takerReceiver');
        const { srcEscrow } = await createSrcEscrow(order);
        const srcEscrowSC = blockchain.openContract(SrcEscrow.createFromAddress(srcEscrow.address));
        const takerBalanceBefore = await taker.getBalance();
        const takerReceiverBalanceBefore = await takerReceiver.getBalance();

        const result = await srcEscrowSC.sendWithdrawTo(taker.getSender(), secret, takerReceiver.address);

        expect(result.transactions).toHaveTransaction({
            from: taker.address,
            to: srcEscrow.address,
            op: EscrowOp.withdraw_to,
            destroyed: true,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: srcEscrow.address,
            to: takerReceiver.address,
            success: true,
        });
        expect(result.transactions).not.toHaveTransaction({
            from: srcEscrow.address,
            to: taker.address,
            success: true,
        });
        expect(await taker.getBalance()).toBeLessThanOrEqual(takerBalanceBefore);
        expect(await takerReceiver.getBalance()).toBeGreaterThanOrEqual(
            takerReceiverBalanceBefore + order.making_amount,
        );
    });

    it('maker should cancel src escrow successful after expiration time', async () => {
        const { srcEscrow } = await createSrcEscrow(order);
        const srcEscrowSC = blockchain.openContract(SrcEscrow.createFromAddress(srcEscrow.address));
        const makerBalanceBefore = await maker.getBalance();

        blockchain.now = order.expiration_time + 1;

        const result = await srcEscrowSC.sendCancel(maker.getSender());

        expect(result.transactions).toHaveTransaction({
            from: maker.address,
            to: srcEscrow.address,
            op: EscrowOp.cancel,
            destroyed: true,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: srcEscrow.address,
            to: maker.address,
            success: true,
        });
        expect(await maker.getBalance()).toBeGreaterThanOrEqual(makerBalanceBefore + order.making_amount);
    });
});
