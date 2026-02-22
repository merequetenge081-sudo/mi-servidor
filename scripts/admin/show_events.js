
import mongoose from 'mongoose';
import dns from 'dns';
import "dotenv/config";

// Quick schema
const eventSchema = new mongoose.Schema({ name: String }, { strict: false });
const Event = mongoose.model("Event", eventSchema);

dns.setDefaultResultOrder("ipv4first");
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";

async function showEvents() {
    try {
        await mongoose.connect(MONGO_URL, { family: 4 });
        const events = await Event.find();
        console.log("EVENTS:");
        events.forEach(e => console.log(`- ID: ${e._id} | Name: "${e.name}"`));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

showEvents();
