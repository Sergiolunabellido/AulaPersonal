const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const root = path.join(__dirname, '..');
const png = path.join(root, 'electron', 'assets', 'app-icon.png');
const ico = path.join(root, 'electron', 'assets', 'app-icon.ico');

pngToIco(png)
  .then((buf) => {
    fs.writeFileSync(ico, buf);
    console.log('ICO generado:', ico, `(${(buf.length / 1024).toFixed(1)} KB)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
