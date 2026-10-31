import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, focusCard, openQuickWheel, press, pressUntil, settle} from './consoleStart';

/**
 * THE VOTE PANEL — ONE GLANCE: THE NUMBER, THEN THE CONSEQUENCES (P77 · DH, docs/claude/prompts/prelude2-p77-jovian-envoys.md §4).
 *
 * The panel every vote passes through, over a corpus of readings (a budget's levy, a payout with the party's answer, a
 * colony ledger, a count by kind, a level, six seats, and a delegate GRANT's door inside the hand — P77 itself, at a zero
 * reading), on the three profiles:
 *   (а) THREE ZONES ON THE TABLE'S LINES — in the hall the panel's top and bottom are the voting area's (±2 px), and the
 *       panel holds no void: the vertical room no zone block stands in is ≤ 15 % of its inner height;
 *   (б) the panel's box and the confirm's box stand still under LB / RB and ◀ ▶ (±1 px);
 *   (в) THE NUMBER IS THE VOICE: the result is ≥ 1.6 × the reading's kicker; «if you win» is ONE quiet line UNDER the
 *       number (`data-parl-vote-suffix`), never a second plate or a column with a head of its own; a zero reading
 *       («0 → +0») is not printed;
 *   (г) the seats are TABS on a row of their own (never on the kicker's line), at the couch floor on the TV;
 *   (д) the facts are TILES of one height on one row, the leader drawn as a cube or an empty socket — never a word or a dash;
 *   (е) the confirm is a PLATE — ≤ 60 % of the panel's width, «ready» a kant and never a light;
 *   (ж) the formula stands on neutral glass — never a violet wash;
 *   (з) nothing under the vote layer is clipped or scrolls.
 * The «before» run of this very spec (the same build without the polish) is red on (а), (в), (д), (е), (ж).
 *
 * Shots: `screenshots/p77/<profile>/panel-<fixture>-<phase>.png` (`TM_E2E_PANEL_PHASE=before|after`, default after).
 * FUNCTIONAL — every probe is a DOM read (no rAF, no frame count).
 */

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

/** The hall's own vote (the wheel → the Parliament → A): every form of reading the corpus asks for. */
const HALL = [
  {name: 'parliament-budget-vote', why: 'a budget — the levy first, the payout, the net'},
  {name: 'parliament-biodome-vote', why: 'a payout by influence with the ruling party\'s answer and the win\'s suffix'},
  {name: 'parliament-colonial-vote', why: 'the colony ledger'},
  {name: 'parliament-tax-breaks-vote', why: 'a count by kind'},
  {name: 'parliament-research-vote', why: 'a level (up to N cards)'},
  {name: 'parliament-budget-vote-six', why: 'six seats on the row of tabs'},
] as const;

/**
 * «WHILE ENACTED» (the owner's frame of 2026-10-31 — Trade Industries over an EMPTY plate): a law that ACTS or STANDS in
 * the first slot. `voice` — it pays nothing at the enactment, so the standing IS the plate's voice; `below` — under the
 * payout, with its own kicker. `marks` — the hooks its number must stand on; `world` — the table's moves stand too.
 */
const STANDING = [
  {name: 'parliament-standing-trade-vote', why: 'Trade Industries — the bill at your influence → the fleet', pose: 'voice', marks: ['[data-standing-price]', '[data-standing-uses]'], world: false},
  {name: 'parliament-standing-manufacturing-vote', why: 'Manufacturing Run — the count a generation and its rule', pose: 'voice', marks: ['[data-standing-uses]', '.con-lawst__rule'], world: false},
  {name: 'parliament-standing-rd-vote', why: 'R&D Funding — the science tags at your influence + the repeat action', pose: 'voice', marks: ['[data-standing-tags]', '[data-standing-uses]'], world: false},
  {name: 'parliament-standing-heat-vote', why: 'Heat Capture — the payout, then −3 M€ on Building cards in hand; the temperature down', pose: 'below', marks: ['[data-standing-discount]', '[data-standing-in-hand]'], world: true},
  {name: 'parliament-standing-metal-vote', why: 'Metal Research — the payout, then the metals\' new values and your stock', pose: 'below', marks: ['[data-standing-value="steel"]', '[data-standing-stock]'], world: false},
  {name: 'parliament-standing-gas-vote', why: 'Gas Export — the payout and the table\'s moves', pose: 'none', marks: [], world: true},
] as const;

/** (и) THE PLATE IS NEVER EMPTY — the law's standing stands where it must, with its numbers; the table's moves stand. */
const readStanding = (page: Page) => page.evaluate(() => {
  const panel = document.querySelector<HTMLElement>('.con-parl__vote--up .con-parl__info');
  const standing = panel?.querySelector<HTMLElement>('[data-parl-vote-standing]') ?? null;
  const shown = (el: Element | null) => el !== null && el.getBoundingClientRect().height > 1 && getComputedStyle(el).visibility !== 'hidden';
  return {
    standing: shown(standing),
    hero: standing?.classList.contains('con-lawst--hero') === true,
    kicker: shown(standing?.querySelector('[data-parl-standing-kicker]') ?? null),
    yields: panel?.querySelectorAll('[data-parl-vote-yield]').length ?? 0,
    text: (standing?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    marks: Array.from(standing?.querySelectorAll<HTMLElement>('*') ?? []).filter(shown).flatMap((el) => Array.from(el.attributes).map((a) => a.name)),
    classes: Array.from(standing?.querySelectorAll<HTMLElement>('*') ?? []).filter(shown).flatMap((el) => Array.from(el.classList)),
    moves: Array.from(panel?.querySelectorAll<HTMLElement>('[data-parl-world-move]') ?? []).filter(shown).map((m) => `${m.getAttribute('data-parl-world-move')} ${m.getAttribute('data-parl-world-steps')}`),
    own: (panel?.querySelector('.con-parl__info-own')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  };
});

const PHASE = process.env.TM_E2E_PANEL_PHASE === 'before' ? 'before' : 'after';
const OUT = path.resolve('screenshots', 'p77');

async function shoot(page: Page, profile: string, name: string): Promise<void> {
  const dir = path.join(OUT, profile);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `panel-${name}-${PHASE}.png`)});
}

async function openHallVote(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-parl').count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(page.locator('.con-parl')).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}),
    'the vote mode opens').toBe(true);
  await settle(page, {timeoutMs: 15_000});
}

/** P77's grant door: the card from the hand → its composer → A — the vote rises inside the hand. */
async function openGrantDoor(page: Page): Promise<void> {
  const card = 'Jovian Envoys';
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${card}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}»`).toBe(true);
  await press(page, 'Enter', 1200);
  await page.locator('.con-composer--play').waitFor({timeout: 15_000});
  await settle(page);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand [data-parl-vote-door="card"].con-parl__vote--up').count() > 0, {tries: 3, settleMs: 2500}),
    'the grant\'s vote rises inside the hand').toBe(true);
  await settle(page, {timeoutMs: 30_000});
}

type Box = {x: number, y: number, w: number, h: number};

type PanelReading = {
  panel: Box | null;
  voting: Box | null;
  hall: boolean;
  /** The inner height (padding off) and the room no ZONE block stands in. */
  inner: number;
  void: number;
  voidRanges: Array<string>;
  cta: Box | null;
  ctaReady: boolean;
  ctaShadow: string;
  kickerFont: number;
  resultFont: number;
  resultText: string;
  /** Numbers in the reading as loud as the result (≥ 0.9 ×) that are not the result itself — a second voice. */
  rivals: Array<string>;
  suffixes: Array<{delta: string | null, lines: number, belowNumber: boolean}>;
  zeroReadings: number;
  seats: {row: Box | null, onKickerLine: boolean, digitFontPx: number, floorPx: number, chips: number};
  facts: Array<{id: string | null, box: Box, cube: boolean, dash: boolean}>;
  formulaBg: Array<{bg: string, violet: boolean}>;
};

const readPanel = (page: Page): Promise<PanelReading> => page.evaluate(() => {
  const boxOf = (el: Element | null): {x: number, y: number, w: number, h: number} | null => {
    if (el === null) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
  };
  const shown = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const panel = document.querySelector<HTMLElement>('.con-parl__vote--up .con-parl__info');
  const parl = panel?.closest('.con-parl') ?? null;
  // The voting area's PLATE — the box the eye reads as the table's frame (the nearest ancestor of the slots' block, itself
  // included, that paints a ground or a kant): its lines are the ones the panel must share.
  const painted = (el: Element): boolean => {
    const cs = getComputedStyle(el);
    const alpha = Number(cs.backgroundColor.match(/rgba?\([^)]*?,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+))?\)/)?.[1] ?? (cs.backgroundColor === 'transparent' ? 0 : 1));
    return alpha > 0.03 || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none';
  };
  let voting: Element | null = parl?.querySelector('.con-parl__voting') ?? null;
  while (voting !== null && voting !== parl && !painted(voting)) {
    voting = voting.parentElement;
  }
  if (voting === parl) {
    voting = null;
  }
  const hall = parl?.classList.contains('con-parl--hall') === true;
  // ── (а) the void: the panel's inner height minus the union of its ZONE blocks' vertical extents.
  let inner = 0;
  let empty = 0;
  const voidRanges: Array<string> = [];
  if (panel !== null) {
    const r = panel.getBoundingClientRect();
    const cs = getComputedStyle(panel);
    const top = r.top + parseFloat(cs.paddingTop);
    const bottom = r.bottom - parseFloat(cs.paddingBottom);
    inner = bottom - top;
    const zones = '.con-parl__info-head, .con-parl__info-seats, .con-parl__info-own, .con-parl__info-party, .con-parl__info-law, ' +
      '.con-parl__facts, .con-parl__info-src, .con-parl__info-receipt, .con-parl__cta, .con-parl__embed';
    const spans = Array.from(panel.querySelectorAll(zones))
      .filter((el) => shown(el) && el.closest('.con-parl-xfade-leave-active') === null)
      .map((el) => el.getBoundingClientRect())
      .map((b) => [Math.max(top, b.top), Math.min(bottom, b.bottom)] as [number, number])
      .filter(([a, b]) => b > a)
      .sort((a, b) => a[0] - b[0]);
    let cursor = top;
    for (const [a, b] of spans) {
      if (a > cursor) {
        empty += a - cursor;
        voidRanges.push(`${Math.round(cursor - top)}–${Math.round(a - top)}`);
      }
      cursor = Math.max(cursor, b);
    }
    if (bottom > cursor) {
      empty += bottom - cursor;
      voidRanges.push(`${Math.round(cursor - top)}–${Math.round(bottom - top)}`);
    }
  }
  // ── (в) the voice: the inline boxes of the kicker's words and of the result's digits.
  const kicker = panel?.querySelector<HTMLElement>('[data-parl-kicker="reading"]') ?? null;
  // The NUMBER — the result's digits (a zero block has none: its calm word is not a voice to measure).
  const result = panel?.querySelector<HTMLElement>('[data-parl-vote-yield] .con-iyield__out b') ?? null;
  const fontOf = (el: HTMLElement | null): number => {
    if (el === null) {
      return 0;
    }
    // The painted size: the computed size scaled by every zoom on the way up (the reading's own fit is a `zoom`).
    let zoom = 1;
    for (let e: HTMLElement | null = el; e !== null; e = e.parentElement) {
      const z = parseFloat(getComputedStyle(e).zoom || '1');
      zoom *= Number.isFinite(z) && z > 0 ? z : 1;
    }
    return parseFloat(getComputedStyle(el).fontSize) * zoom;
  };
  const resultEl = panel?.querySelector<HTMLElement>('[data-parl-vote-yield] .con-iyield__out b') ?? null;
  const numberBottom = resultEl?.getBoundingClientRect().bottom ?? -Infinity;
  const suffixes = Array.from(panel?.querySelectorAll<HTMLElement>('[data-parl-vote-yield] [data-parl-vote-suffix]') ?? []).map((s) => {
    // ONE line = the line's tallest member (a digit, an icon, the Career node) — never the bare text line-height, which
    // a 1.15rem node beside .8rem words doubles.
    const tallest = Math.max(1, ...Array.from(s.children).map((c) => c.getBoundingClientRect().height));
    return {
      delta: s.getAttribute('data-parl-vote-suffix'),
      lines: Math.round(s.getBoundingClientRect().height / tallest),
      belowNumber: s.getBoundingClientRect().top >= numberBottom - 2,
    };
  });
  const zeroReadings = Array.from(panel?.querySelectorAll<HTMLElement>('[data-parl-vote-yield] .con-iyield__reading') ?? [])
    .filter((r) => r.getAttribute('data-yield-amount') === '0' && !r.hasAttribute('data-yield-skipped') && r.getAttribute('data-yield-target') === null).length;
  // ── (г) the tabs.
  const row = panel?.querySelector<HTMLElement>('[data-parl-vote-ledger-row]') ?? null;
  const kr = kicker?.getBoundingClientRect();
  const rr = row?.getBoundingClientRect();
  const onKickerLine = kr !== undefined && rr !== undefined && rr.top < kr.bottom - 1 && rr.bottom > kr.top + 1;
  const digit = row?.querySelector<HTMLElement>('.con-vledger__part b') ?? null;
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  // ── (д) the facts.
  const facts = Array.from(panel?.querySelectorAll<HTMLElement>('[data-parl-fact]') ?? []).filter(shown).map((f) => ({
    id: f.getAttribute('data-parl-fact'),
    box: boxOf(f)!,
    cube: f.querySelector('.player-delegate, [data-fact-socket]') !== null,
    dash: /—/.test(f.textContent ?? ''),
  }));
  // ── (е) the confirm.
  const cta = panel?.querySelector<HTMLElement>('[data-parl-cta]') ?? null;
  // ── (ж) the formula's ground.
  const violetOf = (color: string): boolean => {
    const m = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m === null) {
      return false;
    }
    const [r, g, b] = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
    const a = m[4] === undefined ? 1 : Number(m[4]);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (a < 0.05 || max - min < 0.06) {
      return false;
    }
    let h = 0;
    if (max === r) {
      h = ((g - b) / (max - min)) % 6;
    } else if (max === g) {
      h = (b - r) / (max - min) + 2;
    } else {
      h = (r - g) / (max - min) + 4;
    }
    const hue = (h * 60 + 360) % 360;
    return hue >= 240 && hue <= 320;
  };
  const formulaBg = Array.from(panel?.querySelectorAll<HTMLElement>('[data-parl-vote-yield] .con-iyield__reading') ?? []).map((r) => {
    const cs = getComputedStyle(r);
    const colors = `${cs.backgroundColor} ${cs.backgroundImage}`.match(/rgba?\([^)]*\)/g) ?? [];
    return {bg: `${cs.backgroundColor} | ${cs.backgroundImage}`.slice(0, 160), violet: colors.some(violetOf)};
  });
  return {
    panel: boxOf(panel), voting: boxOf(voting), hall, inner: Math.round(inner), void: Math.round(empty), voidRanges,
    cta: boxOf(cta), ctaReady: cta?.classList.contains('con-parl__cta--ready') === true, ctaShadow: cta === null ? '' : getComputedStyle(cta).boxShadow,
    kickerFont: fontOf(kicker), resultFont: fontOf(result), resultText: (result?.textContent ?? '').trim(),
    rivals: Array.from(panel?.querySelectorAll<HTMLElement>('[data-parl-vote-yield] b') ?? [])
      .filter((b) => b.closest('.con-iyield__out, .con-iyield__levy, .con-iyield__net') === null && result !== null && shown(b) && fontOf(b) >= 0.9 * fontOf(result))
      .map((b) => (b.textContent ?? '').trim()),
    suffixes, zeroReadings,
    seats: {row: boxOf(row), onKickerLine, digitFontPx: digit === null ? 0 : parseFloat(getComputedStyle(digit).fontSize), floorPx: rootPx * 0.8,
      chips: row?.querySelectorAll('.con-vledger__chip').length ?? 0},
    facts, formulaBg,
  };
});

/** A non-inset shadow with a blur in a LIGHT colour — a halo (VISUAL RESTRAINT). */
function halos(shadow: string): Array<string> {
  if (shadow === 'none' || shadow === '') {
    return [];
  }
  return shadow.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => {
    if (/\binset\b/.test(s)) {
      return false;
    }
    const lengths = s.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).map(parseFloat).filter((n) => Number.isFinite(n));
    const blur = lengths[2] ?? 0;
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    const light = m !== null && (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 > 80 && (m[4] === undefined || Number(m[4]) > 0.1);
    return blur > 0 && light;
  });
}

const clipProblems = (page: Page) => page.evaluate(() => {
  const root = document.querySelector<HTMLElement>('.con-parl__vote--up .con-parl__info');
  if (root === null) {
    return ['no vote panel'];
  }
  const out: Array<string> = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (el.closest('.pcard') !== null || el.closest('[data-embed-slot]') !== null) {
      continue;
    }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || cs.display === 'none') {
      continue;
    }
    const name = `${el.className.toString().split(' ')[0] || el.tagName.toLowerCase()} «${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}»`;
    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
      out.push(`scroll container: ${name}`);
    }
    if (cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) {
      out.push(`clipped-y ${name}: ${el.scrollHeight} > ${el.clientHeight}`);
    }
    if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
      out.push(`clipped-x ${name}: ${el.scrollWidth} > ${el.clientWidth}`);
    }
  }
  return out;
});

const near = (a: Box | null, b: Box | null, tol: number): boolean =>
  a !== null && b !== null && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol;

/** Every claim of the panel, judged at once and reported as one table row (a red names every point, not the first). */
async function judge(page: Page, label: string, opts: {walk: boolean}): Promise<void> {
  await expect.poll(() => clipProblems(page), {timeout: 8_000, message: `${label} (з): nothing clipped`}).toEqual([]);
  const m = await readPanel(page);
  test.info().annotations.push({type: 'panel', description: `${label} ${JSON.stringify(m).slice(0, 1800)}`});
  const fails: Array<string> = [];
  // (а)
  if (m.hall && m.panel !== null && m.voting !== null) {
    if (Math.abs(m.panel.y - m.voting.y) > 2) {
      fails.push(`(а) the panel's top ${m.panel.y} ≠ the voting area's ${m.voting.y}`);
    }
    if (Math.abs((m.panel.y + m.panel.h) - (m.voting.y + m.voting.h)) > 2) {
      fails.push(`(а) the panel's bottom ${m.panel.y + m.panel.h} ≠ the voting area's ${m.voting.y + m.voting.h}`);
    }
  }
  if (m.inner > 0 && m.void / m.inner > 0.15) {
    fails.push(`(а) the void is ${Math.round(100 * m.void / m.inner)} % of the panel (${m.void} of ${m.inner} px: ${m.voidRanges.join(', ')})`);
  }
  // (в)
  if (m.kickerFont > 0 && m.resultFont > 0 && m.resultFont < 1.6 * m.kickerFont) {
    fails.push(`(в) the number «${m.resultText}» ${m.resultFont.toFixed(1)} px < 1.6 × the kicker's ${m.kickerFont.toFixed(1)} px`);
  }
  if (m.rivals.length > 0) {
    fails.push(`(в) a second number as loud as the result: ${m.rivals.join(' · ')}`);
  }
  for (const s of m.suffixes) {
    if (s.lines > 1 || !s.belowNumber) {
      fails.push(`(в) the suffix +${s.delta} is not ONE line under the number (lines ${s.lines}, below ${s.belowNumber})`);
    }
  }
  if (m.zeroReadings > 0) {
    fails.push(`(в) a zero formula is printed (${m.zeroReadings} plate(s) «0 → +0»)`);
  }
  // (г)
  if (m.seats.row !== null) {
    if (m.seats.onKickerLine) {
      fails.push('(г) the seats ride the kicker\'s line');
    }
    if (m.seats.digitFontPx > 0 && m.seats.digitFontPx < m.seats.floorPx - 0.5 && label.includes('tv4k')) {
      fails.push(`(г) the tab digits ${m.seats.digitFontPx} px < the couch floor ${m.seats.floorPx} px`);
    }
  }
  // (д)
  if (m.facts.length > 0) {
    const h0 = m.facts[0].box.h;
    const y0 = m.facts[0].box.y;
    if (m.facts.some((f) => Math.abs(f.box.h - h0) > 1 || Math.abs(f.box.y - y0) > 1)) {
      fails.push(`(д) the facts are not tiles of one height on one row (${m.facts.map((f) => `${f.id} ${f.box.y}/${f.box.h}`).join(', ')})`);
    }
    const lead = m.facts.find((f) => f.id === 'lead');
    if (lead !== undefined && (!lead.cube || lead.dash)) {
      fails.push(`(д) the leader is a word or a dash, not a cube (cube ${lead.cube}, dash ${lead.dash})`);
    }
  }
  // (е)
  if (m.cta !== null && m.panel !== null && m.cta.w > 0.6 * m.panel.w) {
    fails.push(`(е) the confirm is ${Math.round(100 * m.cta.w / m.panel.w)} % of the panel's width`);
  }
  if (m.ctaReady && halos(m.ctaShadow).length > 0) {
    fails.push(`(е) «ready» glows: ${halos(m.ctaShadow).join(' | ')}`);
  }
  // (ж)
  const violet = m.formulaBg.filter((f) => f.violet);
  if (violet.length > 0) {
    fails.push(`(ж) the formula stands on a violet wash (${violet[0].bg})`);
  }
  // (б) — the boxes under LB/RB and ◀ ▶.
  if (opts.walk) {
    const before = {panel: m.panel, cta: m.cta};
    for (const key of ['KeyE', 'KeyQ', 'ArrowRight', 'ArrowLeft']) {
      await press(page, key, 500);
      await settle(page, {timeoutMs: 10_000}).catch(() => undefined);
      const after = await readPanel(page);
      if (!near(before.panel, after.panel, 1) || !near(before.cta, after.cta, 1)) {
        fails.push(`(б) ${key} moved a box: panel ${JSON.stringify(before.panel)} → ${JSON.stringify(after.panel)}, confirm ${JSON.stringify(before.cta)} → ${JSON.stringify(after.cta)}`);
      }
    }
  }
  expect(fails, `${label} — ${PHASE}`).toEqual([]);
}

for (const preset of PRESETS) {
  test.describe(`the vote panel at one glance · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    for (const fixture of HALL) {
      test(`${fixture.name} — ${fixture.why} (${preset.id})`, async ({page, request}) => {
        test.setTimeout(240_000);
        await bootFixture(page, request, fixture.name, {query: preset.query});
        await openHallVote(page);
        await shoot(page, preset.id, fixture.name);
        await judge(page, `${fixture.name} @ ${preset.id}`, {walk: true});
      });
    }

    for (const fixture of STANDING) {
      test(`${fixture.name} — ${fixture.why} (${preset.id})`, async ({page, request}) => {
        test.setTimeout(240_000);
        await bootFixture(page, request, fixture.name, {query: preset.query});
        await openHallVote(page);
        await shoot(page, preset.id, fixture.name);
        await judge(page, `${fixture.name} @ ${preset.id}`, {walk: false});
        const st = await readStanding(page);
        test.info().annotations.push({type: 'standing', description: `${fixture.name} @ ${preset.id} ${JSON.stringify(st).slice(0, 1200)}`});
        if (fixture.pose === 'voice') {
          expect(st.standing && st.hero && !st.kicker && st.yields === 0, `(и) the law pays nothing at the enactment — the standing is the plate's VOICE (${st.own})`).toBe(true);
        } else if (fixture.pose === 'below') {
          expect(st.standing && !st.hero && st.kicker && st.yields > 0, `(и) under the payout, the standing names itself (${st.own})`).toBe(true);
        }
        for (const mark of fixture.marks) {
          const hit = mark.startsWith('.') ? st.classes.includes(mark.slice(1)) : st.marks.includes(mark.replace(/^\[|(=.*)?\]$/g, ''));
          expect(hit, `(и) ${mark} stands in the standing («${st.text}»)`).toBe(true);
        }
        if (fixture.world) {
          expect(st.moves.length, `(и) the table's moves stand (${st.moves.join(', ')})`).toBeGreaterThan(0);
        }
        expect(st.own.length, '(и) the plate is never a kicker over nothing').toBeGreaterThan(30);
      });
    }

    test(`jovian-envoys — a delegate GRANT's door inside the hand, at a zero reading (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixture(page, request, 'jovian-envoys', {query: preset.query});
      await settle(page);
      await openGrantDoor(page);
      await shoot(page, preset.id, 'jovian-envoys');
      await judge(page, `jovian-envoys @ ${preset.id}`, {walk: false});
    });
  });
}
