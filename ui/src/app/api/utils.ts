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