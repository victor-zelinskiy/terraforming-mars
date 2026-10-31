import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, FixtureName, openActionFocus, openCardActions, press, settle, walkFocusUntil} from './consoleStart';

/**
 * THE ACTION SETUP STAGE IS ONE SCENE WITH THE CARD (docs/claude/prompts/prelude2-p73-floating-refinery.md §4 —
 * `docs/CONSOLE_BLUE_ACTION_PARITY.md` § СЦЕНА НАСТРОЙКИ). The stage every blue-card action passes through
 * («ДЕЙСТВИЯ КАРТ › <card> › НАСТРОЙКА») is witnessed over a corpus of action shapes × three profiles:
 *
 *   (a) the SHEET stands exactly as tall as the hero's face — its top and bottom on the card's (±2 px); on the Deck
 *       (no hero column) on the band's;
 *   (b) the sheet keeps its box while the player answers inside it (the source pick, ±1 px);
 *   (c) the formula's VALUE is the louder voice: its type ≥ 1.6 × its kicker's;
 *   (d) the sheet never titles itself — no «ДЕЙСТВИЕ» chip over the rule;
 *   (e) the commit is a PLATE, not a bar: ≤ 60 % of the sheet's width, and its «ready» state wears no light (no blurred
 *       light box-shadow on the row itself — the cursor's ring lives on its own layer);
 *   (f) nothing leaves the sheet, no value is cut by an ellipsis.
 *
 * Corpus: Cloud Tourism (one action, no choice) · Floating Refinery's «remove» variant (a source pick over two cards)
 * · Floating Refinery with no source (the «add» variant alone). Frames: `screenshots/action-setup/<profile>/`.
 */

const OUT = path.resolve('screenshots', 'action-setup');
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';

const PROFILES = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

/** `context`: the «after the action» line the sheet owes (a regexp over its text), or `null` when the role says nothing (VP). */
type Case = {id: string, fixture: FixtureName, card: string, variant: number, pick?: string, context: RegExp | null};
const CORPUS: ReadonlyArray<Case> = [
  // A VP holder: the VP chip reads the point — no second line.
  {id: 'cloud-tourism', fixture: 'cloud-tourism-vp', card: 'Cloud Tourism', variant: 0, context: null},
  // The move is on ANOTHER card (the source pick) — the hero's capsule does not move: no line.
  {id: 'refinery-remove', fixture: 'floating-refinery-action', card: 'Floating Refinery', variant: 1, pick: 'Floating Habs', context: null},
  // «+1 floater here» on a 1-floater P73 whose 2 floaters buy titanium + M€: the line says the action opens, 2 / 2.
  {id: 'refinery-sole', fixture: 'floating-refinery-sole', card: 'Floating Refinery', variant: 0, context: /После действия.*Действие откроется: 2 \/ 2/},
];

type Rect = {t: number, b: number, l: number, r: number, w: number, h: number};
type Scene = {
  sheet: Rect,
  hero: Rect | null,
  band: Rect,
  valueFs: number,
  kickerFs: number,
  ruleChip: number,
  cta: Rect | null,
  ctaShadow: string,
  outside: Array<string>,
  cut: Array<string>,
  /** The body zone (between the rule and the commit) and the block it holds — (g) a short block stands CENTRED in it. */
  body: Rect | null,
  block: Rect | null,
  /** The «after the action» line — (h) present for a holder whose role is a priced good / tender, absent for a VP holder. */
  context: string | null,
  /** (i) the plain «confirm to perform» sentence stands ONLY where no formula does — never under one (it restates the plate). */
  plainUnderFormula: boolean,
};

async function readScene(page: Page): Promise<Scene> {
  return page.evaluate((stage) => {
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return {t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height};
    };
    const root = document.querySelector(stage)!;
    const sheet = root.querySelector('.con-composer__surface')!;
    const heroEl = root.querySelector('.con-composer__actcardwrap');
    const hero = heroEl !== null && (heroEl as HTMLElement).offsetParent !== null && heroEl.getBoundingClientRect().height > 0 ? rect(heroEl) : null;
    const band = rect(root.querySelector('.con-composer__actmain--stage')!);
    // The effective type: the computed size times every `zoom` up the chain (the TV scales the formula by zoom).
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
    const value = sheet.querySelector('.con-composer__hero .action-effect-chip, .con-composer__hero .con-composer__varchip');
    const kicker = sheet.querySelector('.con-composer__hero .con-composer__hero-label');
    const ruleChip = [...sheet.querySelectorAll('.con-composer__rule--rule .con-composer__rule-label')]
      .filter((el) => (el as HTMLElement).offsetParent !== null).length;
    const ctaEl = sheet.querySelector('.con-composer__cta');
    const s = sheet.getBoundingClientRect();
    const outside: Array<string> = [];
    for (const el of sheet.querySelectorAll('[data-unfold-item]')) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && (r.top < s.top - 1 || r.bottom > s.bottom + 1 || r.left < s.left - 1 || r.right > s.right + 1)) {
        outside.push(el.className.toString().split(' ')[0]);
      }
    }
    const cut: Array<string> = [];
    for (const el of sheet.querySelectorAll('.con-composer__hero .action-effect-chip *')) {
      const h = el as HTMLElement;
      if (h.scrollWidth > h.clientWidth + 1 && getComputedStyle(h).textOverflow === 'ellipsis') {
        cut.push(h.textContent ?? '');
      }
    }
    const bodyEl = sheet.querySelector('[data-setup-body]');
    let block: Rect | null = null;
    if (bodyEl !== null) {
      const kids = [...bodyEl.children].map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0);
      if (kids.length > 0) {
        const t = Math.min(...kids.map((r) => r.top));
        const b = Math.max(...kids.map((r) => r.bottom));
        const l = Math.min(...kids.map((r) => r.left));
        const rr = Math.max(...kids.map((r) => r.right));
        block = {t, b, l, r: rr, w: rr - l, h: b - t};
      }
    }
    const contextEl = sheet.querySelector('[data-setup-context]');
    return {
      sheet: rect(sheet), hero, band,
      valueFs: effective(value), kickerFs: effective(kicker),
      ruleChip,
      cta: ctaEl !== null ? rect(ctaEl) : null,
      ctaShadow: ctaEl !== null ? getComputedStyle(ctaEl).boxShadow : '',
      outside, cut,
      body: bodyEl !== null ? rect(bodyEl) : null,
      block,
      context: contextEl !== null ? (contextEl.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
      plainUnderFormula: sheet.querySelector('.con-composer__hero:not(.con-composer__hero--plain)') !== null &&
        sheet.querySelector('.con-composer__hero--plain') !== null,
    };
  }, STAGE);
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
    const light = (rgb[0] + rgb[1] + rgb[2]) / 3 > 100 && (rgb[3] ?? 1) > 0.05;
    if (blur > 2 && light) {
      return true;
    }
  }
  return false;
}

const focusedTile = (page: Page) => page.evaluate(() => {
  const f = document.querySelector('.con-cardactions__tile--focused');
  if (f === null) {
    return '';
  }
  const card = f.getAttribute('data-action-card') ?? '';
  return `${card}#${[...document.querySelectorAll(`.con-cardactions__tile[data-action-card="${card}"]`)].indexOf(f)}`;
});

async function openSetup(page: Page, c: Case): Promise<void> {
  await openCardActions(page);
  const want = `${c.card}#${c.variant}`;
  for (let i = 0; i < 4 && !(await focusedTile(page)).startsWith(c.card); i++) {
    await press(page, 'ArrowDown', 400);
  }
  // A card's variants stand side by side on a wide profile and STACK on the Deck — the walk goes along the row, then
  // down the column when the row holds no further tile.
  for (let i = 0; i < 6 && (await focusedTile(page)).startsWith(c.card) && await focusedTile(page) !== want; i++) {
    const at = await focusedTile(page);
    const forward = Number(at.split('#')[1]) < c.variant;
    await press(page, forward ? 'ArrowRight' : 'ArrowLeft', 300);
    if (await focusedTile(page) === at) {
      await press(page, forward ? 'ArrowDown' : 'ArrowUp', 300);
    }
  }
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === want, () => focusedTile(page), 30), `never focused ${want}`).toBeTruthy();
  await openActionFocus(page);
  await settle(page);
}

/** The scene laws (a), (c)–(h) on the current frame. */
function expectSetupScene(scene: Scene, label: string, deck: boolean, context: RegExp | null): void {
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  // (g) THE BODY CENTRES A SHORT BLOCK (iteration 2): the statement stands at the card's mid-height beside the art —
  // never pinned to the top over a void; a block taller than the body starts at its top and scrolls inside.
  expect.soft(scene.body, `${label}: the sheet has a body zone`).not.toBeNull();
  expect.soft(scene.block, `${label}: the body holds a block`).not.toBeNull();
  if (scene.body !== null && scene.block !== null) {
    const bodyMid = (scene.body.t + scene.body.b) / 2;
    const blockMid = (scene.block.t + scene.block.b) / 2;
    if (scene.block.h < scene.body.h - 6) {
      expect.soft(near(bodyMid, blockMid, 3), `${label}: (g) a short block is centred in the body — body ${JSON.stringify([scene.body.t, scene.body.b])} block ${JSON.stringify([scene.block.t, scene.block.b])}`).toBe(true);
    } else {
      expect.soft(scene.block.t >= scene.body.t - 1, `${label}: (g) a tall block starts at the body's top`).toBe(true);
    }
  }
  expect.soft(scene.plainUnderFormula, `${label}: (i) no «confirm to perform» sentence under a standing formula`).toBe(false);
  // (h) THE «AFTER THE ACTION» LINE: owed exactly where the hero's own resource moves and its role prices it.
  if (context === null) {
    expect.soft(scene.context, `${label}: (h) no «after the action» line — the role has nothing to add`).toBeNull();
  } else {
    expect.soft(scene.context ?? '', `${label}: (h) the «after the action» line reads the role`).toMatch(context);
  }
  if (!deck) {
    expect.soft(scene.hero, `${label}: the hero stands beside the sheet`).not.toBeNull();
    expect.soft(near(scene.sheet.t, scene.hero!.t, 2) && near(scene.sheet.b, scene.hero!.b, 2),
      `${label}: (a) the sheet's top / bottom on the hero face's — sheet ${JSON.stringify([scene.sheet.t, scene.sheet.b])} hero ${JSON.stringify([scene.hero!.t, scene.hero!.b])}`).toBe(true);
  } else {
    expect.soft(near(scene.sheet.t, scene.band.t, 2) && near(scene.sheet.b, scene.band.b, 2),
      `${label}: (a) on the Deck the sheet spans the band — sheet ${JSON.stringify([scene.sheet.t, scene.sheet.b])} band ${JSON.stringify([scene.band.t, scene.band.b])}`).toBe(true);
  }
  expect.soft(scene.kickerFs, `${label}: a formula kicker stands`).toBeGreaterThan(0);
  expect.soft(scene.valueFs / scene.kickerFs, `${label}: (c) the value ≥ 1.6 × its kicker — ${scene.valueFs.toFixed(1)} / ${scene.kickerFs.toFixed(1)}`).toBeGreaterThanOrEqual(1.6);
  expect.soft(scene.ruleChip, `${label}: (d) no «ДЕЙСТВИЕ» chip over the rule`).toBe(0);
  expect.soft(scene.cta, `${label}: the commit stands`).not.toBeNull();
  expect.soft(scene.cta!.w / scene.sheet.w, `${label}: (e) the commit is a plate — ${scene.cta!.w.toFixed(0)} of ${scene.sheet.w.toFixed(0)} px`).toBeLessThanOrEqual(0.6);
  expect.soft(hasLightHalo(scene.ctaShadow), `${label}: (e) no light halo on the commit row — ${scene.ctaShadow}`).toBe(false);
  expect.soft(scene.outside, `${label}: (f) nothing leaves the sheet`).toEqual([]);
  expect.soft(scene.cut, `${label}: (f) no value cut by an ellipsis`).toEqual([]);
}

for (const profile of PROFILES) {
  test.describe(`action setup — ONE scene with the card · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});
    for (const c of CORPUS) {
      test(`${c.id}: the sheet as tall as the card, the value louder than its label, no self-title, the commit a plate`, async ({page}) => {
        test.setTimeout(240_000);
        await bootFixture(page, page.request, c.fixture, {query: profile.query});
        await settle(page);
        await openSetup(page, c);
        const dir = path.join(OUT, profile.id);
        fs.mkdirSync(dir, {recursive: true});
        // The commit row in its «ready» pose where the action has nothing to ask; the cursor stays off it for (e).
        const first = await readScene(page);
        await page.screenshot({path: path.join(dir, `${c.id}-a.png`)});
        console.log(`[setup-scene] ${profile.id} ${c.id} ${JSON.stringify(first)}`);
        expectSetupScene(first, `${profile.id} ${c.id}`, profile.id === 'deck', c.context);
        if (c.pick !== undefined) {
          // (b) THE FRAME DOES NOT MOVE while the player answers inside it: open the source step, choose, compare.
          for (let i = 0; i < 6 && await page.locator(`${STAGE} .con-composer__row--focused.con-composer__row--missing`).count() === 0; i++) {
            await press(page, 'ArrowUp', 250);
          }
          await press(page, 'Enter', 600);
          await expect(page.locator('.con-ptsel'), 'the source step opened').toBeVisible();
          const focused = () => page.evaluate(() => document.querySelector('.con-ptsel__cell[data-focused="1"] [data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
          for (const key of ['ArrowRight', 'ArrowLeft']) {
            for (let i = 0; i < 6 && await focused() !== c.pick; i++) {
              await press(page, key, 220);
            }
          }
          await press(page, 'Enter', 600);
          await expect(page.locator('.con-ptsel'), 'the step answered').toHaveCount(0);
          await settle(page);
          const answered = await readScene(page);
          await page.screenshot({path: path.join(dir, `${c.id}-b.png`)});
          const moved = ['t', 'b', 'l', 'r'].filter((k) => Math.abs(answered.sheet[k as keyof Rect] - first.sheet[k as keyof Rect]) > 1);
          expect(moved, `${profile.id} ${c.id}: (b) the sheet keeps its box across the answer — ${JSON.stringify(first.sheet)} → ${JSON.stringify(answered.sheet)}`).toEqual([]);
          expectSetupScene(answered, `${profile.id} ${c.id} answered`, profile.id === 'deck', c.context);
        }
      });
    }
  });
}
