import axios, { AxiosInstance } from 'axios';
import { 
  RelayerOrderResponse, 
  OrderWithMetadata, 
  EscrowValidationRequest, 
  SecretRequestResponse 
} from '../types';

export class RelayerService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Check if relayer is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.error('Relayer health check failed:', error);
      return false;
    }
  }

  /**
   * Fetch orders from relayer with optional filters
   */
  async getOrders(
    limit: number = 50,
    offset: number = 0,
    status?: string,
    srcChainId?: number,
    dstChainId?: number
  ): Promise<OrderWithMetadata[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (status) params.append('status', status);
      if (srcChainId) params.append('srcChainId', srcChainId.toString());
      if (dstChainId) params.append('dstChainId', dstChainId.toString());

      const response = await this.client.get<RelayerOrderResponse>(`/api/orders?${params.toString()}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to fetch orders');
      }

      return response.data.data?.orders || [];
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      throw error;
    }
  }

  /**
   * Get active orders (ready for execution)
   */
  async getActiveOrders(limit: number = 50, offset: number = 0): Promise<OrderWithMetadata[]> {
    return this.getOrders(limit, offset, 'active');
  }

  /**
   * Get processable orders (active and pending, excluding completed and cancelled)
   */
  async getProcessableOrders(limit: number = 50, offset: number = 0): Promise<OrderWithMetadata[]> {
    // Get both active and pending orders
    const activeOrders = await this.getOrders(limit, offset, 'active');
    const pendingOrders = await this.getOrders(limit, offset, 'pending');
    
    // Combine and deduplicate orders (in case there are overlapping orders)
    const allOrders = [...activeOrders, ...pendingOrders];
    const uniqueOrders = allOrders.filter((order, index, self) => 
      index === self.findIndex(o => o.orderHash === order.orderHash)
    );
    
    // Sort by creation date (newest first) and limit
    return uniqueOrders
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  /**
   * Get orders for specific chain pair
   */
  async getOrdersByChainPair(
    srcChainId: number,
    dstChainId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<OrderWithMetadata[]> {
    return this.getOrders(limit, offset, 'active', srcChainId, dstChainId);
  }

  /**
   * Request secret for an order after escrow validation
   */
  async requestSecret(
    orderHash: string,
    escrowData: EscrowValidationRequest
  ): Promise<SecretRequestResponse> {
    try {
      const response = await this.client.post<SecretRequestResponse>(
        `/api/secrets/${orderHash}`,
        escrowData
      );

      return response.data;
    } catch (error: any) {
      console.error('Failed to request secret:', error.response?.data || error.message);
      return {
        success: false,
        error: {
          code: 'SECRET_REQUEST_FAILED',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data?.error?.details
        }
      };
    }
  }

  /**
   * Get order by hash
   */
  async getOrderByHash(orderHash: string): Promise<OrderWithMetadata | null> {
    try {
      const orders = await this.getOrders(1, 0);
      return orders.find(order => order.orderHash === orderHash) || null;
    } catch (error) {
      console.error('Failed to get order by hash:', error);
      return null;
    }
  }

  /**
   * Get total count of orders
   */
  async getOrderCount(status?: string): Promise<number> {
    try {
      const response = await this.getOrders(1, 0, status);
      // The relayer response includes total count, but for simplicity
      // we'll just return the length of orders for now
      return response.length;
    } catch (error) {
      console.error('Failed to get order count:', error);
      return 0;
    }
  }

  /**
   * Poll for new orders continuously
   */
  async pollForOrders(
    callback: (orders: OrderWithMetadata[]) => Promise<void>,
    interval: number = 10000, // 10 seconds
    maxOrders: number = 10
  ): Promise<void> {
    let lastOffset = 0;

    while (true) {
      try {
        const orders = await this.getActiveOrders(maxOrders, lastOffset);
        
        if (orders.length > 0) {
          await callback(orders);
          lastOffset += orders.length;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error('Error polling for orders:', error);
        // Wait a bit longer on error
        await new Promise(resolve => setTimeout(resolve, interval * 2));
      }
    }
  }

  /**
   * Get orders with pagination support
   */
  async getAllOrders(
    batchSize: number = 50,
    status?: string
  ): Promise<OrderWithMetadata[]> {
    const allOrders: OrderWithMetadata[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const orders = await this.getOrders(batchSize, offset, status);
      
      if (orders.length === 0) {
        hasMore = false;
      } else {
        allOrders.push(...orders);
        offset += orders.length;
        
        // Safety check to prevent infinite loops
        if (allOrders.length > 1000) {
          console.warn('Reached maximum order limit, stopping pagination');
          break;
        }
      }
    }

    return allOrders;
  }
} 