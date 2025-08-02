import { crc32 } from 'node:zlib';

export const LopOp = {
    create_order: crc32('create_order'),
    fill_order: crc32('fill_order'),
};

export const EscrowOp = {
    create: crc32('create'),
    claim: crc32('claim'),
    withdraw: crc32('withdraw'),
    withdraw_to: crc32('withdraw_to'),
    public_withdraw: crc32('public_withdraw'),
    cancel: crc32('cancel'),
    public_cancel: crc32('public_cancel'),
};

export const Errors = {
    not_enough_ton: 400,
    not_enough_asset: 401,
    forbidden: 403,
    wrong_workchain: 405,
    already_claimed: 406,
    wrong_secret: 407,
    expired: 408,
    not_implemented: 501,
};

export const JettonOp = {
    transfer: 0xf8a7ea5,
    transfer_notification: 0x7362d09c,
    internal_transfer: 0x178d4519,
    excesses: 0xd53276db,
    mint: 0x1674b0a0,
};
