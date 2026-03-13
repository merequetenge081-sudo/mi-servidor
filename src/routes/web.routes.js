import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, "../../public");

const router = express.Router();

router.get("/", (req, res) => {
  res.sendFile(join(publicDir, "index.html"));
});

router.get("/login", (req, res) => {
  res.sendFile(join(publicDir, "index.html"));
});

router.get("/dashboard.html", (req, res) => {
  res.sendFile(join(publicDir, "dashboard.html"));
});

router.get("/form", (req, res) => {
  res.sendFile(join(publicDir, "form.html"));
});

router.get("/registration/:token", (req, res) => {
  res.sendFile(join(publicDir, "form.html"));
});

router.get("/app", (req, res) => {
  res.redirect("/dashboard.html");
});

router.get("/leader", (req, res) => {
  res.sendFile(join(publicDir, "leader.html"));
});

export default router;

