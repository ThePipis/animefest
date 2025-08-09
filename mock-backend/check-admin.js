import bcrypt from 'bcrypt';

import { User } from './db/database.js';

async function checkAdmin() {
  try {
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (admin) {
      console.log('✓ Usuario admin encontrado:');
      console.log('  Username:', admin.username);
      console.log('  Email:', admin.email);
      console.log('  Role:', admin.role);
      
      // Verificar contraseña
      const isValid = await bcrypt.compare('admin123', admin.password);
      console.log('  Contraseña admin123 válida:', isValid);
    } else {
      console.log('✗ Usuario admin no encontrado');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAdmin().then(() => process.exit(0));