import skillsService from "./skills.service.js";

export async function runSkill(req, res, next) {
  try {
    const { skillName, payload = {} } = req.body || {};
    if (!skillName) {
      return res.status(400).json({ success: false, error: "skillName es requerido" });
    }

    const result = await skillsService.executeSkillJob({
      skillName,
      organizationId: req.user?.organizationId || payload.organizationId || "default",
      createdBy: req.user?.username || req.user?.id || "system",
      payload
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getJob(req, res, next) {
  try {
    const { jobId } = req.params;
    const job = await skillsService.getSkillJobDetail(jobId);
    if (!job) return res.status(404).json({ success: false, error: "Job no encontrado" });
    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
}

export async function listJobs(req, res, next) {
  try {
    const jobs = await skillsService.getSkillJobs(
      req.user?.organizationId || null,
      Number(req.query.limit) || 50
    );
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
}

export async function getCatalog(req, res, next) {
  try {
    res.json({ success: true, data: skillsService.getSupportedSkills() });
  } catch (error) {
    next(error);
  }
}

export async function getHealth(req, res, next) {
  try {
    const eventId = req.query.eventId || null;
    const data = await skillsService.getDataHealthSnapshot({
      organizationId: req.user?.organizationId || "default",
      eventId
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getInconsistencies(req, res, next) {
  try {
    const data = await skillsService.listInconsistencies({
      organizationId: req.user?.organizationId || "default",
      eventId: req.query.eventId || null,
      status: req.query.status || "open",
      flagType: req.query.flagType || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export default {
  runSkill,
  getJob,
  listJobs,
  getCatalog,
  getHealth,
  getInconsistencies
};
