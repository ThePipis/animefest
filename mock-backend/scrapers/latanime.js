import puppeteer from 'puppeteer';

import * as cheerio from 'cheerio';

export class LatAnimeScraper {
  constructor() {
    this.baseUrl = 'https://latanime.org';
    this.browser = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Función helper para extraer texto de forma segura
  safeExtractText(element, fallback = '') {
    try {
      return element && element.length > 0 ? element.text().trim() : fallback;
    } catch (error) {
      console.warn('⚠️ Error al extraer texto:', error.message);
      return fallback;
    }
  }

  // Función helper para extraer atributos de forma segura
  safeExtractAttr(element, attr, fallback = null) {
    try {
      return element && element.length > 0 ? element.attr(attr) : fallback;
    } catch (error) {
      console.warn(`⚠️ Error al extraer atributo '${attr}':`, error.message);
      return fallback;
    }
  }

  // Función mejorada para manejar URLs directas y búsquedas
  async buscarAnime(input) {
    let page = null;
    try {
      // Verificar si es URL directa
      if (input.startsWith('http') && input.includes('latanime.org/anime/')) {
        console.log(`🎯 URL directa detectada: ${input}`);
        return await this.scrapearAnime(input);
      }
      
      // Búsqueda por nombre
      if (!this.browser) await this.init();
      
      page = await this.browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      const searchUrl = `${this.baseUrl}/buscar?q=${encodeURIComponent(input)}`;
      console.log(`🔍 Buscando: ${searchUrl}`);
      
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // Selectores mejorados para resultados de búsqueda
      const primerResultado = $('article, .anime-item, .search-result, a[href*="/anime/"]').first();
      
      if (primerResultado.length === 0) {
        throw new Error('No se encontraron resultados para el anime');
      }
      
      let animeUrl = this.safeExtractAttr(primerResultado, 'href') || 
                     this.safeExtractAttr(primerResultado.find('a'), 'href');
      
      if (!animeUrl) {
        throw new Error('No se pudo extraer la URL del anime');
      }
      
      const fullAnimeUrl = animeUrl.startsWith('http') ? animeUrl : `${this.baseUrl}${animeUrl}`;
      
      return await this.scrapearAnime(fullAnimeUrl);
      
    } catch (error) {
      console.error('❌ Error al buscar anime:', error);
      throw error;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  // Función completamente reescrita para scrapear con debugging y validaciones robustas
  async scrapearAnime(animeUrl, intentos = 0) {
    const maxIntentos = 2;
    let page = null;
    
    try {
      if (!this.browser) await this.init();
      
      page = await this.browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      console.log(`📄 Scrapeando: ${animeUrl} (Intento ${intentos + 1}/${maxIntentos + 1})`);
      await page.goto(animeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // ✅ CORREGIDO: Reemplazar page.waitForTimeout por setTimeout
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      console.log('🔍 Iniciando extracción de datos...');
      
      // === EXTRACCIÓN DEL TÍTULO ===
      let titulo = null;
      const tituloSelectors = [
        'h1.entry-title', // ✅ Selector específico para latanime.org
        'h1', // Selector más general como fallback
        '.anime-title',
        '.title',
        '.anime-info h1',
        '.anime-details h1',
        '.main-title',
        '[class*="title"] h1',
        '.anime-name',
        '.series-title',
        'title' // Fallback al title de la página
      ];
      
      for (const selector of tituloSelectors) {
        try {
          const element = $(selector).first();
          if (element.length > 0) {
            const text = this.safeExtractText(element);
            if (text && text.length > 2 && !text.toLowerCase().includes('latanime')) {
              titulo = text.replace(/— Latanime|Latanime|Ver|Online|HD/gi, '').trim();
              console.log(`✅ Título encontrado con selector '${selector}': ${titulo}`);
              break;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error con selector de título '${selector}':`, error.message);
          continue;
        }
      }
      
      // ✅ FALLBACK: Buscar en meta tags og:title
      if (!titulo || titulo.trim() === '') {
        try {
          const metaTitle = this.safeExtractAttr($('meta[property="og:title"]'), 'content') || 
                           this.safeExtractAttr($('meta[name="title"]'), 'content') ||
                           this.safeExtractAttr($('title'), 'text');
          if (metaTitle) {
            titulo = metaTitle.replace(/— Latanime|Latanime|Ver|Online|HD/gi, '').trim();
            console.log(`⚠️ Título extraído de meta tags: ${titulo}`);
          }
        } catch (error) {
          console.warn('⚠️ Error al extraer título de meta tags:', error.message);
        }
      }
      
      // ✅ VALIDACIÓN CRÍTICA con log de debug obligatorio
      if (!titulo || titulo.trim() === '') {
        console.error('🚨 DEBUG CRÍTICO: NINGÚN SELECTOR ENCONTRÓ TÍTULO');
        console.error('🔍 Selectores probados:', tituloSelectors);
        console.error('📄 HTML disponible:', $('h1').length > 0 ? 'Sí hay h1' : 'No hay h1');
        console.error('🏷️ Meta tags:', $('meta[property="og:title"]').length > 0 ? 'Sí hay og:title' : 'No hay og:title');
        throw new Error('❌ ERROR CRÍTICO: No se pudo extraer el TÍTULO del anime. Selector incorrecto o estructura modificada.');
      }
      
      // === EXTRACCIÓN DE LA IMAGEN ===
      let imagen = null;
      const imagenSelectors = [
        'img[src*="poster"]',
        'img[src*="cover"]', 
        'img[src*="thumb"]',
        'img[alt*="poster"]',
        'img[alt*="cover"]',
        '.anime-poster img',
        '.anime-image img',
        '.poster img',
        '.cover img',
        '.anime-cover img',
        '.series-poster img',
        '.anime-thumbnail img',
        '.anime-info img',
        '.anime-details img',
        'img' // Fallback general
      ];
      
      for (const selector of imagenSelectors) {
        try {
          const imgElement = $(selector).first();
          if (imgElement.length > 0) {
            let imgSrc = this.safeExtractAttr(imgElement, 'src') || 
                        this.safeExtractAttr(imgElement, 'data-src') || 
                        this.safeExtractAttr(imgElement, 'data-lazy') ||
                        this.safeExtractAttr(imgElement, 'data-original');
            
            if (imgSrc) {
              // Limpiar y normalizar URL
              if (imgSrc.startsWith('//')) {
                imgSrc = 'https:' + imgSrc;
              } else if (imgSrc.startsWith('/')) {
                imgSrc = this.baseUrl + imgSrc;
              } else if (!imgSrc.startsWith('http')) {
                imgSrc = this.baseUrl + '/' + imgSrc;
              }
              
              // Verificar que sea una imagen válida
              if (imgSrc.match(/\.(jpg|jpeg|png|webp|gif)$/i) || 
                  imgSrc.includes('image') || 
                  imgSrc.includes('poster') || 
                  imgSrc.includes('cover')) {
                imagen = imgSrc;
                console.log(`✅ Imagen encontrada con selector '${selector}': ${imagen}`);
                break;
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error con selector de imagen '${selector}':`, error.message);
          continue;
        }
      }
      
      // Fallback: buscar en meta tags
      if (!imagen) {
        try {
          const metaImage = this.safeExtractAttr($('meta[property="og:image"]'), 'content') || 
                           this.safeExtractAttr($('meta[name="twitter:image"]'), 'content') ||
                           this.safeExtractAttr($('meta[property="og:image:url"]'), 'content');
          if (metaImage) {
            imagen = metaImage.startsWith('http') ? metaImage : this.baseUrl + metaImage;
            console.log(`⚠️ Imagen extraída de meta tags: ${imagen}`);
          }
        } catch (error) {
          console.warn('⚠️ Error al extraer imagen de meta tags:', error.message);
        }
      }
      
      // ✅ VALIDACIÓN CRÍTICA: Lanzar error si no se encuentra imagen
      if (!imagen || imagen.trim() === '') {
        throw new Error('❌ ERROR CRÍTICO: No se pudo extraer la IMAGEN del anime. Verifique los selectores o la estructura de la página.');
      }
      
      // === EXTRACCIÓN DEL ESTADO ===
      let estado = 'Finalizado'; // valor por defecto seguro
      
      const estadoSelectors = [
        '.anime-status',
        '.status',
        '.estado',
        '.anime-state',
        '.series-status',
        '.badge',
        '.tag',
        '.anime-info .status',
        '.anime-details .status',
        '[class*="status"]',
        '[class*="estado"]'
      ];
      
      // Buscar en elementos específicos
      for (const selector of estadoSelectors) {
        try {
          const elements = $(selector);
          let found = false;
          elements.each((i, el) => {
            if (found) return false;
            try {
              const text = this.safeExtractText($(el)).toLowerCase();
              if (text.includes('estreno') || text.includes('en emisión') || 
                  text.includes('emitiendo') || text.includes('en curso') || 
                  text.includes('ongoing')) {
                estado = 'Estreno';
                console.log(`✅ Estado encontrado con selector '${selector}': ${estado}`);
                found = true;
                return false; // break
              } else if (text.includes('finalizado') || text.includes('completo') || 
                        text.includes('terminado') || text.includes('completed')) {
                estado = 'Finalizado';
                console.log(`✅ Estado encontrado con selector '${selector}': ${estado}`);
                found = true;
                return false; // break
              } else if (text.includes('próximamente') || text.includes('próximo') || 
                        text.includes('pronto') || text.includes('upcoming')) {
                estado = 'Próximamente';
                console.log(`✅ Estado encontrado con selector '${selector}': ${estado}`);
                found = true;
                return false; // break
              }
            } catch (error) {
              console.warn('⚠️ Error al procesar elemento de estado:', error.message);
            }
          });
          if (found) break;
        } catch (error) {
          console.warn(`⚠️ Error con selector de estado '${selector}':`, error.message);
          continue;
        }
      }
      
      // Buscar en el texto general de la página como fallback
      try {
        const textoCompleto = this.safeExtractText($('body')).toLowerCase();
        if (estado === 'Finalizado') {
          if (textoCompleto.includes('estreno') || textoCompleto.includes('en emisión') || 
              textoCompleto.includes('emitiendo') || textoCompleto.includes('en curso')) {
            estado = 'Estreno';
            console.log(`⚠️ Estado inferido del texto general: ${estado}`);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error al analizar texto completo para estado:', error.message);
      }
      
      // ✅ VALIDACIÓN CRÍTICA: Verificar que el estado no sea undefined
      if (!estado || estado.trim() === '') {
        throw new Error('❌ ERROR CRÍTICO: No se pudo extraer el ESTADO del anime. Usando valor por defecto.');
      }
      
      // === EXTRACCIÓN DE SINOPSIS ===
      let sinopsis = '';
      const sinopsisSelectors = [
        '.anime-synopsis',
        '.anime-description',
        '.description',
        '.synopsis',
        '.anime-summary',
        '.anime-info .description',
        '.anime-details .description',
        'p:contains("años")',
        '.content p',
        'p'
      ];
      
      for (const selector of sinopsisSelectors) {
        try {
          const element = $(selector).first();
          if (element.length > 0) {
            const text = this.safeExtractText(element);
            if (text.length > 50) {
              sinopsis = text;
              console.log(`✅ Sinopsis encontrada con selector '${selector}'`);
              break;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error con selector de sinopsis '${selector}':`, error.message);
          continue;
        }
      }
      
      // ✅ VALIDACIÓN: Verificar sinopsis
      if (!sinopsis || sinopsis.trim() === '') {
        console.warn('⚠️ No se pudo extraer sinopsis, usando valor por defecto');
        sinopsis = 'Sinopsis no disponible';
      }
      
      // === EXTRACCIÓN DE GÉNEROS ===
      const generos = [];
      const generoSelectors = [
        '.anime-genres a',
        '.genres a',
        '.genre',
        '.tag',
        '.categories a',
        'a[href*="genero"]',
        '.anime-info .genres a',
        '.anime-details .genres a',
        '[class*="genre"] a',
        '[class*="tag"]'
      ];
      
      generoSelectors.forEach(selector => {
        try {
          $(selector).each((i, el) => {
            try {
              const genero = this.safeExtractText($(el));
              if (genero && genero.length < 20 && genero.length > 2 && !generos.includes(genero)) {
                generos.push(genero);
              }
            } catch (error) {
              console.warn('⚠️ Error al procesar género:', error.message);
            }
          });
        } catch (error) {
          console.warn(`⚠️ Error con selector de géneros '${selector}':`, error.message);
        }
      });
      
      // === EXTRACCIÓN DE AÑO ===
      let año = new Date().getFullYear();
      try {
        const añoText = this.safeExtractText($('body')).match(/\b(19|20)\d{2}\b/g);
        if (añoText && añoText.length > 0) {
          año = parseInt(añoText[0]);
        }
      } catch (error) {
        console.warn('⚠️ Error al extraer año:', error.message);
      }
      
      // === EXTRACCIÓN DE EPISODIOS ===
      const episodios = [];
      const episodioSelectors = [
        'li.episode a[href*="/ver/"]',
        'a[href*="/ver/"]',
        'a[href*="episodio"]',
        'a[href*="capitulo"]',
        '.episode a',
        '.capitulo a'
      ];
      
      episodioSelectors.forEach(selector => {
        try {
          $(selector).each((i, el) => {
            try {
              const link = $(el);
              let urlStream = this.safeExtractAttr(link, 'href');
              
              // ✅ VALIDACIÓN: Asegurar que url_stream contenga "/ver/"
              if (urlStream && (urlStream.includes('episodio') || urlStream.includes('capitulo') || urlStream.includes('ver/'))) {
                const fullUrlStream = urlStream.startsWith('http') ? urlStream : `${this.baseUrl}${urlStream}`;
                
                // ✅ VALIDACIÓN: Verificar que la URL sea válida para streaming
                if (!fullUrlStream.includes('/ver/')) {
                  console.warn(`⚠️ URL de episodio inválida (no contiene /ver/): ${fullUrlStream}`);
                  return; // Skip este episodio
                }
                
                const numeroMatch = urlStream.match(/(?:episodio|capitulo)[\-_]?(\d+)/i);
                const numero = numeroMatch ? parseInt(numeroMatch[1]) : episodios.length + 1;
                
                const tituloEpisodio = this.safeExtractText(link) || `Episodio ${numero}`;
                
                if (!episodios.some(ep => ep.url_stream === fullUrlStream)) {
                  episodios.push({
                    numero,
                    titulo: tituloEpisodio,
                    duracion: '24:00',
                    url_stream: fullUrlStream
                  });
                  console.log(`✅ Episodio ${numero} agregado: ${fullUrlStream}`);
                }
              }
            } catch (error) {
              console.warn('⚠️ Error al procesar episodio:', error.message);
            }
          });
        } catch (error) {
          console.warn(`⚠️ Error con selector de episodios '${selector}':`, error.message);
        }
      });
      
      episodios.sort((a, b) => a.numero - b.numero);
      
      // ✅ VALIDACIÓN CRÍTICA: Verificar que hay al menos 1 episodio válido
      if (!episodios || episodios.length === 0) {
        console.error('🚨 DEBUG CRÍTICO: NO SE ENCONTRARON EPISODIOS VÁLIDOS');
        console.error('🔍 Selectores probados:', episodioSelectors);
        console.error('📄 Enlaces encontrados:', $('a[href*="ver"]').length);
        throw new Error('❌ ERROR CRÍTICO: No se encontraron episodios válidos con URL de streaming.');
      }
      
      // ✅ VALIDACIÓN: Verificar que al menos un episodio tiene url_stream válido
      const episodiosValidos = episodios.filter(ep => ep.url_stream && ep.url_stream.includes('/ver/'));
      if (episodiosValidos.length === 0) {
        console.error('🚨 DEBUG CRÍTICO: NINGÚN EPISODIO TIENE URL_STREAM VÁLIDO');
        console.error('📺 Episodios encontrados:', episodios.length);
        console.error('🔗 URLs encontradas:', episodios.map(ep => ep.url_stream));
        throw new Error('❌ ERROR CRÍTICO: No se encontraron episodios válidos con URL de streaming (/ver/).');
      }
      
      // === GENERAR SLUG ===
      const slug = titulo.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      const animeData = {
        titulo,
        sinopsis,
        imagen,
        generos,
        año,
        estado,
        idioma: 'Latino',
        categoria: 'Anime',
        sitio_origen: 'latanime',
        url_origen: animeUrl,
        slug,
        episodios
      };
      
      console.log(`\n✅ ANIME SCRAPEADO EXITOSAMENTE:`);
      console.log(`📝 Título: ${titulo}`);
      console.log(`🖼️ Imagen: ${imagen}`);
      console.log(`📊 Estado: ${estado}`);
      console.log(`📄 Sinopsis: ${sinopsis.substring(0, 100)}...`);
      console.log(`🎭 Géneros: ${generos.length} encontrados - [${generos.join(', ')}]`);
      console.log(`📺 Episodios: ${episodios.length} encontrados`);
      console.log(`📅 Año: ${año}`);
      
      return animeData;
      
    } catch (error) {
      // ✅ MANEJO DE TargetCloseError con reintentos automáticos
      if (error.message && error.message.includes('Target closed') && intentos < maxIntentos) {
        console.warn(`⚠️ TargetCloseError detectado. Reintentando... (${intentos + 1}/${maxIntentos})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
        return this.scrapearAnime(animeUrl, intentos + 1); // Reintentar recursivamente
      }
      
      console.error('❌ Error al scrapear anime:', error);
      throw error;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }
}