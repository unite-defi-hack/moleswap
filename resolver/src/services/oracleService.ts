import { OraclePrice, PriceComparison } from '../types';

export class OracleService {
  private mockPrices: Map<string, OraclePrice> = new Map();
  private lastUpdate: number = Date.now();

  constructor() {
    this.initializeMockPrices();
  }

  private initializeMockPrices() {
    // Mock prices for common tokens
    const mockPriceData: OraclePrice[] = [
      {
        token: '0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C4', // USDC
        price: 1.0,
        timestamp: Date.now(),
        source: 'mock'
      },
      {
        token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        price: 3500.0,
        timestamp: Date.now(),
        source: 'mock'
      },
      {
        token: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        price: 1.0,
        timestamp: Date.now(),
        source: 'mock'
      },
      {
        token: '0x10563e509b718a279de002dfc3e94a8a8f642b03', // Mock token A
        price: 0.5,
        timestamp: Date.now(),
        source: 'mock'
      },
      {
        token: '0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c', // Mock token B
        price: 2.0,
        timestamp: Date.now(),
        source: 'mock'
      }
    ];

    mockPriceData.forEach(price => {
      this.mockPrices.set(price.token.toLowerCase(), price);
    });
  }

  /**
   * Get current price for a token
   */
  async getPrice(tokenAddress: string): Promise<OraclePrice | null> {
    const normalizedAddress = tokenAddress.toLowerCase();
    const price = this.mockPrices.get(normalizedAddress);
    
    if (!price) {
      // If token not found, generate a random price for demo purposes
      const mockPrice: OraclePrice = {
        token: tokenAddress,
        price: Math.random() * 100 + 0.1, // Random price between 0.1 and 100
        timestamp: Date.now(),
        source: 'mock'
      };
      this.mockPrices.set(normalizedAddress, mockPrice);
      return mockPrice;
    }

    // Update timestamp to simulate fresh data
    price.timestamp = Date.now();
    return price;
  }

  /**
   * Compare order price with oracle price to determine profitability
   */
  async checkProfitability(
    makerAsset: string,
    takerAsset: string,
    makingAmount: string,
    takingAmount: string,
    minProfitPercent: number = 1.0
  ): Promise<PriceComparison> {
    const makerPrice = await this.getPrice(makerAsset);
    const takerPrice = await this.getPrice(takerAsset);

    if (!makerPrice || !takerPrice) {
      throw new Error('Unable to get price data for one or both tokens');
    }

    // Calculate order price (how much taker asset per maker asset)
    const makerAmount = parseFloat(makingAmount) / Math.pow(10, 18); // Assuming 18 decimals
    const takerAmount = parseFloat(takingAmount) / Math.pow(10, 18);
    
    const orderPrice = (takerAmount * takerPrice.price) / (makerAmount * makerPrice.price);
    
    // Calculate oracle price (how much taker asset per maker asset at market rate)
    const oraclePrice = takerPrice.price / makerPrice.price;
    
    // Calculate price difference
    const priceDifference = orderPrice - oraclePrice;
    const priceDifferencePercent = (priceDifference / oraclePrice) * 100;
    
    // Determine if profitable (order price should be higher than oracle price)
    const isProfitable = priceDifferencePercent >= minProfitPercent;

    console.log(`Profitability check for ${makerAsset} -> ${takerAsset}:`, {
      makerPrice: makerPrice.price,
      takerPrice: takerPrice.price,
      orderPrice,
      oraclePrice,
      priceDifferencePercent,
      isProfitable
    });

    return {
      orderPrice,
      oraclePrice,
      priceDifference,
      priceDifferencePercent,
      isProfitable,
      minProfitPercent
    };
  }

  /**
   * Get all available token prices
   */
  async getAllPrices(): Promise<OraclePrice[]> {
    return Array.from(this.mockPrices.values());
  }

  /**
   * Update mock price for testing
   */
  updateMockPrice(tokenAddress: string, price: number): void {
    const normalizedAddress = tokenAddress.toLowerCase();
    const existingPrice = this.mockPrices.get(normalizedAddress);
    
    if (existingPrice) {
      existingPrice.price = price;
      existingPrice.timestamp = Date.now();
    } else {
      this.mockPrices.set(normalizedAddress, {
        token: tokenAddress,
        price,
        timestamp: Date.now(),
        source: 'mock'
      });
    }
  }

  /**
   * Get price history for a token (mock implementation)
   */
  async getPriceHistory(tokenAddress: string, hours: number = 24): Promise<OraclePrice[]> {
    const currentPrice = await this.getPrice(tokenAddress);
    if (!currentPrice) return [];

    const history: OraclePrice[] = [];
    const interval = hours * 60 * 60 * 1000; // Convert to milliseconds
    const steps = 10; // Generate 10 data points

    for (let i = 0; i < steps; i++) {
      const timestamp = currentPrice.timestamp - (interval * i / steps);
      const priceVariation = (Math.random() - 0.5) * 0.1; // ±5% variation
      
      history.push({
        token: tokenAddress,
        price: currentPrice.price * (1 + priceVariation),
        timestamp,
        source: 'mock'
      });
    }

    return history.reverse();
  }
} 