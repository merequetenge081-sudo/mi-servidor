import { Event } from "../models/Event.js";
import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";

export async function getStats(req, res) {
  try {
    const { eventId } = req.query;

    const totalRegistrations = await Registration.countDocuments(eventId ? { eventId } : {});
    const totalConfirmed = await Registration.countDocuments(eventId ? { eventId, confirmed: true } : { confirmed: true });
    const totalLeaders = await Leader.countDocuments({ active: true });
    const totalEvents = await Event.countDocuments({ active: true });

    const registeredToVote = await Registration.countDocuments(
      eventId
        ? { eventId, registeredToVote: true }
        : { registeredToVote: true }
    );

    const stats = {
      totalRegistrations,
      totalConfirmed,
      confirmationRate: totalRegistrations > 0 ? ((totalConfirmed / totalRegistrations) * 100).toFixed(2) : 0,
      totalLeaders,
      totalEvents,
      registeredToVote,
      notRegisteredToVote: totalRegistrations - registeredToVote
    };

    res.json(stats);
  } catch (error) {
    console.error("Get stats error:", error.message);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
}

export async function getDailyStats(req, res) {
  try {
    const { eventId } = req.query;

    const match = eventId ? { eventId } : {};

    const dailyStats = await Registration.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $substr: ["$date", 0, 10] },
          count: { $sum: 1 },
          confirmed: {
            $sum: { $cond: ["$confirmed", 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(dailyStats);
  } catch (error) {
    console.error("Get daily stats error:", error.message);
    res.status(500).json({ error: "Error al obtener estadísticas diarias" });
  }
}
