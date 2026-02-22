
import mongoose from 'mongoose';
import dns from 'dns';
import { Leader } from './src/models/Leader.js';
import "dotenv/config";

dns.setDefaultResultOrder("ipv4first");
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";

// Hardcoded for now based on user screenshot ("Evento Politico Inicial")
// Actually, let's find the event first.

async function debugDedup() {
    try {
        await mongoose.connect(MONGO_URL, { family: 4 });
        console.log("Connected to DB.");

        // Find the event
        const events = (await import('./src/models/Event.js')).Event; // Dynamic import if possible or just schema
        // Since I don't have Event model easily imported here (ESM issues maybe), let's just query leaders directly and guess eventId from them, or just filter all leaders.

        // User said "cada evento muestre su respectivo lider".
        // I will group by eventId.

        const leaders = await Leader.find().sort({ eventId: 1, name: 1 });
        console.log(`Total leaders in DB (all events): ${leaders.length}`);

        // Group by eventId
        const leadersByEvent = {};
        leaders.forEach(l => {
            const eid = l.eventId || 'NO_EVENT';
            if (!leadersByEvent[eid]) leadersByEvent[eid] = [];
            leadersByEvent[eid].push(l);
        });

        const isNA = (email) => !email || email.toLowerCase() === 'na' || email.toLowerCase() === 'n/a';
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        for (const [eid, group] of Object.entries(leadersByEvent)) {
            console.log(`\n--- Event ID: ${eid} (${group.length} leaders) ---`);
            let keptCount = 0;

            group.forEach(a => {
                const aIsBad = isNA(a.email);
                const aName = normalize(a.name).trim(); // Trim!
                const aTokens = aName.split(/\s+/);

                if (aTokens[0] === "fanid") {
                    // Debug Fanid specifically
                    // console.log(`DEBUG FANID: "${a.name}" tokens:`, aTokens);
                }

                let isDuplicate = false;
                let duplicateOf = null;

                for (const b of group) {
                    if (a._id.equals(b._id)) continue;

                    const bIsBad = isNA(b.email);
                    const bName = normalize(b.name).trim(); // Trim!
                    const bTokens = bName.split(/\s+/);

                    // REQUIRE FIRST NAME MATCH
                    if (aTokens[0] !== bTokens[0]) continue;

                    // Case 1: A has NA/bad email, B has valid email
                    if (aIsBad && !bIsBad) {
                        if (aTokens.every(t => bTokens.includes(t))) {
                            isDuplicate = true;
                            duplicateOf = b;
                            break;
                        }
                    }

                    // Case 2: Both same email status
                    if (aIsBad === bIsBad) {
                        // Strict subset check
                        if (aTokens.length < bTokens.length) {
                            if (aTokens.every(t => bTokens.includes(t))) {
                                isDuplicate = true;
                                duplicateOf = b;
                                break;
                            }
                        }
                        if (aName === bName && a._id > b._id) {
                            isDuplicate = true;
                            duplicateOf = b;
                            break;
                        }
                    }
                }

                if (isDuplicate) {
                    console.log(`❌ HIDDEN: "${a.name}" (${a.email || 'NA'})`);
                    console.log(`   -> Because of: "${duplicateOf.name}" (${duplicateOf.email || 'NA'})\n`);
                } else {
                    console.log(`✅ KEPT: "${a.name}" (${a.email || 'NA'})`);
                    keptCount++;
                }
            });

            console.log(`Final count for event ${eid}: ${keptCount}`);
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debugDedup();
