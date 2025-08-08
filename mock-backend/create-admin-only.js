import bcrypt from 'bcryptjs';

import { initDatabase, Usuario, sequelize } from './db/database.js';

const createAdminUser = async () => {
  try {
    console.log('🔄 Inicializando base de datos...');
    await initDatabase();
    
    console.log('🗑️ Eliminando todos los usuarios existentes...');
    await Usuario.destroy({ where: {} });
    
    console.log('👤 Creando usuario admin...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await Usuario.create({
      username: 'admin',
      email: 'admin@animefest.com',
      password: hashedPassword,
      rol: 'admin',
      favoritos: [],
      historial: []
    });
    
    console.log('✅ Usuario admin creado exitosamente:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Rol: admin');
    console.log('   Email: admin@animefest.com');
    
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createAdminUser();