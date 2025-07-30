import express from "express";

import cors from "cors";

import jwt from "jsonwebtoken";

import bcrypt from "bcryptjs";

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

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
  const token = authHeader && authHeader.split(" ")[1];

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

// GET /reproducir - Obtener URL de stream
app.get("/reproducir", async (req, res) => {
  try {
    const { animeId, episodio } = req.query;

    if (!animeId || !episodio) {
      return res
        .status(400)
        .json({ error: "animeId y episodio son requeridos" });
    }

    const animes = await readJsonFile("animes.json");
    const anime = animes.find((a) => a.id === parseInt(animeId));

    if (!anime) {
      return res.status(404).json({ error: "Anime no encontrado" });
    }

    const ep = anime.episodios.find((e) => e.numero === parseInt(episodio));

    if (!ep) {
      return res.status(404).json({ error: "Episodio no encontrado" });
    }

    res.json({
      url: ep.url_stream,
      titulo: ep.titulo,
      anime: anime.titulo,
      episodio: ep.numero,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el stream" });
  }
});

// POST /login - Autenticación de usuario
app.post("/login", async (req, res) => {
  try {
    console.log("Login request received:", req.body);
    const { username, password } = req.body;

    if (!username || !password) {
      console.log("Missing username or password");
      return res
        .status(400)
        .json({ error: "Username y password son requeridos" });
    }

    const users = await readJsonFile("users.json");
    console.log("Users loaded:", users.length);
    const user = users.find((u) => u.username === username);
    console.log("User found:", user ? "Yes" : "No");

    if (!user) {
      console.log("User not found");
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    console.log("Password valid:", validPassword);

    if (!validPassword) {
      console.log("Invalid password");
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("Login successful, sending response");
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Error en el login" });
  }
});

// POST /registro - Registro de nuevo usuario
app.post("/registro", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    const users = await readJsonFile("users.json");

    // Verificar si el usuario ya existe
    const existingUser = users.find(
      (u) => u.username === username || u.email === email
    );

    if (existingUser) {
      return res.status(409).json({ error: "Usuario o email ya existe" });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear nuevo usuario
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password: hashedPassword,
      favoritos: [],
      historial: [],
    };

    users.push(newUser);
    await writeJsonFile("users.json", users);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el registro" });
  }
});

// Rutas protegidas (requieren autenticación)

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
