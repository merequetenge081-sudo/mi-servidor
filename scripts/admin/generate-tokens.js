// Script para generar tokens JWT
import jwt from 'jsonwebtoken';

const SECRET = 'dev_secret_key_change_in_production';

const superAdminToken = jwt.sign({
    userId: 'admin1',
    email: 'superadmin@test.com',
    role: 'super_admin'
}, SECRET, { expiresIn: '12h' });

const orgAdminToken = jwt.sign({
    userId: 'admin2',
    email: 'orgadmin@test.com',
    role: 'org_admin',
    organizationId: 'ORG001'
}, SECRET, { expiresIn: '12h' });

console.log(JSON.stringify({
    superAdminToken,
    orgAdminToken
}, null, 2));
