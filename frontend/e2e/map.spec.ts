import { test, expect } from '@playwright/test';

test('map controls render and basic interactions', async ({ page }) => {
  await page.goto('/');

  // Ensure map controls exist
  await expect(page.getByText('Locate me')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Photos only')).toBeVisible();

  // Search for a place (forward geocode) and ensure the search input can be typed
  const searchInput = page.getByPlaceholder('Search place');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('New York');
  await page.keyboard.press('Enter');

  // Wait a bit for map to center (no exact assertion against map internals)
  await page.waitForTimeout(1500);

  // Click an empty area of the map (at center of the viewport) to trigger empty-spot UI
  await page.mouse.click(640, 400);
  // Expect empty-spot quick action content to appear
  await expect(page.getByText(/Upload a memory|Copy coords/i)).toBeVisible({ timeout: 5000 });
});
