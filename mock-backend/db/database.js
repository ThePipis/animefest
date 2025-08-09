import { Sequelize, DataTypes } from 'sequelize';

import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'animefest.sqlite'),
  logging: console.log,
  pool: { max: 1, min: 0, idle: 10000 }, // ✅ NUEVO: Pool para evitar múltiples conexiones
});

// Modelo Anime
const Anime = sequelize.define('Anime', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sinopsis: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imagen: {
    type: DataTypes.STRING,
    allowNull: true
  },
  generos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  año: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: true
  },
  idioma: {
    type: DataTypes.STRING,
    allowNull: true
  },
  categoria: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sitio_origen: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url_origen: {
    type: DataTypes.STRING,
    allowNull: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  }
}, {
  tableName: 'animes',
  timestamps: true
});

// Modelo Episodio
const Episodio = sequelize.define('Episodio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  numero: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  duracion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  url_stream: {
    type: DataTypes.STRING,
    allowNull: false
  },
  anime_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Anime,
      key: 'id'
    }
  }
}, {
  tableName: 'episodios',
  timestamps: true
});

// Definir asociaciones
Anime.hasMany(Episodio, {
  foreignKey: 'anime_id',
  as: 'episodios',
  onDelete: 'CASCADE'
});

Episodio.belongsTo(Anime, {
  foreignKey: 'anime_id',
  as: 'anime'
});

// Función para inicializar la base de datos
export const initDatabase = async () => {
  try {
    console.log('🔄 Iniciando conexión a la base de datos...');
    console.log('📁 Ruta de la base de datos:', path.join(__dirname, 'animefest.sqlite'));
    
    await sequelize.authenticate();
    console.log(' Conexión a SQLite establecida correctamente.');
    
    // Configuraciones anti-bloqueo
    await sequelize.query('PRAGMA journal_mode = WAL;');
    await sequelize.query('PRAGMA busy_timeout = 5000;'); // 5 segundos de espera si está ocupada
    
    try {
      await sequelize.sync({ alter: false }); // Cambiar a false para evitar conflictos de migración
      console.log(' Modelos sincronizados correctamente.');
    } catch (syncError) {
      console.warn(' Sync con alter falló, intentando sync básico:', syncError.message);
      await sequelize.sync({ force: false });
      console.log(' Modelos sincronizados con sync básico.');
    }
    console.log(' Base de datos creada en:', path.join(__dirname, 'animefest.sqlite'));
    
    return true;
  } catch (error) {
    console.error(' Error al conectar con la base de datos:', error);
    console.error(' Detalles del error:', error.message);
    return false;
  }
};

// Nuevo modelo de usuario.
// Gestiona usuarios con roles y contraseñas hasheadas. Esto reemplaza el uso
// del archivo users.json. Los campos favorites e historial se dejan como JSON
// para mantener la compatibilidad con la lógica existente, pero en el futuro
// pueden migrarse a tablas propias.
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user'
  },
  favorites: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  historial: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'users',
  timestamps: true
});

// Incluir User en las exportaciones
export { sequelize, Anime, Episodio, User };