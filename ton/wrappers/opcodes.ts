import { crc32 } from 'node:zlib';

export const Op = {
    create_order: crc32('create_order'),
};

export const Errors = {
    forbidden: 403,
};
