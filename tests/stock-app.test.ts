import { test, expect } from '@playwright/test';

test('Stock prices should update in real-time within 60 seconds', async ({ page }) => {
  // Start the server (assuming it's running on localhost:3000)
  await page.goto('http://localhost:3000');
  
  // Wait for the page to load and WebSocket to connect
  await expect(page.locator('.connection-status.connected')).toBeVisible({ timeout: 10000 });
  
  // Get initial stock prices
  const stockSymbols = ['AMZN', 'GOOG', 'GOOGL', 'AMD', 'NVDA'];
  const initialPrices: { [key: string]: string } = {};
  
  for (const symbol of stockSymbols) {
    const priceElement = page.locator(`#stock-${symbol} .stock-price`);
    await expect(priceElement).toBeVisible();
    initialPrices[symbol] = await priceElement.textContent() || '';
    console.log(`Initial price for ${symbol}: ${initialPrices[symbol]}`);
  }
  
  // Wait up to 60 seconds for at least one price to change
  let priceChanged = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
  
  while (!priceChanged && attempts < maxAttempts) {
    await page.waitForTimeout(2000); // Wait 2 seconds between checks
    attempts++;
    
    console.log(`Checking for price updates... Attempt ${attempts}/${maxAttempts}`);
    
    for (const symbol of stockSymbols) {
      const priceElement = page.locator(`#stock-${symbol} .stock-price`);
      const currentPrice = await priceElement.textContent() || '';
      
      if (currentPrice !== initialPrices[symbol]) {
        console.log(`✓ Price changed for ${symbol}: ${initialPrices[symbol]} → ${currentPrice}`);
        priceChanged = true;
        break;
      }
    }
    
    // Also check the update counter
    const updateCount = await page.locator('#updateCount').textContent();
    if (updateCount && parseInt(updateCount) > 0) {
      console.log(`✓ Updates received: ${updateCount}`);
      priceChanged = true;
    }
  }
  
  // Verify that at least one price changed
  expect(priceChanged).toBe(true);
  
  // Verify the update counter shows at least 1 update
  const finalUpdateCount = await page.locator('#updateCount').textContent();
  expect(parseInt(finalUpdateCount || '0')).toBeGreaterThan(0);
  
  // Verify last update time is not "Never"
  const lastUpdateTime = await page.locator('#lastUpdateTime').textContent();
  expect(lastUpdateTime).not.toBe('Never');
  
  console.log(`Test completed successfully! Updates received: ${finalUpdateCount}`);
});
