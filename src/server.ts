import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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
const stockPrices: { [symbol: string]: number } = {};

// Mock data for testing - in a real app, you'd connect to the massive API
function generateMockPrice(symbol: string): number {
  const basePrice = {
    'AMZN': 150,
    'GOOG': 140,
    'GOOGL': 138,
    'AMD': 120,
    'NVDA': 500
  };
  
  const base = basePrice[symbol] || 100;
  const variation = (Math.random() - 0.5) * 5; // ±$2.50 variation
  return Math.round((base + variation) * 100) / 100;
}

// Initialize stock prices
SYMBOLS.forEach(symbol => {
  stockPrices[symbol] = generateMockPrice(symbol);
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

// Simulate real-time price updates
setInterval(() => {
  SYMBOLS.forEach(symbol => {
    // Update price with some probability
    if (Math.random() < 0.3) { // 30% chance of price update
      stockPrices[symbol] = generateMockPrice(symbol);
      
      // Broadcast to all connected clients
      const message = JSON.stringify({
        type: 'update',
        symbol,
        price: stockPrices[symbol],
        timestamp: Date.now()
      });
      
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
      
      console.log(`Updated ${symbol}: $${stockPrices[symbol]}`);
    }
  });
}, 2000); // Update every 2 seconds

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
