import puppeteer from 'puppeteer';

import axios from 'axios';

import * as cheerio from 'cheerio';

// Helper para esperar X milisegundos sin depender de page.waitForTimeout
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Configuración de servidores conocidos y sus patrones
const SERVER_PATTERNS = {
  doostream: {
    name: 'Doostream',
    priority: 1,
    patterns: [/doostream\.com/, /dood\.\w+/],
    resolver: resolveDoostream
  },
  mp4upload: {
    name: 'MP4Upload',
    priority: 2,
    patterns: [/mp4upload\.com/, /mp4up\.\w+/],
    resolver: resolveMp4Upload
  },
  streamtape: {
    name: 'Streamtape',
    priority: 3,
    patterns: [/streamtape\.com/, /streamta\.pe/],
    resolver: resolveStreamtape
  },
  okru: {
    name: 'OK.ru',
    priority: 4,
    patterns: [/ok\.ru/, /odnoklassniki\.ru/],
    resolver: resolveOkRu
  },
  fembed: {
    name: 'Fembed',
    priority: 5,
    patterns: [/fembed\.\w+/, /femax\d+\.\w+/],
    resolver: resolveFembed
  }
};

// Función principal para resolver video
export async function resolveVideoStream(episodeUrl) {
  let browser;
  
  try {
    console.log(`🔍 Iniciando resolución para: ${episodeUrl}`);
    
    // Configurar Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurar user agent y headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    });
    
    // Navegar a la página del episodio
    await page.goto(episodeUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Esperar a que carguen los servidores
    await delay(3000);
    
    // Extraer enlaces de servidores
    const serverLinks = await extractServerLinks(page);
    console.log(`📡 Servidores encontrados: ${serverLinks.length}`);
    
    if (serverLinks.length === 0) {
      throw new Error('No se encontraron servidores disponibles');
    }
    
    // Intentar resolver cada servidor en orden de prioridad
    const sortedServers = sortServersByPriority(serverLinks);
    
    for (const server of sortedServers) {
      try {
        console.log(`🔄 Intentando resolver: ${server.name} (${server.url})`);
        
        const result = await resolveServerUrl(page, server);
        
        if (result && await validateVideoUrl(result.url)) {
          console.log(`✅ Servidor resuelto exitosamente: ${server.name}`);
          return {
            servidor: server.name,
            url: result.url,
            tipo: result.tipo || detectVideoType(result.url),
            calidad: result.calidad || 'HD'
          };
        }
      } catch (error) {
        console.log(`❌ Error en servidor ${server.name}: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('Ningún servidor pudo ser resuelto');
    
  } catch (error) {
    console.error('🚨 Error en resolveVideoStream:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Extraer enlaces de servidores de la página
async function extractServerLinks(page) {
  return await page.evaluate(() => {
    const servers = [];
    
    // Buscar diferentes patrones de servidores
    const selectors = [
      'a[href*="doostream"]',
      'a[href*="mp4upload"]',
      'a[href*="streamtape"]',
      'a[href*="ok.ru"]',
      'a[href*="fembed"]',
      '.server-item a',
      '.player-option a',
      '[data-server]',
      'iframe[src*="embed"]'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const url = el.href || el.src || el.getAttribute('data-url');
        const name = el.textContent?.trim() || el.getAttribute('data-server') || 'Unknown';
        
        if (url && !servers.find(s => s.url === url)) {
          servers.push({ name, url });
        }
      });
    });
    
    // También buscar en iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.src;
      if (src && (src.includes('embed') || src.includes('player'))) {
        const name = iframe.getAttribute('data-server') || 'Iframe';
        if (!servers.find(s => s.url === src)) {
          servers.push({ name, url: src });
        }
      }
    });
    
    return servers;
  });
}

// Ordenar servidores por prioridad
function sortServersByPriority(servers) {
  return servers.sort((a, b) => {
    const priorityA = getServerPriority(a.url);
    const priorityB = getServerPriority(b.url);
    return priorityA - priorityB;
  });
}

// Obtener prioridad del servidor
function getServerPriority(url) {
  for (const [key, config] of Object.entries(SERVER_PATTERNS)) {
    if (config.patterns.some(pattern => pattern.test(url))) {
      return config.priority;
    }
  }
  return 999; // Prioridad baja para servidores desconocidos
}

// Resolver URL del servidor
async function resolveServerUrl(page, server) {
  const serverType = getServerType(server.url);
  const resolver = SERVER_PATTERNS[serverType]?.resolver;
  
  if (resolver) {
    return await resolver(page, server.url);
  }
  
  // Resolver genérico
  return await resolveGeneric(page, server.url);
}

// Detectar tipo de servidor
function getServerType(url) {
  for (const [key, config] of Object.entries(SERVER_PATTERNS)) {
    if (config.patterns.some(pattern => pattern.test(url))) {
      return key;
    }
  }
  return 'generic';
}

// Resolvers específicos para cada servidor
async function resolveDoostream(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    // Buscar el enlace de descarga/stream
    const videoUrl = await page.evaluate(() => {
      // Patrones comunes de Doostream
      const patterns = [
        () => document.querySelector('video source')?.src,
        () => document.querySelector('video')?.src,
        () => window.location.href.replace('/e/', '/d/') + '.mp4'
      ];
      
      for (const pattern of patterns) {
        const result = pattern();
        if (result) return result;
      }
      return null;
    });
    
    return videoUrl ? { url: videoUrl, tipo: 'mp4' } : null;
  } catch (error) {
    throw new Error(`Error resolviendo Doostream: ${error.message}`);
  }
}

async function resolveMp4Upload(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    const videoUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.src || video?.querySelector('source')?.src;
    });
    
    return videoUrl ? { url: videoUrl, tipo: 'mp4' } : null;
  } catch (error) {
    throw new Error(`Error resolviendo MP4Upload: ${error.message}`);
  }
}

async function resolveStreamtape(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(3000);
    
    const videoUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        return video.src || video.querySelector('source')?.src;
      }
      
      // Buscar en scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent;
        const match = content.match(/['"]([^'"]*\.mp4[^'"]*)['"]/);
        if (match) return match[1];
      }
      
      return null;
    });
    
    return videoUrl ? { url: videoUrl, tipo: 'mp4' } : null;
  } catch (error) {
    throw new Error(`Error resolviendo Streamtape: ${error.message}`);
  }
}

async function resolveOkRu(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    const videoUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.src || video?.querySelector('source')?.src;
    });
    
    return videoUrl ? { url: videoUrl, tipo: 'mp4' } : null;
  } catch (error) {
    throw new Error(`Error resolviendo OK.ru: ${error.message}`);
  }
}

async function resolveFembed(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    const videoData = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const src = video.src || video.querySelector('source')?.src;
        return src ? { url: src, tipo: src.includes('.m3u8') ? 'm3u8' : 'mp4' } : null;
      }
      return null;
    });
    
    return videoData;
  } catch (error) {
    throw new Error(`Error resolviendo Fembed: ${error.message}`);
  }
}

// Resolver genérico
async function resolveGeneric(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    const videoUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video?.src || video?.querySelector('source')?.src;
    });
    
    return videoUrl ? { url: videoUrl, tipo: detectVideoType(videoUrl) } : null;
  } catch (error) {
    throw new Error(`Error en resolver genérico: ${error.message}`);
  }
}

// Validar si la URL de video es reproducible
async function validateVideoUrl(url) {
  try {
    const response = await axios.head(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const contentType = response.headers['content-type'];
    const contentLength = response.headers['content-length'];
    
    // Verificar que sea un archivo de video válido
    const isVideo = contentType?.includes('video/') || 
                   contentType?.includes('application/vnd.apple.mpegurl') ||
                   url.includes('.mp4') || 
                   url.includes('.m3u8');
    
    const hasContent = !contentLength || parseInt(contentLength) > 1000;
    
    return isVideo && hasContent && response.status === 200;
  } catch (error) {
    console.log(`❌ Validación fallida para ${url}: ${error.message}`);
    return false;
  }
}

// Detectar tipo de video por URL
function detectVideoType(url) {
  if (url.includes('.m3u8')) return 'm3u8';
  if (url.includes('.mp4')) return 'mp4';
  if (url.includes('.webm')) return 'webm';
  if (url.includes('.mkv')) return 'mkv';
  return 'mp4'; // Por defecto
}