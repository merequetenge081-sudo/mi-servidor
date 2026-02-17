import { Registration } from "../models/Registration.js";

export async function getDuplicates(req, res) {
  try {
    const { eventId } = req.query;

    const match = eventId ? { eventId } : {};

    const duplicates = await Registration.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$cedula",
          count: { $sum: 1 },
          eventId: { $first: "$eventId" },
          records: { $push: "$$ROOT" }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const result = [];
    for (const dup of duplicates) {
      const registrations = await Registration.find({ cedula: dup._id, eventId: dup.eventId });
      result.push({
        cedula: dup._id,
        count: dup.count,
        registrations
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Get duplicates error:", error.message);
    res.status(500).json({ error: "Error al obtener duplicados" });
  }
}
