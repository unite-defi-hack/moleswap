import { Address } from '@ton/core';

export type OrderConfig = {
    order_hash?: bigint;
    hashlock: bigint;
    creation_time: number;
    expiration_time: number;
    maker_address: Address | bigint;
    maker_asset: Address | bigint;
    making_amount: bigint;
    receiver_address: bigint | Address;
    taker_address?: bigint | Address;
    taker_asset: bigint | Address;
    taking_amount: bigint;
    salt?: bigint;
};

export type TimelocksConfig = {
    srcWithdrawal: bigint;
    srcPublicWithdrawal: bigint;
    srcCancellation: bigint;
    srcPublicCancellation: bigint;
    dstWithdrawal: bigint;
    dstPublicWithdrawal: bigint;
    dstCancellation: bigint;
};
