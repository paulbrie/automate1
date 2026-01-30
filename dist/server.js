import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { MassiveClient } from './massiveClient';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
// Serve static files
app.use(express.static(join(__dirname, '../public')));
// Serve the HTML file
app.get('/', (req, res) => {
    const htmlPath = join(__dirname, '../public/index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    res.send(html);
});
// Create WebSocket server
const wss = new WebSocketServer({ server });
// Stock symbols we want to track
const SYMBOLS = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
const API_KEY = 'EYhMPuHLcnjnNdAKNHT5xRSJTDYphEIq';
// Store current stock prices
const stockPrices = {};
// Create massive client
const massiveClient = new MassiveClient(API_KEY);
// Listen for stock updates from massive API
massiveClient.on('stockUpdate', (stockData) => {
    stockPrices[stockData.symbol] = stockData;
    // Broadcast to all connected clients
    const message = JSON.stringify({
        type: 'update',
        symbol: stockData.symbol,
        price: stockData.price,
        change: stockData.change,
        changePercent: stockData.changePercent,
        timestamp: stockData.timestamp
    });
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
    console.log(`Updated ${stockData.symbol}: $${stockData.price} (${stockData.changePercent?.toFixed(2)}%)`);
});
// Initialize stock prices for testing
SYMBOLS.forEach(symbol => {
    stockPrices[symbol] = {
        symbol,
        price: 0,
        timestamp: Date.now(),
        change: 0,
        changePercent: 0
    };
});
// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('Client connected');
    // Send initial stock prices
    ws.send(JSON.stringify({
        type: 'init',
        data: stockPrices
    }));
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
// Start massive API connection
massiveClient.connect().catch(error => {
    console.error('Failed to connect to Massive API:', error);
    console.log('Starting simulation mode for testing...');
    massiveClient.startSimulation();
});
// Fallback simulation if massive API doesn't work
setTimeout(() => {
    if (Object.values(stockPrices).every(stock => stock.price === 0)) {
        console.log('No data from Massive API, starting simulation...');
        massiveClient.startSimulation();
    }
}, 5000);
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map