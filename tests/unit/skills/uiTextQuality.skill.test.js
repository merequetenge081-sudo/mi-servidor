import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  detectMojibakeIssues,
  detectSpellingIssues,
  runUiTextQualitySkill
} from "../../../src/backend/skills/uiTextQuality.skill.js";

describe("uiTextQuality.skill", () => {
  test("detects mojibake patterns", () => {
    const text = "Panel Pol\u00C3\u00ADtica y campa\u00C3\u00B1a activa";
    const issues = detectMojibakeIssues(text, "public/dashboard.html");
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.issueType === "encoding")).toBe(true);
  });

  test("detects common spelling/accent issues", () => {
    const text = "politica lider campanas contrasena analisis";
    const issues = detectSpellingIssues(text, "public/index.html");
    expect(issues.length).toBeGreaterThanOrEqual(5);
    expect(issues.every((i) => i.issueType === "spelling")).toBe(true);
  });

  test("generates resultSummary from frontend files", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ui-quality-"));
    const publicDir = path.join(tempRoot, "public");
    await fs.mkdir(publicDir, { recursive: true });
    await fs.mkdir(path.join(publicDir, "js"), { recursive: true });

    await fs.writeFile(
      path.join(publicDir, "dashboard.html"),
      "<html><head></head><body>Pol\u00C3\u00ADtica politica <button>INGRESAR</button></body></html>",
      "utf8"
    );
    await fs.writeFile(
      path.join(publicDir, "index.html"),
      "<html><head><meta charset=\"UTF-8\"></head><body>correo iniciar sesion politica</body></html>",
      "utf8"
    );
    await fs.writeFile(
      path.join(publicDir, "js", "ui.js"),
      "const a='Guardar cambios'; const b='Guardar cambios'; const c='Guardar cambios';",
      "utf8"
    );

    const result = await runUiTextQualitySkill({ rootDir: tempRoot });
    expect(result).toHaveProperty("filesAnalyzed");
    expect(result).toHaveProperty("mojibakeIssues");
    expect(result).toHaveProperty("spellingIssues");
    expect(result).toHaveProperty("consistencyIssues");
    expect(result).toHaveProperty("repeatedStrings");
    expect(result).toHaveProperty("topProblems");
    expect(result.filesAnalyzed).toBeGreaterThan(0);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});