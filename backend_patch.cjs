const fs = require('fs');

// 1. UPDATE CONTROLLER
let ctrl = fs.readFileSync('src/backend/modules/analytics/analytics.controller.js', 'utf8');
const oldCtrl = `export async function getAdvanced(req, res, next) {
  try {
    const { eventId, status } = req.query;
    logger.info('Advanced analytics request', { eventId, status });

    const data = await advancedService.getAdvancedAnalytics(eventId, status);`;
const newCtrl = `export async function getAdvanced(req, res, next) {
  try {
    const { eventId, status, leaderId } = req.query;
    logger.info('Advanced analytics request', { eventId, status, leaderId });

    const data = await advancedService.getAdvancedAnalytics(eventId, status, leaderId);`;

if (ctrl.includes('export async function getAdvanced(req, res, next) {')) {
    ctrl = ctrl.replace(oldCtrl, newCtrl);
    fs.writeFileSync('src/backend/modules/analytics/analytics.controller.js', ctrl, 'utf8');
    console.log('Controller updated');
}

// 2. UPDATE SERVICE
let svc = fs.readFileSync('src/backend/modules/analytics/advanced.service.js', 'utf8');
const oldSvc = `export async function getAdvancedAnalytics(eventId = null, status = 'all') {
  try {
    const matchQuery = eventId ? { eventId } : {};

    if (status === 'confirmed') {
      matchQuery.puestoId = { $ne: null };
    } else if (status === 'unconfirmed') {
      matchQuery.puestoId = null;
    }`;
const newSvc = `export async function getAdvancedAnalytics(eventId = null, status = 'all', leaderId = null) {
  try {
    const matchQuery = eventId ? { eventId } : {};

    if (leaderId) {
      matchQuery.leaderId = leaderId;
    }

    if (status === 'confirmed') {
      matchQuery.puestoId = { $ne: null };
    } else if (status === 'unconfirmed') {
      matchQuery.puestoId = null;
    }`;

if (svc.includes('export async function getAdvancedAnalytics')) {
    svc = svc.replace(oldSvc, newSvc);
    fs.writeFileSync('src/backend/modules/analytics/advanced.service.js', svc, 'utf8');
    console.log('Service updated');
}
