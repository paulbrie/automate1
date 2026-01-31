import { restClient } from '@massive.com/client-js';

const MASSIVE_API_KEY = 'EYhMPuHLcnjnNdAKNHT5xRSJTDYphEIq';

async function testMassiveAPI() {
    try {
        console.log('Testing Massive API...');
        
        const rest = restClient(MASSIVE_API_KEY);
        
        console.log('REST client structure:', Object.keys(rest));
        console.log('REST client type:', typeof rest);
        
        // Try different API call patterns
        console.log('Trying getStocksAggregates directly...');
        const response1 = await rest.getStocksAggregates({
            stocksTicker: "AAPL",
            multiplier: "1",
            timespan: "day",
            from: "2025-01-20",
            to: "2025-01-31",
            adjusted: "true",
            sort: "desc",
            limit: "5"
        });
        
        console.log('Response:', JSON.stringify(response1, null, 2));
        
    } catch (error) {
        console.error('Error testing Massive API:', error.message);
    }
}

testMassiveAPI();
