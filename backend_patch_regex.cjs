const fs = require('fs');

let ctrl = fs.readFileSync('src/backend/modules/analytics/analytics.controller.js', 'utf8');

const ctrlRegex = /const { eventId, status } = req\.query;\s*logger\.info\('Advanced analytics request', { eventId, status }\);\s*const data = await advancedService\.getAdvancedAnalytics\(eventId, status\);/;

if (ctrlRegex.test(ctrl)) {
    ctrl = ctrl.replace(ctrlRegex, `const { eventId, status, leaderId } = req.query;
    logger.info('Advanced analytics request', { eventId, status, leaderId });

    const data = await advancedService.getAdvancedAnalytics(eventId, status, leaderId);`);
    fs.writeFileSync('src/backend/modules/analytics/analytics.controller.js', ctrl, 'utf8');
    console.log('Controller patched successfully.');
}

let svc = fs.readFileSync('src/backend/modules/analytics/advanced.service.js', 'utf8');

const svcRegex = /export async function getAdvancedAnalytics\(eventId = null, status = 'all'\) \{\s*try \{\s*const matchQuery = eventId \? \{ eventId \} : \{\};/;

if (svcRegex.test(svc)) {
    svc = svc.replace(svcRegex, `export async function getAdvancedAnalytics(eventId = null, status = 'all', leaderId = null) {
    try {
      const matchQuery = eventId ? { eventId } : {};

      if (leaderId) {
          matchQuery.leaderId = leaderId;
      }`);
    fs.writeFileSync('src/backend/modules/analytics/advanced.service.js', svc, 'utf8');
    console.log('Service patched successfully.');
}
