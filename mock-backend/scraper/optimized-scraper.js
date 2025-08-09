import { browserManager } from './browser.js';
import { getPrioridad } from '../lib/utils.js';
import pLimit from 'p-limit';

const SCRAPE_CONCURRENCY = parseInt(process.env.SCRAPE_CONCURRENCY) || 6;
const SCRAPE_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT_MS) || 6000;
const NAVIGATION_TIMEOUT = parseInt(process.env.NAVIGATION_TIMEOUT) || 6000;
const SELECTOR_TIMEOUT = parseInt(process.env.SELECTOR_TIMEOUT) || 3000;
const MAX_RETRIES = 2;

const limit = pLimit(SCRAPE_CONCURRENCY);

// Exponential backoff with jitter
function delay(ms, jitter = true) {
  const actualDelay = jitter ? ms + Math.random() * ms * 0.1 : ms;
  return new Promise(resolve => setTimeout(resolve, actualDelay));
}

async function retryWithBackoff(fn, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms: ${error.message}`);
      await delay(backoffMs);
    }
  }
}

export async function obtenerServidoresDesdeLatAnimeOptimizada(slug, ep) {
  const urlLatAnime = `https://latanime.org/ver/${slug}-episodio-${ep}`;
  const startTime = Date.now();
  
  console.log(`🔍 [${slug}:${ep}] Accessing: ${urlLatAnime}`);
  console.log(`🐛 DEBUG: Starting scraper for ${slug}:${ep}`);

  let page, context;
  
  try {
    // Create browser page with debug info
    console.log(`🔧 DEBUG: Creating optimized browser page...`);
    const pageResult = await browserManager.createOptimizedPage();
    page = pageResult.page;
    context = pageResult.context;
    console.log(`✅ DEBUG: Browser page created successfully`);
    const navigationStart = Date.now();
    console.log(`🚀 DEBUG: Navigating to ${urlLatAnime}`);
    
    // Navigate with stable timeout and fallback strategy
    try {
      await page.goto(urlLatAnime, { 
        waitUntil: 'networkidle2', 
        timeout: NAVIGATION_TIMEOUT 
      });
    } catch (navError) {
      console.warn(`⚠️ [${slug}:${ep}] Navigation with networkidle2 failed, trying domcontentloaded`);
      await page.goto(urlLatAnime, { 
        waitUntil: 'domcontentloaded', 
        timeout: NAVIGATION_TIMEOUT + 2000 
      });
    }
    
    console.log(`✅ DEBUG: Page loaded successfully`);
    
    // Optimized selector waiting with reduced timeout
    try {
      console.log(`🔍 DEBUG: Waiting for .play-video selector...`);
      await page.waitForSelector('.play-video', { 
        timeout: SELECTOR_TIMEOUT,
        visible: true 
      });
      console.log(`✅ DEBUG: .play-video selector found`);
    } catch (selectorError) {
      console.warn(`⚠️ [${slug}:${ep}] Server container not found, proceeding anyway`);
      console.log(`🐛 DEBUG: Selector error:`, selectorError.message);
      
      // Try alternative selector as fallback
      try {
        await page.waitForSelector('[data-player]', { timeout: 1000 });
        console.log(`✅ DEBUG: Alternative selector [data-player] found`);
      } catch {
        console.log(`⚠️ DEBUG: No video elements found, continuing with extraction`);
      }
    }
    
    const navigationTime = Date.now() - navigationStart;
    
    // Extract all servers in one evaluation
    const extractStart = Date.now();
    console.log(`🔍 DEBUG: Extracting servers from .play-video elements...`);
    
    const servidoresRaw = await page.$$eval('.play-video', (els) => {
      console.log('DEBUG: Found', els.length, 'elements with .play-video class');
      return els.map((el) => ({
        nombre: el.textContent.trim(),
        base64url: el.getAttribute('data-player'),
      }));
    });
    
    const extractTime = Date.now() - extractStart;
    console.log(`📡 [${slug}:${ep}] Found ${servidoresRaw.length} raw servers (nav: ${navigationTime}ms, extract: ${extractTime}ms)`);
    console.log(`🐛 DEBUG: Raw servers data:`, JSON.stringify(servidoresRaw, null, 2));

    // Process servers with optimized concurrency and batching
    const processStart = Date.now();
    console.log(`⚡ DEBUG: Processing ${servidoresRaw.length} servers with concurrency ${SCRAPE_CONCURRENCY}`);
    
    // Process with conservative concurrency for stability
    const batchSize = Math.min(4, servidoresRaw.length); // Reduced batch size
    const batches = [];
    
    for (let i = 0; i < servidoresRaw.length; i += batchSize) {
      batches.push(servidoresRaw.slice(i, i + batchSize));
    }
    
    const results = [];
    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`🔄 DEBUG: Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} servers)`);
      
      const batchPromises = batch.map((server, index) => 
        limit(() => retryWithBackoff(() => 
          processServer(server, page, slug, ep, batchIndex * batchSize + index)
        ))
      );
      
      // Add timeout to prevent hanging
      const batchTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Batch processing timeout')), 15000)
      );
      
      try {
        const batchResults = await Promise.race([
          Promise.allSettled(batchPromises),
          batchTimeout
        ]);
        results.push(...batchResults);
        
        // Small delay between batches for stability
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (timeoutError) {
        console.error(`❌ [${slug}:${ep}] Batch ${batchIndex + 1} timed out, marking servers as degraded`);
        // Mark all servers in this batch as degraded
        const degradedResults = batch.map(() => ({
          status: 'rejected',
          reason: new Error('Batch processing timeout')
        }));
        results.push(...degradedResults);
      }
    }
    
    const processTime = Date.now() - processStart;
    console.log(`⚡ DEBUG: All batches processed in ${processTime}ms`);
    
    // Collect successful results and mark failed ones as degraded
    const servidores = [];
    let successCount = 0;
    let degradedCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        servidores.push(result.value);
        successCount++;
      } else {
        // Add degraded server entry
        const failedServer = servidoresRaw[index];
        servidores.push({
          nombre: failedServer.nombre?.toLowerCase().replace(/\s+/g, '') || `server_${index}`,
          iframe: null,
          prioridad: 999,
          servidor: failedServer.nombre?.toLowerCase().replace(/\s+/g, '') || `server_${index}`,
          url: null,
          status: 'degraded',
          error: result.reason?.message || 'Processing failed'
        });
        degradedCount++;
        console.warn(`⚠️ [${slug}:${ep}] Server ${index} degraded: ${result.reason?.message}`);
      }
    });

    const totalTime = Date.now() - startTime;
    
    console.log(`✅ [${slug}:${ep}] Completed in ${totalTime}ms (nav: ${navigationTime}ms, extract: ${extractTime}ms, process: ${processTime}ms) - ${successCount} ok, ${degradedCount} degraded`);
    
    // Performance analysis with stability metrics
    if (totalTime > 5000) {
      console.warn(`⚠️ PERFORMANCE: Scraping took ${totalTime}ms, stability may be affected`);
    } else if (totalTime > 3000) {
      console.warn(`⚠️ PERFORMANCE: Scraping took ${totalTime}ms, consider optimizing`);
    } else if (totalTime < 2000) {
      console.log(`🚀 PERFORMANCE: Excellent scraping time: ${totalTime}ms`);
    } else {
      console.log(`✅ PERFORMANCE: Good scraping time: ${totalTime}ms`);
    }
    
    return {
      servers: servidores.sort((a, b) => (a.prioridad || 999) - (b.prioridad || 999)),
      timing: {
        total: totalTime,
        navigation: navigationTime,
        extraction: extractTime,
        processing: processTime
      },
      stats: {
        total: servidoresRaw.length,
        successful: successCount,
        degraded: degradedCount
      }
    };

  } catch (error) {
    console.error(`🚨 Scraper failed for ${slug}:${ep}, using fallback:`, error.message);
    console.error(`🐛 DEBUG: Full error stack:`, error.stack);
    console.log(`🔍 DEBUG: Error type:`, error.constructor.name);
    
    // Fallback: return minimal server info
    const fallbackServer = {
      nombre: 'Servidor Fallback',
      url: 'fallback.com',
      prioridad: 99,
      activo: false
    };
    
    console.log(`🆘 DEBUG: Returning fallback server:`, JSON.stringify(fallbackServer, null, 2));
    return [fallbackServer];
  } finally {
    // Cleanup with debug info
    console.log(`🧹 DEBUG: Cleaning up browser context...`);
    if (context) {
      try {
        await context.close();
        console.log(`✅ DEBUG: Context closed successfully`);
      } catch (cleanupError) {
        console.error(`❌ DEBUG: Error closing context:`, cleanupError.message);
      }
    }
  }
}

async function processServer(serverRaw, mainPage, slug, ep, index) {
  if (!serverRaw.base64url) {
    throw new Error('No base64url found');
  }

  try {
    const decodedUrl = Buffer.from(serverRaw.base64url, 'base64').toString('utf-8');
    let iframeUrl = decodedUrl;
    
    // If not an embed URL, try to extract iframe from the same page
    if (!decodedUrl.includes('embed') && !decodedUrl.includes('iframe')) {
      try {
        // Click on the server button to reveal iframe (same page approach)
        const serverButton = await mainPage.$(`[data-player="${serverRaw.base64url}"]`);
        if (serverButton) {
          await serverButton.click();
          await delay(500); // Brief wait for iframe to load
          
          // Look for iframe in the same page
          const embedUrl = await mainPage.evaluate(() => {
            const iframe = document.querySelector('iframe[src*="embed"], iframe[src*="player"]');
            return iframe ? iframe.src : null;
          });
          
          if (embedUrl) {
            iframeUrl = embedUrl;
          }
        }
      } catch (embedError) {
        console.log(`⚠️ [${slug}:${ep}] Could not extract iframe for ${serverRaw.nombre}: ${embedError.message}`);
      }
    }
    
    return {
      nombre: serverRaw.nombre.toLowerCase().replace(/\s+/g, ''),
      iframe: iframeUrl,
      prioridad: getPrioridad(serverRaw.nombre.toLowerCase()) || 999,
      servidor: serverRaw.nombre.toLowerCase().replace(/\s+/g, ''),
      url: decodedUrl,
      status: 'active'
    };
    
  } catch (error) {
    throw new Error(`Failed to process server ${serverRaw.nombre}: ${error.message}`);
  }
}

// getPrioridad function imported from utils.js
