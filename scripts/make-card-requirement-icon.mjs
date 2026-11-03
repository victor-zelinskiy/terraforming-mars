#!/usr/bin/env node
/**
 * «A CARD WITH A REQUIREMENT» — the ONE mark of the concept (PL-1691), built from the face's own parts:
 * the premium card cover (`assets/resources/card.webp`, the very cover `b.cards(n)` prints) carrying the
 * face's REQUIREMENTS BANNER across its upper part — the pointed copper plate of `.pcard__reqs`, in its own
 * tokens (`--pcard-req-*`: bronze rim, copper field, crown sheen). The plate is EMPTY, as the printed symbol
 * is (the scans print a card with a blank gold tab): no word, no «MIN» — the mark is language-neutral.
 *
 * Read by every surface that names the concept (one constant, `CARD_REQUIREMENT_ICON` in
 * `premiumCardIcons.ts`): the face's «card with a requirement» (`cards(n, {secondaryTag: REQ})` — Xavier,
 * Cutting Edge Technology, Strategic Shift, Nobel Prize), the quest footnote's `requirementPlate` (RX36),
 * the requirement chip «N played cards with requirements» (TR68), the hand's reason badge, and the draw
 * search's rule («с требованием», P54).
 *
 *   node scripts/make-card-requirement-icon.mjs      → assets/misc/card-requirement.webp
 *
 * Re-run it when the card cover changes: the mark must stay the cover it is drawn on.
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COVER = path.join(ROOT, 'assets', 'resources', 'card.webp');
const OUT = path.join(ROOT, 'assets', 'misc', 'card-requirement.webp');

/** The mark's raster: wide enough for the 4K face's mechanics icon at 2×. */
const W = 240;
const H = Math.round(W * 1912 / 1336); // the cover's own proportion — a drop-in for `card.webp`

/** The face banner's place on a card: 86% wide on the face; here the mark's main subject, so a touch shorter and taller. */
const PLATE = {w: Math.round(W * 0.8), h: Math.round(H * 0.19), x: Math.round(W * 0.1), y: Math.round(H * 0.085)};

function pointed(w, h, inset) {
  const tip = h * 0.42; // `.pprq` / `.pcard__reqs`: the tips are 42% of the height
  const i = inset;
  return [[tip + i * 0.45, i], [w - tip - i * 0.45, i], [w - i, h / 2], [w - tip - i * 0.45, h - i], [tip + i * 0.45, h - i], [i, h / 2]]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function plateSvg({w, h}) {
  const outline = Math.max(2, h * 0.08); // a dark ink line, so the plate stands on the dark cover at 24 px
  const rim = outline + Math.max(1.5, h * 0.07);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#dcb06c"/><stop offset="0.48" stop-color="#9f6f3d"/><stop offset="1" stop-color="#5d3b1e"/>
    </linearGradient>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3a457"/><stop offset="0.2" stop-color="#c7823e"/>
      <stop offset="0.6" stop-color="#a8642c"/><stop offset="1" stop-color="#7a4421"/>
    </linearGradient>
    <linearGradient id="tips" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#40210b" stop-opacity="0.38"/><stop offset="0.14" stop-color="#40210b" stop-opacity="0"/>
      <stop offset="0.86" stop-color="#40210b" stop-opacity="0"/><stop offset="1" stop-color="#40210b" stop-opacity="0.38"/>
    </linearGradient>
    <radialGradient id="crown" cx="0.5" cy="0.06" r="0.85">
      <stop offset="0" stop-color="#fff1d6" stop-opacity="0.22"/><stop offset="0.55" stop-color="#fff1d6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <polygon points="${pointed(w, h, 0)}" fill="#1c0e05"/>
  <polygon points="${pointed(w, h, outline)}" fill="url(#rim)"/>
  <polygon points="${pointed(w, h, rim)}" fill="url(#field)"/>
  <polygon points="${pointed(w, h, rim)}" fill="url(#tips)"/>
  <polygon points="${pointed(w, h, rim)}" fill="url(#crown)"/>
</svg>`;
}

const cover = await sharp(COVER).resize(W, H).png().toBuffer();
const plate = await sharp(Buffer.from(plateSvg(PLATE))).png().toBuffer();
await sharp(cover)
  .composite([{input: plate, left: PLATE.x, top: PLATE.y}])
  .webp({quality: 92, alphaQuality: 100})
  .toFile(OUT);
console.log(`card-requirement: ${path.relative(ROOT, OUT)} (${W}×${H})`);
