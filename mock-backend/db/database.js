import { Sequelize, DataTypes } from 'sequelize';

import path from 'path';

import { fileURLToPath } from 'url';

import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'animefest.sqlite'),
  logging: console.log,
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

// ✅ NUEVO: Modelo Usuario con sistema de roles
const Usuario = sequelize.define('Usuario', {
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
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // ✅ NUEVO: Campo de rol
  rol: {
    type: DataTypes.ENUM('admin', 'usuario'),
    allowNull: false,
    defaultValue: 'usuario'
  },
  favoritos: {
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
  tableName: 'usuarios',
  timestamps: true
});

// ✅ FUNCIÓN para migrar usuarios desde JSON
// ✅ ACTUALIZADA: Función para migrar usuarios con roles
const migrateUsersFromJson = async () => {
  try {
    // ❌ ELIMINAR: Referencias a users.json
    // const usersJsonPath = path.join(__dirname, '..', 'data', 'users.json');
    // console.log('🔄 Migrando usuarios desde users.json...');
    const usersData = await fs.readFile(usersJsonPath, 'utf8');
    const users = JSON.parse(usersData);
    
    console.log('🔄 Migrando usuarios desde users.json...');
    
    for (const user of users) {
      const existingUser = await Usuario.findOne({ where: { username: user.username } });
      
      if (!existingUser) {
        await Usuario.create({
          username: user.username,
          email: user.email,
          password: user.password,
          // ✅ NUEVO: Asignar rol admin solo al usuario 'admin'
          rol: user.username === 'admin' ? 'admin' : 'usuario',
          favoritos: user.favoritos || [],
          historial: user.historial || []
        });
        console.log(`✅ Usuario migrado: ${user.username} (${user.username === 'admin' ? 'ADMIN' : 'USUARIO'})`);
      } else {
        console.log(`⚠️ Usuario ya existe: ${user.username}`);
      }
    }
    
    console.log('✅ Migración de usuarios completada');
  } catch (error) {
    console.error('❌ Error migrando usuarios:', error);
  }
};

// ✅ FUNCIÓN SIMPLIFICADA - sin migración de users.json
export const initDatabase = async () => {
  try {
    console.log('🔄 Iniciando conexión a la base de datos...');
    console.log('📁 Ruta de la base de datos:', path.join(__dirname, 'animefest.sqlite'));
    
    await sequelize.authenticate();
    console.log('✅ Conexión a SQLite establecida correctamente.');
    
    // ✅ CAMBIO: Usar force: true para recrear las tablas con el esquema correcto
    await sequelize.sync({ force: true });
    console.log('✅ Modelos sincronizados correctamente.');
    
    console.log('📄 Base de datos lista en:', path.join(__dirname, 'animefest.sqlite'));
    
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
    console.error('📋 Detalles del error:', error.message);
    return false;
  }
};

export { sequelize, Anime, Episodio, Usuario };