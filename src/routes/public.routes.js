import express from "express";
import * as leaderController from "../controllers/leaders.controller.js";

const router = express.Router();

router.get("/registro/:token", leaderController.getLeaderByToken);

export default router;

