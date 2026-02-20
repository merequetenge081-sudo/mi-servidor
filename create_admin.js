import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';
import { addAdmin, findAdminByUsername } from './src/utils/userDb.js';

dotenv.config();

async function main() {
  const argvUser = process.argv[2];
  const argvPass = process.argv[3];
  const username = argvUser || process.env.ADMIN_USER || 'admin';
  const password = argvPass || process.env.ADMIN_PASS;

  if (!password) {
    console.error('Uso: node create_admin.js <username> <password>  (o setear ADMIN_PASS en .env)');
    process.exit(1);
  }

  const hash = await bcryptjs.hash(password, 10);
  
  const existing = findAdminByUsername(username);
  addAdmin(username, hash);
  
  if (existing) {
    console.log(`✅ Actualizado admin '${username}'`);
  } else {
    console.log(`✅ Creado admin '${username}'`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error creando admin:', err);
  process.exit(1);
});
