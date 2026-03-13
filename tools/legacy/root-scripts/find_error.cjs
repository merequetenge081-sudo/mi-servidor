const fs = require('fs');

const lines = fs.readFileSync('logs/error.log', 'utf8').split('\n');
const recentErrors = lines.slice(-200);

for(let line of recentErrors) {
  if(line.includes('verificaci')) {
    console.log(line);
  }
}
