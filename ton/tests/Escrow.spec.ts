import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { SrcEscrow, SrcOrderConfig } from '../wrappers/SrcEscrow';
import { DstEscrow, DstOrderConfig } from '../wrappers/DstEscrow';
import { EscrowOp } from '../wrappers/opcodes';

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

describe('UserOrder', () => {
    let blockchain: Blockchain;

    let lopCode: Cell;
    let srcEscrowCode: Cell;
    let dstEscrowCode: Cell;

    let deployer: SandboxContract<TreasuryContract>;
    let maker: SandboxContract<TreasuryContract>;
    let taker: SandboxContract<TreasuryContract>;

    beforeAll(async () => {
        lopCode = await compile('LimitOrderProtocol');
        srcEscrowCode = await compile('SrcEscrow');
        dstEscrowCode = await compile('DstEscrow');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        maker = await blockchain.treasury('maker');
        taker = await blockchain.treasury('taker');
    });

    it('create a new src escrow successful', async () => {
        const fromAsset = await blockchain.treasury('fromAsset');
        const toAsset = 1111111111n;
        const order: SrcOrderConfig = {
            order_hash: 123456789n,
            hashlock: 456n,
            creation_time: Math.floor(Date.now() / 1000),
            expiration_time: Math.floor((Date.now() + 3 * DAY) / 1000),
            maker_address: maker.address,
            maker_asset: fromAsset.address,
            making_amount: toNano('0.05'),
            receiver_address: 789n,
            taker_asset: toAsset,
            taking_amount: toNano('0.05'),
        };
        const srcEscrow = blockchain.openContract(
            SrcEscrow.createFromConfig(
                {
                    lop_address: deployer.address,
                    order_hash: order.order_hash,
                },
                srcEscrowCode,
            ),
        );

        // deploy SC
        let res = await srcEscrow.sendDeploy(deployer.getSender());
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: srcEscrow.address,
            deploy: true,
            success: true,
        });

        // create
        res = await srcEscrow.sendCreate(deployer.getSender(), order);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: srcEscrow.address,
            op: EscrowOp.create,
            success: true,
        });

        const escrowData = await srcEscrow.getEscrowData();
        expect(escrowData.orderHash).toEqual(order.order_hash);
        expect(escrowData.hashlock).toEqual(order.hashlock);
        expect(escrowData.creationTime).toEqual(order.creation_time);
        expect(escrowData.expirationTime).toEqual(order.expiration_time);
        expect(escrowData.makerAddress.toString()).toEqual(maker.address.toString());
        expect(escrowData.makerAssetAddress.toString()).toEqual(fromAsset.address.toString());
        expect(escrowData.makerAssetAmount).toEqual(order.making_amount);
        expect(escrowData.receiverAddress).toEqual(order.receiver_address);
        expect(escrowData.takerAssetAddress).toEqual(order.taker_asset);
        expect(escrowData.takerAssetAmount).toEqual(order.taking_amount);
    });

    it('create a new dst escrow successful', async () => {
        const order: DstOrderConfig = {
            order_hash: 123456789n,
            hashlock: 456n,
            creation_time: Math.floor(Date.now() / 1000),
            expiration_time: Math.floor((Date.now() + 3 * DAY) / 1000),
            maker_address: 1111111111n,
            maker_asset: 2222222222n,
            making_amount: toNano('0.05'),
            receiver_address: (await blockchain.treasury('receiver')).address,
            taker_asset: (await blockchain.treasury('toAsset')).address,
            taking_amount: toNano('0.055'),
            taker_address: taker.address,
        };
        const dstEscrow = blockchain.openContract(
            DstEscrow.createFromConfig(
                {
                    lop_address: deployer.address,
                    order_hash: order.order_hash,
                },
                dstEscrowCode,
            ),
        );

        // deploy SC
        let res = await dstEscrow.sendDeploy(deployer.getSender());
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: dstEscrow.address,
            deploy: true,
            success: true,
        });

        // create
        res = await dstEscrow.sendCreate(deployer.getSender(), order);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: dstEscrow.address,
            op: EscrowOp.create,
            success: true,
        });

        const escrowData = await dstEscrow.getEscrowData();
        expect(escrowData.orderHash).toEqual(order.order_hash);
        expect(escrowData.hashlock).toEqual(order.hashlock);
        expect(escrowData.creationTime).toEqual(order.creation_time);
        expect(escrowData.expirationTime).toEqual(order.expiration_time);
        expect(escrowData.makerAddress).toEqual(order.maker_address);
        expect(escrowData.makerAssetAddress).toEqual(order.maker_asset);
        expect(escrowData.makerAssetAmount).toEqual(order.making_amount);
        expect(escrowData.receiverAddress.toString()).toEqual(order.receiver_address.toString());
        expect(escrowData.takerAddress.toString()).toEqual(taker.address.toString());
        expect(escrowData.takerAssetAddress.toString()).toEqual(order.taker_asset.toString());
        expect(escrowData.takerAssetAmount).toEqual(order.taking_amount);
    });
});
