import mongoose from 'mongoose';

const url = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';

const BOGOTA_LOCALIDADES = [
    'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
    'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',      
    'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
    'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
];

async function run() {
  try {
    await mongoose.connect(url);
    console.log("Connected");
    
    const db = mongoose.connection.db;
    for (const collName of ['puestos', 'registrations']) {
      console.log(`\n--- Normalizando ${collName} ---`);
      const coll = db.collection(collName);
      
      for (const loc of BOGOTA_LOCALIDADES) {
        // Build regex for case-insensitive match, replacing accents if needed
        const unaccented = loc.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const regexStr = unaccented.split('').map(char => {
          if (/[aeiou]/i.test(char)) {
            const map = {
              'a': '[aáAÁ]',
              'e': '[eéEÉ]',
              'i': '[iíIÍ]',
              'o': '[oóOÓ]',
              'u': '[uúUÚ]'
            };
            return map[char.toLowerCase()];
          }
          return char;
        }).join('');

        const regex = new RegExp(`^\\s*${regexStr}\\s*$`, 'i');
        
        // Find existing mismatches
        const mismatchDocs = await coll.find({
          localidad: regex,
          localidad: { $ne: loc }
        }).toArray();

        if (mismatchDocs.length > 0) {
            console.log(`Normalizando a '${loc}' - Afectados: ${mismatchDocs.length}`);
            await coll.updateMany({
              localidad: regex,
              localidad: { $ne: loc }
            }, {
              $set: { localidad: loc }
            });
        }
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();