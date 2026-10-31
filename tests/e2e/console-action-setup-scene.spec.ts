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

type Case = {id: string, fixture: FixtureName, card: string, variant: number, pick?: string};
const CORPUS: ReadonlyArray<Case> = [
  {id: 'cloud-tourism', fixture: 'cloud-tourism-vp', card: 'Cloud Tourism', variant: 0},
  {id: 'refinery-remove', fixture: 'floating-refinery-action', card: 'Floating Refinery', variant: 1, pick: 'Floating Habs'},
  {id: 'refinery-sole', fixture: 'floating-refinery-sole', card: 'Floating Refinery', variant: 0},
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
    return {
      sheet: rect(sheet), hero, band,
      valueFs: effective(value), kickerFs: effective(kicker),
      ruleChip,
      cta: ctaEl !== null ? rect(ctaEl) : null,
      ctaShadow: ctaEl !== null ? getComputedStyle(ctaEl).boxShadow : '',
      outside, cut,
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

/** The scene laws (a), (c)–(f) on the current frame. */
function expectSetupScene(scene: Scene, label: string, deck: boolean): void {
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
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
        expectSetupScene(first, `${profile.id} ${c.id}`, profile.id === 'deck');
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
          expectSetupScene(answered, `${profile.id} ${c.id} answered`, profile.id === 'deck');
        }
      });
    }
  });
}
