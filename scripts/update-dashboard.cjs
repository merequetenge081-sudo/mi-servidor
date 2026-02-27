const fs = require('fs');
let content = fs.readFileSync('public/dashboard.html', 'utf8');
const searchStr = '<span>AnÃ¡lisis</span>';
const index = content.indexOf(searchStr);
if (index !== -1) {
  const endOfLi = content.indexOf('</li>', index) + 5;
  const newLi = '\n                <li>\n                    <a href="/analytics.html" class="nav-link">\n                        <i class="bi bi-graph-up-arrow"></i>\n                        <span>AnÃ¡lisis Avanzado</span>\n                    </a>\n                </li>';
  content = content.slice(0, endOfLi) + newLi + content.slice(endOfLi);
  fs.writeFileSync('public/dashboard.html', content);
  console.log('Updated successfully');
} else {
  console.log('String not found, trying alternative');
  const searchStr2 = '<span>Análisis</span>';
  const index2 = content.indexOf(searchStr2);
  if (index2 !== -1) {
    const endOfLi = content.indexOf('</li>', index2) + 5;
    const newLi = '\n                <li>\n                    <a href="/analytics.html" class="nav-link">\n                        <i class="bi bi-graph-up-arrow"></i>\n                        <span>Análisis Avanzado</span>\n                    </a>\n                </li>';
    content = content.slice(0, endOfLi) + newLi + content.slice(endOfLi);
    fs.writeFileSync('public/dashboard.html', content);
    console.log('Updated successfully with alternative string');
  } else {
    console.log('Alternative string not found either');
  }
}
