import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  date: String,
  location: String,
  active: { type: Boolean, default: true },
  registrationCount: { type: Number, default: 0 },
  confirmedCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Event = mongoose.model("Event", eventSchema);
