import { test, expect, Page } from '@playwright/test';

// Test that stock values change at least once in 60 seconds
test('stock values should change at least once in 60 seconds', async ({ page }) => {
  // Set a longer timeout for this test
  test.setTimeout(70000);

  console.log('Navigating to the stock app...');
  await page.goto('http://localhost:3000');

  // Wait for the page to load and WebSocket to connect
  await expect(page.locator('h1')).toContainText('Real-time Stock Data');
  
  console.log('Waiting for WebSocket connection...');
  // Wait for status to show connected or for stock data to appear
  await page.waitForSelector('#status', { timeout: 10000 });
  
  // Wait for stock cards to appear
  await page.waitForSelector('.stock-card', { timeout: 10000 });
  
  console.log('Stock cards loaded, capturing initial prices...');
  
  // Capture initial prices for all stocks
  const stocks = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
  const initialPrices: { [key: string]: string } = {};
  
  for (const stock of stocks) {
    const stockCard = page.locator(`[data-symbol="${stock}"]`);
    await expect(stockCard).toBeVisible();
    
    const priceElement = stockCard.locator('.stock-price');
    const initialPrice = await priceElement.textContent();
    initialPrices[stock] = initialPrice || '';
    console.log(`Initial ${stock} price: ${initialPrice}`);
  }
  
  console.log('Waiting for price changes over 60 seconds...');
  
  // Wait up to 60 seconds for at least one stock price to change
  let changeDetected = false;
  const startTime = Date.now();
  const maxWaitTime = 60000; // 60 seconds
  
  while (!changeDetected && (Date.now() - startTime) < maxWaitTime) {
    // Wait a bit before checking again
    await page.waitForTimeout(2000);
    
    // Check if any price has changed
    for (const stock of stocks) {
      const stockCard = page.locator(`[data-symbol="${stock}"]`);
      const priceElement = stockCard.locator('.stock-price');
      const currentPrice = await priceElement.textContent();
      
      if (currentPrice && currentPrice !== initialPrices[stock] && currentPrice !== '$0.00') {
        console.log(`✅ Price change detected for ${stock}: ${initialPrices[stock]} → ${currentPrice}`);
        changeDetected = true;
        break;
      }
    }
    
    if (changeDetected) {
      break;
    }
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`Still waiting... ${elapsed}s elapsed`);
  }
  
  // Verify that at least one stock price changed
  expect(changeDetected).toBeTruthy();
  
  console.log('✅ Test passed: Stock values changed within 60 seconds');
  
  // Additional verification: check that all stocks have reasonable prices
  for (const stock of stocks) {
    const stockCard = page.locator(`[data-symbol="${stock}"]`);
    const priceElement = stockCard.locator('.stock-price');
    const currentPrice = await priceElement.textContent();
    
    // Verify price format and that it's not zero
    expect(currentPrice).toMatch(/^\$\d+\.\d{2}$/);
    expect(currentPrice).not.toBe('$0.00');
    
    // Check that change information is displayed
    const changeElement = stockCard.locator('.stock-change');
    const changeText = await changeElement.textContent();
    expect(changeText).toMatch(/[+-]?\$\d+\.\d{2}\s*\([+-]?\d+\.\d{2}%\)/);
    
    console.log(`Final ${stock}: ${currentPrice}, Change: ${changeText}`);
  }
  
  console.log('✅ All stock data validation passed');
});

// Additional test to verify the WebSocket connection works
test('WebSocket connection should be established', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Wait for the status element
  const statusElement = page.locator('#status');
  await expect(statusElement).toBeVisible();
  
  // Status should eventually show connected or show stock data
  await page.waitForTimeout(3000);
  
  // Check that we have stock cards
  const stockCards = page.locator('.stock-card');
  await expect(stockCards).toHaveCount(5); // Should have 5 stock cards
  
  // Verify all expected stocks are present
  const stocks = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
  for (const stock of stocks) {
    await expect(page.locator(`[data-symbol="${stock}"] .stock-symbol`)).toContainText(stock);
  }
  
  console.log('✅ WebSocket connection and stock cards verified');
});
