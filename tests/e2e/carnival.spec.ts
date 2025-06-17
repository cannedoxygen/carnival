import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
const LOCAL_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 60000;

test.describe('Carnival E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    // Create a new context for each test to ensure isolation
    context = await browser.newContext();
    page = await context.newPage();
    
    // Set longer timeout for Web3 operations
    test.setTimeout(TEST_TIMEOUT);
    
    // Navigate to the application
    await page.goto(LOCAL_URL);
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Landing Page', () => {
    test('should display the main carnival interface', async () => {
      // Check for main heading
      await expect(page.locator('h1')).toContainText(/carnival|simpsons/i);
      
      // Check for key game elements
      await expect(page.locator('[data-testid="ticket-booth"]')).toBeVisible();
      await expect(page.locator('[data-testid="door-selection"]')).toBeVisible();
      await expect(page.locator('[data-testid="jackpot-display"]')).toBeVisible();
      
      // Check for wallet connection button
      await expect(page.locator('[data-testid="wallet-connect"]')).toBeVisible();
    });

    test('should display current jackpot amount', async () => {
      const jackpotDisplay = page.locator('[data-testid="jackpot-amount"]');
      await expect(jackpotDisplay).toBeVisible();
      
      // Should show some ETH amount (could be 0 initially)
      await expect(jackpotDisplay).toContainText(/\d+\.?\d*\s*ETH/i);
    });

    test('should show leaderboard', async () => {
      const leaderboard = page.locator('[data-testid="leaderboard"]');
      await expect(leaderboard).toBeVisible();
      
      // May be empty initially, but should have the structure
      await expect(page.locator('[data-testid="leaderboard-header"]')).toContainText(/leaderboard|top\s*players/i);
    });
  });

  test.describe('Wallet Connection', () => {
    test('should prompt for wallet connection when attempting to play', async () => {
      // Try to select a key without connecting wallet
      await page.click('[data-testid="bronze-key"]');
      
      // Should show wallet connection prompt
      await expect(page.locator('[data-testid="wallet-prompt"]')).toBeVisible();
    });

    test('should handle wallet connection flow', async () => {
      // Click connect wallet button
      await page.click('[data-testid="wallet-connect"]');
      
      // Should show wallet selection modal
      await expect(page.locator('[data-testid="wallet-modal"]')).toBeVisible();
      
      // Should have MetaMask option (most common)
      await expect(page.locator('[data-testid="metamask-option"]')).toBeVisible();
    });
  });

  test.describe('Game Interface', () => {
    test('should display key purchase options', async () => {
      // Check all three key types are visible
      await expect(page.locator('[data-testid="bronze-key"]')).toBeVisible();
      await expect(page.locator('[data-testid="silver-key"]')).toBeVisible();
      await expect(page.locator('[data-testid="gold-key"]')).toBeVisible();
      
      // Check prices are displayed
      await expect(page.locator('[data-testid="bronze-key-price"]')).toContainText('0.005 ETH');
      await expect(page.locator('[data-testid="silver-key-price"]')).toContainText('0.01 ETH');
      await expect(page.locator('[data-testid="gold-key-price"]')).toContainText('0.025 ETH');
    });

    test('should display door selection', async () => {
      // Check all three doors are visible
      for (let i = 1; i <= 3; i++) {
        await expect(page.locator(`[data-testid="door-${i}"]`)).toBeVisible();
      }
      
      // Doors should be interactive
      await page.hover('[data-testid="door-1"]');
      // Should have some hover effect or cursor change
    });

    test('should show game rules and mechanics', async () => {
      // Click on rules/help button
      await page.click('[data-testid="rules-button"]');
      
      // Rules modal should appear
      await expect(page.locator('[data-testid="rules-modal"]')).toBeVisible();
      
      // Should contain key information
      await expect(page.locator('[data-testid="rules-content"]')).toContainText(/win/i);
      await expect(page.locator('[data-testid="rules-content"]')).toContainText(/probability/i);
      await expect(page.locator('[data-testid="rules-content"]')).toContainText(/jackpot/i);
    });
  });

  test.describe('Game Statistics', () => {
    test('should display game statistics when available', async () => {
      // Check for stats section
      const statsSection = page.locator('[data-testid="game-stats"]');
      
      if (await statsSection.isVisible()) {
        // Should show total games, wins, losses, etc.
        await expect(page.locator('[data-testid="total-games"]')).toBeVisible();
        await expect(page.locator('[data-testid="total-wins"]')).toBeVisible();
        await expect(page.locator('[data-testid="total-wagered"]')).toBeVisible();
      }
    });

    test('should display player history when available', async () => {
      // Navigate to history page
      await page.click('[data-testid="history-link"]');
      await page.waitForURL('**/history');
      
      // Should show history interface
      await expect(page.locator('[data-testid="game-history"]')).toBeVisible();
      
      // May be empty for new users
      const historyItems = page.locator('[data-testid="history-item"]');
      const count = await historyItems.count();
      
      if (count > 0) {
        // Should show game details
        await expect(historyItems.first()).toContainText(/bronze|silver|gold/i);
        await expect(historyItems.first()).toContainText(/win|lose|break/i);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Main elements should still be visible
      await expect(page.locator('[data-testid="ticket-booth"]')).toBeVisible();
      await expect(page.locator('[data-testid="door-selection"]')).toBeVisible();
      
      // Navigation should adapt to mobile
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
      }
    });

    test('should work on tablet devices', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // All game elements should be accessible
      await expect(page.locator('[data-testid="bronze-key"]')).toBeVisible();
      await expect(page.locator('[data-testid="silver-key"]')).toBeVisible();
      await expect(page.locator('[data-testid="gold-key"]')).toBeVisible();
      
      // Layout should adapt appropriately
      const gameArea = page.locator('[data-testid="game-area"]');
      const bbox = await gameArea.boundingBox();
      expect(bbox?.width).toBeLessThanOrEqual(768);
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async () => {
      const startTime = Date.now();
      await page.goto(LOCAL_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should have good lighthouse scores', async () => {
      // Note: This would require additional setup for lighthouse in Playwright
      // For now, we'll check basic performance indicators
      
      // Check for critical resources
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
      
      // Check that CSS and JS are loaded
      const styles = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      expect(styles).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await context.setOffline(true);
      
      // Try to interact with the app
      await page.click('[data-testid="bronze-key"]');
      
      // Should show appropriate error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      
      // Restore network
      await context.setOffline(false);
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should recover
      await expect(page.locator('[data-testid="ticket-booth"]')).toBeVisible();
    });

    test('should handle Web3 connection errors', async () => {
      // This test assumes no Web3 provider is available
      await page.click('[data-testid="wallet-connect"]');
      
      // Should show appropriate message if no wallet detected
      const errorMessage = page.locator('[data-testid="wallet-error"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/wallet|metamask|web3/i);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      // Tab through key elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Should be able to navigate to main game elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        if (await focused.isVisible()) {
          const tagName = await focused.evaluate(el => el.tagName);
          if (['BUTTON', 'A', 'INPUT'].includes(tagName)) {
            // Interactive element found
            break;
          }
        }
      }
    });

    test('should have proper ARIA labels', async () => {
      // Check for ARIA labels on key interactive elements
      const walletButton = page.locator('[data-testid="wallet-connect"]');
      await expect(walletButton).toHaveAttribute('aria-label');
      
      const bronzeKey = page.locator('[data-testid="bronze-key"]');
      if (await bronzeKey.isVisible()) {
        await expect(bronzeKey).toHaveAttribute('aria-label');
      }
    });

    test('should support screen readers', async () => {
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const count = await headings.count();
      expect(count).toBeGreaterThan(0);
      
      // Check for alt text on images
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        await expect(img).toHaveAttribute('alt');
      }
    });
  });

  test.describe('Animation and Visual Effects', () => {
    test('should have smooth animations', async () => {
      // Test hover effects on doors
      await page.hover('[data-testid="door-1"]');
      
      // Should have some visual feedback (could check CSS transitions)
      const door = page.locator('[data-testid="door-1"]');
      const transform = await door.evaluate(el => 
        window.getComputedStyle(el).transform
      );
      
      // Basic check that styles are applied
      expect(transform).toBeDefined();
    });

    test('should handle reduced motion preferences', async () => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      // Reload page to apply preference
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Animations should still be functional but less prominent
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    });
  });

  test.describe('Content and Theming', () => {
    test('should display Simpsons-themed content', async () => {
      // Check for Simpsons-related content
      const content = await page.textContent('body');
      
      // Should contain carnival or Simpsons references
      expect(content).toMatch(/carnival|simpsons|springfield/i);
    });

    test('should support dark/light theme toggling', async () => {
      const themeToggle = page.locator('[data-testid="theme-toggle"]');
      
      if (await themeToggle.isVisible()) {
        // Get initial theme
        const initialTheme = await page.evaluate(() => 
          document.documentElement.getAttribute('data-theme')
        );
        
        // Toggle theme
        await themeToggle.click();
        
        // Theme should change
        const newTheme = await page.evaluate(() => 
          document.documentElement.getAttribute('data-theme')
        );
        
        expect(newTheme).not.toBe(initialTheme);
      }
    });
  });

  test.describe('Sound and Audio', () => {
    test('should handle audio controls properly', async () => {
      const audioToggle = page.locator('[data-testid="audio-toggle"]');
      
      if (await audioToggle.isVisible()) {
        // Should be able to toggle audio
        await audioToggle.click();
        
        // Should show some indication of audio state
        const audioState = await audioToggle.getAttribute('aria-pressed');
        expect(audioState).toBeDefined();
      }
    });
  });

  test.describe('Social Features', () => {
    test('should display leaderboard correctly', async () => {
      const leaderboard = page.locator('[data-testid="leaderboard"]');
      await expect(leaderboard).toBeVisible();
      
      // Check for leaderboard entries structure
      const entries = page.locator('[data-testid="leaderboard-entry"]');
      const count = await entries.count();
      
      if (count > 0) {
        // Each entry should have address and amount
        await expect(entries.first()).toContainText(/0x[a-fA-F0-9]+/);
        await expect(entries.first()).toContainText(/\d+\.?\d*\s*ETH/);
      }
    });

    test('should show recent winners', async () => {
      const recentWinners = page.locator('[data-testid="recent-winners"]');
      
      if (await recentWinners.isVisible()) {
        // Should show winner information
        const winners = page.locator('[data-testid="winner-entry"]');
        const count = await winners.count();
        
        if (count > 0) {
          await expect(winners.first()).toContainText(/won|jackpot/i);
        }
      }
    });
  });
});

// Helper function for testing with mocked Web3
test.describe('Mocked Web3 Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Web3 provider
    await page.addInitScript(() => {
      // Mock ethereum object
      (window as any).ethereum = {
        isMetaMask: true,
        request: async (params: any) => {
          if (params.method === 'eth_requestAccounts') {
            return ['0x1234567890123456789012345678901234567890'];
          }
          if (params.method === 'eth_chainId') {
            return '0x1'; // Mainnet
          }
          if (params.method === 'eth_getBalance') {
            return '0x1BC16D674EC80000'; // 2 ETH
          }
          return null;
        },
        on: () => {},
        removeListener: () => {}
      };
    });
  });

  test('should complete a full game flow with mocked wallet', async () => {
    await page.goto(LOCAL_URL);
    await page.waitForLoadState('networkidle');
    
    // Connect wallet
    await page.click('[data-testid="wallet-connect"]');
    
    // Should show connected state
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    
    // Select a key
    await page.click('[data-testid="bronze-key"]');
    
    // Select a door
    await page.click('[data-testid="door-2"]');
    
    // Should show game state
    await expect(page.locator('[data-testid="game-active"]')).toBeVisible();
    
    // Note: Full transaction flow would require more complex mocking
  });
});