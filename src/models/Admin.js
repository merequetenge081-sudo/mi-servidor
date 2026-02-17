import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Admin = mongoose.model("Admin", adminSchema);

