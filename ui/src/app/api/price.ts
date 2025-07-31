export const getAssetPrice = async (coinGeckoId: string) => {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`);
    const data = await response.json();

    return data[coinGeckoId].usd;
};