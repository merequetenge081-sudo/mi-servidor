#!/usr/bin/env node
// Simple generator: convert GeoJSON polygons into an SVG with paths per feature
// Usage: node tools/generate_svg_from_geojson.cjs

const fs = require('fs');
const path = require('path');

const inFile = path.join(__dirname, '..', 'bogota_localidades.geojson');
const outFile = path.join(__dirname, '..', 'bogota_croquis_auto.svg');

function norm(s){ return String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim(); }

function ensureDir(p){ if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function geomToPaths(features, width, height, padding){
    // compute bbox of all coordinates (lon,lat)
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    features.forEach(f => {
        const geom = f.geometry;
        if (!geom) return;
        const coords = (geom.type === 'Polygon') ? [geom.coordinates] : (geom.type === 'MultiPolygon') ? geom.coordinates : [];
        coords.forEach(rings => {
            rings.forEach(ring => {
                ring.forEach(pt => {
                    const x = pt[0]; const y = pt[1];
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                });
            });
        });
    });
    if (!isFinite(minX)) return '';
    // expand bbox a little
    const padFactor = 0.02; // 2%
    const dx = (maxX - minX) || 0.01;
    const dy = (maxY - minY) || 0.01;
    minX -= dx*padFactor; maxX += dx*padFactor; minY -= dy*padFactor; maxY += dy*padFactor;

    // mapping functions: lon->x, lat->y (invert y so north is up)
    const lonToX = lon => padding + ((lon - minX) / (maxX - minX)) * (width - 2*padding);
    const latToY = lat => padding + ((maxY - lat) / (maxY - minY)) * (height - 2*padding);

    let paths = '';
    features.forEach((f, idx) => {
        const geom = f.geometry;
        if (!geom) return;
        const coords = (geom.type === 'Polygon') ? [geom.coordinates] : (geom.type === 'MultiPolygon') ? geom.coordinates : [];
        const name = f.properties && (f.properties.NOMBRE || f.properties.name || f.properties.NOM || f.properties.NOM_LOC || f.properties.LOCALIDAD) || ('localidad_' + idx);
        const dataName = String(name).trim();
        let pathD = '';
        coords.forEach(rings => {
            rings.forEach(ring => {
                ring.forEach((pt, i) => {
                    const x = lonToX(pt[0]); const y = latToY(pt[1]);
                    pathD += (i===0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
                });
                pathD += 'Z ';
            });
        });
        const id = 'loc-' + idx;
        paths += `<path id="${id}" data-name="${dataName}" data-name-norm="${norm(dataName)}" d="${pathD.trim()}" />\n`;
    });

    return paths;
}

function main(){
    if (!fs.existsSync(inFile)){
        console.error('GeoJSON input not found:', inFile);
        process.exit(1);
    }
    const txt = fs.readFileSync(inFile, 'utf8');
    let geo;
    try { geo = JSON.parse(txt); } catch(e){ console.error('Invalid GeoJSON:', e); process.exit(1); }
    const features = geo.features || [];
    const width = 1200; const height = 800; const padding = 16;
    const svgPaths = geomToPaths(features, width, height, padding);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n`+
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" id="bogota_croquis_auto">\n`+
        `<style>path{fill:#eee;stroke:#ffffff;stroke-width:1.5px;cursor:pointer;}path:hover{filter:brightness(0.9);}#legend{font-family:Arial,Helvetica,sans-serif;font-size:12px}</style>\n`+
        `${svgPaths}`+
        `</svg>`;

    // backup existing auto svg if any
    if (fs.existsSync(outFile)){
        fs.copyFileSync(outFile, outFile + '.bak');
    }

    fs.writeFileSync(outFile, svg, 'utf8');
    console.log('Wrote', outFile);
}

main();
