// Dev-only: zoom the top/bottom edges of each exported art on a checkerboard so
// thin UI slivers at the alpha boundary are visible. Writes _edge.png per card
// (top strip over bottom strip).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const base = 'assets/card-art';
const codes = process.argv.slice(2);
const list = codes.length ? codes : ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'];
(async () => {
  for (const code of list) {
    const f = path.join(base, `${code}-1024.webp`);
    if (!fs.existsSync(f)) continue;
    const m = await sharp(f).metadata();
    const W = m.width, H = m.height;
    const strip = Math.max(8, Math.round(H * 0.16));
    const top = await sharp(f).extract({left: 0, top: 0, width: W, height: strip}).toBuffer();
    const bot = await sharp(f).extract({left: 0, top: H - strip, width: W, height: strip}).toBuffer();
    const sep = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="14"><rect width="${W}" height="14" fill="#111"/><text x="6" y="11" fill="#0f0" font-size="11" font-family="monospace">${code} top edge ↑ / bottom edge ↓</text></svg>`);
    const stack = await sharp({create: {width: W, height: strip * 2 + 14, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
      .composite([
        {input: top, top: 0, left: 0},
        {input: sep, top: strip, left: 0},
        {input: bot, top: strip + 14, left: 0},
      ]).png().toBuffer();
    const sz = 14;
    const checker = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${strip * 2 + 14}"><defs><pattern id="c" width="${sz * 2}" height="${sz * 2}" patternUnits="userSpaceOnUse"><rect width="${sz * 2}" height="${sz * 2}" fill="#7f8a96"/><rect width="${sz}" height="${sz}" fill="#e7ecf1"/><rect x="${sz}" y="${sz}" width="${sz}" height="${sz}" fill="#e7ecf1"/></pattern></defs><rect width="${W}" height="${strip * 2 + 14}" fill="url(#c)"/></svg>`);
    await sharp(checker).png().composite([{input: stack}]).png().toFile(path.join(base, 'review', 'cards', code, '_edge.png'));

    // left/right vertical strips (catch frame slivers + author credits)
    const vstrip = Math.max(8, Math.round(W * 0.14));
    const left = await sharp(f).extract({left: 0, top: 0, width: vstrip, height: H}).toBuffer();
    const right = await sharp(f).extract({left: W - vstrip, top: 0, width: vstrip, height: H}).toBuffer();
    const gap = 24;
    const sideW = vstrip * 2 + gap;
    const sideChecker = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sideW}" height="${H}"><defs><pattern id="c" width="${sz * 2}" height="${sz * 2}" patternUnits="userSpaceOnUse"><rect width="${sz * 2}" height="${sz * 2}" fill="#7f8a96"/><rect width="${sz}" height="${sz}" fill="#e7ecf1"/><rect x="${sz}" y="${sz}" width="${sz}" height="${sz}" fill="#e7ecf1"/></pattern></defs><rect width="${sideW}" height="${H}" fill="url(#c)"/></svg>`);
    await sharp(sideChecker).png().composite([
      {input: left, top: 0, left: 0},
      {input: right, top: 0, left: vstrip + gap},
    ]).png().toFile(path.join(base, 'review', 'cards', code, '_sides.png'));
  }
  console.log('edge strips written for', list.join(', '));
})();
