import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import path from 'path';
import { restClient, getStocksWebsocket } from '@massive.com/client-js';

const app = express();
const PORT = 3000;
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || 'EYhMPuHLcnjnNdAKNHT5xRSJTDYphEIq';
const SYMBOLS = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA', 'AAPL', 'MSFT', 'TSLA'];
const SANDBOX_URL = process.env.SANDBOX_URL || 'http://localhost:3000';

console.log('Using Massive API Key:', MASSIVE_API_KEY.substring(0, 8) + '...');

// Initialize Massive REST client
const massiveRest = restClient(MASSIVE_API_KEY);

// Serve static files (except index.html which we'll handle specially)
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/images', express.static('public/images'));

// Stock data storage
const stockData = {};

// Initialize stock data with live data from Massive API
async function initializeStockData() {
    console.log('Initializing stock data with live data from Massive API...');
    
    for (const symbol of SYMBOLS) {
        try {
            // Get the latest daily bar for each symbol
            const response = await massiveRest.getStocksAggregates({
                stocksTicker: symbol,
                multiplier: "1",
                timespan: "day",
                from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
                to: new Date().toISOString().split('T')[0], // today
                adjusted: "true",
                sort: "desc",
                limit: "2"
            });

            if (response.results && response.results.length > 0) {
                const latest = response.results[0];
                const previous = response.results[1] || latest;
                
                const currentPrice = latest.c; // Close price as current
                const previousClose = previous.c;
                const change = currentPrice - previousClose;
                const changePercent = (change / previousClose) * 100;

                stockData[symbol] = {
                    price: currentPrice,
                    change: change,
                    changePercent: changePercent,
                    timestamp: Date.now(),
                    volume: latest.v,
                    high: latest.h,
                    low: latest.l,
                    open: latest.o,
                    close: latest.c,
                    vwap: latest.vw,
                    source: 'massive_api',
                    last_updated: new Date().toISOString()
                };

                console.log(`✅ ${symbol}: $${currentPrice.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%) [LIVE DATA]`);
            } else {
                // Fallback to simulated data if no results
                stockData[symbol] = {
                    price: Math.random() * 200 + 50,
                    change: (Math.random() - 0.5) * 10,
                    changePercent: (Math.random() - 0.5) * 5,
                    timestamp: Date.now(),
                    source: 'simulated',
                    last_updated: new Date().toISOString()
                };
                console.log(`⚠️ No data for ${symbol}, using simulated data`);
            }
        } catch (error) {
            console.error(`❌ Error fetching data for ${symbol}:`, error.message);
            // Fallback to simulated data
            stockData[symbol] = {
                price: Math.random() * 200 + 50,
                change: (Math.random() - 0.5) * 10,
                changePercent: (Math.random() - 0.5) * 5,
                timestamp: Date.now(),
                source: 'simulated_fallback',
                last_updated: new Date().toISOString()
            };
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

// WebSocket clients management
const clients = new Set();

// Create WebSocket server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ 
    server,
    path: '/ws'
});

// Set up Massive WebSocket for real-time data
let massiveWebSocket = null;

function connectToMassiveWebSocket() {
    try {
        console.log('🔌 Connecting to Massive WebSocket...');
        
        // Get the stocks WebSocket client
        massiveWebSocket = getStocksWebsocket(MASSIVE_API_KEY);
        
        // Subscribe to ticker events for our symbols
        SYMBOLS.forEach(symbol => {
            massiveWebSocket.subscribe('AM', symbol);
            console.log(`📊 Subscribed to ${symbol} minute aggregates`);
        });

        massiveWebSocket.on('message', (data) => {
            try {
                console.log('📨 Received WebSocket message:', data);
                
                if (data.ev === 'AM' && data.sym && stockData[data.sym]) {
                    // Update stock data with real-time aggregate data
                    const symbol = data.sym;
                    const price = data.c || stockData[symbol].price;
                    const open = data.o || stockData[symbol].open;
                    const change = price - open;
                    const changePercent = (change / open) * 100;

                    stockData[symbol] = {
                        ...stockData[symbol],
                        price: price,
                        change: change,
                        changePercent: changePercent,
                        timestamp: Date.now(),
                        volume: data.v || stockData[symbol].volume,
                        high: data.h || stockData[symbol].high,
                        low: data.l || stockData[symbol].low,
                        vwap: data.vw || stockData[symbol].vwap,
                        source: 'massive_websocket',
                        last_updated: new Date().toISOString()
                    };

                    // Broadcast to all connected clients
                    broadcastToClients(JSON.stringify({
                        type: 'stock_update',
                        symbol: symbol,
                        data: stockData[symbol]
                    }));
                }
            } catch (error) {
                console.error('❌ Error processing WebSocket message:', error.message);
            }
        });

        massiveWebSocket.on('error', (error) => {
            console.error('❌ Massive WebSocket error:', error.message);
            setTimeout(connectToMassiveWebSocket, 5000);
        });

        massiveWebSocket.on('close', () => {
            console.log('🔌 Massive WebSocket connection closed');
            setTimeout(connectToMassiveWebSocket, 5000);
        });

    } catch (error) {
        console.error('❌ Error setting up Massive WebSocket:', error.message);
        // Fall back to periodic REST API updates
        console.log('📱 Falling back to periodic REST API updates...');
        setInterval(updateStockDataFromREST, 30000); // Update every 30 seconds
    }
}

// Fallback function to update data via REST API
async function updateStockDataFromREST() {
    console.log('🔄 Updating stock data via REST API...');
    
    for (const symbol of SYMBOLS) {
        try {
            const response = await massiveRest.getStocksAggregates({
                stocksTicker: symbol,
                multiplier: "1",
                timespan: "minute",
                from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 hours ago
                to: new Date().toISOString().split('T')[0],
                adjusted: "true",
                sort: "desc",
                limit: "1"
            });

            if (response.results && response.results.length > 0) {
                const result = response.results[0];
                const prevPrice = stockData[symbol].price;
                const newPrice = result.c;
                const change = newPrice - (stockData[symbol].open || result.o);
                const changePercent = (change / (stockData[symbol].open || result.o)) * 100;

                stockData[symbol] = {
                    ...stockData[symbol],
                    price: newPrice,
                    change: change,
                    changePercent: changePercent,
                    timestamp: Date.now(),
                    volume: result.v,
                    high: result.h,
                    low: result.l,
                    close: result.c,
                    vwap: result.vw,
                    source: 'massive_api_periodic',
                    last_updated: new Date().toISOString()
                };

                // Broadcast to clients if price changed significantly
                if (Math.abs(newPrice - prevPrice) > 0.01) {
                    broadcastToClients(JSON.stringify({
                        type: 'stock_update',
                        symbol: symbol,
                        data: stockData[symbol]
                    }));
                }
            }
        } catch (error) {
            console.error(`❌ Error updating ${symbol} via REST:`, error.message);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('🟢 New WebSocket client connected');
    clients.add(ws);

    // Send current stock data to new client
    ws.send(JSON.stringify({
        type: 'initial_data',
        data: stockData
    }));

    ws.on('close', () => {
        console.log('🔴 Client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('❌ Client WebSocket error:', error);
        clients.delete(ws);
    });
});

function broadcastToClients(message) {
    clients.forEach(client => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        } catch (error) {
            console.error('❌ Error broadcasting to client:', error);
            clients.delete(client);
        }
    });
}

// Serve index.html with dynamic WebSocket URL
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(process.cwd(), 'public', 'index.html');
        const html = readFileSync(indexPath, 'utf8');
        
        const wsUrl = SANDBOX_URL.replace('http', 'ws').replace('https', 'wss') + '/ws';
        const modifiedHtml = html.replace(/ws:\/\/[^'"]+/g, wsUrl);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(modifiedHtml);
    } catch (error) {
        console.error('❌ Error serving index.html:', error);
        res.status(500).send('Error loading page');
    }
});

// API endpoints
app.get('/api/stocks', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        source: 'massive_api',
        data: stockData
    });
});

app.get('/api/stock/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    
    try {
        // Get real-time data from Massive API
        const response = await massiveRest.getStocksAggregates({
            stocksTicker: symbol,
            multiplier: "1",
            timespan: "day",
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            to: new Date().toISOString().split('T')[0],
            adjusted: "true",
            sort: "desc",
            limit: "5"
        });

        res.json({
            symbol,
            cached_data: stockData[symbol],
            live_data: response.results || [],
            api_status: response.status,
            request_id: response.request_id,
            query_count: response.queryCount,
            results_count: response.resultsCount,
            using_massive_api: true
        });
    } catch (error) {
        console.error(`❌ Error fetching ${symbol}:`, error);
        res.status(500).json({
            error: 'Failed to fetch live data',
            symbol,
            cached_data: stockData[symbol],
            using_massive_api: true
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        clients: clients.size,
        sandbox_url: SANDBOX_URL,
        websocket_url: SANDBOX_URL.replace('http', 'ws').replace('https', 'wss') + '/ws',
        api_key_configured: !!MASSIVE_API_KEY,
        api_key_preview: MASSIVE_API_KEY.substring(0, 8) + '...',
        symbols: SYMBOLS,
        stock_data_initialized: Object.keys(stockData).length > 0,
        using_massive_api: true,
        data_sources: Object.values(stockData).map(d => d.source).filter((v, i, a) => a.indexOf(v) === i)
    });
});

// Initialize everything
async function startServer() {
    try {
        await initializeStockData();
        connectToMassiveWebSocket();
        
        console.log('🎯 Stock data server started with live Massive API data');
        console.log('📋 Available endpoints:');
        console.log(`  🏠 Main page: ${SANDBOX_URL}`);
        console.log(`  📊 All stocks: ${SANDBOX_URL}/api/stocks`);
        console.log(`  📈 Single stock: ${SANDBOX_URL}/api/stock/{SYMBOL}`);
        console.log(`  ❤️ Health check: ${SANDBOX_URL}/health`);
        console.log(`  🔌 WebSocket: ${SANDBOX_URL.replace('http', 'ws').replace('https', 'wss')}/ws`);
        
        // Start periodic REST updates as fallback
        setInterval(updateStockDataFromREST, 60000); // Update every minute
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
    }
}

startServer();
