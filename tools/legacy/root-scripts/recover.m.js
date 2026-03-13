import mongoose from 'mongoose';
import fs from 'fs';

const url = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';
const pmd = JSON.parse(fs.readFileSync('tools/puestos_from_md.json', 'utf8'));

mongoose.connect(url).then(async () => {
  const db = mongoose.connection.db;
  const p = db.collection('puestos');
  
  const missing = await p.find({localidad: 'Fontibón', fuente: 'IDECA'}).toArray();
  console.log('Needs recovery:', missing.length);

  let updated = 0;
  for (const doc of missing) {
    let mdMatch = pmd.find(x => x.nombre.trim().toLowerCase() === doc.nombre.trim().toLowerCase());
    
    // Also try checking by codigoPuesto
    if(!mdMatch) {
      mdMatch = pmd.find(x => x.codigo === doc.codigoPuesto);
    }
    
    if (mdMatch) {
       await p.updateOne({_id: doc._id}, { $set: { localidad: mdMatch.localidad } });
       updated++;
    } else {
       console.log('Still not found:', doc.nombre);
    }
  }
  
  console.log('Updated from MD:', updated);
  process.exit(0);
});