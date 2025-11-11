import mongoose from "mongoose";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const mongoURL = process.env.MONGO_URL;

// Conectar a MongoDB
await mongoose.connect(mongoURL)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => {
    console.error("❌ Error al conectar a MongoDB:", err);
    process.exit(1);
  });

// Esquemas
const LeaderSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  area: String,
  active: Boolean,
  token: String,
  eventId: { type: String, default: '' },
  registrations: { type: Number, default: 0 }
});

const RegistrationSchema = new mongoose.Schema({
  leaderId: String,
  leaderName: String,
  eventId: String,
  firstName: String,
  lastName: String,
  cedula: String,
  email: String,
  phone: String,
  date: String,
  notifications: {
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    whatsappSent: { type: Boolean, default: false }
  },
  confirmed: { type: Boolean, default: false },
  confirmedBy: { type: String, default: '' },
  confirmedAt: { type: Date, default: null }
});

const Leader = mongoose.model("Leader", LeaderSchema);
const Registration = mongoose.model("Registration", RegistrationSchema);

// Leer data.json
const data = JSON.parse(fs.readFileSync("./data.json", "utf-8"));

let migratedLeaders = 0;
let migratedRegistrations = 0;

console.log("🔄 Iniciando migración...\n");

try {
  // Migrar líderes
  if (data.leaders && Array.isArray(data.leaders)) {
    console.log(`📌 Procesando ${data.leaders.length} líderes...`);
    
    for (const leader of data.leaders) {
      const existingLeader = await Leader.findOne({ 
        email: leader.email, 
        phone: leader.phone 
      });
      
      if (!existingLeader) {
        const newLeader = new Leader({
          name: leader.name,
          email: leader.email,
          phone: leader.phone,
          area: leader.area || "",
          active: leader.isActive !== false,
          token: leader.token || `leader-${leader.id}`,
          registrations: leader.registrations || 0
        });
        
        await newLeader.save();
        migratedLeaders++;
        console.log(`  ✅ Líder migrado: ${leader.name}`);
      } else {
        console.log(`  ⏭️  Líder ya existe: ${leader.email}`);
      }
    }
  }

  // Migrar registros
  if (data.registrations && Array.isArray(data.registrations)) {
    console.log(`\n📌 Procesando ${data.registrations.length} registros...`);
    
    for (const reg of data.registrations) {
      const existingReg = await Registration.findOne({ 
        email: reg.email, 
        cedula: reg.cedula 
      });
      
      if (!existingReg) {
        // Buscar el líder por id antiguo
        const leader = data.leaders?.find(l => l.id === reg.leaderId);
        let leaderId = null;
        
        if (leader) {
          const dbLeader = await Leader.findOne({ 
            email: leader.email, 
            phone: leader.phone 
          });
          leaderId = dbLeader ? dbLeader._id.toString() : null;
        }

        const newReg = new Registration({
          leaderId: leaderId,
          leaderName: reg.leaderName || "",
          firstName: reg.firstName || "",
          lastName: reg.lastName || "",
          cedula: reg.cedula || "",
          email: reg.email || "",
          phone: reg.phone || "",
          date: reg.date || new Date().toISOString(),
          confirmed: false,
          confirmedBy: "",
          confirmedAt: null,
          notifications: {
            emailSent: false,
            smsSent: false,
            whatsappSent: reg.whatsappSent || false
          }
        });
        
        await newReg.save();
        migratedRegistrations++;
        console.log(`  ✅ Registro migrado: ${reg.firstName} ${reg.lastName}`);
      } else {
        console.log(`  ⏭️  Registro ya existe: ${reg.email}`);
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ MIGRACIÓN COMPLETADA");
  console.log("=".repeat(50));
  console.log(`📊 Líderes migrados: ${migratedLeaders}`);
  console.log(`📊 Registros migrados: ${migratedRegistrations}`);
  console.log("=".repeat(50) + "\n");

} catch (error) {
  console.error("❌ Error durante la migración:", error);
} finally {
  await mongoose.connection.close();
  console.log("✅ Conexión a MongoDB cerrada");
  process.exit(0);
}
