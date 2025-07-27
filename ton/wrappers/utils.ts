import { randomBytes } from 'node:crypto';
import { Address } from '@ton/core';

export const HOLE_ADDRESS = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c');

export function generateRandomBigInt(): bigint {
    return BigInt('0x' + randomBytes(32).toString('hex'));
}

export function ethAddressToBigInt(address: string): bigint {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        throw new Error('Invalid Ethereum address format');
    }

    return BigInt(address.toLowerCase());
}
