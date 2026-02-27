import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { Puestos } from '../src/models/Puestos.js';
import { matchPuesto } from '../src/utils/fuzzyMatch.js';

const MONGO_ATLAS_URL = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';

async function verifyPuestos() {
  try {
    await mongoose.connect(MONGO_ATLAS_URL);
    console.log('Connected to MongoDB Atlas');

    // Find all active puestos
    const allPuestos = await Puestos.find({ activo: true }).lean();
    console.log(`Loaded ${allPuestos.length} active puestos for matching`);

    // Find registrations that need review or have votingPlace but no puestoId
    const registrations = await Registration.find({
      $or: [
        { requiereRevisionPuesto: true },
        { puestoId: null, votingPlace: { $ne: null, $ne: '' } }
      ]
    });

    console.log(`Found ${registrations.length} registrations needing review`);

    let updatedCount = 0;
    let stillNeedsReviewCount = 0;

    for (const reg of registrations) {
      if (!reg.votingPlace) {
        stillNeedsReviewCount++;
        continue;
      }

      // Clean up locality if it's "cundinamarca (resto del pais)" or similar
      let localidadFiltro = reg.localidad;
      if (localidadFiltro && localidadFiltro.toLowerCase().includes('cundinamarca')) {
        localidadFiltro = null; // Ignore this locality for filtering
      }

      // Try to match
      const match = matchPuesto(reg.votingPlace, allPuestos, 0.75, localidadFiltro);

      if (match) {
        console.log(`Matched: "${reg.votingPlace}" -> "${match.puesto.nombre}" (Localidad: ${match.puesto.localidad}) [Similarity: ${(match.similarity * 100).toFixed(1)}%]`);
        
        await Registration.updateOne(
          { _id: reg._id },
          {
            $set: {
              puestoId: match.puesto._id,
              localidad: match.puesto.localidad || reg.localidad,
              votingPlace: match.puesto.nombre,
              requiereRevisionPuesto: false,
              revisionPuestoResuelta: true
            }
          }
        );
        updatedCount++;
      } else {
        console.log(`No match found for: "${reg.votingPlace}" (Localidad: ${reg.localidad})`);
        stillNeedsReviewCount++;
      }
    }

    console.log(`\nVerification complete.`);
    console.log(`Successfully matched and updated: ${updatedCount}`);
    console.log(`Still needing review: ${stillNeedsReviewCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyPuestos();
