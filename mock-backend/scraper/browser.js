import puppeteer from 'puppeteer';

class BrowserManager {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
    this.initPromise = null;
  }

  async init() {
    if (this.browser) return this.browser;
    if (this.isInitializing) return await this.initPromise;
    
    this.isInitializing = true;
    this.initPromise = this._createBrowser();
    
    try {
      this.browser = await this.initPromise;
      console.log('🚀 Global browser instance created');
      return this.browser;
    } finally {
      this.isInitializing = false;
    }
  }

  async _createBrowser() {
    return await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain'
      ]
    });
  }

  async createOptimizedPage() {
    const browser = await this.init();
    
    // Debug: Log browser instance type
    console.log('🔍 DEBUG: Browser instance type:', typeof browser, browser.constructor.name);
    
    // Use correct method name for creating browser context
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    console.log('✅ DEBUG: Context and page created successfully');
    
    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    console.log('🔧 DEBUG: Request interception configured');

    // Set optimized user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1280, height: 720 });
    
    // Disable JavaScript animations and transitions for faster loading
    await page.evaluateOnNewDocument(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-delay: 0.001ms !important;
          transition-duration: 0.001ms !important;
          transition-delay: 0.001ms !important;
        }
      `;
      document.head.appendChild(style);
    });
    
    // Set faster timeouts
    await page.setDefaultTimeout(3000);
    await page.setDefaultNavigationTimeout(4000);

    console.log('🎯 DEBUG: Optimized page ready for scraping');
    return { page, context };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🔒 Global browser instance closed');
    }
  }

  async cleanup() {
    if (this.browser) {
      console.log('🧹 DEBUG: Cleaning up browser instance...');
      try {
        await this.browser.close();
        this.browser = null;
        console.log('✅ Browser instance cleaned up');
      } catch (error) {
        console.error('❌ Error during browser cleanup:', error.message);
        this.browser = null; // Force reset even if cleanup fails
      }
    }
  }

  // Pre-warm browser for better performance
  async preWarm() {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('🔥 Pre-warming browser instance...');
      await this.init();
      
      // Create and close a test page to warm up the browser
      const { page, context } = await this.createOptimizedPage();
      await page.goto('about:blank');
      await context.close();
      
      console.log('✅ Browser pre-warmed successfully');
    }
  }

  isReady() {
    return this.browser && this.browser.isConnected();
  }
}

// Singleton instance
export const browserManager = new BrowserManager();

// Pre-warm browser on startup
setTimeout(async () => {
  try {
    await browserManager.preWarm();
  } catch (error) {
    console.warn('⚠️ Browser pre-warming failed:', error.message);
  }
}, 1000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down browser manager...');
  await browserManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down browser manager...');
  await browserManager.cleanup();
  process.exit(0);
});
