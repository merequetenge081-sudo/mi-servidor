import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

dotenv.config();
const mongoURL = process.env.MONGO_URL;
if (!mongoURL) {
  console.error('ERROR: debe definir MONGO_URL en .env antes de ejecutar este script');
  process.exit(1);
}

const AdminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
  createdAt: { type: Date, default: () => new Date() }
});
const Admin = mongoose.model('Admin', AdminSchema);

async function main() {
  await mongoose.connect(mongoURL);

  const argvUser = process.argv[2];
  const argvPass = process.argv[3];
  const username = argvUser || process.env.ADMIN_USER || 'admin';
  const password = argvPass || process.env.ADMIN_PASS;

  if (!password) {
    console.error('Uso: node create_admin.js <username> <password>  (o setear ADMIN_PASS en .env)');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  const existing = await Admin.findOne({ username });
  if (existing) {
    existing.passwordHash = hash;
    await existing.save();
    console.log(`Actualizado admin '${username}'`);
  } else {
    await Admin.create({ username, passwordHash: hash });
    console.log(`Creado admin '${username}'`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error creando admin:', err);
  process.exit(1);
});
