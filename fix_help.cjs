const fs = require('fs');
let c = fs.readFileSync('public/js/utils/helpers.js', 'utf8');
c = c.replace(
    'return ModalsModule.showAlert(message, type);',
    'if (typeof ModalsModule !== "undefined" && ModalsModule.showAlert) { return ModalsModule.showAlert(message, type); } else { const prefix = type === "error" ? "Error: " : ""; alert(prefix + message); }'
);
fs.writeFileSync('public/js/utils/helpers.js', c);
