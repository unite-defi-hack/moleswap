import { crc32 } from 'node:zlib';

export const LopOp = {
    create_order: crc32('create_order'),
    claim_order: crc32('claim_order'),
};

export const EscrowOp = {
    create: crc32('create'),
    withdraw: crc32('withdraw'),
    withdraw_to: crc32('withdraw_to'),
    cancel: crc32('cancel'),
};

export const Errors = {
    forbidden: 403,
    wrong_secret: 407,
};
