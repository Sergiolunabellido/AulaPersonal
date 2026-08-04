/**
 * Quita el damero gris/blanco que Gemini a veces “imprime” como píxeles opacos
 * en vez de transparencia real. Flood-fill desde los bordes.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function esFondo(r, g, b, a) {
  if (a < 10) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma >= 28) return false;
  return max >= 160 && chroma <= 25;
}

function esGrisDamero(r, g, b, a) {
  if (a < 10) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min > 22) return false;
  // Celdas grises del damero (no el blanco puro de la cara)
  return max >= 150 && max <= 245;
}

function esBlanco(r, g, b, a) {
  if (a < 200) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 235 && max - min <= 20;
}

function limpiarBuffer(png) {
  const w = png.width;
  const h = png.height;
  const data = png.data;
  const visited = new Uint8Array(w * h);
  const queue = [];

  const idx = (x, y) => (y * w + x) * 4;
  const tryEnqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (visited[i]) return;
    const p = idx(x, y);
    if (!esFondo(data[p], data[p + 1], data[p + 2], data[p + 3])) return;
    visited[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < w; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryEnqueue(0, y);
    tryEnqueue(w - 1, y);
  }

  let cleared = 0;
  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    const p = i * 4;
    data[p] = 0;
    data[p + 1] = 0;
    data[p + 2] = 0;
    data[p + 3] = 0;
    cleared++;
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  // Interior del círculo: borrar grises del damero (aislados del borde)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = idx(x, y);
      if (esGrisDamero(data[p], data[p + 1], data[p + 2], data[p + 3])) {
        data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0;
        cleared++;
      }
    }
  }

  // Blancos del damero interior (junto a transparencia). La cara blanca toca azul, no se borra.
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = idx(x, y);
        if (!esBlanco(data[p], data[p + 1], data[p + 2], data[p + 3])) continue;
        let nearClear = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (data[idx(nx, ny) + 3] < 10) {
            nearClear = true;
            break;
          }
        }
        if (nearClear) {
          data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0;
          cleared++;
          changed = true;
        }
      }
    }
  }

  return cleared;
}

function resizeNearest(src, size) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x / size) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / size) * src.height));
      const si = (sy * src.width + sx) * 4;
      const di = (y * size + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function main() {
  const root = path.join(__dirname, '..');
  const raw = process.argv[2];
  if (!raw) {
    console.error('Uso: node scripts/remove-checkerboard.js <png-origen>');
    process.exit(1);
  }

  const input = PNG.sync.read(fs.readFileSync(raw));
  const cleared = limpiarBuffer(input);
  const outMain = path.join(root, 'electron', 'assets', 'app-icon.png');
  fs.mkdirSync(path.dirname(outMain), { recursive: true });
  fs.writeFileSync(outMain, PNG.sync.write(input));
  console.log(`Cleared ${cleared} px -> ${outMain}`);

  const rendererIcon = path.join(root, 'electron', 'renderer', 'assets', 'imagenes', 'aula-personal-icon.png');
  const rendererLogo = path.join(root, 'electron', 'renderer', 'assets', 'imagenes', 'aula-personal-logo.png');
  fs.copyFileSync(outMain, rendererIcon);
  fs.copyFileSync(outMain, rendererLogo);

  const iconsDir = path.join(root, 'electron', 'assets', 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  for (const size of [512, 256, 128, 64, 48, 32, 16]) {
    const resized = resizeNearest(input, size);
    const dest = path.join(iconsDir, `${size}x${size}.png`);
    fs.writeFileSync(dest, PNG.sync.write(resized));
  }
  fs.writeFileSync(
    path.join(root, 'electron', 'assets', 'app-icon-512.png'),
    PNG.sync.write(resizeNearest(input, 512))
  );

  const c0 = input.data[3];
  console.log(`Corner alpha after clean: ${c0}`);
}

main();
