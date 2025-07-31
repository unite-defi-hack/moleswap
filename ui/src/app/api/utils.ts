const POLYNOMIAL = -306674912;

let crc32_table: Int32Array | undefined = undefined;

export function crc32(str: string, crc = 0xffffffff) {
    let bytes = new TextEncoder().encode(str);
    if (crc32_table === undefined) {
        calcTable();
    }
    for (let i = 0; i < bytes.length; ++i) crc = crc32_table![(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
}

function calcTable() {
    crc32_table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let r = i;
        for (let bit = 8; bit > 0; --bit) r = r & 1 ? (r >>> 1) ^ POLYNOMIAL : r >>> 1;
        crc32_table[i] = r;
    }
}

export function ethAddressToBigInt(address: string): bigint {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        throw new Error('Invalid Ethereum address format');
    }

    return BigInt(address.toLowerCase());
}

export function generateRandomBigInt(): bigint {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hexString = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return BigInt('0x' + hexString);
}

// Cross-chain order utilities following 1_order_create.ts logic
export function generateSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return '0x' + Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createHashLock(secret: string): Promise<string> {
    // Simple hash lock implementation - in production you'd use a proper crypto library
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return '0x' + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export interface TimeLocks {
    srcWithdrawal: bigint;
    srcPublicWithdrawal: bigint;
    srcCancellation: bigint;
    srcPublicCancellation: bigint;
    dstWithdrawal: bigint;
    dstPublicWithdrawal: bigint;
    dstCancellation: bigint;
}

export function createTimeLocks(): TimeLocks {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return {
        srcWithdrawal: now + BigInt(10),
        srcPublicWithdrawal: now + BigInt(12000),
        srcCancellation: now + BigInt(18000),
        srcPublicCancellation: now + BigInt(24000),
        dstWithdrawal: now + BigInt(10),
        dstPublicWithdrawal: now + BigInt(120),
        dstCancellation: now + BigInt(180)
    };
}

export function createSafetyDeposits() {
    return {
        srcSafetyDeposit: BigInt(1000000000000),
        dstSafetyDeposit: BigInt(1000000000000)
    };
}

export function createAuctionDetails() {
    return {
        noAuction: true,
        startTime: BigInt(0),
        endTime: BigInt(0),
        minBid: BigInt(0)
    };
}

export function randBigInt(max: bigint): bigint {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    const randomValue = BigInt('0x' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join(''));
    return randomValue % max;
}

export const UINT_40_MAX = (BigInt(1) << BigInt(40)) - BigInt(1);

// Helper function to safely serialize objects with BigInt values
export function safeStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    });
}