import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { ethers } from 'ethers';
import { LimitOrderProtocol } from '../wrappers/LimitOrderProtocol';
import { EscrowOp, LopOp } from '../wrappers/opcodes';
import { generateRandomBigInt, ethAddressToBigInt, HOLE_ADDRESS } from '../wrappers/utils';
import { OrderConfig } from '../wrappers/types';
import { SrcEscrow } from '../wrappers/SrcEscrow';
import { DstEscrow } from '../wrappers/DstEscrow';

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

describe('UserOrder', () => {
    let blockchain: Blockchain;

    let limitOrderProtocolCode: Cell;
    let srcEscrowCode: Cell;
    let dstEscrowCode: Cell;

    let deployer: SandboxContract<TreasuryContract>;
    let maker: SandboxContract<TreasuryContract>;
    let taker: SandboxContract<TreasuryContract>;
    let receiver: SandboxContract<TreasuryContract>;
    let lopSC: SandboxContract<LimitOrderProtocol>;

    let secret: bigint;
    let srcOrder: OrderConfig;
    let dstOrder: OrderConfig;

    beforeAll(async () => {
        limitOrderProtocolCode = await compile('LimitOrderProtocol');
        srcEscrowCode = await compile('SrcEscrow');
        dstEscrowCode = await compile('DstEscrow');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        maker = await blockchain.treasury('maker');
        taker = await blockchain.treasury('taker');
        receiver = await blockchain.treasury('receiver');

        const timelocks = {
            srcWithdrawal: 30,
            srcPublicWithdrawal: 350,
            srcCancellation: 500,
            srcPublicCancellation: 1000,
            dstWithdrawal: 50,
            dstPublicWithdrawal: 300,
            dstCancellation: 450,
        };

        lopSC = blockchain.openContract(
            LimitOrderProtocol.createFromConfig(
                {
                    admin: deployer.address,
                    srcEscrowCode: srcEscrowCode,
                    dstEscrowCode: dstEscrowCode,
                    timelocks,
                },
                limitOrderProtocolCode,
            ),
        );

        secret = generateRandomBigInt();
        srcOrder = {
            maker_address: maker.address,
            maker_asset: HOLE_ADDRESS,
            making_amount: toNano(100),
            receiver_address: ethAddressToBigInt('0x1111111111111111111111111111111111111111'),
            taker_asset: ethAddressToBigInt('0x3333333333333333333333333333333333333333'),
            taking_amount: toNano(200),
            salt: generateRandomBigInt(),
            hashlock: BigInt(ethers.keccak256(ethers.toBeHex(secret))),
            creation_time: Math.floor(Date.now() / 1000),
            expiration_time: Math.floor((Date.now() + 3 * DAY) / 1000),
        };
        dstOrder = {
            maker_address: ethAddressToBigInt('0x1111111111111111111111111111111111111111'),
            maker_asset: ethAddressToBigInt('0x2222222222222222222222222222222222222222'),
            making_amount: toNano(100),
            receiver_address: receiver.address,
            taker_address: taker.address,
            taker_asset: HOLE_ADDRESS,
            taking_amount: toNano(200),
            order_hash: generateRandomBigInt(),
            hashlock: BigInt(ethers.keccak256(ethers.toBeHex(secret))),
            creation_time: Math.floor(Date.now() / 1000),
            expiration_time: Math.floor((Date.now() + 3 * DAY) / 1000),
        };
    });

    async function createOrder(order: OrderConfig): Promise<{ result: any; orderHash: bigint }> {
        const result = await lopSC.sendCreateOrder(maker.getSender(), order);

        expect(result.transactions).toHaveTransaction({
            from: maker.address,
            to: lopSC.address,
            op: LopOp.create_order,
            success: true,
        });

        const orderHash = LimitOrderProtocol.calculateOrderHash(order);
        return { result, orderHash };
    }

    it('create a new order successful', async () => {
        const { result, orderHash } = await createOrder(srcOrder);
        const srcEscrowAddress = await lopSC.getSrcEscrowAddress(orderHash);

        expect(result.transactions).toHaveTransaction({
            from: lopSC.address,
            to: srcEscrowAddress,
            op: EscrowOp.create,
            success: true,
        });

        const srcEscrowSC = blockchain.openContract(SrcEscrow.createFromAddress(srcEscrowAddress));
        const orderData = await srcEscrowSC.getEscrowData();
        expect(orderData.orderHash).toEqual(orderHash);
        expect(orderData.hashlock).toEqual(srcOrder.hashlock);
        expect(orderData.creationTime).toEqual(srcOrder.creation_time);
        expect(orderData.expirationTime).toEqual(srcOrder.expiration_time);
        expect(orderData.makerAddress.toString()).toEqual(srcOrder.maker_address.toString());
        expect(orderData.makerAssetAddress.toString()).toEqual(srcOrder.maker_asset.toString());
        expect(orderData.makerAssetAmount).toEqual(srcOrder.making_amount);
        expect(orderData.receiverAddress).toEqual(srcOrder.receiver_address);
        expect(orderData.takerAssetAddress).toEqual(srcOrder.taker_asset);
        expect(orderData.takerAssetAmount).toEqual(srcOrder.taking_amount);
    });

    it('taker should fill order successful', async () => {
        const res = await lopSC.sendFillOrder(taker.getSender(), dstOrder);

        expect(res.transactions).toHaveTransaction({
            from: taker.address,
            to: lopSC.address,
            op: LopOp.fill_order,
            success: true,
        });

        const dstEscrowAddress = await lopSC.getDstEscrowAddress(dstOrder.order_hash!!);
        expect(res.transactions).toHaveTransaction({
            from: lopSC.address,
            to: dstEscrowAddress,
            op: EscrowOp.create,
            success: true,
        });

        const dstEscrowSC = blockchain.openContract(DstEscrow.createFromAddress(dstEscrowAddress));
        const orderData = await dstEscrowSC.getEscrowData();
        expect(orderData.orderHash).toEqual(dstOrder.order_hash!!);
        expect(orderData.hashlock).toEqual(dstOrder.hashlock);
        expect(orderData.creationTime).toEqual(dstOrder.creation_time);
        expect(orderData.expirationTime).toEqual(dstOrder.expiration_time);
        expect(orderData.makerAddress).toEqual(dstOrder.maker_address);
        expect(orderData.makerAssetAddress).toEqual(dstOrder.maker_asset);
        expect(orderData.makerAssetAmount).toEqual(dstOrder.making_amount);
        expect(orderData.receiverAddress.toString()).toEqual(dstOrder.receiver_address.toString());
        expect(orderData.takerAddress.toString()).toEqual(dstOrder.taker_address!!.toString());
        expect(orderData.takerAssetAddress.toString()).toEqual(dstOrder.taker_asset.toString());
        expect(orderData.takerAssetAmount).toEqual(dstOrder.taking_amount);
    });
});
