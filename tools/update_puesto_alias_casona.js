import "dotenv/config";
import mongoose from "mongoose";
import { Puestos } from "../src/models/Puestos.js";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";

async function main() {
  await mongoose.connect(MONGO_URL);

  const localidad = "Ciudad Bolívar";
  const nombreActual = "Facultad Tecnológica Universidad Distrital";
  const nombreNuevo = "Casona del Libertador - Facultad Tecnológica Universidad Distrital";

  const puesto = await Puestos.findOne({ localidad, nombre: nombreActual });
  if (!puesto) {
    console.log("No se encontro el puesto objetivo. Revisa el nombre en la DB.");
    await mongoose.disconnect();
    return;
  }

  if (puesto.nombre === nombreNuevo) {
    console.log("El puesto ya tiene el nombre actualizado.");
    await mongoose.disconnect();
    return;
  }

  puesto.nombre = nombreNuevo;
  puesto.updatedAt = new Date();
  await puesto.save();

  console.log("Actualizado:", puesto._id.toString(), "->", puesto.nombre);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Error al actualizar alias:", error);
  process.exit(1);
});
