import { Sequelize, DataTypes } from 'sequelize';

import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'animefest.sqlite'),
  logging: console.log, // Cambiar de false a console.log para ver errores
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
    console.log('✅ Conexión a SQLite establecida correctamente.');
    
    // Sincronizar modelos (crear tablas si no existen)
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados correctamente.');
    console.log('📄 Base de datos creada en:', path.join(__dirname, 'animefest.sqlite'));
    
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
    console.error('📋 Detalles del error:', error.message);
    return false;
  }
};

export { sequelize, Anime, Episodio };