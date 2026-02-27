import mongoose from 'mongoose';
import { Leader } from '../src/models/Leader.js';
import { Registration } from '../src/models/Registration.js';

const MONGO_ATLAS_URL = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';

async function syncLeaderCounts() {
  try {
    await mongoose.connect(MONGO_ATLAS_URL);
    console.log('Connected to MongoDB Atlas');

    const leaders = await Leader.find({});
    let updatedCount = 0;

    for (const leader of leaders) {
      // Check both leaderId and _id
      const count = await Registration.countDocuments({ 
        $or: [
          { leaderId: leader.leaderId },
          { leaderId: leader._id.toString() }
        ]
      });

      if (leader.name.includes('Nidia') || leader.name.includes('Méndez') || leader.name.includes('Mendez')) {
        console.log(`Leader ${leader.name} (${leader.leaderId}): DB Count = ${count}, Leader.registrations = ${leader.registrations}`);
        
        // Print all registrations for this leader
        const regs = await Registration.find({
          $or: [
            { leaderId: leader.leaderId },
            { leaderId: leader._id.toString() }
          ]
        });
        console.log(`Registrations for ${leader.name}:`);
        regs.forEach(r => console.log(`- ${r.firstName} ${r.lastName} (Leader ID: ${r.leaderId}, Leader Name: ${r.leaderName})`));
      }

      if (count !== leader.registrations) {
        console.log(`Updating ${leader.name}: ${leader.registrations} -> ${count}`);
        await Leader.updateOne({ _id: leader._id }, { $set: { registrations: count } });
        updatedCount++;
      }
    }

    console.log(`Finished syncing. Updated ${updatedCount} leaders.`);
    
    // Find all registrations with Nidia Mendez as leaderName
    const nidiaRegs = await Registration.find({ leaderName: { $regex: /Nidia|Méndez|Mendez/i } });
    console.log(`\nFound ${nidiaRegs.length} registrations with leaderName matching Nidia Mendez:`);
    nidiaRegs.forEach(r => console.log(`- ${r.firstName} ${r.lastName} (Leader ID: ${r.leaderId}, Leader Name: ${r.leaderName})`));
    
    // Find all leaders
    console.log(`\nAll leaders:`);
    leaders.forEach(l => console.log(`- ${l.name} (Leader ID: ${l.leaderId}, Registrations: ${l.registrations})`));

    process.exit(0);
  } catch (error) {
    console.error('Error syncing leader counts:', error);
    process.exit(1);
  }
}

syncLeaderCounts();
