import express from "express";

import cors from "cors";

import jwt from "jsonwebtoken";

import bcrypt from "bcryptjs";

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

import { resolveVideoStream } from './videoResolver.js';

import axios from 'axios';

import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001; // Server port
const JWT_SECRET = "animefest_secret_key_2024";

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

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Función para leer archivos JSON
const readJsonFile = async (filename) => {
  try {
    const filePath = path.join(__dirname, "data", filename);
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
};

// Función para escribir archivos JSON
const writeJsonFile = async (filename, data) => {
  try {
    const filePath = path.join(__dirname, "data", filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    return false;
  }
};

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // ✅ Extrae token después de "Bearer "

  if (!token) {
    return res.status(401).json({ error: "Token de acceso requerido" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" });
    }
    req.user = user;
    next();
  });
};

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
    const animes = await readJsonFile("animes.json");
    res.json(animes);
  } catch (error) {
    console.error('Error fetching animes:', error);
    res.status(500).json({ error: "Error al obtener los animes" });
  }
});

// GET /catalogo - Lista completa de animes
app.get("/catalogo", async (req, res) => {
  try {
    const animes = await readJsonFile("animes.json");
    const { buscar, genero } = req.query;

    let resultado = animes;

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
        anime.generos.some((g) =>
          g.toLowerCase().includes(genero.toLowerCase())
        )
      );
    }

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el catálogo" });
  }
});

// GET /anime/:id - Detalles de un anime específico
app.get("/anime/:id", async (req, res) => {
  try {
    const animes = await readJsonFile("animes.json");
    const anime = animes.find((a) => a.id === parseInt(req.params.id));

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    res.json(anime);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el anime" });
  }
});

// GET /reproducir - Endpoint mejorado con scraping automático
app.get("/reproducir", authenticateToken, async (req, res) => {
  try {
    const { id, episodio } = req.query;

    // Validar parámetros
    if (!id || !episodio) {
      return res.status(400).json({ 
        error: "Los parámetros 'id' y 'episodio' son requeridos" 
      });
    }

    console.log(`🎬 Solicitud de reproducción - Anime ID: ${id}, Episodio: ${episodio}`);

    // Buscar anime en la base de datos
    const animes = await readJsonFile("animes.json");
    const anime = animes.find((a) => a.id === parseInt(id));

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    // Buscar episodio específico
    const ep = anime.episodios.find((e) => e.numero === parseInt(episodio));

    if (!ep) {
      return res.status(404).json({ error: "Episodio no encontrado" });
    }

    // Verificar que el url_stream sea válido
    if (!ep.url_stream || !ep.url_stream.includes('latanime.org')) {
      return res.status(400).json({ 
        error: "URL de episodio no válida o no soportada" 
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
        progreso: 0
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
          imagen: anime.imagen
        }
      });

      console.log(`✅ Stream resuelto exitosamente para ${anime.titulo} - Episodio ${ep.numero}`);
      
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
          imagen: anime.imagen
        },
        error: "No se pudo resolver automáticamente, usando enlace original"
      });
    }

  } catch (error) {
    console.error('🚨 Error en endpoint /reproducir:', error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /episodios/:animeId/:episodio - Nuevo endpoint para obtener stream de episodio específico
app.get("/episodios/:animeId/:episodio", authenticateToken, async (req, res) => {
  try {
    const { animeId, episodio } = req.params;

    // Validar parámetros
    if (!animeId || !episodio) {
      return res.status(400).json({ 
        error: "Los parámetros 'animeId' y 'episodio' son requeridos" 
      });
    }

    console.log(`🎬 Solicitud de episodio - Anime ID: ${animeId}, Episodio: ${episodio}`);

    // Buscar anime en la base de datos
    const animes = await readJsonFile("animes.json");
    const anime = animes.find((a) => a.id === parseInt(animeId));

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    // Buscar episodio específico
    const ep = anime.episodios.find((e) => e.numero === parseInt(episodio));

    if (!ep) {
      return res.status(404).json({ error: "Episodio no encontrado" });
    }

    // Verificar que el url_stream sea válido
    if (!ep.url_stream || !ep.url_stream.includes('latanime.org')) {
      return res.status(400).json({ 
        error: "URL de episodio no válida o no soportada" 
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
        progreso: 0
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
          imagen: anime.imagen
        }
      });

      console.log(`✅ Stream resuelto exitosamente para ${anime.titulo} - Episodio ${ep.numero}`);
      
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
          imagen: anime.imagen
        },
        error: "No se pudo resolver automáticamente, usando enlace original"
      });
    }

  } catch (error) {
    console.error('🚨 Error en endpoint /episodios:', error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /reproductor/:animeId/:episodio - Nuevo endpoint para obtener servidores con fallback
app.get("/reproductor/:animeId/:episodio", authenticateToken, async (req, res) => {
  try {
    const { animeId, episodio } = req.params;

    // Validar parámetros
    if (!animeId || !episodio) {
      return res.status(400).json({ 
        error: "Los parámetros 'animeId' y 'episodio' son requeridos" 
      });
    }

    console.log(`🎬 Solicitud de servidores - Anime ID: ${animeId}, Episodio: ${episodio}`);

    // Buscar anime en la base de datos
    const animes = await readJsonFile("animes.json");
    const anime = animes.find((a) => a.id === parseInt(animeId));

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    // Buscar episodio específico
    const ep = anime.episodios.find((e) => e.numero === parseInt(episodio));

    if (!ep) {
      return res.status(404).json({ error: "Episodio no encontrado" });
    }

    // Verificar que el url_stream sea válido
    if (!ep.url_stream || !ep.url_stream.includes('latanime.org')) {
      return res.status(400).json({ 
        error: "URL de episodio no válida o no soportada" 
      });
    }

    try {
      // Hacer scraping de la página de latanime.org
      console.log(`🔍 Haciendo scraping de: ${ep.url_stream}`);
      
      const response = await axios.get(ep.url_stream, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const servidores = [];

      // Extraer iframes de los diferentes servidores
      const serverPatterns = {
        'doodstream': /dood\.(la|to|ws|sh|pm|re|wf|cx|watch)/i,
        'yourupload': /yourupload\.com/i,
        'mp4upload': /mp4upload\.com/i,
        'ok': /ok\.ru/i
      };

      // Buscar todos los iframes en la página
      $('iframe').each((index, element) => {
        const src = $(element).attr('src');
        if (src) {
          // Determinar el tipo de servidor
          for (const [serverName, pattern] of Object.entries(serverPatterns)) {
            if (pattern.test(src)) {
              servidores.push({
                nombre: serverName,
                iframe: src.startsWith('//') ? `https:${src}` : src,
                prioridad: getPrioridad(serverName)
              });
              break;
            }
          }
        }
      });

      // Buscar también en enlaces que pueden contener URLs de servidores
      $('a[href]').each((index, element) => {
        const href = $(element).attr('href');
        if (href) {
          for (const [serverName, pattern] of Object.entries(serverPatterns)) {
            if (pattern.test(href)) {
              // Verificar si ya existe este servidor
              const exists = servidores.some(s => s.nombre === serverName);
              if (!exists) {
                servidores.push({
                  nombre: serverName,
                  iframe: href.startsWith('//') ? `https:${href}` : href,
                  prioridad: getPrioridad(serverName)
                });
              }
              break;
            }
          }
        }
      });

      // Ordenar por prioridad
      servidores.sort((a, b) => a.prioridad - b.prioridad);

      // Registrar en historial del usuario
      await registrarHistorial(req.user.id, {
        animeId: anime.id,
        episodio: ep.numero,
        fechaVisto: new Date().toISOString(),
        animeTitle: anime.titulo,
        animeImage: anime.imagen,
        progreso: 0
      });

      // Respuesta exitosa
      res.json({
        success: true,
        anime: {
          id: anime.id,
          titulo: anime.titulo,
          imagen: anime.imagen
        },
        episodio: {
          numero: ep.numero,
          titulo: ep.titulo,
          duracion: ep.duracion
        },
        servidores: servidores.length > 0 ? servidores : [{
          nombre: "original",
          iframe: ep.url_stream,
          prioridad: 999
        }]
      });

      console.log(`✅ Servidores encontrados: ${servidores.length}`);
      
    } catch (scrapingError) {
      console.error(`🚨 Error haciendo scraping:`, scrapingError.message);
      
      // Fallback: devolver URL original
      res.json({
        success: false,
        fallback: true,
        anime: {
          id: anime.id,
          titulo: anime.titulo,
          imagen: anime.imagen
        },
        episodio: {
          numero: ep.numero,
          titulo: ep.titulo,
          duracion: ep.duracion
        },
        servidores: [{
          nombre: "original",
          iframe: ep.url_stream,
          prioridad: 999
        }],
        error: "No se pudo extraer servidores, usando enlace original"
      });
    }

  } catch (error) {
    console.error('🚨 Error en endpoint /reproductor:', error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Función auxiliar para determinar prioridad de servidores
function getPrioridad(serverName) {
  const prioridades = {
    'doodstream': 1,
    'yourupload': 2,
    'mp4upload': 3,
    'ok': 4,
    'original': 999
  };
  return prioridades[serverName] || 999;
}

// Función auxiliar para registrar historial
async function registrarHistorial(userId, data) {
  try {
    const usuarios = await readJsonFile("users.json");
    const usuario = usuarios.find(u => u.id === userId);
    
    if (usuario) {
      if (!usuario.historial) usuario.historial = [];
      
      // Evitar duplicados del mismo episodio
      const existingIndex = usuario.historial.findIndex(
        h => h.animeId === data.animeId && h.episodio === data.episodio
      );
      
      if (existingIndex >= 0) {
        usuario.historial[existingIndex] = { ...usuario.historial[existingIndex], ...data };
      } else {
        usuario.historial.unshift(data);
      }
      
      // Mantener solo los últimos 50 elementos
      usuario.historial = usuario.historial.slice(0, 50);
      
      await writeJsonFile("users.json", usuarios);
    }
  } catch (error) {
    console.error('Error registrando historial:', error);
  }
}

// GET /usuario - Datos del usuario actual
app.get("/usuario", authenticateToken, async (req, res) => {
  try {
    const users = await readJsonFile("users.json");
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      favoritos: user.favoritos,
      historial: user.historial,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener datos del usuario" });
  }
});

// GET /favoritos - Lista de favoritos del usuario
app.get("/favoritos", authenticateToken, async (req, res) => {
  try {
    const users = await readJsonFile("users.json");
    const animes = await readJsonFile("animes.json");
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const favoritos = animes.filter((anime) =>
      user.favoritos.includes(anime.id)
    );
    res.json(favoritos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener favoritos" });
  }
});

// POST /favoritos - Agregar anime a favoritos
app.post("/favoritos", authenticateToken, async (req, res) => {
  try {
    const { animeId } = req.body;

    if (!animeId) {
      return res.status(400).json({ error: "animeId es requerido" });
    }

    const users = await readJsonFile("users.json");
    const userIndex = users.findIndex((u) => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (!users[userIndex].favoritos.includes(animeId)) {
      users[userIndex].favoritos.push(animeId);
      await writeJsonFile("users.json", users);
    }

    res.json({ message: "Anime agregado a favoritos" });
  } catch (error) {
    res.status(500).json({ error: "Error al agregar favorito" });
  }
});

// DELETE /favoritos/:id - Quitar anime de favoritos
app.delete("/favoritos/:id", authenticateToken, async (req, res) => {
  try {
    const animeId = parseInt(req.params.id);
    const users = await readJsonFile("users.json");
    const userIndex = users.findIndex((u) => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    users[userIndex].favoritos = users[userIndex].favoritos.filter(
      (id) => id !== animeId
    );
    await writeJsonFile("users.json", users);

    res.json({ message: "Anime removido de favoritos" });
  } catch (error) {
    res.status(500).json({ error: "Error al remover favorito" });
  }
});

// GET /historial - Historial de reproducción del usuario
app.get("/historial", authenticateToken, async (req, res) => {
  try {
    const users = await readJsonFile("users.json");
    const animes = await readJsonFile("animes.json");
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const historialConDetalles = user.historial.map((item) => {
      const anime = animes.find((a) => a.id === item.animeId);
      return {
        ...item,
        animeTitle: anime ? anime.titulo : "Anime no encontrado",
        animeImage: anime ? anime.imagen : null,
      };
    });

    res.json(historialConDetalles);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// POST /historial - Agregar entrada al historial
app.post("/historial", authenticateToken, async (req, res) => {
  try {
    const { animeId, episodio, progreso } = req.body;

    if (!animeId || !episodio || progreso === undefined) {
      return res
        .status(400)
        .json({ error: "animeId, episodio y progreso son requeridos" });
    }

    const users = await readJsonFile("users.json");
    const userIndex = users.findIndex((u) => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Buscar si ya existe una entrada para este anime y episodio
    const existingIndex = users[userIndex].historial.findIndex(
      (item) => item.animeId === animeId && item.episodio === episodio
    );

    const nuevaEntrada = {
      animeId,
      episodio,
      progreso,
      fechaVisto: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      // Actualizar entrada existente
      users[userIndex].historial[existingIndex] = nuevaEntrada;
    } else {
      // Agregar nueva entrada
      users[userIndex].historial.push(nuevaEntrada);
    }

    await writeJsonFile("users.json", users);
    res.json({ message: "Historial actualizado" });
  } catch (error) {
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
