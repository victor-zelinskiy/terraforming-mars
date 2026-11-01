import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, FixtureName, focusCard, press, settle} from './consoleStart';

/**
 * THE PLAY COMPOSER IS A SHEET THAT MIRRORS THE CARD (P81 · DJ — docs/claude/prompts/prelude2-p81-soil-studies.md §4;
 * `docs/claude/console/workspace-band.md` § ЛИСТ РОЗЫГРЫША). «КАРТЫ В РУКЕ › <карта> › РОЗЫГРЫШ» — the screen every card
 * play passes through — witnessed over a corpus of play shapes × three profiles:
 *
 *   (a) the SHEET stands as tall as the hero's face — its top and bottom on the card's (±2 px); on the Deck the band's;
 *   (b) the sheet and the commit keep their boxes while the cursor walks the sheet (±1 px);
 *   (c) the result's VALUE is the louder voice: its chip type ≥ 1.6 × the «РЕЗУЛЬТАТ» kicker's;
 *   (d) one lane and nothing to shape → the payment is ONE line (`data-pay-density="line"`), no «✓ Оплачено» verdict;
 *       a ledger case (an alternative lane) stays `compact`;
 *   (e) the commit is a PLATE: ≤ 60 % of the sheet's width, its «ready» row wears no light halo;
 *   (f) the card's roles are a LINE: no plate behind a role, no emoji glyph (a penalty's ⚠ excepted) — and no role the
 *       FACE already prints (its tags, its action, its effect, a printed VP — the owner's 4K review: «Метки» centred
 *       on the sheet is help the card shows — an event's tags too); a «per X» VP now, an armed effect, a pass stay;
 *   (g) a «РАСЧЁТ» strip, where one stands, is ONE line with nothing cut;
 *   (h) the sheet's body fits — no scroll (the eight-lane ledger included, off the Deck: the sheet EXPANDS instead);
 *   (l) THE EXPANDED SHEET (the owner's decision for the extreme payment): a sheet taller than the card keeps its bottom
 *       — the commit — on the card's bottom line and grows UPWARD past the card's top (`data-sheet-expanded`); a sheet
 *       as tall as the card is never marked expanded;
 *   (i) a ledger (several lanes) stands in the BODY, never in the dock; the one-line price in the dock;
 *   (j) the commit stands whole inside the sheet — a tall ledger never pushes it out;
 *   (k) a short body block is CENTRED in the body (the result at the card's mid-height, never pinned over a void);
 *   (m) THE RESULT ROW (the owner, 2026-11-01): no heading over nothing; everything the play brings is a chip of ONE
 *       «РЕЗУЛЬТАТ» row — the resources, «+ Эффект», «+ Действие», the VP shield — never the card's graphic a second time;
 *       a card with no immediate result reads its gains alone (Cutting Edge Technology), never an empty sheet; on the TV
 *       the row is ONE line.
 * Frames: `screenshots/play-sheet/<profile>/`.
 */

const OUT = path.resolve('screenshots', 'play-sheet');
const COMPOSER = '.con-composer--play';

const PROFILES = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

/** `density`: the payment's expected density; `undefined` — whatever the deal gives (annotated, not judged). */
type Case = {id: string, fixture: FixtureName, card: string | undefined, density: 'line' | 'compact' | undefined, why: boolean, tall?: boolean, gains?: ReadonlyArray<string>, vp?: boolean};
const CORPUS: ReadonlyArray<Case> = [
  // A counted event, M€ only: the line, «РАСЧЁТ» of two terms, the event-tags role.
  {id: 'soil-studies', fixture: 'soil-studies', card: 'Soil Studies', density: 'line', why: true},
  // A discounted price (Teractor −3), «ДАЛЕЕ», «Сработает»: still one line — the discount on it.
  {id: 'sponsoring-nation', fixture: 'sponsoring-nation', card: 'Sponsoring Nation', density: 'line', why: false},
  // A counted floater play with an action and VP roles — and Dirigibles' floaters are a SECOND lane for a Venus card: the ledger.
  {id: 'floating-refinery', fixture: 'floating-refinery', card: 'Floating Refinery', density: 'compact', why: true},
  // A solo hand with steel and titanium: the first card whose payment holds an alternative lane (the ledger case).
  {id: 'ledger', fixture: 'solo-actions', card: undefined, density: 'compact', why: false},
  // THE WORST PAYMENT (the owner's question): Space Elevator with every lane open — an eight-row ledger.
  {id: 'ledger-8', fixture: 'play-sheet-ledger', card: 'Space Elevator', density: 'compact', why: false, tall: true, gains: ['action'], vp: true},
  // THE OTHER EXTREME (the owner's frame of an empty sheet): no immediate result — a printed EFFECT and 1 VP (Helion's heat
  // is a second lane: the ledger).
  {id: 'effect-only', fixture: 'play-sheet-ledger', card: 'Cutting Edge Technology', density: 'compact', why: false, gains: ['effect'], vp: true},
];

type Rect = {t: number, b: number, l: number, r: number, w: number, h: number};
type Scene = {
  sheet: Rect | null,
  hero: Rect | null,
  band: Rect | null,
  cta: Rect | null,
  ctaShadow: string,
  valueFs: number,
  kickerFs: number,
  density: string,
  verdicts: number,
  rolePlates: Array<string>,
  roleGlyphs: Array<string>,
  whyLines: number,
  whyCut: boolean,
  bodyScroll: {sh: number, ch: number},
  /** Roles that repeat the face (plain tags, action, effect, a printed VP). */
  faceRoles: Array<string>,
  /** Where the payment panel stands: 'dock' | 'body' | ''. */
  payWhere: string,
  /** The result row (m): its non-resource gains, the VP chip, the distinct lines its chips stand on, and the card's
   *  graphic printed a second time (must be none). */
  gains: Array<string>,
  vpChip: boolean,
  resultLines: number,
  graphicDuplicates: number,
  /** A «РЕЗУЛЬТАТ» heading standing over nothing (m). */
  emptyKicker: boolean,
  /** The sheet wears the EXPANDED mark (l). */
  expanded: boolean,
  /** The body's viewport and the block it holds (k). */
  body: Rect | null,
  block: Rect | null,
  /** The share of the sheet's height no zone content stands on — annotated (the body's air is by design). */
  voidShare: number,
};

async function readScene(page: Page): Promise<Scene> {
  return page.evaluate((root) => {
    const rect = (el: Element | null): Rect | null => {
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return r.height > 0 ? {t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height} : null;
    };
    const effective = (el: Element | null) => {
      if (el === null) {
        return 0;
      }
      let z = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const zoom = Number(getComputedStyle(n).zoom || '1');
        z *= Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
      }
      return parseFloat(getComputedStyle(el).fontSize) * z;
    };
    const host = document.querySelector(root)!;
    const sheetEl = host.querySelector('.con-composer__playsheet');
    const heroEl = host.querySelector('.con-composer__playcard');
    const ctaEl = host.querySelector('.con-composer__cta');
    const value = host.querySelector('.con-composer__result-chips .action-effect-chip__res') ??
      host.querySelector('.con-composer__result-chips .action-effect-chip') ??
      host.querySelector('.con-composer__variants .action-effect-chip');
    const rescats = [...host.querySelectorAll('.con-composer__rescat')];
    const why = host.querySelector('[data-count-why]');
    let whyLines = 0;
    let whyCut = false;
    if (why !== null) {
      const mids = [...why.children].map((c) => {
        const r = c.getBoundingClientRect();
        return Math.round((r.top + r.bottom) / 2);
      });
      whyLines = new Set(mids.map((m) => Math.round(m / 12))).size;
      whyCut = (why as HTMLElement).scrollWidth > (why as HTMLElement).clientWidth + 2;
    }
    const viewport = host.querySelector('.con-composer__playsheet .con-scroll-area__viewport') as HTMLElement | null;
    const sheet = rect(sheetEl);
    let voidShare = 0;
    if (sheet !== null && sheetEl !== null) {
      const parts = [...sheetEl.querySelectorAll('[data-unfold-item], .con-composer__rescats, .con-composer__row')]
        .map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0)
        .sort((a, b) => a.top - b.top);
      let covered = 0;
      let reach = sheet.t;
      for (const r of parts) {
        const top = Math.max(r.top, reach);
        if (r.bottom > top) {
          covered += r.bottom - top;
          reach = r.bottom;
        }
      }
      voidShare = Math.max(0, 1 - covered / sheet.h);
    }
    return {
      sheet,
      hero: rect(heroEl),
      band: rect(host.querySelector('.con-composer__playmain')),
      cta: rect(ctaEl),
      ctaShadow: ctaEl !== null ? getComputedStyle(ctaEl).boxShadow : '',
      valueFs: effective(value),
      kickerFs: effective(host.querySelector('.con-composer__sub-title--result')),
      density: host.querySelector('.con-pay')?.getAttribute('data-pay-density') ?? '',
      verdicts: host.querySelectorAll('.con-paystatus').length,
      rolePlates: rescats.filter((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      }).map((el) => (el.textContent ?? '').trim().slice(0, 40)),
      roleGlyphs: rescats.flatMap((el) => [...el.querySelectorAll('.con-composer__rescat-glyph')].map((g) => (g.textContent ?? '').trim()))
        .filter((g) => g !== '⚠'),
      whyLines,
      whyCut,
      bodyScroll: viewport === null ? {sh: 0, ch: 0} : {sh: viewport.scrollHeight, ch: viewport.clientHeight},
      voidShare,
      faceRoles: rescats.filter((el) => {
        const kind = el.getAttribute('data-rescat') ?? '';
        // VP of every kind stand in the head line's VP cell (P81 · DW), never in the roles line.
        return kind === 'tags' || kind === 'action' || kind === 'effect' || kind === 'vp';
      }).map((el) => el.getAttribute('data-rescat') ?? ''),
      expanded: sheetEl?.hasAttribute('data-sheet-expanded') ?? false,
      gains: [...host.querySelectorAll('[data-result-gain]')].map((el) => el.getAttribute('data-result-gain') ?? ''),
      vpChip: host.querySelector('[data-result-vp]') !== null,
      resultLines: (() => {
        const row = host.querySelector('.con-composer__result-chips');
        return row === null ? 0 : new Set([...row.children].map((c) => Math.round(c.getBoundingClientRect().top / 6))).size;
      })(),
      graphicDuplicates: host.querySelectorAll('.con-composer__result-chips .card-container, .con-composer__result-chips .card-description').length,
      emptyKicker: host.querySelector('.con-composer__sub-title--result') !== null &&
        host.querySelector('.con-composer__result-chips > *') === null && host.querySelector('.con-composer__variants') === null,
      payWhere: host.querySelector('.con-composer__playdock .con-pay') !== null ? 'dock' :
        host.querySelector('.con-composer__playmid .con-pay') !== null ? 'body' : '',
      body: rect(viewport),
      block: (() => {
        const content = viewport?.querySelector('.con-scroll-area__content .con-composer__scroll-body') ?? null;
        const kids = content === null ? [] : [...content.children].map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0);
        if (kids.length === 0) {
          return null;
        }
        const t = Math.min(...kids.map((r) => r.top));
        const b = Math.max(...kids.map((r) => r.bottom));
        return {t, b, l: 0, r: 0, w: 0, h: b - t};
      })(),
    };
  }, COMPOSER);
}

/** A blurred OUTER shadow in a light colour (the glow the restraint law forbids for a standing state). */
function hasLightHalo(shadow: string): boolean {
  if (shadow === '' || shadow === 'none') {
    return false;
  }
  for (const part of shadow.split(/,(?![^(]*\))/)) {
    if (part.includes('inset')) {
      continue;
    }
    const nums = (part.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) ?? []).map((n) => parseFloat(n));
    const blur = nums[2] ?? 0;
    const rgb = part.match(/rgba?\(([^)]*)\)/)?.[1].split(',').map((n) => parseFloat(n)) ?? [0, 0, 0, 1];
    if (blur > 2 && (rgb[0] + rgb[1] + rgb[2]) / 3 > 100 && (rgb[3] ?? 1) > 0.05) {
      return true;
    }
  }
  return false;
}

async function openHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

async function openComposer(page: Page, card: string): Promise<boolean> {
  await openHand(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  if (!await focusCard(page, card, slots * 2 + 6)) {
    return false;
  }
  if (!await page.locator('.con-hand__verdictbar').evaluate((el) => el.classList.contains('con-hand__verdictbar--ok')).catch(() => false)) {
    return false;
  }
  await press(page, 'Enter', 1200);
  await page.locator(COMPOSER).waitFor({timeout: 15_000});
  await settle(page);
  return true;
}

/** The ledger case: the first playable card of the deal whose payment holds an alternative lane. */
async function openLedgerComposer(page: Page): Promise<string | undefined> {
  await openHand(page);
  const names = await page.locator('.con-hand__slot[data-zoom-slot]').evaluateAll((els) => els.map((e) => e.getAttribute('data-zoom-slot') ?? ''));
  for (const name of names) {
    if (!await openComposer(page, name)) {
      continue;
    }
    if (await page.locator(`${COMPOSER} .con-pay`).getAttribute('data-pay-density') === 'compact') {
      return name;
    }
    await press(page, 'Escape', 900);
    await settle(page);
  }
  return undefined;
}

function expectSheet(scene: Scene, label: string, deck: boolean, c: Case): void {
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  expect.soft(scene.sheet, `${label}: the sheet stands`).not.toBeNull();
  if (scene.sheet === null) {
    return;
  }
  if (!deck) {
    expect.soft(scene.hero, `${label}: the hero stands beside the sheet`).not.toBeNull();
    if (scene.hero !== null && c.tall === true) {
      // (l) THE EXPANDED SHEET: the commit's line on the card's bottom, the sheet grown upward past the card's top.
      expect.soft(scene.sheet.b >= scene.hero.b - 2 && scene.sheet.t < scene.hero.t - 2,
        `${label}: (l) the expanded sheet rises above the card's top and keeps its commit at or below the card's bottom line — sheet ${JSON.stringify([scene.sheet.t, scene.sheet.b])} hero ${JSON.stringify([scene.hero.t, scene.hero.b])}`).toBe(true);
      expect.soft(scene.expanded, `${label}: (l) the sheet is marked expanded`).toBe(true);
    } else if (scene.hero !== null) {
      expect.soft(scene.expanded, `${label}: (l) a sheet as tall as the card is not expanded`).toBe(false);
      expect.soft(near(scene.sheet.t, scene.hero.t, 2) && near(scene.sheet.b, scene.hero.b, 2),
        `${label}: (a) the sheet's top / bottom on the hero face's — sheet ${JSON.stringify([scene.sheet.t, scene.sheet.b])} hero ${JSON.stringify([scene.hero.t, scene.hero.b])}`).toBe(true);
    }
  } else if (scene.band !== null && c.tall !== true) {
    expect.soft(near(scene.sheet.t, scene.band.t, 2) && near(scene.sheet.b, scene.band.b, 2),
      `${label}: (a) on the Deck the sheet spans the band — sheet ${JSON.stringify([scene.sheet.t, scene.sheet.b])} band ${JSON.stringify([scene.band.t, scene.band.b])}`).toBe(true);
  }
  // The «РЕЗУЛЬТАТ» heading stands exactly where a result chip does (a card with no immediate change has none — (m)).
  if (scene.valueFs > 0) {
    expect.soft(scene.kickerFs, `${label}: the result kicker stands over its chips`).toBeGreaterThan(0);
  }
  // (c) is judged where a result chip stands — a card whose result is a next step alone («ДАЛЕЕ») has no value to weigh.
  if (scene.valueFs > 0) {
    expect.soft(scene.valueFs / Math.max(1, scene.kickerFs), `${label}: (c) the value ≥ 1.6 × its kicker — ${scene.valueFs.toFixed(1)} / ${scene.kickerFs.toFixed(1)}`).toBeGreaterThanOrEqual(1.6);
  }
  if (c.density !== undefined) {
    expect.soft(scene.density, `${label}: (d) the payment's density`).toBe(c.density);
  }
  if (scene.density === 'line') {
    expect.soft(scene.verdicts, `${label}: (d) one line — no «✓ Оплачено» verdict beside the price`).toBe(0);
  }
  expect.soft(scene.cta, `${label}: the commit stands`).not.toBeNull();
  if (scene.cta !== null) {
    expect.soft(scene.cta.w / scene.sheet.w, `${label}: (e) the commit is a plate — ${scene.cta.w.toFixed(0)} of ${scene.sheet.w.toFixed(0)} px`).toBeLessThanOrEqual(0.6);
  }
  expect.soft(hasLightHalo(scene.ctaShadow), `${label}: (e) no light halo on the commit row — ${scene.ctaShadow}`).toBe(false);
  expect.soft(scene.rolePlates, `${label}: (f) no plate behind a role`).toEqual([]);
  expect.soft(scene.roleGlyphs, `${label}: (f) no emoji glyph on a role`).toEqual([]);
  if (c.why) {
    expect.soft(scene.whyLines, `${label}: (g) «РАСЧЁТ» on ONE line`).toBe(1);
    expect.soft(scene.whyCut, `${label}: (g) «РАСЧЁТ» cut by nothing`).toBe(false);
  }
  if (c.tall !== true || !deck) {
    expect.soft(scene.bodyScroll.sh, `${label}: (h) the body fits — ${scene.bodyScroll.sh} of ${scene.bodyScroll.ch}`).toBeLessThanOrEqual(scene.bodyScroll.ch + 2);
  }
  expect.soft(scene.faceRoles, `${label}: (f) no role the face already prints`).toEqual([]);
  expect.soft(scene.payWhere, `${label}: (i) a ledger in the body, the one line in the dock`).toBe(scene.density === 'line' ? 'dock' : 'body');
  if (scene.cta !== null) {
    expect.soft(scene.cta.t >= scene.sheet.t - 1 && scene.cta.b <= scene.sheet.b + 1,
      `${label}: (j) the commit whole inside the sheet — commit ${JSON.stringify([scene.cta.t, scene.cta.b])} sheet ${JSON.stringify([scene.sheet.t, scene.sheet.b])}`).toBe(true);
  }
  expect.soft(scene.emptyKicker, `${label}: (m) no «РЕЗУЛЬТАТ» heading over nothing`).toBe(false);
  expect.soft(scene.graphicDuplicates, `${label}: (m) the card's graphic is never printed a second time in the sheet`).toBe(0);
  if (c.gains !== undefined) {
    expect.soft(scene.gains, `${label}: (m) the result's gains are the card's`).toEqual([...c.gains]);
    expect.soft(scene.vpChip, `${label}: (m) the VP stands as a chip of the result`).toBe(c.vp === true);
    if (label.startsWith('tv4k')) {
      expect.soft(scene.resultLines, `${label}: (m) the result row is ONE line`).toBe(1);
    }
  }
  if (scene.body !== null && scene.block !== null && scene.block.h < scene.body.h - 6) {
    const bodyMid = (scene.body.t + scene.body.b) / 2;
    const blockMid = (scene.block.t + scene.block.b) / 2;
    expect.soft(near(bodyMid, blockMid, 3), `${label}: (k) a short block centred in the body — body ${JSON.stringify([scene.body.t, scene.body.b])} block ${JSON.stringify([scene.block.t, scene.block.b])}`).toBe(true);
  }
}

for (const profile of PROFILES) {
  test.describe(`play composer — a sheet that mirrors the card · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});
    for (const c of CORPUS) {
      test(`${c.id}: as tall as the card, the number louder than its label, the price once, the commit a plate, the roles a line`, async ({page}) => {
        test.setTimeout(240_000);
        await bootFixture(page, page.request, c.fixture, {query: profile.query});
        await settle(page);
        const card = c.card === undefined ? await openLedgerComposer(page) : (await openComposer(page, c.card) ? c.card : undefined);
        if (card === undefined) {
          test.info().annotations.push({type: 'skipped-case', description: `${c.id}: the deal holds no ${c.card === undefined ? 'card with an alternative lane' : 'playable ' + c.card}`});
          expect.soft(c.card, `${c.id}: a named corpus card must open`).toBeUndefined();
          return;
        }
        const dir = path.join(OUT, profile.id);
        fs.mkdirSync(dir, {recursive: true});
        const first = await readScene(page);
        await page.screenshot({path: path.join(dir, `${c.id}-a.png`)});
        test.info().annotations.push({type: 'scene', description: `${card} ${JSON.stringify(first)}`});
        expectSheet(first, `${profile.id} ${c.id}`, profile.id === 'deck', c);
        // (b) THE FRAME DOES NOT MOVE while the cursor walks the sheet.
        for (const key of ['ArrowUp', 'ArrowDown']) {
          await press(page, key, 300);
          await settle(page);
          const walked = await readScene(page);
          for (const [name, a, b] of [['sheet', first.sheet, walked.sheet], ['commit', first.cta, walked.cta]] as const) {
            if (a !== null && b !== null) {
              expect.soft(Math.abs(a.t - b.t) <= 1 && Math.abs(a.b - b.b) <= 1 && Math.abs(a.w - b.w) <= 1,
                `${profile.id} ${c.id}: (b) the ${name}'s box after ${key} — ${JSON.stringify([a.t, a.b, a.w])} → ${JSON.stringify([b.t, b.b, b.w])}`).toBe(true);
            }
          }
        }
        await page.screenshot({path: path.join(dir, `${c.id}-b.png`)});
      });
    }
  });
}
