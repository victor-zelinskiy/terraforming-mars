// Dev-only design preview of the DELEGATE FIGURE (PlayerDelegate.vue) — no
// browser: the component's SVG is re-assembled here with the palette's real
// tones (`playerTokenPalette.ts`) and the real silhouette (`delegateGlyph.ts`)
// and rasterized by sharp. A design iteration aid, not the probe: the live
// figure is witnessed on the Steam Machine (`console-player-token-parity`).
// Kept in sync with PlayerDelegate.vue's layers (disc → figure → depth → turn
// → sheen → rim → edge → AO) and player_delegate.less's fills.
//
//   npx tsx scripts/delegate-figure-preview.ts [out.png]
import sharp from 'sharp';
import {tokenStyleVars, BASE_RGB} from '../src/client/components/playerToken/playerTokenPalette';
import {DELEGATE_PATH} from '../src/client/components/playerToken/delegateGlyph';
import {Color} from '../src/common/Color';

function figure(id: string, vars: Record<string, string>, x: number, y: number, h: number): string {
  const w = h * 0.8;
  const p = DELEGATE_PATH;
  return `
  <g transform="translate(${x} ${y})">
    <ellipse cx="${w / 2}" cy="${h * 0.9}" rx="${w * 0.48}" ry="${h * 0.075}" fill="url(#shadow)"/>
    <svg x="0" y="0" width="${w}" height="${h}" viewBox="0 0 40 50" overflow="visible">
      <defs>
        <linearGradient id="d${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity=".16"/><stop offset="34%" stop-color="#fff" stop-opacity=".02"/>
          <stop offset="70%" stop-color="#000" stop-opacity=".10"/><stop offset="100%" stop-color="#000" stop-opacity=".38"/>
        </linearGradient>
        <radialGradient id="s${id}" cx="34%" cy="18%" r="62%">
          <stop offset="0%" stop-color="#fff" stop-opacity=".40"/><stop offset="44%" stop-color="#fff" stop-opacity=".08"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="t${id}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".26"/>
        </linearGradient>
        <radialGradient id="c${id}" cx="40%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#fff" stop-opacity=".18"/><stop offset="100%" stop-color="#000" stop-opacity=".18"/>
        </radialGradient>
        <linearGradient id="r${id}" x1="14" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${vars['--pt-edge-hi']}" stop-opacity="0"/><stop offset="100%" stop-color="${vars['--pt-edge-hi']}" stop-opacity="1"/></linearGradient>
      </defs>
      <path d="M3 43.4V45.6A17 4.2 0 0 0 37 45.6V43.4Z" fill="${vars['--pt-bottom']}"/>
      <ellipse cx="20" cy="43.4" rx="17" ry="4.2" fill="${vars['--pt-right']}"/>
      <ellipse cx="20" cy="43.4" rx="17" ry="4.2" fill="url(#c${id})"/>
      <g transform="translate(4 2.24) scale(0.8)">
        <path d="${p}" fill="${vars['--pt-top']}"/>
        <path d="${p}" fill="url(#d${id})"/>
        <path d="${p}" fill="url(#t${id})"/>
        <path d="${p}" fill="url(#s${id})"/>
        <path d="${p}" fill="none" stroke="url(#r${id})" stroke-width="2.4" opacity=".6"/>
        <path d="${p}" fill="none" stroke="rgba(0,0,0,.42)" stroke-width="1.6" stroke-linejoin="round"/>
      </g>
      <ellipse cx="20" cy="43.2" rx="13.2" ry="1.7" fill="rgba(0,0,0,.34)"/>
    </svg>
  </g>`;
}

async function main(): Promise<void> {
  const out = process.argv[2] ?? 'screenshots/delegfig/figure-preview.png';
  const colors = Object.keys(BASE_RGB).filter((c) => c !== 'bronze') as Array<Color>;
  const rows: Array<[string, number]> = [['18', 18], ['24', 24], ['28', 28], ['×4', 96]];
  const scale = 2; // a 4K TV renders the 1080 logical px ×2
  let body = '';
  let y = 20;
  for (const [, h] of rows) {
    let x = 20;
    for (const c of colors) {
      const steel = c === 'neutral';
      body += figure(`${c}${h}`, tokenStyleVars(c, {steel}), x, y, h * scale);
      x += Math.max(h * scale * 0.8, 40) + 24;
    }
    y += h * scale + 26;
  }
  const W = 20 + colors.length * (96 * scale * 0.8 + 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}">
    <defs><radialGradient id="shadow"><stop offset="0%" stop-color="#000" stop-opacity=".85"/><stop offset="55%" stop-color="#000" stop-opacity=".35"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="#16202a"/>${body}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(out);
}

void main();
