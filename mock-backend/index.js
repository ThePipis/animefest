import express from "express";

import compression from "compression";

import cors from "cors";

import jwt from "jsonwebtoken";

import bcrypt from "bcryptjs";

import path from "path";

import { fileURLToPath } from "url";

import { Op } from 'sequelize';

import { resolveVideoStream } from "./videoResolver.js";

import { initDatabase, Anime, Episodio, User } from './db/database.js';
import { serverCache } from './lib/cache.js';
import animeRoutes from './routes/animes.js';
import { obtenerServidoresDesdeLatAnimeOptimizada } from './scraper/optimized-scraper.js';
import { LatAnimeScraper } from './scrapers/latanime.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable compression for all responses
app.use(compression());

// Configurar CORS
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());

// Add ETag support
app.set('etag', 'strong');

// Leer puerto y secreto JWT desde variables de entorno con valores por defecto
const JWT_SECRET = process.env.JWT_SECRET || "animefest_secret_key_2024";

// Inicializar base de datos al arrancar el servidor
initDatabase().then(() => {
  // Crear usuario admin por defecto
  createDefaultAdmin();
});

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "http://localhost:5177",
      "http://localhost:5178",
      "http://localhost:5179",
    ],
    credentials: true,
  })
);
app.use(express.json());

// Structured logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    type: 'request',
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  }));
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'response',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: duration,
      contentLength: res.get('Content-Length')
    }));
  });
  
  next();
});

// Funciones readJsonFile y writeJsonFile eliminadas - ahora usamos base de datos

// Función para crear usuario admin por defecto
const createDefaultAdmin = async () => {
  try {
    console.log('🔄 Verificando si existe usuario admin...');
    
    // Verificar si ya existe el usuario admin
    const adminExists = await User.findOne({ where: { username: 'admin' } });
    
    if (adminExists) {
      console.log('✅ Usuario admin ya existe. Omitiendo creación.');
      return;
    }
    
    console.log('👤 Creando usuario admin por defecto...');
    
    // Hashear la contraseña admin123
    const saltRounds = 12;
    const password_hash = await bcrypt.hash('admin123', saltRounds);
    
    // Crear usuario admin
    await User.create({
      username: 'admin',
      email: 'admin@animefest.com',
      password_hash: password_hash,
      role: 'admin',
      favorites: [],
      historial: []
    });
    
    console.log('✅ Usuario admin creado correctamente');
    console.log('📋 Credenciales: admin / admin123');
    
  } catch (error) {
    console.error('❌ Error al crear usuario admin:', error);
  }
};

// Función migrateJsonToDatabase eliminada - ya no usamos archivo JSON

// Middleware de autenticación. Extrae el token JWT y busca el usuario en la base de datos.
// En caso de token inválido o ausencia, responde con 401 en vez de usar un fallback inseguro.
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    const token = authHeader?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    // Adjuntar información básica del usuario al request
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware de autorización por roles. Acepta uno o más roles permitidos.
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
    }
    next();
  };
};

// Mount optimized API routes
app.use('/api/v1', animeRoutes);

// Rutas públicas

// GET /health - Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});

// GET /animes - Endpoint para obtener todos los animes (usado por filtros)
app.get("/animes", async (req, res) => {
  try {
    const animes = await Anime.findAll({
      include: [{
        model: Episodio,
        as: 'episodios',
        attributes: ['numero', 'titulo', 'duracion', 'url_stream']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    const resultado = animes.map(anime => ({
      ...anime.toJSON(),
      episodios: anime.episodios || []
    }));
    
    res.json(resultado);
  } catch (error) {
    console.error("Error fetching animes:", error);
    res.status(500).json({ error: "Error al obtener los animes" });
  }
});

// GET /catalogo - Lista completa de animes (MODIFICADO para usar base de datos)
app.get("/catalogo", async (req, res) => {
  try {
    // Cambiar de archivo JSON a base de datos
    const animes = await Anime.findAll({
      include: [{
        model: Episodio,
        as: 'episodios',
        attributes: ['numero', 'titulo', 'duracion', 'url_stream']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    const { buscar, genero } = req.query;
    
    // Convertir a formato JSON y procesar episodios
    let resultado = animes.map(anime => ({
      ...anime.toJSON(),
      episodios: anime.episodios || []
    }));

    // Filtrar por búsqueda de texto
    if (buscar) {
      resultado = resultado.filter(
        (anime) =>
          anime.titulo.toLowerCase().includes(buscar.toLowerCase()) ||
          anime.sinopsis.toLowerCase().includes(buscar.toLowerCase())
      );
    }

    // Filtrar por género
    if (genero) {
      resultado = resultado.filter((anime) =>
        anime.generos && anime.generos.some((g) =>
          g.toLowerCase().includes(genero.toLowerCase())
        )
      );
    }

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener el catálogo:', error);
    res.status(500).json({ error: "Error al obtener el catálogo" });
  }
});

// GET /animes - Endpoint para obtener todos los animes (MODIFICADO para filtros)
app.get("/animes", async (req, res) => {
  try {
    // Cambiar de archivo JSON a base de datos
    const animes = await Anime.findAll({
      include: [{
        model: Episodio,
        as: 'episodios',
        attributes: ['numero', 'titulo', 'duracion', 'url_stream']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // Convertir a formato JSON
    const resultado = animes.map(anime => ({
      ...anime.toJSON(),
      episodios: anime.episodios || []
    }));
    
    res.json(resultado);
  } catch (error) {
    console.error("Error fetching animes:", error);
    res.status(500).json({ error: "Error al obtener los animes" });
  }
});

// GET /anime/:identifier - Detalles de un anime específico (MODIFICADO para soportar ID y slug)
app.get("/anime/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    let anime;

    if (isNaN(Number(identifier))) {
      // Buscar por slug
      anime = await Anime.findOne({
        where: { slug: identifier },
        include: [{
          model: Episodio,
          as: 'episodios',
          attributes: ['numero', 'titulo', 'duracion', 'url_stream'],
          order: [['numero', 'ASC']]
        }]
      });
    } else {
      // Buscar por ID numérico
      anime = await Anime.findByPk(identifier, {
        include: [{
          model: Episodio,
          as: 'episodios',
          attributes: ['numero', 'titulo', 'duracion', 'url_stream'],
          order: [['numero', 'ASC']]
        }]
      });
    }

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    // Devolver anime + episodios en formato JSON
    res.json({
      ...anime.toJSON(),
      episodios: anime.episodios || []
    });
  } catch (error) {
    console.error('❌ Error al obtener el anime por identificador:', error);
    return res.status(500).json({ error: "Error al obtener el anime" });
  }
});

// GET /reproducir - Endpoint mejorado con scraping automático (ACTUALIZADO para manejar slugs)
app.get("/reproducir", authenticateToken, async (req, res) => {
  try {
    const { animeSlug, episodio } = req.query;

    // Validar parámetros
    if (!animeSlug || !episodio) {
      return res.status(400).json({
        error: "Los parámetros 'animeSlug' y 'episodio' son requeridos",
      });
    }

    console.log(
      `🎬 Solicitud de reproducción - Anime Slug: ${animeSlug}, Episodio: ${episodio}`
    );

    // Buscar anime en la base de datos por slug
    let anime = await Anime.findOne({
      where: { slug: animeSlug },
      include: [{
        model: Episodio,
        as: 'episodios',
        attributes: ['numero', 'titulo', 'duracion', 'url_stream']
      }]
    });

    // Si no se encuentra por slug, intentar por ID (fallback)
    if (!anime && !isNaN(Number(animeSlug))) {
      anime = await Anime.findByPk(animeSlug, {
        include: [{
          model: Episodio,
          as: 'episodios',
          attributes: ['numero', 'titulo', 'duracion', 'url_stream']
        }]
      });
    }

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    // Buscar episodio específico
    const ep = anime.episodios.find((e) => e.numero === parseInt(episodio));

    if (!ep) {
      return res.status(404).json({ error: "Episodio no encontrado" });
    }

    // Verificar que el url_stream sea válido
    if (!ep.url_stream || !ep.url_stream.includes("latanime.org")) {
      return res.status(400).json({
        error: "URL de episodio no válida o no soportada",
      });
    }

    try {
      // Resolver el stream de video usando puppeteer
      console.log(`🔍 Resolviendo stream para: ${ep.url_stream}`);

      const videoData = await resolveVideoStream(ep.url_stream);

      // Registrar en historial del usuario
      await registrarHistorial(req.user.id, {
        animeId: anime.id,
        episodio: ep.numero,
        fechaVisto: new Date().toISOString(),
        animeTitle: anime.titulo,
        animeImage: anime.imagen,
        animeSlug: anime.slug,
        progreso: 0,
      });

      // Respuesta exitosa
      res.json({
        success: true,
        data: {
          ...videoData,
          titulo: ep.titulo,
          anime: anime.titulo,
          episodio: ep.numero,
          duracion: ep.duracion,
          imagen: anime.imagen,
        },
      });

      console.log(
        `✅ Stream resuelto exitosamente para ${anime.titulo} - Episodio ${ep.numero}`
      );
    } catch (resolverError) {
      console.error(`🚨 Error resolviendo stream:`, resolverError.message);

      // Fallback: devolver URL original si el scraping falla
      res.json({
        success: false,
        fallback: true,
        data: {
          servidor: "Original",
          url: ep.url_stream,
          tipo: "webpage",
          titulo: ep.titulo,
          anime: anime.titulo,
          episodio: ep.numero,
          duracion: ep.duracion,
          imagen: anime.imagen,
        },
        error: "No se pudo resolver automáticamente, usando enlace original",
      });
    }
  } catch (error) {
    console.error("🚨 Error en endpoint /reproducir:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /episodios/:animeSlug/:episodio - Endpoint actualizado para usar base de datos y slugs
app.get(
  "/episodios/:animeSlug/:episodio",
  authenticateToken,
  async (req, res) => {
    try {
      const { animeSlug, episodio } = req.params;

      // Validar parámetros
      if (!animeSlug || !episodio) {
        return res.status(400).json({
          error: "Los parámetros 'animeSlug' y 'episodio' son requeridos",
        });
      }

      console.log(
        `🎬 Solicitud de episodio - Anime Slug: ${animeSlug}, Episodio: ${episodio}`
      );

      // Buscar anime en la base de datos por slug
      let anime = await Anime.findOne({
        where: { slug: animeSlug },
        include: [{
          model: Episodio,
          as: 'episodios',
          attributes: ['numero', 'titulo', 'duracion', 'url_stream']
        }]
      });

      // Si no se encuentra por slug, intentar por ID (fallback)
      if (!anime && !isNaN(Number(animeSlug))) {
        anime = await Anime.findByPk(animeSlug, {
          include: [{
            model: Episodio,
            as: 'episodios',
            attributes: ['numero', 'titulo', 'duracion', 'url_stream']
          }]
        });
      }

      if (!anime) {
        return res.status(404).json({ error: "Anime no encontrado" });
      }

      // Buscar episodio específico
      const ep = anime.episodios.find((e) => e.numero === parseInt(episodio));

      if (!ep) {
        return res.status(404).json({ error: "Episodio no encontrado" });
      }

      // Verificar que el url_stream sea válido
      if (!ep.url_stream || !ep.url_stream.includes("latanime.org")) {
        return res.status(400).json({
          error: "URL de episodio no válida o no soportada",
        });
      }

      try {
        // Resolver el stream de video usando puppeteer
        console.log(`🔍 Resolviendo stream para: ${ep.url_stream}`);

        const videoData = await resolveVideoStream(ep.url_stream);

        // Registrar en historial del usuario
        await registrarHistorial(req.user.id, {
          animeId: anime.id,
          episodio: ep.numero,
          fechaVisto: new Date().toISOString(),
          animeTitle: anime.titulo,
          animeImage: anime.imagen,
          animeSlug: anime.slug,
          progreso: 0,
        });

        // Respuesta exitosa
        res.json({
          success: true,
          data: {
            ...videoData,
            titulo: ep.titulo,
            anime: anime.titulo,
            episodio: ep.numero,
            duracion: ep.duracion,
            imagen: anime.imagen,
          },
        });

        console.log(
          `✅ Stream resuelto exitosamente para ${anime.titulo} - Episodio ${ep.numero}`
        );
      } catch (resolverError) {
        console.error(`🚨 Error resolviendo stream:`, resolverError.message);

        // Fallback: devolver URL original si el scraping falla
        res.json({
          success: false,
          fallback: true,
          data: {
            servidor: "Original",
            url: ep.url_stream,
            tipo: "webpage",
            titulo: ep.titulo,
            anime: anime.titulo,
            episodio: ep.numero,
            duracion: ep.duracion,
            imagen: anime.imagen,
          },
          error: "No se pudo resolver automáticamente, usando enlace original",
        });
      }
    } catch (error) {
      console.error("🚨 Error en endpoint /episodios:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// GET /reproductor/:animeId/:episodio - Scraping optimizado desde LatAnime con caché
app.get("/reproductor/:animeId/:episodio", async (req, res) => {
  const { animeId, episodio } = req.params;
  const startTime = Date.now();

  if (!animeId || !episodio) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    console.log(`🎬 [${animeId}:${episodio}] Obteniendo servidores optimizados`);

    // Use the optimized cached scraper
    const servidoresObtenidos = await serverCache.getServersCached(animeId, episodio, async (slug, ep) => {
      try {
        const scraped = await obtenerServidoresDesdeLatAnimeOptimizada(slug, ep);
        return scraped.servers;
      } catch (error) {
        console.error(`🚨 Scraper failed for ${slug}:${ep}, using fallback:`, error.message);
        return [
          {
            nombre: 'fallback',
            iframe: `https://fallback.com/${slug}-${ep}`,
            prioridad: 999,
            servidor: 'fallback',
            url: `https://fallback.com/${slug}-${ep}`,
            status: 'degraded',
            error: 'Scraper unavailable'
          }
        ];
      }
    });

    if (!servidoresObtenidos || servidoresObtenidos.length === 0) {
      return res.status(404).json({ error: "No se encontraron servidores disponibles" });
    }

    // Register history only if user is authenticated (optional)
    if (req.user && req.user.id) {
      try {
        const animeRecord = isNaN(Number(animeId))
          ? await Anime.findOne({ where: { slug: animeId } })
          : await Anime.findByPk(animeId);

        if (animeRecord) {
          await registrarHistorial(req.user.id, {
            animeId: animeRecord.id,
            episodio: parseInt(episodio),
            fechaVisto: new Date().toISOString(),
            animeTitle: animeRecord.titulo,
            animeImage: animeRecord.imagen,
            progreso: 0
          });
        }
      } catch (historyError) {
        console.warn(`⚠️ Could not register history: ${historyError.message}`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [${animeId}:${episodio}] Servidores obtenidos en ${totalTime}ms (${servidoresObtenidos.length} servidores)`);

    return res.json({
      animeId,
      episodioId: episodio,
      servidores: servidoresObtenidos,
      meta: {
        total: servidoresObtenidos.length,
        active: servidoresObtenidos.filter(s => s.status !== 'degraded').length,
        degraded: servidoresObtenidos.filter(s => s.status === 'degraded').length,
        responseTime: totalTime,
        fromCache: true // Will be updated by cache layer
      }
    });

  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [${animeId}:${episodio}] Error al obtener servidores después de ${totalTime}ms:`, err.message, err.stack);
    return res.status(500).json({ 
      error: "Error interno al obtener los servidores",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// GET /reproductor/:animeId/:episodio - Nuevo endpoint para obtener servidores con fallback
app.get('/reproductor/:animeId/:episodioId', authenticateToken, async (req, res) => {
  const { animeId, episodioId } = req.params;

  try {
    // Buscar anime en la base de datos
    let anime;
    
    if (isNaN(Number(animeId))) {
      // Buscar por slug
      anime = await Anime.findOne({
        where: { slug: animeId },
        include: [{
          model: Episodio,
          as: 'episodios',
          attributes: ['numero', 'titulo', 'duracion', 'url_stream']
        }]
      });
    } else {
      // Buscar por ID numérico
      anime = await Anime.findByPk(animeId, {
        include: [{
          model: Episodio,
          as: 'episodios',
          attributes: ['numero', 'titulo', 'duracion', 'url_stream']
        }]
      });
    }

    if (!anime) return res.status(404).json({ error: 'Anime no encontrado' });

    // Buscar episodio específico
    const episodio = anime.episodios.find(e => e.numero === parseInt(episodioId));
    if (!episodio) return res.status(404).json({ error: 'Episodio no encontrado' });

    // Simulamos múltiples servidores en base a la URL original
    const servidores = [
      { nombre: 'Desu', url: episodio.url_stream },
      { nombre: 'Magi', url: episodio.url_stream },
      { nombre: 'Mega', url: episodio.url_stream }
    ];

    res.json(servidores);
  } catch (error) {
    console.error("Error al leer servidores:", error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Función auxiliar para determinar prioridad de servidores (importada desde utils.js)


// Función auxiliar para registrar historial en la base de datos
async function registrarHistorial(userId, data) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      console.warn(`registrarHistorial: usuario ${userId} no encontrado`);
      return;
    }
    // Clonar historial para evitar mutar directamente la instancia
    const historial = Array.isArray(user.historial) ? [...user.historial] : [];
    // Buscar si existe entrada para mismo anime/episodio
    const existingIndex = historial.findIndex(
      (h) => h.animeId === data.animeId && h.episodio === data.episodio
    );
    if (existingIndex >= 0) {
      historial[existingIndex] = { ...historial[existingIndex], ...data };
    } else {
      // Insertar al inicio para mantener orden reciente
      historial.unshift(data);
    }
    // Limitar a 50 registros
    const limitedHist = historial.slice(0, 50);
    await user.update({ historial: limitedHist });
  } catch (error) {
    console.error("Error registrando historial:", error);
  }
}

// GET /usuario - Datos del usuario actual desde la base de datos
app.get("/usuario", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      favoritos: user.favorites || [],
      historial: user.historial || []
    });
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    return res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
});

// GET /favoritos - Lista de favoritos del usuario (base de datos)
app.get("/favoritos", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const favorites = user.favorites || [];
    // Buscar animes por slug en lugar de ID
    const animes = await Anime.findAll({ where: { slug: favorites } });
    return res.json(animes);
  } catch (error) {
    console.error('Error al obtener favoritos:', error);
    return res.status(500).json({ error: 'Error al obtener favoritos' });
  }
});

// POST /favoritos - Agregar anime a favoritos (base de datos)
app.post("/favoritos", authenticateToken, async (req, res) => {
  try {
    const { animeSlug } = req.body;
    if (!animeSlug) {
      return res.status(400).json({ error: 'animeSlug es requerido' });
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const favs = Array.isArray(user.favorites) ? [...user.favorites] : [];
    if (!favs.includes(animeSlug)) {
      favs.push(animeSlug);
      await user.update({ favorites: favs });
    }
    return res.json({ message: 'Anime agregado a favoritos' });
  } catch (error) {
    console.error('Error al agregar favorito:', error);
    return res.status(500).json({ error: 'Error al agregar favorito' });
  }
});

// DELETE /favoritos/:slug - Quitar anime de favoritos (base de datos)
app.delete("/favoritos/:slug", authenticateToken, async (req, res) => {
  try {
    const animeSlug = req.params.slug;
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const favs = Array.isArray(user.favorites) ? [...user.favorites] : [];
    const newFavs = favs.filter((slug) => slug !== animeSlug);
    await user.update({ favorites: newFavs });
    return res.json({ message: 'Anime removido de favoritos' });
  } catch (error) {
    console.error('Error al remover favorito:', error);
    return res.status(500).json({ error: 'Error al remover favorito' });
  }
});

// GET /historial - Historial de reproducción del usuario (base de datos actualizado con slugs)
app.get("/historial", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const historial = Array.isArray(user.historial) ? user.historial : [];
    // Enriquecer historial con título, imagen y slug del anime
    const historialConDetalles = await Promise.all(
      historial.map(async (item) => {
        const anime = await Anime.findByPk(item.animeId);
        return {
          ...item,
          animeTitle: anime ? anime.titulo : "Anime no encontrado",
          animeImage: anime ? anime.imagen : null,
          animeSlug: anime ? anime.slug : null,
        };
      })
    );
    res.json(historialConDetalles);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// POST /historial - Agregar o actualizar entrada en historial (actualizado para manejar slugs)
app.post("/historial", authenticateToken, async (req, res) => {
  try {
    const { animeSlug, episodio, progreso } = req.body;
    if (!animeSlug || !episodio || progreso === undefined) {
      return res
        .status(400)
        .json({ error: "animeSlug, episodio y progreso son requeridos" });
    }
    
    // Buscar anime por slug para obtener el ID
    let anime = await Anime.findOne({ where: { slug: animeSlug } });
    
    // Si no se encuentra por slug, intentar por ID (fallback)
    if (!anime && !isNaN(Number(animeSlug))) {
      anime = await Anime.findByPk(animeSlug);
    }
    
    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }
    
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const historial = Array.isArray(user.historial) ? [...user.historial] : [];
    const existingIndex = historial.findIndex(
      (item) => item.animeId === anime.id && item.episodio === episodio
    );
    
    const nuevaEntrada = {
      animeId: anime.id,
      episodio,
      progreso,
      fechaVisto: new Date().toISOString(),
      animeSlug: anime.slug
    };
    
    if (existingIndex !== -1) {
      historial[existingIndex] = nuevaEntrada;
    } else {
      historial.unshift(nuevaEntrada);
    }
    
    // Limitar a 50 registros
    const limitedHist = historial.slice(0, 50);
    await user.update({ historial: limitedHist });
    res.json({ message: "Historial actualizado" });
  } catch (error) {
    console.error('Error al actualizar historial:', error);
    res.status(500).json({ error: "Error al actualizar historial" });
  }
});

// Error handlers
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor AnimeFest ejecutándose en http://localhost:${PORT}`);
  console.log("📺 Endpoints disponibles:");
  console.log("  GET  /catalogo - Lista de animes");
  console.log("  GET  /anime/:id - Detalles de anime");
  console.log("  GET  /reproducir?animeId=X&episodio=Y - Stream URL");
  console.log("  POST /login - Autenticación");
  console.log("  POST /registro - Registro de usuario");
  console.log("  GET  /usuario - Datos del usuario (auth)");
  console.log("  GET  /favoritos - Lista de favoritos (auth)");
  console.log("  POST /favoritos - Agregar favorito (auth)");
  console.log("  DELETE /favoritos/:id - Quitar favorito (auth)");
  console.log("  GET  /historial - Historial de reproducción (auth)");
  console.log("  POST /historial - Actualizar historial (auth)");
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

// POST /login - Inicio de sesión contra la base de datos
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password son requeridos' });
    }
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno en login' });
  }
});

// POST /registro - Registrar un nuevo usuario
app.post('/registro', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email y password son requeridos' });
    }

    // Verificar duplicados por username o email
    const exists = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });
    if (exists) return res.status(409).json({ error: 'Usuario o email ya existe' });

    // Hashear contraseña con factor de coste configurable
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Crear usuario con role 'user' por defecto
    const user = await User.create({
      username, 
      email, 
      password_hash, 
      role: 'user',
      favorites: [], 
      historial: []
    });

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '2h' }
    );

    return res.json({
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      }
    });
  } catch (err) {
    // Manejo específico de errores SQLite
    if (err?.original?.code === 'SQLITE_BUSY') {
      return res.status(503).json({ error: 'Base de datos ocupada, intenta de nuevo' });
    }
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Usuario o email ya existe' });
    }
    console.error('Error en registro:', err);
    return res.status(500).json({ error: 'Error interno en registro' });
  }
});

// Función para obtener servidores desde LatAnime usando Puppeteer (LEGACY - usar obtenerServidoresDesdeLatAnimeOptimizada)
async function obtenerServidoresDesdeLatAnime(animeId, episodioId) {
  console.log(`⚠️ Using legacy scraper for ${animeId}:${episodioId} - consider migrating to optimized version`);
  
  // Delegate to optimized version for better performance
  const result = await obtenerServidoresDesdeLatAnimeOptimizada(animeId, episodioId);
  return result.servers;
}

// Ruta para registrar nuevo anime (solo administradores)
app.post('/api/animes/register', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { nombre, sitio } = req.body;
    
    if (!nombre || !sitio) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre y sitio son requeridos' 
      });
    }
    
    if (sitio !== 'latanime') {
      return res.status(400).json({ 
        success: false, 
        message: 'Sitio no soportado. Solo se admite: latanime' 
      });
    }
    
    console.log(`🎬 Iniciando scraping de: ${nombre} desde ${sitio}`);
    
    // Inicializar scraper
    const scraper = new LatAnimeScraper();
    
    try {
      // Buscar y scrapear anime
      const animeData = await scraper.buscarAnime(nombre);
      
      // Verificar si el anime ya existe
      const animeExistente = await Anime.findOne({ 
        where: { slug: animeData.slug } 
      });
      
      let anime;
      
      if (animeExistente) {
        // Actualizar anime existente
        await animeExistente.update({
          titulo: animeData.titulo,
          sinopsis: animeData.sinopsis,
          imagen: animeData.imagen,
          generos: animeData.generos,
          año: animeData.año,
          estado: animeData.estado,
          idioma: animeData.idioma,
          categoria: animeData.categoria,
          url_origen: animeData.url_origen
        });
        
        // Eliminar episodios existentes
        await Episodio.destroy({ where: { anime_id: animeExistente.id } });
        
        anime = animeExistente;
        console.log(`📝 Anime actualizado: ${animeData.titulo}`);
      } else {
        // Crear nuevo anime
        anime = await Anime.create({
          titulo: animeData.titulo,
          sinopsis: animeData.sinopsis,
          imagen: animeData.imagen,
          generos: animeData.generos,
          año: animeData.año,
          estado: animeData.estado,
          idioma: animeData.idioma,
          categoria: animeData.categoria,
          sitio_origen: animeData.sitio_origen,
          url_origen: animeData.url_origen,
          slug: animeData.slug
        });
        
        console.log(`✨ Nuevo anime creado: ${animeData.titulo}`);
      }
      
      // Crear episodios
      const episodiosData = animeData.episodios.map(ep => ({
        ...ep,
        anime_id: anime.id
      }));
      
      await Episodio.bulkCreate(episodiosData);
      
      console.log(`📺 ${episodiosData.length} episodios guardados`);
      
      await scraper.close();
      
      res.json({
        success: true,
        message: `Anime ${animeExistente ? 'actualizado' : 'registrado'} correctamente`,
        anime: {
          id: anime.id,
          titulo: anime.titulo,
          episodios: episodiosData.length
        }
      });
      
    } catch (scrapingError) {
      await scraper.close();
      throw scrapingError;
    }
    
  } catch (error) {
    console.error('❌ Error al registrar anime:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el anime: ' + error.message
    });
  }
});



// DELETE /api/animes/:id - Eliminar anime (solo administradores)
app.delete('/api/animes/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar el anime
    const anime = await Anime.findByPk(id);
    
    if (!anime) {
      return res.status(404).json({
        success: false,
        message: 'Anime no encontrado'
      });
    }
    
    // Eliminar episodios asociados
    await Episodio.destroy({ where: { anime_id: id } });
    
    // Eliminar anime
    await anime.destroy();
    
    console.log(`🗑️ Anime eliminado: ${anime.titulo}`);
    
    res.json({
      success: true,
      message: 'Anime eliminado correctamente'
    });
    
  } catch (error) {
    console.error('❌ Error al eliminar anime:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el anime: ' + error.message
    });
  }
});

// GET /api/animes/registered - Mejorado para incluir conteo de episodios (solo administradores)
app.get('/api/animes/registered', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const animes = await Anime.findAll({
      include: [{
        model: Episodio,
        as: 'episodios',
        attributes: ['id']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // Agregar conteo de episodios
    const animesConEpisodios = animes.map(anime => ({
      ...anime.toJSON(),
      episodios: anime.episodios ? anime.episodios.length : 0
    }));
    
    res.json({
      success: true,
      animes: animesConEpisodios
    });
    
  } catch (error) {
    console.error('❌ Error al obtener animes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener animes: ' + error.message
    });
  }
});

// ... existing code ...
