import WebSocket from 'ws';
import { EventEmitter } from 'events';
export class MassiveClient extends EventEmitter {
    ws = null;
    apiKey;
    symbols = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
    reconnectTimeout = null;
    isConnecting = false;
    simulationInterval = null;
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
    }
    async connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        this.isConnecting = true;
        try {
            console.log('Attempting to connect to Massive API...');
            // Try different WebSocket endpoints based on Massive API documentation
            const endpoints = [
                'wss://api.massive.com/v1/websocket',
                'wss://ws.massive.com/v1',
                'wss://massive.com/api/v1/websocket'
            ];
            for (const endpoint of endpoints) {
                try {
                    this.ws = new WebSocket(endpoint, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'X-API-Key': this.apiKey
                        }
                    });
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Connection timeout'));
                        }, 5000);
                        this.ws.on('open', () => {
                            clearTimeout(timeout);
                            console.log(`Connected to Massive API at ${endpoint}`);
                            this.isConnecting = false;
                            this.subscribeToStocks();
                            resolve(void 0);
                        });
                        this.ws.on('error', (error) => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                    });
                    // If we get here, connection was successful
                    this.setupEventHandlers();
                    return;
                }
                catch (error) {
                    console.log(`Failed to connect to ${endpoint}:`, error);
                    if (this.ws) {
                        this.ws.close();
                        this.ws = null;
                    }
                }
            }
            // If all endpoints failed, throw error
            throw new Error('All WebSocket endpoints failed');
        }
        catch (error) {
            console.error('Failed to connect to any Massive API endpoint:', error);
            this.isConnecting = false;
            throw error;
        }
    }
    setupEventHandlers() {
        if (!this.ws)
            return;
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            }
            catch (error) {
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
        });
    }
    subscribeToStocks() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        // Try different subscription message formats
        const subscriptionMessages = [
            {
                action: 'subscribe',
                symbols: this.symbols,
                feed: 'quotes'
            },
            {
                type: 'subscribe',
                channel: 'stocks',
                symbols: this.symbols
            },
            {
                command: 'subscribe',
                data: {
                    symbols: this.symbols,
                    feed: 'real-time'
                }
            }
        ];
        for (const message of subscriptionMessages) {
            try {
                this.ws.send(JSON.stringify(message));
                console.log('Sent subscription message:', message);
            }
            catch (error) {
                console.error('Error sending subscription:', error);
            }
        }
    }
    handleMessage(message) {
        console.log('Received message:', message);
        try {
            // Handle different message formats from Massive API
            if (message.type === 'quote' || message.type === 'stock_update') {
                const stockData = {
                    symbol: message.symbol || message.ticker,
                    price: parseFloat(message.price || message.last || message.close),
                    timestamp: message.timestamp || Date.now(),
                    change: parseFloat(message.change || 0),
                    changePercent: parseFloat(message.changePercent || message.change_percent || 0)
                };
                if (this.symbols.includes(stockData.symbol)) {
                    this.emit('stockUpdate', stockData);
                }
            }
            else if (message.data && Array.isArray(message.data)) {
                // Handle array of stock updates
                message.data.forEach((item) => {
                    if (item.symbol && item.price) {
                        const stockData = {
                            symbol: item.symbol,
                            price: parseFloat(item.price),
                            timestamp: item.timestamp || Date.now(),
                            change: parseFloat(item.change || 0),
                            changePercent: parseFloat(item.changePercent || 0)
                        };
                        if (this.symbols.includes(stockData.symbol)) {
                            this.emit('stockUpdate', stockData);
                        }
                    }
                });
            }
        }
        catch (error) {
            console.error('Error processing message:', error);
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
            });
        }, 5000);
    }
    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    // Enhanced simulation for testing when real API is not available
    startSimulation() {
        console.log('Starting enhanced stock data simulation...');
        // Clear any existing simulation
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        // Base prices for more realistic simulation
        const basePrices = {
            'AMZN': 150,
            'GOOG': 140,
            'GOOGL': 140,
            'AMD': 120,
            'NVDA': 500
        };
        let currentPrices = { ...basePrices };
        const simulateData = () => {
            for (const symbol of this.symbols) {
                // More realistic price movement
                const volatility = 0.02; // 2% volatility
                const change = (Math.random() - 0.5) * 2 * volatility;
                const newPrice = currentPrices[symbol] * (1 + change);
                const priceChange = newPrice - currentPrices[symbol];
                const changePercent = (priceChange / currentPrices[symbol]) * 100;
                currentPrices[symbol] = newPrice;
                const stockData = {
                    symbol,
                    price: Number(newPrice.toFixed(2)),
                    timestamp: Date.now(),
                    change: Number(priceChange.toFixed(2)),
                    changePercent: Number(changePercent.toFixed(2))
                };
                this.emit('stockUpdate', stockData);
            }
        };
        // Send initial data
        simulateData();
        // Send updates every 2-4 seconds to ensure changes are visible
        this.simulationInterval = setInterval(simulateData, 2000 + Math.random() * 2000);
    }
}
//# sourceMappingURL=massiveClient.js.map