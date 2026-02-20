const fs = require('fs');
const html = fs.readFileSync('app.html', 'utf8');

// Extract script content
let startIdx = html.indexOf('<script>');
let endIdx = html.lastIndexOf('</script>');
if (startIdx === -1 || endIdx === -1) {
  console.error('Cannot find script tag');
  process.exit(1);
}

const script = html.substring(startIdx + 8, endIdx);
console.log('Script length:', script.length);

// Look for common issues
const lines = script.split('\n');

// Find lines with orphaned try
let inTry = false;
let tryStart = -1;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  if (line.startsWith('try') && line.includes('{')) {
    inTry = true;
    tryStart = i;
    braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
  } else if (inTry) {
    braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    
    if (braceCount === 0) {
      // Check next line for catch/finally
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!nextLine.match(/^(catch|finally)/)) {
          console.log(`WARNING: try at line ${tryStart + 1} closes without catch/finally`);
          console.log(`  Line ${i + 1}: ${lines[i].substring(0, 80)}`);
          console.log(`  Next line ${i + 2}: ${(lines[i + 1] || '').substring(0, 80)}`);
        }
      }
      inTry = false;
    }
  }
}

// Try to parse
try {
  new Function(script);
  console.log('✓ JavaScript syntax is valid!');
  process.exit(0);
} catch (err) {
  console.error('✗ Syntax Error:', err.message);
  process.exit(1);
}

