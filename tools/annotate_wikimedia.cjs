#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createSVGWindow } = require('svgdom');
const { SVG, registerWindow } = require('@svgdotjs/svg.js');

(async function main(){
  try {
    const svgPath = path.resolve(__dirname, '..', 'bogota_croquis_wikimedia.svg');
    if (!fs.existsSync(svgPath)) {
      console.error('SVG file not found:', svgPath);
      process.exit(1);
    }
    const svgText = fs.readFileSync(svgPath, 'utf8');

    const window = createSVGWindow();
    const document = window.document;
    registerWindow(window, document);

    const canvas = SVG(document.documentElement);
    canvas.svg(svgText);

    const numMap = {
      1: 'Usaquén', 2: 'Chapinero', 3: 'Santa Fe', 4: 'San Cristóbal', 5: 'Usme',
      6: 'Tunjuelito', 7: 'Bosa', 8: 'Kennedy', 9: 'Fontibón', 10: 'Engativá',
      11: 'Suba', 12: 'Barrios Unidos', 13: 'Teusaquillo', 14: 'Los Mártires',
      15: 'Antonio Nariño', 16: 'Puente Aranda', 17: 'La Candelaria', 18: 'Rafael Uribe',
      19: 'Ciudad Bolívar', 20: 'Sumapaz'
    };

    const texts = canvas.find('text').filter(t => /^\s*\d+\s*$/.test(t.text()));
    const candidateShapes = canvas.find('path, polygon, rect, circle');
    console.log('Found', texts.length, 'numbered text elements and', candidateShapes.length, 'candidate shapes');

    let assigned = 0;
    texts.forEach(t => {
      const txt = t.text().trim();
      const m = txt.match(/^(\d+)$/);
      if (!m) return;
      const n = Number(m[1]);
      const name = numMap[n];
      if (!name) return;

      // Hide the numeric label so the map shows names instead of numbers
      try {
        if (t.node && t.node.setAttribute) t.node.setAttribute('style', 'display:none');
      } catch(e) {}

      // Try same parent group
      try {
        const parent = t.node.parentNode;
        if (parent) {
          // find first shape child in the same group
          const children = Array.from(parent.childNodes || []);
          const shapeChild = children.find(c => c.nodeName && /path|polygon|rect|circle/i.test(c.nodeName));
          if (shapeChild) {
            if (shapeChild && shapeChild.setAttribute) {
              shapeChild.setAttribute('data-name', name);
              assigned++;
              return;
            }
          }
        }
      } catch (e) {}

      // otherwise, pick nearest by bbox center
      try {
        const tb = t.bbox();
        const tx = tb.x + tb.width/2;
        const ty = tb.y + tb.height/2;
        let best = null; let bestDist = Infinity;
        candidateShapes.forEach(s => {
          try {
            const b = s.bbox();
            const cx = b.x + b.width/2;
            const cy = b.y + b.height/2;
            const d = Math.hypot(cx - tx, cy - ty);
            if (d < bestDist) { bestDist = d; best = s; }
          } catch(e) {}
        });
        if (best && bestDist < 300) {
          best.attr('data-name', name);
          assigned++;
        }
      } catch (e) { }
    });

    if (assigned > 0) {
      // serialize and write back
      const out = canvas.svg();
      fs.writeFileSync(svgPath, out, 'utf8');
      console.log('Assigned', assigned, 'data-name attributes and wrote', svgPath);
    } else {
      console.log('No assignments made');
    }

  } catch (err) {
    console.error('Error annotating SVG:', err);
    process.exit(1);
  }
})();
