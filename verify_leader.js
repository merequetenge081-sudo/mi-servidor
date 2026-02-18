
import mongoose from 'mongoose';
import dns from 'dns';
import { Leader } from './src/models/Leader.js';
import "dotenv/config";

// Fix IPv6 issue
dns.setDefaultResultOrder("ipv4first");

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";
const LEADER_ID_TO_CHECK = "690f99b2ee9dedbe5de6b94c";

async function verify() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URL, { family: 4 });
        console.log("Connected.");

        console.log(`Checking for leader with ID: ${LEADER_ID_TO_CHECK}`);

        // Check by _id
        let leaderById = null;
        if (mongoose.Types.ObjectId.isValid(LEADER_ID_TO_CHECK)) {
            leaderById = await Leader.findById(LEADER_ID_TO_CHECK);
        }

        // Check by leaderId
        const leaderByCustomId = await Leader.findOne({ leaderId: LEADER_ID_TO_CHECK });

        if (leaderById) {
            console.log("✅ FOUND by _id:");
            console.log(`   Name: ${leaderById.name}`);
            console.log(`   _id: ${leaderById._id}`);
            console.log(`   leaderId: ${leaderById.leaderId}`);
        } else {
            console.log("❌ NOT FOUND by _id");
        }

        if (leaderByCustomId) {
            console.log("✅ FOUND by custom leaderId:");
            console.log(`   Name: ${leaderByCustomId.name}`);
        } else {
            console.log("❌ NOT FOUND by custom leaderId");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

verify();
