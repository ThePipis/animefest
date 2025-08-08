import bcrypt from 'bcryptjs';

import { User } from './db/database.js';

const createAdmin = async () => {
  try {
    const password_hash = await bcrypt.hash('admin123', 12);
    
    const admin = await User.create({
      username: 'admin',
      email: 'admin@animefest.com',
      password_hash,
      role: 'admin',
      favorites: [],
      historial: []
    });
    
    console.log('✅ Usuario admin creado:', admin.username);
  } catch (error) {
    console.error('❌ Error creando admin:', error);
  }
};

createAdmin();