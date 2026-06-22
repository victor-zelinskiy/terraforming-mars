const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const base = 'assets/card-art/review/cards';
(async () => {
  for (const code of ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010']) {
    const f = path.join(base, code, 'card.png');
    if (!fs.existsSync(f)) continue;
    const big = await sharp(f).resize({width: 760, kernel: 'lanczos3'}).toBuffer();
    const m = await sharp(big).metadata();
    const W = m.width, H = m.height;
    let lines = '';
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20 * W).toFixed(1);
      const major = i % 2 === 0;
      lines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#00e5ff" stroke-opacity="${major ? 0.95 : 0.3}" stroke-width="${major ? 1 : 0.5}"/>`;
      if (major) lines += `<text x="${(+x + 2).toFixed(1)}" y="16" fill="#00e5ff" font-size="14" font-family="monospace" font-weight="bold">${(i / 20).toFixed(2)}</text>`;
    }
    for (let i = 0; i <= 20; i++) {
      const y = (i / 20 * H).toFixed(1);
      const major = i % 2 === 0;
      lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ff2dd4" stroke-opacity="${major ? 0.95 : 0.3}" stroke-width="${major ? 1 : 0.5}"/>`;
      if (major) lines += `<text x="2" y="${(+y - 2).toFixed(1)}" fill="#ff2dd4" font-size="14" font-family="monospace" font-weight="bold">${(i / 20).toFixed(2)}</text>`;
    }
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines}</svg>`);
    await sharp(big).composite([{input: svg}]).png().toFile(path.join(base, code, 'grid.png'));
  }
  console.log('grids written');
})();
