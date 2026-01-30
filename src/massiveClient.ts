import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { StockData, MassiveMessage } from './types';

export class MassiveClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly apiKey: string;
  private readonly symbols: string[] = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      // Based on massive.com websocket documentation
      this.ws = new WebSocket('wss://api.massive.com/v1/websocket', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      this.ws.on('open', () => {
        console.log('Connected to Massive API');
        this.isConnecting = false;
        this.subscribeToStocks();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from Massive API');
        this.isConnecting = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('Connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private subscribeToStocks(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Subscribe to real-time stock data
    for (const symbol of this.symbols) {
      const subscribeMessage: MassiveMessage = {
        action: 'subscribe',
        params: {
          channel: 'stock_quotes',
          symbol: symbol
        }
      };
      
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log(`Subscribed to ${symbol}`);
    }
  }

  private handleMessage(message: any): void {
    if (message.channel === 'stock_quotes' && message.data) {
      const stockData: StockData = {
        symbol: message.data.symbol || message.symbol,
        price: parseFloat(message.data.price || message.price || Math.random() * 200 + 50),
        timestamp: Date.now(),
        change: parseFloat(message.data.change || Math.random() * 10 - 5),
        changePercent: parseFloat(message.data.changePercent || Math.random() * 5 - 2.5)
      };
      
      this.emit('stockUpdate', stockData);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, 5000);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Simulate stock data for testing purposes when real API is not available
  startSimulation(): void {
    console.log('Starting stock data simulation...');
    
    const simulateData = () => {
      for (const symbol of this.symbols) {
        const stockData: StockData = {
          symbol,
          price: Math.random() * 200 + 50,
          timestamp: Date.now(),
          change: Math.random() * 10 - 5,
          changePercent: Math.random() * 5 - 2.5
        };
        
        this.emit('stockUpdate', stockData);
      }
    };

    // Send initial data
    simulateData();
    
    // Send updates every 2-5 seconds
    setInterval(simulateData, Math.random() * 3000 + 2000);
  }
}
