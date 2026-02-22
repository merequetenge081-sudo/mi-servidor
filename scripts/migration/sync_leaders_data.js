
import mongoose from 'mongoose';
import dns from 'dns';
import { Leader } from './src/models/Leader.js';
import { Admin } from './src/models/Admin.js';
import "dotenv/config";
import crypto from 'crypto';

dns.setDefaultResultOrder("ipv4first");
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";

async function syncLeaderData() {
    try {
        console.log("Connecting...");
        await mongoose.connect(MONGO_URL, { family: 4 });

        // FETCH DEFAULT ORG ID from an Admin
        let defaultOrgId = null;
        try {
            const admin = await Admin.findOne();
            if (admin && admin.organizationId) {
                defaultOrgId = admin.organizationId;
                console.log(`Using Default Org ID from Admin: ${defaultOrgId}`);
            } else {
                defaultOrgId = new mongoose.Types.ObjectId().toString();
                console.log(`Generated temporary Org ID (No Admin found): ${defaultOrgId}`);
            }
        } catch (e) {
            defaultOrgId = new mongoose.Types.ObjectId().toString();
            console.log(`Error fetching Admin, generated temporary Org ID: ${defaultOrgId}`);
        }

        // Find all leaders
        const leaders = await Leader.find().sort({ name: 1 });
        console.log(`Checking ${leaders.length} leaders for matches...`);

        const isNA = (str) => !str || str.toLowerCase() === 'na' || str.toLowerCase() === 'n/a' || str.trim() === '';
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        let updatedCount = 0;

        const incompleteLeaders = leaders.filter(l => isNA(l.email) || isNA(l.phone));
        console.log(`Found ${incompleteLeaders.length} leaders with missing email/phone.`);

        const completeLeaders = leaders.filter(l => !isNA(l.email));

        for (const target of incompleteLeaders) {
            const targetName = normalize(target.name);
            const targetTokens = targetName.split(/\s+/);

            const source = completeLeaders.find(s => {
                if (s._id.equals(target._id)) return false;
                if (s.eventId === target.eventId) return false;

                const sourceName = normalize(s.name);
                const sourceTokens = sourceName.split(/\s+/);

                if (targetTokens[0] !== sourceTokens[0]) return false;

                if (targetTokens.every(t => sourceTokens.includes(t))) return true;
                if (sourceTokens.every(t => targetTokens.includes(t))) return true;

                return false;
            });

            let changes = false;

            // --- FIX MISSING REQUIRED FIELDS ---
            if (!target.token) {
                target.token = crypto.randomBytes(16).toString("hex");
                changes = true;
            }

            // Fix Org ID
            if (!target.organizationId) {
                if (source && source.organizationId) {
                    target.organizationId = source.organizationId;
                } else {
                    target.organizationId = defaultOrgId;
                }
                changes = true;
            }

            // Fix LeaderId
            if (!target.leaderId) {
                target.leaderId = target._id.toString();
                changes = true;
            }

            // --- SYNC DATA ---
            if (source) {
                if (isNA(target.email) && !isNA(source.email)) {
                    console.log(`[UPDATE] ${target.name} (Event: ${target.eventId}) sets EMAIL from ${source.name} (Event: ${source.eventId})`);
                    console.log(`         New Email: ${source.email}`);
                    target.email = source.email;
                    changes = true;
                }

                if (isNA(target.phone) && !isNA(source.phone)) {
                    console.log(`[UPDATE] ${target.name} sets PHONE from ${source.name}`);
                    console.log(`         New Phone: ${source.phone}`);
                    target.phone = source.phone;
                    changes = true;
                }
            }

            if (changes) {
                try {
                    await target.save();
                    updatedCount++;
                } catch (err) {
                    console.error(`Failed to save ${target.name}:`, err.message);
                    // Try logging validation errors detail if possible
                    if (err.errors) {
                        Object.keys(err.errors).forEach(key => {
                            console.error(`  -> ${key}: ${err.errors[key].message}`);
                        });
                    }
                }
            }
        }

        console.log(`\nSync complete. Updated ${updatedCount} leaders.`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

syncLeaderData();
