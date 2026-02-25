/**
 * 🔍 VERIFY SCRIPT - Probar fuzzy matching en tiempo real
 * 
 * Simula el endpoint de verificación para ver si encuentra el puesto
 */

import mongoose from 'mongoose';

async function verifyRegistration() {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/seguimiento-datos';
    
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;

    console.log('🔍 VERIFICANDO REGISTRATIONS...\n');

    // 1. Obtener la registration pendiente
    const registration = await db.collection('leaderregistrations').findOne({
      status: 'pending',
    });

    if (!registration) {
      console.log('❌ No hay registrations pendientes');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 Registration encontrada:');
    console.log(`   ID: ${registration._id}`);
    console.log(`   Puesto ingresado: "${registration.puesto}"`);
    console.log(`   Localidad: ${registration.localidad}`);
    console.log(`   Estado: ${registration.status}`);

    // 2. Buscar puestos similares
    const threshold = 0.85; // Critical threshold
    const puestos = await db.collection('puestos').find({
      localidad: registration.localidad,
    }).toArray();

    console.log(`\n📊 Puestos disponibles en ${registration.localidad}: ${puestos.length}`);

    if (puestos.length === 0) {
      console.log('⚠️  No hay puestos en esa localidad');
      await mongoose.disconnect();
      return;
    }

    // 3. Calcular similitud (Levenshtein simplificado)
    function levenshteinDistance(a, b) {
      const aLower = a.toLowerCase().replace(/[áéíóú]/g, (match) => {
        const accents = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
        return accents[match];
      });
      const bLower = b.toLowerCase().replace(/[áéíóú]/g, (match) => {
        const accents = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
        return accents[match];
      });

      if (aLower === bLower) return 1.0;

      const matrix = [];

      for (let i = 0; i <= bLower.length; i++) {
        matrix[i] = [i];
      }

      for (let j = 0; j <= aLower.length; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i <= bLower.length; i++) {
        for (let j = 1; j <= aLower.length; j++) {
          if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }

      const distance = matrix[bLower.length][aLower.length];
      const maxLength = Math.max(aLower.length, bLower.length);
      return 1 - distance / maxLength;
    }

    // 4. Encontrar el mejor match
    let bestMatch = null;
    let bestScore = 0;

    puestos.forEach((puesto) => {
      const score = levenshteinDistance(registration.puesto, puesto.nombre);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = puesto;
      }
    });

    // 5. Mostrar resultados
    console.log('\n🎯 RESULTADO DEL MATCHING:');
    console.log(`   Threshold requerido: ${threshold}`);
    console.log(`   Score encontrado: ${bestScore.toFixed(4)}`);

    if (bestScore >= threshold) {
      console.log(`\n✅ MATCH EXITOSO!`);
      console.log(`   Puesto encontrado: "${bestMatch.nombre}"`);
      console.log(`   Código: ${bestMatch.codigoPuesto}`);
      console.log(`   Mesa: ${bestMatch.mesa}`);
      console.log(`   Confianza: ${(bestScore * 100).toFixed(1)}%`);

      // Actualizar registration
      await db.collection('leaderregistrations').updateOne(
        { _id: registration._id },
        {
          $set: {
            matchConfidence: bestScore,
            matched: true,
            matchedPuesto: bestMatch.nombre,
            matchedCode: bestMatch.codigoPuesto,
            status: 'verified',
            verifiedAt: new Date(),
          },
        }
      );

      console.log(`\n✨ Registration actualizado a "verified"`);
    } else {
      console.log(`\n⚠️  MATCH FALLIDO`);
      console.log(`   Mejor coincidencia: "${bestMatch.nombre}" (${(bestScore * 100).toFixed(1)}%)`);
      console.log(`   Score insuficiente - se requiere ${(threshold * 100).toFixed(0)}%`);
    }

    // 6. Mostrar top 5 matches
    console.log('\n📋 TOP 5 Matches:');
    const scores = puestos.map((p) => ({
      nombre: p.nombre,
      score: levenshteinDistance(registration.puesto, p.nombre),
    }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    scores.forEach((s, i) => {
      const icon = s.score >= threshold ? '✅' : '❌';
      console.log(`   ${i + 1}. ${icon} ${s.nombre} (${(s.score * 100).toFixed(1)}%)`);
    });

    console.log('\n✨ Verificación completada!\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyRegistration();
