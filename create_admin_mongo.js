import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import readline from 'readline';

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGO_URL) {
  console.error('❌ Error: MONGO_URL no está definido en .env');
  process.exit(1);
}

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  email: String,
  role: { type: String, enum: ['super_admin', 'org_admin'], default: 'super_admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

async function createAdmin(username, password, role = 'super_admin') {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URL);
    console.log('✅ Conectado');

    const existing = await Admin.findOne({ username });
    if (existing) {
      console.log(`⚠️  El admin '${username}' ya existe. Actualizando contraseña...`);
      existing.passwordHash = await bcryptjs.hash(password, 10);
      existing.updatedAt = new Date();
      await existing.save();
      console.log(`✅ Contraseña actualizada para '${username}'`);
    } else {
      const hash = await bcryptjs.hash(password, 10);
      await Admin.create({
        username,
        passwordHash: hash,
        role
      });
      console.log(`✅ Admin '${username}' creado con rol '${role}'`);
    }

    console.log('\n📋 Credenciales:');
    console.log(`   Usuario: ${username}`);
    console.log(`   Contraseña: ${password}`);
    console.log(`   Rol: ${role}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(question, answer => {
    rl.close();
    resolve(answer);
  }));
}

async function main() {
  const args = process.argv.slice(2);
  
  let username, password, role;

  if (args.length >= 2) {
    username = args[0];
    password = args[1];
    role = args[2] || 'super_admin';
  } else {
    console.log('\n========================================');
    console.log('  Crear Admin para MongoDB');
    console.log('========================================\n');
    
    username = await prompt('👤 Usuario: ');
    password = await prompt('🔑 Contraseña: ');
    const roleInput = await prompt('👔 Rol (super_admin/org_admin) [super_admin]: ');
    role = roleInput || 'super_admin';
  }

  if (!username || !password) {
    console.error('❌ Usuario y contraseña son requeridos');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ La contraseña debe tener al menos 6 caracteres');
    process.exit(1);
  }

  await createAdmin(username, password, role);
}

main();
