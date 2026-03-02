const fs = require('fs');

const lines = fs.readFileSync('logs/combined.log', 'utf8').split('\n').filter(l => l.trim().length > 0);
const recent = lines.slice(-200);

for(let line of recent) {
  if (line.includes('500') || line.includes('verify')) {
    console.log(line);
  }
}
