import express from "express";

import cors from "cors";

import jwt from "jsonwebtoken";

import bcrypt from "bcryptjs";

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

import axios from "axios";

import * as cheerio from "cheerio";

import puppeteer from "puppeteer";

import { Op } from 'sequelize';

import { resolveVideoStream } from "./videoResolver.js";

import { initDatabase, Anime, Episodio, Usuario } from './db/database.js';
import { LatAnimeScraper } from './scrapers/latanime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const JWT_SECRET = "animefest_secret_key_2024";

// Inicializar base de datos al arrancar el servidor
initDatabase();

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

// ✅ CORREGIDO: Middleware de autenticación más estricto
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token de acceso requerido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar que el usuario existe en la base de datos
    const user = await Usuario.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Usuario no válido" });
    }
    
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
};

// ✅ NUEVO: Middleware para verificar rol de administrador
const requireAdmin = async (req, res, next) => {
  try {
    const user = await Usuario.findByPk(req.user.id);
    
    if (!user || user.rol !== 'admin') {
      return res.status(403).json({ 
        error: "Acceso denegado. Se requieren permisos de administrador." 
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ Error verificando permisos de admin:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
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

// GET /anime/:id - Detalles de un anime específico (MODIFICADO)
app.get("/anime/:id", async (req, res) => {
  try {
    // Cambiar de archivo JSON a base de datos
    const anime = await Anime.findByPk(req.params.id, {
      include: [{
        model: Episodio,
        as: 'episodios',
        attributes: ['numero', 'titulo', 'duracion', 'url_stream'],
        order: [['numero', 'ASC']]
      }]
    });

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    // Convertir a formato JSON
    const resultado = {
      ...anime.toJSON(),
      episodios: anime.episodios || []
    };

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener el anime:', error);
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
        error: "Los parámetros 'id' y 'episodio' son requeridos",
      });
    }

    console.log(
      `🎬 Solicitud de reproducción - Anime ID: ${id}, Episodio: ${episodio}`
    );

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

// GET /episodios/:animeId/:episodio - Nuevo endpoint para obtener stream de episodio específico
app.get(
  "/episodios/:animeId/:episodio",
  authenticateToken,
  async (req, res) => {
    try {
      const { animeId, episodio } = req.params;

      // Validar parámetros
      if (!animeId || !episodio) {
        return res.status(400).json({
          error: "Los parámetros 'animeId' y 'episodio' son requeridos",
        });
      }

      console.log(
        `🎬 Solicitud de episodio - Anime ID: ${animeId}, Episodio: ${episodio}`
      );

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

// GET /reproductor/:animeId/:episodio - Scraping en tiempo real desde LatAnime
app.get("/reproductor/:animeId/:episodio", authenticateToken, async (req, res) => {
  const { animeId, episodio } = req.params;

  if (!animeId || !episodio) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    console.log(`🎬 Scrapeando servidores para: ${animeId} - Episodio ${episodio}`);

    const servidoresObtenidos = await obtenerServidoresDesdeLatAnime(animeId, episodio);

    if (!servidoresObtenidos || servidoresObtenidos.length === 0) {
      return res.status(404).json({ error: "No se encontraron servidores disponibles" });
    }

    const animes = await readJsonFile("animes.json");
    const anime = animes.find((a) => {
      // Buscar por slug extraído de la URL del primer episodio
      if (a.episodios && a.episodios.length > 0) {
        const urlStream = a.episodios[0].url_stream;
        const match = urlStream.match(/\/ver\/(.+)-episodio-\d+$/);
        const slug = match ? match[1] : '';
        return slug === animeId;
      }
      return false;
    });

    if (anime) {
      await registrarHistorial(req.user.id, {
        animeId: anime.id,
        episodio: parseInt(episodio),
        fechaVisto: new Date().toISOString(),
        animeTitle: anime.titulo,
        animeImage: anime.imagen,
        progreso: 0
      });
    }

    return res.json({
      animeId,
      episodioId: episodio,
      servidores: servidoresObtenidos
    });

  } catch (err) {
    console.error("❌ Error al scrapear iframes:", err);
    return res.status(500).json({ error: "Error interno al obtener los servidores" });
  }
});

// GET /reproductor/:animeId/:episodio - Nuevo endpoint para obtener servidores con fallback
app.get('/reproductor/:animeId/:episodioId', authenticateToken, async (req, res) => {
  const { animeId, episodioId } = req.params;

  try {
    const dataPath = path.join(__dirname, 'data', 'animes.json');
    const animes = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    const anime = animes.find(a => a.id === animeId);
    if (!anime) return res.status(404).json({ error: 'Anime no encontrado' });

    const episodio = anime.episodios.find(e => e.id == episodioId);
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

// Función auxiliar para determinar prioridad de servidores
function getPrioridad(serverName) {
  const prioridades = {
    doodstream: 1,
    yourupload: 2,
    mp4upload: 3,
    ok: 4,
    original: 999,
  };
  return prioridades[serverName] || 999;
}

// Función auxiliar para registrar historial (CORREGIDA)
async function registrarHistorial(userId, data) {
  try {
    const user = await Usuario.findByPk(userId);
    if (!user) {
      console.error('Usuario no encontrado para registrar historial');
      return;
    }

    const historial = user.historial || [];
    
    // Evitar duplicados del mismo episodio
    const existingIndex = historial.findIndex(
      (h) => h.animeId === data.animeId && h.episodio === data.episodio
    );

    if (existingIndex >= 0) {
      historial[existingIndex] = {
        ...historial[existingIndex],
        ...data,
      };
    } else {
      historial.unshift(data);
    }

    // Mantener solo los últimos 50 elementos
    const historialLimitado = historial.slice(0, 50);
    await user.update({ historial: historialLimitado });
  } catch (error) {
    console.error("Error registrando historial:", error);
  }
}

// GET /usuario - Datos del usuario actual (CORREGIDO)
app.get("/usuario", authenticateToken, async (req, res) => {
  try {
    const user = await Usuario.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      rol: user.rol,
      favoritos: user.favoritos || [],
      historial: user.historial || [],
    });
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    res.status(500).json({ error: "Error al obtener datos del usuario" });
  }
});

// GET /favoritos - Lista de favoritos del usuario (CORREGIDO)
app.get("/favoritos", authenticateToken, async (req, res) => {
  try {
    const user = await Usuario.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const animes = await Anime.findAll({
      where: {
        id: user.favoritos || []
      },
      include: [{
        model: Episodio,
        as: 'episodios',
        attributes: ['numero', 'titulo', 'duracion', 'url_stream']
      }]
    });
    
    res.json(animes);
  } catch (error) {
    console.error('Error al obtener favoritos:', error);
    res.status(500).json({ error: "Error al obtener favoritos" });
  }
});

// POST /favoritos - Agregar anime a favoritos (CORREGIDO)
app.post("/favoritos", authenticateToken, async (req, res) => {
  try {
    const { animeId } = req.body;

    if (!animeId) {
      return res.status(400).json({ error: "animeId es requerido" });
    }

    const user = await Usuario.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const favoritos = user.favoritos || [];
    if (!favoritos.includes(animeId)) {
      favoritos.push(animeId);
      await user.update({ favoritos });
    }

    res.json({ message: "Anime agregado a favoritos" });
  } catch (error) {
    console.error('Error al agregar favorito:', error);
    res.status(500).json({ error: "Error al agregar favorito" });
  }
});

// DELETE /favoritos/:id - Quitar anime de favoritos (CORREGIDO)
app.delete("/favoritos/:id", authenticateToken, async (req, res) => {
  try {
    const animeId = parseInt(req.params.id);
    const user = await Usuario.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const favoritos = (user.favoritos || []).filter(id => id !== animeId);
    await user.update({ favoritos });

    res.json({ message: "Anime removido de favoritos" });
  } catch (error) {
    console.error('Error al remover favorito:', error);
    res.status(500).json({ error: "Error al remover favorito" });
  }
});

// GET /historial - Historial de reproducción del usuario (CORREGIDO)
app.get("/historial", authenticateToken, async (req, res) => {
  try {
    const user = await Usuario.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const historial = user.historial || [];
    
    // Enriquecer historial con datos de animes
    const historialConDetalles = await Promise.all(
      historial.map(async (item) => {
        const anime = await Anime.findByPk(item.animeId);
        return {
          ...item,
          animeTitle: anime ? anime.titulo : "Anime no encontrado",
          animeImage: anime ? anime.imagen : null,
        };
      })
    );

    res.json(historialConDetalles);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// POST /historial - Agregar entrada al historial (CORREGIDO)
app.post("/historial", authenticateToken, async (req, res) => {
  try {
    const { animeId, episodio, progreso } = req.body;

    if (!animeId || !episodio || progreso === undefined) {
      return res
        .status(400)
        .json({ error: "animeId, episodio y progreso son requeridos" });
    }

    const user = await Usuario.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const historial = user.historial || [];
    
    // Buscar si ya existe una entrada para este anime y episodio
    const existingIndex = historial.findIndex(
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
      historial[existingIndex] = nuevaEntrada;
    } else {
      // Agregar nueva entrada
      historial.unshift(nuevaEntrada);
    }

    // Mantener solo los últimos 50 elementos
    const historialLimitado = historial.slice(0, 50);
    await user.update({ historial: historialLimitado });

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

// POST /registro - Registro de nuevos usuarios
app.post("/registro", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email y password son requeridos" });
  }

  try {
    // Verificar si el usuario ya existe
    const existingUser = await Usuario.findOne({ 
      where: { 
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(409).json({ error: "El usuario o email ya existe" });
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear nuevo usuario
    const newUser = await Usuario.create({
      username,
      email,
      password: hashedPassword,
      rol: 'usuario',
      favoritos: [],
      historial: []
    });

    // Generar token
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, rol: newUser.rol }, 
      JWT_SECRET, 
      { expiresIn: "24h" }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        rol: newUser.rol
      },
    });
  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ ACTUALIZADO: Login con información de rol
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username y password son requeridos" });
  }

  try {
    const user = await Usuario.findOne({ where: { username } });
    
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol }, 
      JWT_SECRET, 
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rol: user.rol // ✅ NUEVO: Incluir rol en respuesta
      },
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Función para obtener servidores desde LatAnime usando Puppeteer
async function obtenerServidoresDesdeLatAnime(animeId, episodioId) {
  const urlLatAnime = `https://latanime.org/ver/${animeId}-episodio-${episodioId}`;

  console.log(`🔍 Accediendo a: ${urlLatAnime}`);

  const browser = await puppeteer.launch({
    headless: true, // Cambiar a true para producción
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // Configurar User-Agent para evitar detección
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.goto(urlLatAnime, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(5000);

    // Buscar elementos con clase .play-video
    const servidoresRaw = await page.$$eval(".play-video", (els) =>
      els.map((el) => ({
        nombre: el.textContent.trim(),
        base64url: el.getAttribute("data-player"),
      }))
    );

    console.log(`📡 Encontrados ${servidoresRaw.length} servidores raw`);

    const servidores = [];
    for (const s of servidoresRaw) {
      try {
        if (s.base64url) {
          const decodedUrl = Buffer.from(s.base64url, "base64").toString("utf-8");
          
          // Verificar si la URL es embebible (contiene 'embed' o es un iframe directo)
          let iframeUrl = decodedUrl;
          
          // Si no es una URL de embed, intentar convertirla
          if (!decodedUrl.includes('embed') && !decodedUrl.includes('iframe')) {
            // Para algunos servidores, necesitamos navegar y extraer el iframe real
            try {
              const iframePage = await browser.newPage();
              await iframePage.goto(decodedUrl, { waitUntil: 'networkidle2', timeout: 15000 });
              
              // Buscar iframe embebible en la página
              const embedUrl = await iframePage.evaluate(() => {
                const iframe = document.querySelector('iframe[src*="embed"], iframe[src*="player"]');
                return iframe ? iframe.src : null;
              });
              
              if (embedUrl) {
                iframeUrl = embedUrl;
              }
              
              await iframePage.close();
            } catch (embedError) {
              console.log(`⚠️ No se pudo extraer iframe de ${s.nombre}, usando URL original`);
            }
          }
          
          servidores.push({
            nombre: s.nombre.toLowerCase().replace(/\s+/g, ""),
            iframe: iframeUrl, // URL específica para embebido
            prioridad: getPrioridad(s.nombre.toLowerCase()) || 999,
            servidor: s.nombre.toLowerCase().replace(/\s+/g, ""),
            url: decodedUrl,
          });
          
          console.log(`✅ Servidor procesado: ${s.nombre} -> ${iframeUrl}`);
        }
      } catch (decodeError) {
        console.log(`❌ Error procesando ${s.nombre}:`, decodeError.message);
      }
    }

    return servidores;
  } catch (error) {
    console.error(`🚨 Error en scraping de ${urlLatAnime}:`, error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Ruta para registrar nuevo anime
app.post('/api/animes/register', authenticateToken, requireAdmin, async (req, res) => {
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



// DELETE /api/animes/:id - Eliminar anime
app.delete('/api/animes/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// GET /api/animes/registered - Mejorado para incluir conteo de episodios
app.get('/api/animes/registered', authenticateToken, requireAdmin, async (req, res) => {
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

// ✅ NUEVA RUTA: POST /api/login (sin hash de contraseñas)
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username y password son requeridos' 
    });
  }

  try {
    // Buscar usuario en la base de datos SQLite
    const usuario = await Usuario.findOne({ where: { username } });
    
    if (!usuario) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario o contraseña incorrectos' 
      });
    }

    // Verificar contraseña sin hash (como solicitó el usuario)
    if (usuario.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario o contraseña incorrectos' 
      });
    }

    // Login exitoso
    return res.status(200).json({
      success: true,
      usuario: {
        id: usuario.id,
        username: usuario.username
      }
    });

  } catch (error) {
    console.error('❌ Error en /api/login:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// ... existing code ...
