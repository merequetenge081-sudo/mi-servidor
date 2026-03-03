const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/backend/modules/exports/exports.service.js');
let code = fs.readFileSync(file, 'utf8');

const regex = /export async function generateReportPDF[\s\S]*?^}/m;
const match = code.match(regex);

if (!match) {
    console.error("No se pudo encontrar generateReportPDF");
    process.exit(1);
}

const replacement = `export async function generateReportPDF(eventId = null) {
  try {
    logger.info('Preparando PDF report avanzado', { eventId });

    // Call real existing methods
    const dashboard = await analyticsService.getDashboardSummary(eventId);
    const leaderPerf = await advancedService.getLeaderPerformance(eventId);

    const summary = dashboard?.summary || {};
    const totalLeaders = summary.uniqueLeaders || 0;
    const totalRegistrations = summary.totalRegistrations || 0;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        doc.font('Helvetica');

        // Document Header
        doc.fontSize(22).fillColor('#2c3e50').text('Informe Analítico Avanzado', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(10).fillColor('#7f8c8d').text(\`Generado: \${new Date().toLocaleString()}\`, { align: 'right' });
        doc.moveDown(1.5);

        // --- SECTION 1: GLOBAL SUMMARY ---
        doc.fontSize(16).fillColor('#e74c3c').text('1. Resumen General Constitucional');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e74c3c').stroke();
        doc.moveDown(0.5);
        
        doc.fontSize(12).fillColor('#34495e');
        doc.text(\`Total Líderes Activos: \${totalLeaders}\`);
        doc.text(\`Total Registros Captados: \${totalRegistrations}\`);
        doc.moveDown(2);

        // --- SECTION 2: TOP LEADER PERFORMANCE ---
        doc.fontSize(16).fillColor('#27ae60').text('2. Cuadro de Honor y Rendimiento de Líderes');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#27ae60').stroke();
        doc.moveDown(0.5);
        
        if (leaderPerf && leaderPerf.length > 0) {
          const topLeaders = leaderPerf.slice(0, 10);
          
          topLeaders.forEach((leader, index) => {
            const leaderName = (leader.leaderData && leader.leaderData.name) ? leader.leaderData.name : (leader.leaderName || 'No Identificado');
            const totalReg = leader.totalRegistrations || 0;
            const netEffectiveness = leader.efectividadNeta ? leader.efectividadNeta.toFixed(2) : '0.00';
            const penalty = leader.penaltyScore || 0;
            
            doc.fontSize(12).fillColor('#34495e').text(\`\${index + 1}. \${leaderName}\`, { continued: false });
            doc.fontSize(10).fillColor('#7f8c8d')
               .text(\`   Registros Exitosos: \${totalReg} | Efectividad Ponderada: \${netEffectiveness}%\`);
            doc.text(\`   Inconsistencias y Errores (Penalizaciones): \${penalty}\`);
            doc.moveDown(0.5);
          });
        } else {
          doc.fontSize(11).text('Datos de desempeño aún inaccesibles para el periodo seleccionado.', { font: 'Helvetica-Oblique' });
        }
        
        doc.moveDown(3);
        doc.fontSize(10).fillColor('#bdc3c7').text('--- Fin del Reporte ---', { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

  } catch (error) {
    logger.error('Error generando Reporte PDF Backend', error);
    throw AppError.serverError('Error al generar PDF en el servidor');
  }
}`;

code = code.replace(regex, replacement);
fs.writeFileSync(file, code, 'utf8');
console.log('PDF logic fixed!');
