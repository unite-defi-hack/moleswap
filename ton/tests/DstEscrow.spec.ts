import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { DstEscrow } from '../wrappers/DstEscrow';
import { Errors, EscrowOp } from '../wrappers/opcodes';
import { ethAddressToBigInt, generateRandomBigInt, HOLE_ADDRESS } from '../wrappers/utils';
import { OrderConfig, TimelocksConfig } from '../wrappers/types';
import { ethers } from 'ethers';

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

describe('DstEscrow', () => {
    let blockchain: Blockchain;

    let dstEscrowCode: Cell;

    let deployer: SandboxContract<TreasuryContract>;
    let maker: SandboxContract<TreasuryContract>;
    let taker: SandboxContract<TreasuryContract>;
    let receiver: SandboxContract<TreasuryContract>;

    let secret: bigint;
    let order: OrderConfig;
    let timelocks: TimelocksConfig;

    beforeAll(async () => {
        dstEscrowCode = await compile('DstEscrow');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = Math.floor(Date.now() / 1000);
        deployer = await blockchain.treasury('deployer');
        maker = await blockchain.treasury('maker');
        taker = await blockchain.treasury('taker');
        receiver = await blockchain.treasury('receiver');

        timelocks = {
            srcWithdrawal: 30,
            srcPublicWithdrawal: 350,
            srcCancellation: 500,
            srcPublicCancellation: 1000,
            dstWithdrawal: 50,
            dstPublicWithdrawal: 300,
            dstCancellation: 450,
        };

        secret = generateRandomBigInt();
        order = {
            order_hash: generateRandomBigInt(),
            salt: generateRandomBigInt(),
            hashlock: BigInt(ethers.keccak256(ethers.toBeHex(secret))),
            creation_time: Math.floor(Date.now() / 1000),
            expiration_time: Math.floor((Date.now() + 3 * DAY) / 1000),
            maker_address: ethAddressToBigInt('0x1111111111111111111111111111111111111111'),
            maker_asset: ethAddressToBigInt('0x2222222222222222222222222222222222222222'),
            making_amount: toNano('100'),
            receiver_address: (await blockchain.treasury('receiver')).address,
            taker_asset: HOLE_ADDRESS,
            taking_amount: toNano('200'),
            taker_address: taker.address,
            asset_jetton_address: HOLE_ADDRESS,
        };
    });

    async function createDstEscrow(
        order: OrderConfig,
        timelocks: TimelocksConfig,
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
        result = await dstEscrow.sendCreate(deployer.getSender(), order, timelocks, order.taking_amount + toNano(0.15));
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: dstEscrow.address,
            op: EscrowOp.create,
            success: true,
        });

        return { result, dstEscrow };
    }

    it('create a new dst escrow successful', async () => {
        const { dstEscrow } = await createDstEscrow(order, timelocks);

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

    it('maker should withdraw ton from dst escrow successful when know the secret', async () => {
        const { dstEscrow } = await createDstEscrow(order, timelocks);
        const dstEscrowSC = blockchain.openContract(DstEscrow.createFromAddress(dstEscrow.address));
        const receiverBalanceBefore = await receiver.getBalance();
        blockchain.now = Math.floor(Date.now() / 1000) + timelocks.dstWithdrawal + 1;

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
        expect(await receiver.getBalance()).toBeGreaterThanOrEqual(receiverBalanceBefore + order.taking_amount);
    });

    it('taker should not withdraw ton from dst escrow when do not know the secret', async () => {
        const wrongSecret = generateRandomBigInt();
        const { dstEscrow } = await createDstEscrow(order, timelocks);
        const dstEscrowSC = blockchain.openContract(DstEscrow.createFromAddress(dstEscrow.address));
        const receiverBalanceBefore = await receiver.getBalance();
        blockchain.now = Math.floor(Date.now() / 1000) + timelocks.dstWithdrawal + 1;

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

    it('any user can make public withdraw from dst escrow when know the secret', async () => {
        const someUser = await blockchain.treasury('someUser');
        const { dstEscrow } = await createDstEscrow(order, timelocks);
        const dstEscrowSC = blockchain.openContract(DstEscrow.createFromAddress(dstEscrow.address));
        const receiverBalanceBefore = await receiver.getBalance();
        const userBalanceBefore = await someUser.getBalance();
        blockchain.now = Math.floor(Date.now() / 1000) + timelocks.dstPublicWithdrawal + 1;

        const result = await dstEscrowSC.sendPublicWithdraw(someUser.getSender(), secret);

        expect(result.transactions).toHaveTransaction({
            from: someUser.address,
            to: dstEscrow.address,
            op: EscrowOp.public_withdraw,
            destroyed: true,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: dstEscrow.address,
            to: someUser.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: dstEscrow.address,
            to: receiver.address,
            value: order.taking_amount + toNano(0.001),
            success: true,
        });
        const deposit = toNano(0.1);
        expect(await receiver.getBalance()).toBeGreaterThanOrEqual(receiverBalanceBefore + order.taking_amount);
        expect(await someUser.getBalance()).toBeGreaterThanOrEqual(userBalanceBefore + deposit);
    });
});
