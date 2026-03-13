const MOJIBAKE_REPLACEMENTS = [
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã", "Á"],
  ["Ã‰", "É"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã±", "ñ"],
  ["Ã‘", "Ñ"],
  ["Ã¼", "ü"],
  ["Ãœ", "Ü"],
  ["â€œ", "\""],
  ["â€", "\""],
  ["â€˜", "'"],
  ["â€™", "'"],
  ["â€“", "-"],
  ["â€”", "-"],
  ["Â", ""],
  ["\uFFFD", ""]
];

function countArtifacts(value = "") {
  return (String(value).match(/[ÃÂâ\uFFFD]/g) || []).length;
}

export function repairTextEncoding(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);

  if (/Ã|Â|â|\uFFFD/.test(text) && typeof Buffer !== "undefined") {
    try {
      const decoded = Buffer.from(text, "latin1").toString("utf8");
      if (decoded && countArtifacts(decoded) < countArtifacts(text)) {
        text = decoded;
      }
    } catch (_) {
      // Ignore failed speculative decoding and continue with static repairs.
    }
  }

  for (const [find, replacement] of MOJIBAKE_REPLACEMENTS) {
    text = text.split(find).join(replacement);
  }

  return text
    .replace(/[“”«»]/g, "\"")
    .replace(/[‘’´`]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return repairTextEncoding(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function buildTextSkeleton(value) {
  return normalizeText(value).replace(/[^A-Z0-9]+/g, "");
}

export function normalizeMesaNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : null;
}
