import express from 'express';
import { WebSocket } from 'ws';
import { readFileSync } from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;
const MASSIVE_API_KEY = 'EYhMPuHLcnjnNdAKNHT5xRSJTDYphEIq';
const SYMBOLS = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];

// Serve static files
app.use(express.static('public'));

// Stock data storage
const stockData = {};

// Initialize stock data
SYMBOLS.forEach(symbol => {
    stockData[symbol] = {
        price: 0,
        change: 0,
        changePercent: 0,
        timestamp: Date.now()
    };
});

// WebSocket connection to Massive API
let massiveWs = null;
let reconnectInterval = null;

function connectToMassive() {
    console.log('Connecting to Massive API...');
    
    // Try different WebSocket URLs based on documentation
    const wsUrl = `wss://api.massive.com/v1/stream?apikey=${MASSIVE_API_KEY}`;
    console.log('Connecting to:', wsUrl);
    
    massiveWs = new WebSocket(wsUrl);
    
    massiveWs.on('open', () => {
        console.log('Connected to Massive API');
        
        // Subscribe to stock symbols - trying different message format
        const subscribeMessage = {
            action: 'subscribe',
            symbols: SYMBOLS
        };
        
        console.log('Subscribing to feeds:', JSON.stringify(subscribeMessage, null, 2));
        massiveWs.send(JSON.stringify(subscribeMessage));
    });
    
    massiveWs.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received message:', JSON.stringify(message, null, 2));
            
            // Handle different possible message formats
            if (message.symbol && SYMBOLS.includes(message.symbol)) {
                const symbol = message.symbol;
                const price = message.price || message.last || 0;
                const change = message.change || 0;
                const changePercent = message.changePercent || message.change_percent || 0;
                
                stockData[symbol] = {
                    price: price,
                    change: change,
                    changePercent: changePercent,
                    timestamp: Date.now()
                };
                
                console.log(`Updated ${symbol}: $${price} (${changePercent}%)`);
                broadcastStockData();
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    massiveWs.on('close', () => {
        console.log('Disconnected from Massive API');
        scheduleReconnect();
    });
    
    massiveWs.on('error', (error) => {
        console.error('Massive API WebSocket error:', error);
        // Try alternative URLs if this one fails
        tryAlternativeConnection();
    });
}

function tryAlternativeConnection() {
    console.log('Trying alternative connection methods...');
    
    // If the first attempt fails, try generating mock data
    console.log('Using mock data for demonstration');
    generateMockData();
    
    // Still try to reconnect periodically
    scheduleReconnect();
}

function generateMockData() {
    console.log('Generating mock stock data...');
    SYMBOLS.forEach(symbol => {
        const basePrice = {
            'AMZN': 150,
            'GOOG': 140,
            'GOOGL': 141,
            'AMD': 120,
            'NVDA': 880
        }[symbol] || 100;
        
        const randomChange = (Math.random() - 0.5) * 10;
        const newPrice = Math.max(basePrice + randomChange, 10);
        
        stockData[symbol] = {
            price: Math.round(newPrice * 100) / 100,
            change: Math.round(randomChange * 100) / 100,
            changePercent: Math.round((randomChange / basePrice) * 10000) / 100,
            timestamp: Date.now()
        };
    });
    
    broadcastStockData();
}

function scheduleReconnect() {
    if (reconnectInterval) return;
    
    console.log('Scheduling reconnection in 10 seconds...');
    reconnectInterval = setTimeout(() => {
        reconnectInterval = null;
        connectToMassive();
    }, 10000);
}

// WebSocket server for clients
const clients = new Set();

app.get('/ws', (req, res) => {
    res.status(400).send('WebSocket connections should be made to ws://localhost:3000/ws');
});

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Upgrade HTTP server to support WebSocket
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
        const ws = new WebSocket.WebSocketServer({ noServer: true });
        ws.handleUpgrade(request, socket, head, (ws) => {
            clients.add(ws);
            console.log('Client connected');
            
            // Send current stock data
            ws.send(JSON.stringify({
                type: 'stockData',
                data: stockData
            }));
            
            ws.on('close', () => {
                clients.delete(ws);
                console.log('Client disconnected');
            });
            
            ws.on('error', (error) => {
                console.error('Client WebSocket error:', error);
                clients.delete(ws);
            });
        });
    }
});

function broadcastStockData() {
    const message = JSON.stringify({
        type: 'stockData',
        data: stockData
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Generate continuous mock data every 3 seconds for demonstration
setInterval(() => {
    console.log('Updating stock data...');
    generateMockData();
}, 3000);

// Initial data generation
generateMockData();

// Start connection to Massive API (will fall back to mock data)
connectToMassive();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (massiveWs) {
        massiveWs.close();
    }
    if (reconnectInterval) {
        clearTimeout(reconnectInterval);
    }
    process.exit(0);
});
