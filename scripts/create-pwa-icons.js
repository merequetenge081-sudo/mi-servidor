#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const iconsDir = path.join(__dirname, "public", "assets", "icons");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#0d6efd");
  gradient.addColorStop(1, "#0a58ca");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "white";
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PA", size / 2, size / 2);

  return canvas;
}

async function saveIcon(canvas, filename) {
  const buffer = canvas.toBuffer("image/png");
  const filepath = path.join(iconsDir, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`✅ Creado: ${filepath}`);
}

async function main() {
  console.log("🎨 Generando iconos PWA...\n");

  try {
    const canvas192 = generateIcon(192);
    const canvas512 = generateIcon(512);
    const canvasMaskable = generateIcon(512);

    await saveIcon(canvas192, "icon-192.png");
    await saveIcon(canvas512, "icon-512.png");
    await saveIcon(canvasMaskable, "maskable-icon.png");

    console.log(
      "\n✨ Imágenes creadas exitosamente en public/assets/icons/"
    );
    console.log("   (Reemplaza con tus propias imágenes si lo deseas)");
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.log(
      "\nNota: Este script requiere 'canvas' instalado:"
    );
    console.log("   npm install canvas");
  }
}

main();
