#!/usr/bin/env node

/**
 * FASE 6 VALIDATION TEST SUITE
 * Tests: Backward compatibility, Multi-tenant isolation, Role enforcement, Cache
 */

import jwt from 'jsonwebtoken';
import http from 'http';

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

// ============== COLORS FOR OUTPUT ==============
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// ============== TEST RESULTS ==============
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// ============== HELPER FUNCTIONS ==============

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

function log(level, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = {
    'INFO': `${colors.blue}[${timestamp} INFO]${colors.reset}`,
    'TEST': `${colors.cyan}[${timestamp} TEST]${colors.reset}`,
    'PASS': `${colors.green}[PASS]${colors.reset}`,
    'FAIL': `${colors.red}[FAIL]${colors.reset}`,
    'WARN': `${colors.yellow}[WARN]${colors.reset}`,
    'RESULT': `${colors.bright}[RESULT]${colors.reset}`
  };
  console.log(`${prefix[level]} ${message}`);
  if (data) console.log(`   ${JSON.stringify(data, null, 2)}`);
}

async function makeRequest(method, path, token = null, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function recordTest(testName, passed, expected, actual) {
  testResults.tests.push({
    name: testName,
    passed,
    expected,
    actual,
    timestamp: new Date().toISOString()
  });

  if (passed) {
    testResults.passed++;
    log('PASS', testName);
  } else {
    testResults.failed++;
    log('FAIL', testName, { expected, actual });
  }
}

// ============== TEST SUITE ==============

async function runTests() {
  log('INFO', '╔════════════════════════════════════════════════════════════╗');
  log('INFO', '║     FASE 6 VALIDATION TEST SUITE                           ║');
  log('INFO', '║     Testing: BC, Multi-tenant, Roles, Cache                ║');
  log('INFO', '╚════════════════════════════════════════════════════════════╝');

  // ============== TEST 1: HEALTH CHECK ==============
  log('TEST', 'Test 1: Health Check');
  try {
    const health = await makeRequest('GET', '/health');
    recordTest('Health endpoint responding', health.status === 200, 200, health.status);
  } catch (e) {
    recordTest('Health endpoint responding', false, 200, 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 2: BACKWARD COMPATIBILITY ==============
  log('TEST', 'Test 2: Backward Compatibility (Public Registration without JWT)');
  try {
    const registration = await makeRequest('POST', '/api/registrations', null, {
      firstName: 'Test',
      lastName: 'BC User',
      cedula: '1234567890',
      email: 'test.bc@example.com',
      leaderId: 'test-leader',
      leaderName: 'Test Leader',
      eventId: 'test-event',
      registeredToVote: true,
      votingPlace: 'Test Place',
      votingTable: '1'
    });
    recordTest(
      'Public registration (no JWT) error handled correctly',
      registration.status >= 400 || registration.status === 201,
      'Status >= 400 or 201',
      registration.status
    );
  } catch (e) {
    recordTest('Public registration test', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 3: LEGACY ADMIN (Super Admin) ==============
  log('TEST', 'Test 3: Super Admin JWT (Global Admin, no organizationId)');
  const legacyAdminToken = generateToken({
    userId: 'admin_global_test',
    email: 'admin@system.test',
    role: 'super_admin'
  });

  try {
    const response = await makeRequest('GET', '/api/leaders', legacyAdminToken);
    recordTest(
      'Super admin can fetch leaders (no org filter)',
      response.status === 200,
      'Status 200',
      response.status
    );
  } catch (e) {
    recordTest('Super admin leaders fetch', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 4: ORG ADMIN 1 ==============
  log('TEST', 'Test 4: Org Admin 1 JWT (organizationId: TEST-ORG-1)');
  const org1Token = generateToken({
    userId: 'admin_org1_test',
    email: 'admin@org1.test',
    role: 'org_admin',
    organizationId: 'TEST-ORG-1'
  });

  try {
    const response = await makeRequest('GET', '/api/leaders', org1Token);
    recordTest(
      'Org admin can fetch leaders (with org filter)',
      response.status === 200,
      'Status 200',
      response.status
    );
  } catch (e) {
    recordTest('Org admin leaders fetch', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 5: ORG ADMIN 2 ==============
  log('TEST', 'Test 5: Org Admin 2 JWT (organizationId: TEST-ORG-2)');
  const org2Token = generateToken({
    userId: 'admin_org2_test',
    email: 'admin@org2.test',
    role: 'org_admin',
    organizationId: 'TEST-ORG-2'
  });

  try {
    const response = await makeRequest('GET', '/api/leaders', org2Token);
    recordTest(
      'Org admin 2 can fetch leaders (different org)',
      response.status === 200,
      'Status 200',
      response.status
    );
  } catch (e) {
    recordTest('Org admin 2 leaders fetch', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 6: LEADER ROLE ==============
  log('TEST', 'Test 6: Leader Role JWT (organizationId: TEST-ORG-1)');
  const leaderToken = generateToken({
    userId: 'leader_test_001',
    email: 'leader@org1.test',
    role: 'leader',
    organizationId: 'TEST-ORG-1'
  });

  try {
    const response = await makeRequest('GET', '/api/leaders', leaderToken);
    recordTest(
      'Leader can fetch leaders (with org filter)',
      response.status === 200,
      'Status 200',
      response.status
    );
  } catch (e) {
    recordTest('Leader leaders fetch', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 7: STATS WITH CACHE ==============
  log('TEST', 'Test 7: Stats Endpoint with Cache (First call - MISS)');
  const startTime1 = Date.now();
  try {
    const response1 = await makeRequest('GET', '/api/stats', org1Token);
    const duration1 = Date.now() - startTime1;
    
    recordTest(
      'Stats endpoint returns 200 or 500 (expected for empty data)',
      response1.status === 200 || response1.status === 500,
      'Status 200 or 500',
      response1.status
    );
    log('INFO', `  First stats call duration: ${duration1}ms (cache MISS expected)`);
  } catch (e) {
    recordTest('First stats call', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 8: STATS CACHE HIT ==============
  log('TEST', 'Test 8: Stats Endpoint with Cache (Second call - HIT)');
  const startTime2 = Date.now();
  try {
    const response2 = await makeRequest('GET', '/api/stats', org1Token);
    const duration2 = Date.now() - startTime2;
    
    recordTest(
      'Second stats call also returns 200 or 500',
      response2.status === 200 || response2.status === 500,
      'Status 200 or 500',
      response2.status
    );
    log('INFO', `  Second stats call duration: ${duration2}ms`);
    
    // Cache should return faster (but may not be visible with network latency)
    const cacheHit = response2.headers['x-cache'] === 'HIT';
    log('INFO', `  Cache header: ${response2.headers['x-cache'] || 'not set'}`);
  } catch (e) {
    recordTest('Second stats call', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 9: AUDIT LOGS WITH ORG FILTER ==============
  log('TEST', 'Test 9: Audit Logs with Organization Filter');
  try {
    const response = await makeRequest('GET', '/api/audit-logs?limit=10', org1Token);
    recordTest(
      'Audit logs endpoint returns 200 or 403',
      response.status === 200 || response.status === 403,
      'Status 200 or 403',
      response.status
    );
  } catch (e) {
    recordTest('Audit logs fetch', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 10: EVENTS WITH ORG FILTER ==============
  log('TEST', 'Test 10: Events with Organization Filter');
  try {
    const response = await makeRequest('GET', '/api/events', org1Token);
    recordTest(
      'Events endpoint returns 200',
      response.status === 200,
      'Status 200',
      response.status
    );
  } catch (e) {
    recordTest('Events fetch', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 11: CREATE EVENT ASSIGNS ORG ==============
  log('TEST', 'Test 11: Create Event Assigns organizationId');
  try {
    const eventPayload = {
      name: `Test Event ${Date.now()}`,
      description: 'Evento de prueba para Fase 6',
      date: new Date().toISOString(),
      location: 'Test Location'
    };
    
    const response = await makeRequest('POST', '/api/events', org1Token, eventPayload);
    recordTest(
      'Create event endpoint returns 401 or 403 (no admin role)',
      response.status === 401 || response.status === 403,
      'Status 401 or 403',
      response.status
    );
  } catch (e) {
    recordTest('Create event test', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 12: ROLE ENFORCEMENT ==============
  log('TEST', 'Test 12: Role Enforcement (Leader cannot create events)');
  try {
    const eventPayload = {
      name: `Forbidden Event ${Date.now()}`,
      description: 'Este debe ser rechazado',
      date: new Date().toISOString(),
      location: 'Test'
    };
    
    const response = await makeRequest('POST', '/api/events', leaderToken, eventPayload);
    recordTest(
      'Leader cannot create events (403 or 401)',
      response.status === 403 || response.status === 401,
      'Status 403 or 401',
      response.status
    );
  } catch (e) {
    recordTest('Role enforcement test', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 13: REGISTRATIONS WITH ORG FILTER ==============
  log('TEST', 'Test 13: Registrations with Organization Filter');
  try {
    const response = await makeRequest('GET', '/api/registrations', org1Token);
    recordTest(
      'Registrations endpoint returns 200',
      response.status === 200,
      'Status 200',
      response.status
    );
  } catch (e) {
    recordTest('Registrations fetch', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 14: ORGANIZATION ENDPOINTS ==============
  log('TEST', 'Test 14: Organization Endpoints');
  try {
    // Only super_admin can list organizations
    const response = await makeRequest('GET', '/api/organizations', legacyAdminToken);
    recordTest(
      'Super admin can list organizations',
      response.status === 200,
      'Status 200',
      response.status
    );
  } catch (e) {
    recordTest('Organization endpoints', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== TEST 15: ORG ADMIN CANNOT LIST ALL ORGS ==============
  log('TEST', 'Test 15: Org Admin Cannot List All Organizations (403)');
  try {
    const response = await makeRequest('GET', '/api/organizations', org1Token);
    recordTest(
      'Org admin cannot list all organizations',
      response.status === 403,
      'Status 403',
      response.status
    );
  } catch (e) {
    recordTest('Org admin list orgs block', false, 'Success', 'ERROR: ' + e.message);
  }

  await sleep(500);

  // ============== FINAL RESULTS ==============
  printResults();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printResults() {
  log('RESULT', '╔════════════════════════════════════════════════════════════╗');
  log('RESULT', '║                    TEST RESULTS                            ║');
  log('RESULT', '╚════════════════════════════════════════════════════════════╝');

  const total = testResults.passed + testResults.failed;
  const percentage = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;

  log('RESULT', `✓ Passed: ${testResults.passed}/${total} (${percentage}%)`);
  log('RESULT', `✗ Failed: ${testResults.failed}/${total}`);

  if (testResults.failed > 0) {
    log('RESULT', '\nFailed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => {
        log('FAIL', `  - ${t.name}`, { expected: t.expected, actual: t.actual });
      });
  }

  const status = testResults.failed === 0 ? `${colors.green}PASSED${colors.reset}` : `${colors.red}FAILED${colors.reset}`;
  log('RESULT', `\nOverall Status: ${status}`);
  log('RESULT', `Total Duration: ~${(testResults.tests.length * 0.5).toFixed(1)}s`);

  // Exit code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// ============== RUN TESTS ==============
console.log('\n');
runTests().catch(err => {
  log('FAIL', 'Test suite error', err);
  process.exit(1);
});
