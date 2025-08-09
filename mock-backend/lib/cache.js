import { createClient } from 'redis';

class ServerCache {
  constructor() {
    this.lruCache = new Map();
    this.maxLRUSize = 1000;
    this.ttlMs = 20 * 60 * 1000; // 20 minutes
    this.pendingRequests = new Map(); // For deduplication
    this.redisClient = null;
    this.useRedis = false;
    
    this.initRedis();
  }

  async initRedis() {
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = createClient({
          url: process.env.REDIS_URL
        });
        
        this.redisClient.on('error', (err) => {
          console.warn('Redis Client Error:', err);
          this.useRedis = false;
        });
        
        await this.redisClient.connect();
        this.useRedis = true;
        console.log('✅ Redis connected for caching');
      } catch (error) {
        console.warn('⚠️ Redis connection failed, falling back to LRU:', error.message);
        this.useRedis = false;
      }
    }
  }

  _generateKey(slug, ep) {
    return `servers:${slug}:${ep}`;
  }

  async _getFromRedis(key) {
    if (!this.useRedis) return null;
    
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Redis get error:', error);
      return null;
    }
  }

  async _setToRedis(key, value, ttlSeconds = 1200) {
    if (!this.useRedis) return;
    
    try {
      await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.warn('Redis set error:', error);
    }
  }

  _getFromLRU(key) {
    const item = this.lruCache.get(key);
    if (!item) return null;
    
    const now = Date.now();
    if (now > item.expiry) {
      this.lruCache.delete(key);
      return null;
    }
    
    // Move to end (LRU behavior)
    this.lruCache.delete(key);
    this.lruCache.set(key, item);
    return item.data;
  }

  _setToLRU(key, value) {
    // Evict oldest if at capacity
    if (this.lruCache.size >= this.maxLRUSize) {
      const firstKey = this.lruCache.keys().next().value;
      this.lruCache.delete(firstKey);
    }
    
    this.lruCache.set(key, {
      data: value,
      expiry: Date.now() + this.ttlMs,
      timestamp: Date.now()
    });
  }

  async get(slug, ep) {
    const key = this._generateKey(slug, ep);
    
    // Try Redis first, then LRU
    let cached = await this._getFromRedis(key);
    if (!cached) {
      cached = this._getFromLRU(key);
    }
    
    return cached;
  }

  async set(slug, ep, servers) {
    const key = this._generateKey(slug, ep);
    const cacheData = {
      servers,
      timestamp: Date.now(),
      slug,
      ep
    };
    
    // Store in both Redis and LRU
    await this._setToRedis(key, cacheData);
    this._setToLRU(key, cacheData);
  }

  async getServersCached(slug, ep, producer) {
    const key = this._generateKey(slug, ep);
    
    // Check if there's already a pending request for this key (deduplication)
    if (this.pendingRequests.has(key)) {
      console.log(`🔄 Deduplicating request for ${key}`);
      return await this.pendingRequests.get(key);
    }
    
    // Check cache first
    const cached = await this.get(slug, ep);
    
    if (cached) {
      console.log(`🎯 Cache hit for ${key} (age: ${Date.now() - cached.timestamp}ms)`);
      
      // Stale-while-revalidate: if data is older than 10 minutes, refresh in background
      const staleThreshold = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - cached.timestamp > staleThreshold) {
        console.log(`🔄 Background refresh for ${key}`);
        // Don't await - refresh in background
        this._refreshInBackground(slug, ep, producer, key);
      }
      
      return cached.servers;
    }
    
    // No cache, fetch fresh data
    console.log(`🆕 Cache miss for ${key}, fetching fresh data`);
    const promise = this._fetchAndCache(slug, ep, producer, key);
    this.pendingRequests.set(key, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  async _fetchAndCache(slug, ep, producer, key) {
    try {
      const startTime = Date.now();
      const servers = await producer(slug, ep);
      const fetchTime = Date.now() - startTime;
      
      console.log(`⚡ Fetched ${servers.length} servers for ${key} in ${fetchTime}ms`);
      
      await this.set(slug, ep, servers);
      return servers;
    } catch (error) {
      console.error(`❌ Error fetching servers for ${key}:`, error.message);
      throw error;
    }
  }

  async _refreshInBackground(slug, ep, producer, key) {
    try {
      await this._fetchAndCache(slug, ep, producer, key);
      console.log(`✅ Background refresh completed for ${key}`);
    } catch (error) {
      console.warn(`⚠️ Background refresh failed for ${key}:`, error.message);
    }
  }

  async invalidate(slug, ep) {
    const key = this._generateKey(slug, ep);
    
    if (this.useRedis) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        console.warn('Redis delete error:', error);
      }
    }
    
    this.lruCache.delete(key);
    console.log(`🗑️ Invalidated cache for ${key}`);
  }

  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  getStats() {
    return {
      lruSize: this.lruCache.size,
      maxLRUSize: this.maxLRUSize,
      useRedis: this.useRedis,
      pendingRequests: this.pendingRequests.size
    };
  }
}

// Singleton instance
export const serverCache = new ServerCache();
