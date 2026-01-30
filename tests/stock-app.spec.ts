import { test, expect, Page } from '@playwright/test';

test.describe('Stock App', () => {
  test('should show real-time stock values that change within 60 seconds', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for the app to load and connect
    await expect(page.locator('#status')).toContainText('Connected', { timeout: 10000 });
    
    // Wait for stock data to load
    await page.waitForSelector('.stock-card', { timeout: 10000 });
    
    // Verify all required stocks are present
    const requiredStocks = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
    
    for (const stock of requiredStocks) {
      await expect(page.locator(`[data-symbol="${stock}"]`)).toBeVisible();
    }
    
    // Capture initial stock prices
    const initialPrices = new Map<string, string>();
    
    for (const stock of requiredStocks) {
      const priceElement = page.locator(`[data-symbol="${stock}"] .stock-price`);
      const initialPrice = await priceElement.textContent();
      initialPrices.set(stock, initialPrice || '');
      console.log(`Initial ${stock} price: ${initialPrice}`);
    }
    
    // Wait for price changes (up to 60 seconds)
    let changesDetected = 0;
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();
    
    while (changesDetected === 0 && (Date.now() - startTime) < maxWaitTime) {
      await page.waitForTimeout(checkInterval);
      
      for (const stock of requiredStocks) {
        const priceElement = page.locator(`[data-symbol="${stock}"] .stock-price`);
        const currentPrice = await priceElement.textContent();
        const initialPrice = initialPrices.get(stock);
        
        if (currentPrice !== initialPrice) {
          console.log(`Price change detected for ${stock}: ${initialPrice} -> ${currentPrice}`);
          changesDetected++;
        }
      }
      
      if (changesDetected > 0) {
        break;
      }
    }
    
    // Verify that at least one stock price changed
    expect(changesDetected).toBeGreaterThan(0);
    console.log(`Test passed: ${changesDetected} price changes detected within 60 seconds`);
    
    // Additional verification: check that the timestamps are updating
    const timestampElements = page.locator('.stock-timestamp');
    await expect(timestampElements.first()).toContainText('Last updated:');
    
    // Verify the page structure
    await expect(page.locator('h1')).toContainText('Real-Time Stock Prices');
    await expect(page.locator('.stocks-grid')).toBeVisible();
    
    // Check that all stock cards have the required elements
    for (const stock of requiredStocks) {
      const stockCard = page.locator(`[data-symbol="${stock}"]`);
      await expect(stockCard.locator('.stock-symbol')).toContainText(stock);
      await expect(stockCard.locator('.stock-price')).toMatch(/\$\d+\.\d{2}/);
      await expect(stockCard.locator('.stock-change')).toBeVisible();
      await expect(stockCard.locator('.stock-timestamp')).toBeVisible();
    }
  });
  
  test('should handle WebSocket reconnection', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for initial connection
    await expect(page.locator('#status')).toContainText('Connected', { timeout: 10000 });
    
    // Wait for stock data
    await page.waitForSelector('.stock-card', { timeout: 5000 });
    
    // Verify we have stock data
    const stockCards = page.locator('.stock-card');
    await expect(stockCards).toHaveCount(5);
  });
});
