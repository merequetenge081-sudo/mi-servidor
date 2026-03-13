const fs = require('fs');
const file = 'public/index.html';
let content = fs.readFileSync(file, 'utf8');

const s1 = \                    } else {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('role', 'leader');\;
const r1 = \                    } else {
                        localStorage.removeItem('admin_token');
                        sessionStorage.removeItem('admin_token');
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('role', 'leader');\;
                        
content = content.replace(s1, r1);

const s2 = \                    adminToken = data.token;
                    
                    // Asegurar que se guarda para redireccion exitosa
                    localStorage.setItem('role', 'admin');\;
const r2 = \                    adminToken = data.token;
                    
                    localStorage.removeItem('admin_token');
                    sessionStorage.removeItem('admin_token');
                    
                    // Asegurar que se guarda para redireccion exitosa
                    localStorage.setItem('role', 'admin');\;

content = content.replace(s2, r2);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed index.html');
