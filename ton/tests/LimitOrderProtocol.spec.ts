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
    let lopSC: SandboxContract<LimitOrderProtocol>;

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

        lopSC = blockchain.openContract(
            LimitOrderProtocol.createFromConfig(
                {
                    admin: deployer.address,
                    srcEscrowCode: srcEscrowCode,
                    dstEscrowCode: dstEscrowCode,
                },
                limitOrderProtocolCode,
            ),
        );
    });

    it('create a new order successful', async () => {
        const secret = generateRandomBigInt();
        const order: OrderConfig = {
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

        const res = await lopSC.sendCreateOrder(maker.getSender(), order);

        expect(res.transactions).toHaveTransaction({
            from: maker.address,
            to: lopSC.address,
            op: LopOp.create_order,
            success: true,
        });

        const orderHash = LimitOrderProtocol.calculateOrderHash(order);
        const srcEscrowAddress = await lopSC.getSrcEscrowAddress(orderHash);

        expect(res.transactions).toHaveTransaction({
            from: lopSC.address,
            to: srcEscrowAddress,
            op: EscrowOp.create,
            success: true,
        });

        const srcEscrowSC = blockchain.openContract(SrcEscrow.createFromAddress(srcEscrowAddress));
        const orderData = await srcEscrowSC.getEscrowData();
        expect(orderData.orderHash).toEqual(orderHash);
        expect(orderData.hashlock).toEqual(order.hashlock);
        expect(orderData.creationTime).toEqual(order.creation_time);
        expect(orderData.expirationTime).toEqual(order.expiration_time);
        expect(orderData.makerAddress.toString()).toEqual(order.maker_address.toString());
        expect(orderData.makerAssetAddress.toString()).toEqual(order.maker_asset.toString());
        // expect(orderData.makerAssetAmount).toEqual(order.making_amount);
        // expect(orderData.receiverAddress).toEqual(order.receiver_address);
        // expect(orderData.takerAssetAddress).toEqual(order.taker_asset);
        // expect(orderData.takerAssetAmount).toEqual(order.taking_amount);
    });
});
