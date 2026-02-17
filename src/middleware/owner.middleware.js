import { Leader } from "../models/Leader.js";

export async function ownerMiddleware(req, res, next) {
  try {
    if (req.user.role === "admin") {
      return next();
    }

    if (req.user.role === "leader") {
      const leaderId = req.params.leaderId;
      if (!leaderId) {
        return res.status(403).json({ error: "Acceso denegado" });
      }

      const leader = await Leader.findOne({ leaderId });
      if (!leader || leader._id.toString() !== req.user.userId) {
        return res.status(403).json({ error: "Acceso denegado" });
      }

      return next();
    }

    res.status(403).json({ error: "Acceso denegado" });
  } catch (error) {
    res.status(403).json({ error: "Acceso denegado" });
  }
}
