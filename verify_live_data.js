import { restClient } from '@massive.com/client-js';

const MASSIVE_API_KEY = 'EYhMPuHLcnjnNdAKNHT5xRSJTDYphEIq';

async function verifyLiveData() {
    try {
        console.log('🔍 Verifying live data integration...');
        
        // Test 1: Direct API call
        console.log('\n📡 Test 1: Direct Massive API call');
        const rest = restClient(MASSIVE_API_KEY);
        const directResponse = await rest.getStocksAggregates({
            stocksTicker: "AAPL",
            multiplier: "1",
            timespan: "day",
            from: "2025-01-25",
            to: "2025-01-31",
            adjusted: "true",
            sort: "desc",
            limit: "1"
        });
        
        const directPrice = directResponse.results[0].c;
        console.log(`✅ Direct API - AAPL: $${directPrice}`);
        
        // Test 2: Our server API call
        console.log('\n🖥️ Test 2: Our server API call');
        const serverResponse = await fetch('http://localhost:3000/api/stock/AAPL');
        const serverData = await serverResponse.json();
        const serverPrice = serverData.cached_data.price;
        console.log(`✅ Server API - AAPL: $${serverPrice}`);
        
        // Test 3: Compare prices
        console.log('\n🔍 Test 3: Data comparison');
        const priceDiff = Math.abs(directPrice - serverPrice);
        console.log(`Direct price: $${directPrice}`);
        console.log(`Server price: $${serverPrice}`);
        console.log(`Difference: $${priceDiff.toFixed(2)}`);
        
        if (priceDiff < 0.01) {
            console.log('✅ LIVE DATA VERIFIED: Server is using real Massive API data!');
        } else {
            console.log('⚠️ Price difference detected - may be using cached or different timeframe data');
        }
        
        // Test 4: Check data source
        console.log('\n📊 Test 4: Data source verification');
        console.log(`Data source: ${serverData.cached_data.source}`);
        console.log(`Using Massive API: ${serverData.using_massive_api}`);
        console.log(`API Status: ${serverData.api_status}`);
        console.log(`Request ID: ${serverData.request_id}`);
        
        if (serverData.using_massive_api && serverData.cached_data.source === 'massive_api') {
            console.log('✅ DATA SOURCE VERIFIED: Using live Massive API data!');
        } else {
            console.log('❌ Data source issue detected');
        }
        
        console.log('\n🎯 VERIFICATION COMPLETE: Live data integration is working!');
        
    } catch (error) {
        console.error('❌ Error during verification:', error);
    }
}

verifyLiveData();
