import bcrypt from 'bcryptjs';

import fs from 'fs/promises';

import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ NUEVA CONTRASEÑA PARA ADMIN
const NUEVA_PASSWORD_ADMIN = 'AnimeFest2024!';

async function crearNuevoAdmin() {
  try {
    console.log('🔐 Generando nuevo usuario admin...');
    
    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(NUEVA_PASSWORD_ADMIN, 12);
    
    // Leer users.json actual
    const usersPath = path.join(__dirname, 'data', 'users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);
    
    // Eliminar admin actual
    const filteredUsers = users.filter(user => user.username !== 'admin');
    
    // Crear nuevo admin
    const nuevoAdmin = {
      id: 1,
      username: 'admin',
      email: 'admin@animefest.com',
      password: hashedPassword,
      favoritos: [],
      historial: []
    };
    
    // Agregar nuevo admin al inicio
    const nuevosUsers = [nuevoAdmin, ...filteredUsers.map(user => ({ ...user, id: user.id + 1 }))];
    
    // Guardar users.json actualizado
    await fs.writeFile(usersPath, JSON.stringify(nuevosUsers, null, 2));
    
    console.log('✅ Nuevo usuario admin creado exitosamente!');
    console.log('📋 Credenciales del nuevo admin:');
    console.log(`   Username: admin`);
    console.log(`   Email: admin@animefest.com`);
    console.log(`   Password: ${NUEVA_PASSWORD_ADMIN}`);
    console.log(`   Hash: ${hashedPassword}`);
    
  } catch (error) {
    console.error('❌ Error creando nuevo admin:', error);
  }
}

crearNuevoAdmin();