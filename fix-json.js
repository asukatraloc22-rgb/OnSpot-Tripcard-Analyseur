const fs = require('fs');
['client/src/lib/audit.ts', 'client/src/lib/ai360.ts'].forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    if (c.indexOf('format JSON') === -1) {
      c = c.replace(/messages:\s*\[/g, 'messages: [{ role: "system", content: "Tu dois obligatoirement répondre au format JSON." },');
      fs.writeFileSync(f, c);
      console.log(f + " corrigé !");
    } else {
      console.log(f + " contient déjà la consigne.");
    }
  }
});
