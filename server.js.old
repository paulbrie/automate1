import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const MASSIVE_API_KEY = 'EYhMPuHLcnjnNdAKNHT5xRSJTDYphEIq';
const SYMBOLS = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
const SANDBOX_URL = process.env.SANDBOX_URL || 'http://localhost:3000';

// Serve static files (except index.html which we'll handle specially)
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/images', express.static('public/images'));

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
            const message = JSON.parse(data);
            console.log('Received from Massive API:', message);
            
            // Process stock data update
            if (message.symbol && SYMBOLS.includes(message.symbol)) {
                stockData[message.symbol] = {
                    price: message.price || stockData[message.symbol].price,
                    change: message.change || 0,
                    changePercent: message.changePercent || 0,
                    timestamp: Date.now()
                };
                
                // Broadcast to all connected clients
                const updateMessage = {
                    type: 'stock_update',
                    symbol: message.symbol,
                    price: stockData[message.symbol].price,
                    change: stockData[message.symbol].change,
                    changePercent: stockData[message.symbol].changePercent,
                    timestamp: stockData[message.symbol].timestamp
                };
                
                broadcastToClients(JSON.stringify(updateMessage));
            }
        } catch (error) {
            console.error('Error processing Massive API message:', error);
        }
    });
    
    massiveWs.on('error', (error) => {
        console.error('Massive API WebSocket error:', error);
        scheduleReconnect();
    });
    
    massiveWs.on('close', () => {
        console.log('Massive API connection closed');
        scheduleReconnect();
    });
}

function scheduleReconnect() {
    if (reconnectInterval) {
        clearTimeout(reconnectInterval);
    }
    
    console.log('Scheduling reconnection in 5 seconds...');
    reconnectInterval = setTimeout(() => {
        connectToMassive();
    }, 5000);
}

// Simulate stock updates if Massive API is not working
function simulateStockUpdates() {
    setInterval(() => {
        SYMBOLS.forEach(symbol => {
            const basePrice = Math.random() * 1000 + 50; // Random price between 50-1050
            const change = (Math.random() - 0.5) * 20; // Random change between -10 and +10
            const changePercent = (change / basePrice) * 100;
            
            stockData[symbol] = {
                price: basePrice,
                change: change,
                changePercent: changePercent,
                timestamp: Date.now()
            };
            
            const updateMessage = {
                type: 'stock_update',
                symbol: symbol,
                price: basePrice,
                change: change,
                changePercent: changePercent,
                timestamp: Date.now()
            };
            
            broadcastToClients(JSON.stringify(updateMessage));
        });
    }, 3000); // Update every 3 seconds
}

// WebSocket server for clients
const clients = new Set();

app.get('/ws', (req, res) => {
    const wsUrl = SANDBOX_URL.replace('http', 'ws').replace('https', 'wss') + '/ws';
    res.status(400).send(`WebSocket connections should be made to ${wsUrl}`);
});

// Serve index.html with environment variables injected
app.get('/', (req, res) => {
    try {
        let html = readFileSync(path.join(process.cwd(), 'public/index.html'), 'utf-8');
        
        // Replace the WebSocket URL with the proper SANDBOX_URL
        const wsProtocol = SANDBOX_URL.startsWith('https') ? 'wss' : 'ws';
        const wsUrl = SANDBOX_URL.replace('http://', '').replace('https://', '');
        const websocketUrl = `${wsProtocol}://${wsUrl}/ws`;
        
        // Find and replace the WebSocket connection line - handle the template literal case
        html = html.replace(
            /const ws = new WebSocket\(`[^`]+`\);/,
            `const ws = new WebSocket('${websocketUrl}');`
        );
        
        // Also handle the case with regular string
        html = html.replace(
            /const ws = new WebSocket\([^)]+\);/,
            `const ws = new WebSocket('${websocketUrl}');`
        );
        
        console.log('Serving HTML with WebSocket URL:', websocketUrl);
        res.send(html);
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Error loading page');
    }
});

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on ${SANDBOX_URL}`);
});

// Upgrade HTTP server to support WebSocket
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
        const ws = new WebSocketServer({ noServer: true });
        
        ws.handleUpgrade(request, socket, head, (wsConnection) => {
            clients.add(wsConnection);
            console.log('Client connected. Total clients:', clients.size);
            
            // Send current stock data to new client
            SYMBOLS.forEach(symbol => {
                const updateMessage = {
                    type: 'stock_update',
                    symbol: symbol,
                    price: stockData[symbol].price,
                    change: stockData[symbol].change,
                    changePercent: stockData[symbol].changePercent,
                    timestamp: stockData[symbol].timestamp
                };
                wsConnection.send(JSON.stringify(updateMessage));
            });
            
            wsConnection.on('close', () => {
                clients.delete(wsConnection);
                console.log('Client disconnected. Total clients:', clients.size);
            });
            
            wsConnection.on('error', (error) => {
                console.error('Client WebSocket error:', error);
                clients.delete(wsConnection);
            });
        });
    } else {
        socket.destroy();
    }
});

function broadcastToClients(message) {
    clients.forEach(client => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        } catch (error) {
            console.error('Error broadcasting to client:', error);
            clients.delete(client);
        }
    });
}

// API endpoints
app.get('/api/stocks', (req, res) => {
    res.json(stockData);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        clients: clients.size,
        sandbox_url: SANDBOX_URL,
        websocket_url: SANDBOX_URL.replace('http', 'ws').replace('https', 'wss') + '/ws'
    });
});

// Start Massive API connection
connectToMassive();

// Start stock simulation as backup
simulateStockUpdates();

console.log('Stock data server started');
console.log('Available endpoints:');
console.log(`  - ${SANDBOX_URL}`);
console.log(`  - ${SANDBOX_URL}/api/stocks`);
console.log(`  - ${SANDBOX_URL}/health`);
console.log(`  - WebSocket: ${SANDBOX_URL.replace('http', 'ws').replace('https', 'wss')}/ws`);
