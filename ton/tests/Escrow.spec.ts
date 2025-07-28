import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { SrcEscrow } from '../wrappers/SrcEscrow';
import { DstEscrow } from '../wrappers/DstEscrow';
import { Errors, EscrowOp } from '../wrappers/opcodes';
import { ethAddressToBigInt, generateRandomBigInt, HOLE_ADDRESS } from '../wrappers/utils';
import { OrderConfig } from '../wrappers/types';
import { ethers } from 'ethers';

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

describe('UserOrder', () => {
    let blockchain: Blockchain;

    let srcEscrowCode: Cell;
    let dstEscrowCode: Cell;

    let deployer: SandboxContract<TreasuryContract>;
    let maker: SandboxContract<TreasuryContract>;
    let taker: SandboxContract<TreasuryContract>;
    let receiver: SandboxContract<TreasuryContract>;

    let secret: bigint;
    let srcOrder: OrderConfig;
    let dstOrder: OrderConfig;

    beforeAll(async () => {
        srcEscrowCode = await compile('SrcEscrow');
        dstEscrowCode = await compile('DstEscrow');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        maker = await blockchain.treasury('maker');
        taker = await blockchain.treasury('taker');
        receiver = await blockchain.treasury('receiver');

        secret = generateRandomBigInt();
        srcOrder = {
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
        dstOrder = {
            order_hash: generateRandomBigInt(),
            hashlock: BigInt(ethers.keccak256(ethers.toBeHex(secret))),
            creation_time: Math.floor(Date.now() / 1000),
            expiration_time: Math.floor((Date.now() + 3 * DAY) / 1000),
            maker_address: ethAddressToBigInt('0x1111111111111111111111111111111111111111'),
            maker_asset: ethAddressToBigInt('0x2222222222222222222222222222222222222222'),
            making_amount: toNano('100'),
            receiver_address: (await blockchain.treasury('receiver')).address,
            taker_asset: (await blockchain.treasury('toAsset')).address,
            taking_amount: toNano('200'),
            taker_address: taker.address,
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

    async function createDstEscrow(
        order: OrderConfig,
    ): Promise<{ result: any; dstEscrow: SandboxContract<DstEscrow> }> {
        const dstEscrow = blockchain.openContract(
            DstEscrow.createFromConfig(
                {
                    lop_address: deployer.address,
                    order_hash: order.order_hash!!,
                },
                dstEscrowCode,
            ),
        );

        // deploy SC
        let result = await dstEscrow.sendDeploy(deployer.getSender());
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: dstEscrow.address,
            deploy: true,
            success: true,
        });

        // create
        result = await dstEscrow.sendCreate(deployer.getSender(), order, 0, order.taking_amount);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: dstEscrow.address,
            op: EscrowOp.create,
            success: true,
        });

        return { result, dstEscrow };
    }

    it('create a new src escrow successful', async () => {
        const { srcEscrow } = await createSrcEscrow(srcOrder);

        const escrowData = await srcEscrow.getEscrowData();
        expect(escrowData.orderHash).toEqual(srcOrder.order_hash);
        expect(escrowData.hashlock).toEqual(srcOrder.hashlock);
        expect(escrowData.creationTime).toEqual(srcOrder.creation_time);
        expect(escrowData.expirationTime).toEqual(srcOrder.expiration_time);
        expect(escrowData.makerAddress.toString()).toEqual(maker.address.toString());
        expect(escrowData.makerAssetAddress.toString()).toEqual(srcOrder.maker_asset.toString());
        expect(escrowData.makerAssetAmount).toEqual(srcOrder.making_amount);
        expect(escrowData.receiverAddress).toEqual(srcOrder.receiver_address);
        expect(escrowData.takerAssetAddress).toEqual(srcOrder.taker_asset);
        expect(escrowData.takerAssetAmount).toEqual(srcOrder.taking_amount);
    });

    it('create a new dst escrow successful', async () => {
        const { dstEscrow } = await createDstEscrow(dstOrder);

        const escrowData = await dstEscrow.getEscrowData();
        expect(escrowData.orderHash).toEqual(dstOrder.order_hash);
        expect(escrowData.hashlock).toEqual(dstOrder.hashlock);
        expect(escrowData.creationTime).toEqual(dstOrder.creation_time);
        expect(escrowData.expirationTime).toEqual(dstOrder.expiration_time);
        expect(escrowData.makerAddress).toEqual(dstOrder.maker_address);
        expect(escrowData.makerAssetAddress).toEqual(dstOrder.maker_asset);
        expect(escrowData.makerAssetAmount).toEqual(dstOrder.making_amount);
        expect(escrowData.receiverAddress.toString()).toEqual(dstOrder.receiver_address.toString());
        expect(escrowData.takerAddress.toString()).toEqual(taker.address.toString());
        expect(escrowData.takerAssetAddress.toString()).toEqual(dstOrder.taker_asset.toString());
        expect(escrowData.takerAssetAmount).toEqual(dstOrder.taking_amount);
    });

    it('taker should withdraw ton from src escrow successful when know the secret', async () => {
        const { srcEscrow } = await createSrcEscrow(srcOrder);
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
        expect(await taker.getBalance()).toBeGreaterThanOrEqual(takerBalanceBefore + srcOrder.making_amount);
    });

    it('taker should not withdraw ton from src escrow successful when not know the secret', async () => {
        const wrongSecret = generateRandomBigInt();
        const { srcEscrow } = await createSrcEscrow(srcOrder);
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
        const { srcEscrow } = await createSrcEscrow(srcOrder);
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
            takerReceiverBalanceBefore + srcOrder.making_amount,
        );
    });

    it('maker should cancel src escrow successful after expiration time', async () => {
        const { srcEscrow } = await createSrcEscrow(srcOrder);
        const srcEscrowSC = blockchain.openContract(SrcEscrow.createFromAddress(srcEscrow.address));
        const makerBalanceBefore = await maker.getBalance();

        blockchain.now = srcOrder.expiration_time + 1;

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
        expect(await maker.getBalance()).toBeGreaterThanOrEqual(makerBalanceBefore + srcOrder.making_amount);
    });

    it('maker should withdraw ton from dst escrow successful when know the secret', async () => {
        const { dstEscrow } = await createDstEscrow(dstOrder);
        const dstEscrowSC = blockchain.openContract(DstEscrow.createFromAddress(dstEscrow.address));
        const receiverBalanceBefore = await receiver.getBalance();

        const result = await dstEscrowSC.sendWithdraw(taker.getSender(), secret);

        expect(result.transactions).toHaveTransaction({
            from: taker.address,
            to: dstEscrow.address,
            op: EscrowOp.withdraw,
            destroyed: true,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: dstEscrow.address,
            to: receiver.address,
            success: true,
        });
        expect(await receiver.getBalance()).toBeGreaterThanOrEqual(receiverBalanceBefore + dstOrder.taking_amount);
    });

    it('taker should not withdraw ton from dst escrow when do not know the secret', async () => {
        const wrongSecret = generateRandomBigInt();
        const { dstEscrow } = await createDstEscrow(dstOrder);
        const dstEscrowSC = blockchain.openContract(DstEscrow.createFromAddress(dstEscrow.address));
        const receiverBalanceBefore = await receiver.getBalance();

        const result = await dstEscrowSC.sendWithdraw(taker.getSender(), wrongSecret);

        expect(result.transactions).toHaveTransaction({
            from: taker.address,
            to: dstEscrow.address,
            op: EscrowOp.withdraw,
            destroyed: false,
            success: false,
            exitCode: Errors.wrong_secret,
        });
        expect(await receiver.getBalance()).toBeLessThanOrEqual(receiverBalanceBefore);
    });
});
