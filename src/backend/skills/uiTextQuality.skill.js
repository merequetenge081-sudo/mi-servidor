import fs from "fs/promises";
import path from "path";

const TARGET_FRONTEND_DIRS = ["public"];
const TARGET_EXTENSIONS = new Set([".html", ".js"]);
const MAX_FILE_BYTES = 1024 * 512;

const MOJIBAKE_FIXES = [
  ["\u00C3\u00A1", "\u00E1"],
  ["\u00C3\u00A9", "\u00E9"],
  ["\u00C3\u00AD", "\u00ED"],
  ["\u00C3\u00B3", "\u00F3"],
  ["\u00C3\u00BA", "\u00FA"],
  ["\u00C3\u0081", "\u00C1"],
  ["\u00C3\u0089", "\u00C9"],
  ["\u00C3\u008D", "\u00CD"],
  ["\u00C3\u0093", "\u00D3"],
  ["\u00C3\u009A", "\u00DA"],
  ["\u00C3\u00B1", "\u00F1"],
  ["\u00C3\u0091", "\u00D1"],
  ["\u00C2\u00BF", "\u00BF"],
  ["\u00C2\u00A1", "\u00A1"],
  ["\u00C2", ""],
  ["\uFFFD", ""]
];

const SPELLING_RULES = [
  { wrong: /\bpolitica\b/gi, correct: "pol\u00EDtica" },
  { wrong: /\blider(es)?\b/gi, correct: "l\u00EDder(es)" },
  { wrong: /\bcampanas\b/gi, correct: "campa\u00F1as" },
  { wrong: /\bcontrasena\b/gi, correct: "contrase\u00F1a" },
  { wrong: /\banalisis\b/gi, correct: "an\u00E1lisis" },
  { wrong: /\bsesion\b/gi, correct: "sesi\u00F3n" }
];

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function detectMojibakeIssues(text, filePath = "") {
  const issues = [];
  const lines = String(text || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const [bad, good] of MOJIBAKE_FIXES) {
      if (!bad) continue;
      if (line.includes(bad)) {
        issues.push({
          file: filePath,
          line: i + 1,
          text: bad,
          issueType: "encoding",
          suggestedFix: good || "Revisar codificacion UTF-8"
        });
      }
    }
  }
  return issues;
}

export function detectSpellingIssues(text, filePath = "") {
  const issues = [];
  const lines = String(text || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of SPELLING_RULES) {
      const matches = line.match(rule.wrong) || [];
      for (const match of matches) {
        issues.push({
          file: filePath,
          line: i + 1,
          text: match,
          issueType: "spelling",
          suggestedFix: rule.correct
        });
      }
    }
  }
  return issues;
}

function extractUiTextLiterals(content, ext) {
  const values = [];
  const text = String(content || "");

  if (ext === ".html") {
    const chunks = text.match(/>([^<]{2,})</g) || [];
    for (const chunk of chunks) {
      const clean = normalizeWhitespace(chunk.slice(1, -1));
      if (clean.length >= 3) values.push(clean);
    }
  }

  const stringRegex = /(['"`])((?:\\.|(?!\1).){3,})\1/g;
  let match;
  while ((match = stringRegex.exec(text)) !== null) {
    const value = normalizeWhitespace(match[2]);
    if (value.length < 3) continue;
    if (/^https?:\/\//i.test(value)) continue;
    if (/^[a-z0-9_.\-/:]+$/i.test(value) && value.includes("/")) continue;
    values.push(value);
  }

  return values;
}

function detectUppercaseLabelIssues(content, filePath) {
  const issues = [];
  const lines = String(content || "").split(/\r?\n/);
  const pattern = />\s*([A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00D1 ]{8,})\s*</g;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const label = normalizeWhitespace(match[1]);
      issues.push({
        file: filePath,
        line: i + 1,
        text: label,
        issueType: "consistency",
        suggestedFix: "Evitar mayusculas sostenidas en labels y botones"
      });
    }
  }
  return issues;
}

async function walkFiles(dirPath, out) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await walkFiles(fullPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    out.push(fullPath);
  }
}

async function collectTargetFiles(rootDir) {
  const files = [];
  for (const relDir of TARGET_FRONTEND_DIRS) {
    const abs = path.join(rootDir, relDir);
    await walkFiles(abs, files);
  }

  return files.filter((absPath) => {
    const ext = path.extname(absPath).toLowerCase();
    if (!TARGET_EXTENSIONS.has(ext)) return false;
    const name = path.basename(absPath).toLowerCase();
    if (name.endsWith(".min.js")) return false;
    return true;
  });
}

function hasUtf8Meta(htmlText) {
  return /<meta\s+charset=["']?utf-?8["']?/i.test(htmlText || "");
}

export async function runUiTextQualitySkill({ rootDir = process.cwd() } = {}) {
  const warnings = [];
  const recommendations = [];
  const topProblems = [];
  const repeatedMap = new Map();
  const seenTokens = {
    email: false,
    correo: false,
    ingresar: false,
    iniciarSesion: false
  };

  let filesAnalyzed = 0;
  let mojibakeIssues = 0;
  let spellingIssues = 0;
  let consistencyIssues = 0;

  const targetFiles = await collectTargetFiles(rootDir);

  for (const absPath of targetFiles) {
    const relPath = path.relative(rootDir, absPath).replace(/\\/g, "/");
    try {
      const stat = await fs.stat(absPath);
      if (stat.size > MAX_FILE_BYTES) {
        warnings.push(`Archivo omitido por tamano: ${relPath}`);
        continue;
      }

      const content = await fs.readFile(absPath, "utf8");
      const ext = path.extname(absPath).toLowerCase();
      filesAnalyzed += 1;

      const encoding = detectMojibakeIssues(content, relPath);
      mojibakeIssues += encoding.length;
      topProblems.push(...encoding.slice(0, 6));

      const spelling = detectSpellingIssues(content, relPath);
      spellingIssues += spelling.length;
      topProblems.push(...spelling.slice(0, 6));

      const uppercase = detectUppercaseLabelIssues(content, relPath);
      consistencyIssues += uppercase.length;
      topProblems.push(...uppercase.slice(0, 4));

      const lower = content.toLowerCase();
      if (/\bemail\b/.test(lower)) seenTokens.email = true;
      if (/\bcorreo\b/.test(lower)) seenTokens.correo = true;
      if (/\bingresar\b/.test(lower)) seenTokens.ingresar = true;
      if (/iniciar\s+sesi[o\u00F3]n/.test(lower)) seenTokens.iniciarSesion = true;

      if (ext === ".html" && !hasUtf8Meta(content)) {
        consistencyIssues += 1;
        topProblems.push({
          file: relPath,
          text: "<meta charset>",
          issueType: "consistency",
          suggestedFix: 'Agregar <meta charset="UTF-8">'
        });
      }

      const literals = extractUiTextLiterals(content, ext);
      for (const literal of literals) {
        const key = literal.toLowerCase();
        const current = repeatedMap.get(key) || { value: literal, count: 0, files: new Set() };
        current.count += 1;
        current.files.add(relPath);
        repeatedMap.set(key, current);
      }
    } catch (error) {
      warnings.push(`No se pudo analizar ${relPath}: ${error.message}`);
    }
  }

  if (seenTokens.email && seenTokens.correo) {
    consistencyIssues += 1;
    topProblems.push({
      file: "multiple",
      text: "email / correo",
      issueType: "consistency",
      suggestedFix: "Unificar termino de contacto en toda la UI"
    });
    recommendations.push("Normalize UI copy: usar un solo termino para email/correo");
  }

  if (seenTokens.ingresar && seenTokens.iniciarSesion) {
    consistencyIssues += 1;
    topProblems.push({
      file: "multiple",
      text: "ingresar / iniciar sesion",
      issueType: "consistency",
      suggestedFix: "Unificar CTA principal de autenticacion"
    });
    recommendations.push("Normalize UI copy for login labels");
  }

  const repeatedStrings = Array.from(repeatedMap.values())
    .filter((item) => item.value.length >= 8 && item.count >= 3)
    .sort((a, b) => b.count - a.count);

  if (mojibakeIssues > 0) {
    recommendations.push("Ensure all frontend files use UTF-8 encoding");
    recommendations.push('Add <meta charset="UTF-8"> to root HTML if missing');
  }
  if (repeatedStrings.length > 0) {
    recommendations.push("Centralize repeated UI strings");
  }
  if (spellingIssues > 0) {
    recommendations.push("Estandarizar ortografia y acentuacion de textos visibles");
  }

  return {
    filesAnalyzed,
    mojibakeIssues,
    spellingIssues,
    consistencyIssues,
    repeatedStrings: repeatedStrings.length,
    topProblems: topProblems.slice(0, 25),
    recommendations: Array.from(new Set(recommendations)),
    warnings
  };
}

export default {
  runUiTextQualitySkill
};