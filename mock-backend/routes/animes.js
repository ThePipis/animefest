import express from 'express';
import { serverCache } from '../lib/cache.js';
import { obtenerServidoresDesdeLatAnimeOptimizada } from '../scraper/optimized-scraper.js';

const router = express.Router();

// GET /api/v1/servers?slug={slug}&ep={n} - Get servers with caching
router.get('/servers', async (req, res) => {
  const startTime = Date.now();
  const { slug, ep } = req.query;
  
  // Validate parameters
  if (!slug || !ep) {
    return res.status(400).json({ 
      error: 'Missing required parameters: slug and ep',
      example: '/api/v1/servers?slug=una-pareja-de-cucos-s2-latino&ep=1'
    });
  }

  try {
    console.log(`🎯 [${slug}:${ep}] Server request received`);
    
    // Use cache with SWR and deduplication with real scraper
    const result = await serverCache.getServersCached(slug, ep, async (slug, ep) => {
      try {
        const scraped = await obtenerServidoresDesdeLatAnimeOptimizada(slug, ep);
        return scraped.servers; // Return just the servers array for cache
      } catch (error) {
        console.error(`🚨 Real scraper failed for ${slug}:${ep}, using fallback:`, error.message);
        
        // Fallback to mock data if real scraper fails
        return [
          {
            nombre: 'fallback',
            iframe: `https://fallback.com/${slug}-${ep}`,
            prioridad: 999,
            servidor: 'fallback',
            url: `https://fallback.com/${slug}-${ep}`,
            status: 'degraded',
            error: 'Real scraper unavailable'
          }
        ];
      }
    });
    
    const totalTime = Date.now() - startTime;
    
    // Add response headers for caching and compression
    res.set({
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5min cache, 10min stale
      'ETag': `"${slug}-${ep}-${Date.now()}"`,
      'X-Response-Time': `${totalTime}ms`,
      'X-Cache-Stats': JSON.stringify(serverCache.getStats())
    });
    
    // Structure response
    const response = {
      success: true,
      data: {
        slug,
        episode: parseInt(ep),
        servers: result,
        meta: {
          total: result.length,
          active: result.filter(s => s.status !== 'degraded').length,
          degraded: result.filter(s => s.status === 'degraded').length,
          responseTime: totalTime
        }
      }
    };
    
    console.log(`✅ [${slug}:${ep}] Response sent in ${totalTime}ms (${result.length} servers)`);
    res.json(response);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${slug}:${ep}] Error after ${totalTime}ms:`, error.message, error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch servers',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      meta: {
        responseTime: totalTime
      }
    });
  }
});

// GET /api/v1/servers/stream?slug={slug}&ep={n} - Server-Sent Events for partial results
router.get('/servers/stream', async (req, res) => {
  const { slug, ep } = req.query;
  
  if (!slug || !ep) {
    return res.status(400).json({ 
      error: 'Missing required parameters: slug and ep' 
    });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const startTime = Date.now();
  console.log(`🌊 [${slug}:${ep}] SSE stream started`);

  try {
    // Check cache first
    const cached = await serverCache.get(slug, ep);
    
    if (cached) {
      // Send cached data immediately and close
      const event = {
        type: 'complete',
        data: {
          servers: cached.servers,
          fromCache: true,
          responseTime: Date.now() - startTime
        }
      };
      
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      res.end();
      console.log(`🎯 [${slug}:${ep}] SSE completed from cache in ${Date.now() - startTime}ms`);
      return;
    }

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'start', timestamp: Date.now() })}\n\n`);

    // Fetch fresh data with progress updates
    const result = await obtenerServidoresDesdeLatAnimeOptimizada(slug, ep);
    
    // Cache the result
    await serverCache.set(slug, ep, result.servers);
    
    // Send final complete event
    const completeEvent = {
      type: 'complete',
      data: {
        servers: result.servers,
        timing: result.timing,
        stats: result.stats,
        fromCache: false,
        responseTime: Date.now() - startTime
      }
    };
    
    res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
    res.end();
    
    console.log(`✅ [${slug}:${ep}] SSE completed in ${Date.now() - startTime}ms`);
    
  } catch (error) {
    const errorEvent = {
      type: 'error',
      error: error.message,
      responseTime: Date.now() - startTime
    };
    
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
    
    console.error(`❌ [${slug}:${ep}] SSE error after ${Date.now() - startTime}ms:`, error.message);
  }
});

// GET /api/v1/servers/cache/stats - Cache statistics (for debugging)
router.get('/servers/cache/stats', (req, res) => {
  res.json({
    success: true,
    data: serverCache.getStats()
  });
});

// DELETE /api/v1/servers/cache?slug={slug}&ep={ep} - Invalidate cache
router.delete('/servers/cache', async (req, res) => {
  const { slug, ep } = req.query;
  
  if (!slug || !ep) {
    return res.status(400).json({ 
      error: 'Missing required parameters: slug and ep' 
    });
  }

  try {
    await serverCache.invalidate(slug, ep);
    res.json({
      success: true,
      message: `Cache invalidated for ${slug}:${ep}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      details: error.message
    });
  }
});

// GET /api/v1/cache/stats - Get cache statistics
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = serverCache.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
      details: error.message
    });
  }
});

export default router;
