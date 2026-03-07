import { Router } from "express";
import { Registration } from "../models/Registration.js";
const router = Router();
router.get("/", async (req, res) => {
  const data = await Registration.aggregate([
    {
      $lookup: {
        from: "puestos",
        localField: "puestoId",
        foreignField: "_id",
        as: "puesto"
      }
    },
    { $addFields: { puesto: { $arrayElemAt: ["$puesto", 0] } } },
    {
      $group: {
        _id: {
          departamento: "$departamento",
          localidad: "$localidad",
          puestoDepto: "$puesto.departamento",
          puestoCiudad: "$puesto.ciudad",
          puestoLoc: "$puesto.localidad"
        },
        count: { $sum: 1 }
      }
    }
  ]);
  res.json(data);
});
export default router;