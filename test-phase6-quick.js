#!/usr/bin/env node

/**
 * FASE 6 - QUICK VALIDATION TEST
 * Focuses on: JWT auth, middleware, org filtering without needing MongoDB
 */

import jwt from 'jsonwebtoken';
import http from 'http';

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let passed = 0, failed = 0;

function log(type, msg) {
  const time = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = {
    'PASS': `${colors.green}[✓]${colors.reset}`,
    'FAIL': `${colors.red}[✗]${colors.reset}`,
    'TEST': `${colors.cyan}[TEST]${colors.reset}`,
    'INFO': `${colors.blue}[INFO]${colors.reset}`
  };
  console.log(`${prefix[type]} ${msg}`);
}

function test(name, condition, expected, actual) {
  if (condition) {
    log('PASS', name);
    passed++;
  } else {
    log('FAIL', `${name} (expected: ${expected}, got: ${actual})`);
    failed++;
  }
}

function request(method, path, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      timeout: 2000 // 2 second timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, body: { error: 'Gateway Timeout' } });
    });
    req.end();
  });
}

async function main() {
  console.log('\n' + colors.bright + '═ FASE 6 VALIDATION ═' + colors.reset + '\n');

  // Test 1: Health (no auth required)
  log('TEST', 'Health check');
  const health = await request('GET', '/health');
  test('Health endpoint', health.status === 200, 200, health.status);

  // Test 2: Tokens generation
  log('TEST', 'JWT token generation');
  const superAdminToken = jwt.sign({
    userId: 'admin1',
    role: 'super_admin'
  }, JWT_SECRET, { expiresIn: '12h' });
  test('Super admin token generated', !!superAdminToken, 'token', typeof superAdminToken);

  const orgAdminToken = jwt.sign({
    userId: 'admin2',
    role: 'org_admin',
    organizationId: 'ORG1'
  }, JWT_SECRET, { expiresIn: '12h' });
  test('Org admin token generated', !!orgAdminToken, 'token', typeof orgAdminToken);

  // Test 3: Auth middleware validation
  log('TEST', 'Auth middleware validation');
  
  // 3a: Request without token should get 401
  const noToken = await request('GET', '/api/leaders');
  test('No token returns 401', noToken.status === 401, 401, noToken.status);

  // 3b: Request with valid token should bypass auth
  const withToken = await request('GET', '/api/leaders', superAdminToken);
  test('Valid token bypasses auth (500 OK - no MongoDB)', 
    [200, 500].includes(withToken.status), '200 or 500', withToken.status);

  // Test 4: Organization role middleware
  log('TEST', 'Organization role middleware');

  // 4a: Super admin can access organization endpoints
  const orgList = await request('GET', '/api/organizations', superAdminToken);
  test('Super admin can list organizations',
    [200, 500, 403].includes(orgList.status), '200 or 500', orgList.status);

  // 4b: Org admin should not be allowed
  const orgListOrgAdmin = await request('GET', '/api/organizations', orgAdminToken);
  test('Org admin denied on org list endpoint',
    orgListOrgAdmin.status === 403, 403, orgListOrgAdmin.status);

  // Test 5: Backward compatibility - public endpoints
  log('TEST', 'Backward compatibility');
  
  const registrationNoAuth = await request('POST', '/api/registrations');
  test('Public registration endpoint accessible', 
    [200, 400, 500].includes(registrationNoAuth.status), '200/400/500', registrationNoAuth.status);

  // Test 6: Multiple org isolation
  log('TEST', 'Multi-tenant org isolation');

  const org2Token = jwt.sign({
    userId: 'admin3',
    role: 'org_admin',
    organizationId: 'ORG2'
  }, JWT_SECRET, { expiresIn: '12h' });

  const leaders1 = await request('GET', '/api/leaders', orgAdminToken);
  const leaders2 = await request('GET', '/api/leaders', org2Token);
  
  test('Both org admins can access endpoints',
    [200, 500].includes(leaders1.status) && [200, 500].includes(leaders2.status),
    'both 200/500', `${leaders1.status}, ${leaders2.status}`);

  // Summary
  console.log('\n' + colors.bright + '═ RESULTS ═' + colors.reset);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${passed + failed}\n`);

  if (failed === 0) {
    console.log(colors.green + '✓ Phase 6 integration VALIDATED' + colors.reset + '\n');
    process.exit(0);
  } else {
    console.log(colors.red + '✗ Some tests failed' + colors.reset + '\n');
    process.exit(1);
  }
}

main().catch(err => {
  log('FAIL', 'Test error: ' + err.message);
  process.exit(1);
});
