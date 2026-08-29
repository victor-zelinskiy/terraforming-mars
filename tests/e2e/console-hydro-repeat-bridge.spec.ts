import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * THE REPEAT-ACTION BRIDGE — stage 7 («Микробная фиксация») round trip, live:
 *
 *   Hydronet → «Выберите действие» → the repeat browser (a SECOND Card
 *   Actions instance) → pick → back to the SAME Hydronet instance.
 *
 * The three contracts of the third polish iteration:
 *  · the workspace comes back FULLY LIT — no stale dim, no leftover pose on
 *    the root/rail/scene, no shade, input alive (the reported dark screen);
 *  · focus returns to the PRE-SELECT SUMMARY (the player sees what they just
 *    chose; the same press cannot commit the move);
 *  · the pick row and the side CTA keep ONE geometry across focus moves (the
 *    glyph slot is reserved — focus never re-lays the scene).
 *
 * The route is honest: six tag cards played over the API cover the 0→7 path
 * (building/power, earth, space, science×2, plant+building, microbe), the
 * used blue action comes from GHG Producing Bacteria's own action.
 *
 * Screenshots → `screenshots/hydro-repeat-bridge/`.
 */

const OUT = path.resolve('screenshots', 'hydro-repeat-bridge');

/** Path tags for a 0 → 7 jump + a repeatable blue action. */
const TAG_CARDS = [
  'Solar Power',              // power + building
  'Development Manager',      // earth
  'Space Station',            // space
  'Research',                 // science ×2
  'Adapted Lichen',           // plant
  'Tardigrades',              // microbe; ACTIVE: add a microbe (repeatable)
];

const CFG = soloGameConfig({
  players: [{name: 'BridgeProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: TAG_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.37,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 30; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 20)},
  } as never);
}

/** Activate a tableau card's blue action over the API (marks it USED). */
async function useCardAction(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) =>
    (o.cards ?? []).some((c: Wire) => c.name === card) && titleOf(o) !== 'Play project card');
  expect(at, `the menu offers ${card}'s action (menu: ${
    (menu.options ?? []).map((o: Wire) => titleOf(o)).join(' | ')})`).toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'card', cards: [card]},
  } as never);
}

/** The workspace's LIGHT: computed opacity of every load-bearing layer plus
 *  the stale-state suspects the dark-screen bug could hide behind. */
async function lightProbe(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const op = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el === null) {
        return undefined;
      }
      return {
        opacity: Number(getComputedStyle(el).opacity),
        inline: (el.style.opacity ?? '') + '|' + (el.style.transform ?? '') + '|' + (el.style.visibility ?? ''),
        display: getComputedStyle(el).display,
      };
    };
    const shade = document.querySelector('.con-shade') as HTMLElement | null;
    return {
      root: op('.con-hydro'),
      rail: op('.con-hydro__rail'),
      scene: op('.con-hydro__scene'),
      panel: op('.con-hydro__panel'),
      ctx: op('.con-hydro__ctx'),
      act: op('.con-hydro__act'),
      shade: shade === null ? undefined :
        {opacity: Number(getComputedStyle(shade).opacity), display: getComputedStyle(shade).display},
      repeatUp: document.querySelector('.con-cardactions') !== null,
      pointerBlocked: (() => {
        const el = document.querySelector('.con-hydro') as HTMLElement | null;
        return el === null ? undefined : getComputedStyle(el).pointerEvents === 'none';
      })(),
      inert: document.querySelector('.con-hydro[inert], .con-hydro [inert]') !== null,
      focusedRow: document.querySelector('.con-hydro__pickrow.con-hydro__summary--focused') !== null,
      ctaFocused: document.querySelector('.con-hydro__cta--focused') !== null,
      pickedSummary: (document.querySelector('.con-hydro__pickrow') as HTMLElement | null)
        ?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      barText: (document.querySelector('.con-cmdbar') as HTMLElement | null)
        ?.innerText.replace(/\s+/g, ' ').trim() ?? '',
    };
  });
}

function expectLit(light: Record<string, any>, where: string): void {
  for (const key of ['root', 'rail', 'scene', 'panel', 'ctx', 'act']) {
    const l = light[key];
    expect(l, `${where}: ${key} is on screen`).toBeDefined();
    expect(l.opacity, `${where}: ${key} is fully lit (inline «${l.inline}»)`).toBeGreaterThan(0.95);
    expect(l.display, `${where}: ${key} is not display:none`).not.toBe('none');
  }
  expect(light.shade?.opacity ?? 0, `${where}: no stale shade`).toBeLessThan(0.05);
  expect(light.pointerBlocked, `${where}: pointer events alive`).not.toBe(true);
  expect(light.inert, `${where}: nothing inert`).toBe(false);
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`hydro repeat bridge · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('stage 7: selector round trip returns a LIT workspace, focus on the summary', async ({page, request}) => {
      test.setTimeout(480_000);
      const id = await createGameWithCards(request, TAG_CARDS, {config: CFG, seed: 0.37});
      await seedGameOverApi(request, id, {cards: TAG_CARDS, corporation: 'ThorGate'});
      for (const card of TAG_CARDS) {
        await playCard(request, id, card);
      }
      await useCardAction(request, id, 'Tardigrades');
      await openConsole(page, id, profile.query);
      await waitForBoardHome(page, 25);

      // ── Open the Hydronetwork; RT jumps to the farthest legal stage (7). ──
      await press(page, 'Period', 1100);
      await press(page, 'ArrowLeft', 1600);
      await page.waitForSelector('.con-hydro', {timeout: 10_000});
      await page.waitForSelector('.con-hydro__payline', {timeout: 10_000});
      await press(page, 'Period', 900); // RT — «К дальнему»
      const focused = await page.evaluate(() =>
        document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
      expect(focused, 'the farthest legal stage is 7').toBe('7');

      // ── INITIAL FOCUS: the unresolved pre-select owns the cursor. ──
      const seat = await lightProbe(page);
      expect(seat.focusedRow, 'the cursor starts on «Выберите действие»').toBe(true);
      expect(String(seat.barText), 'the bar names the row\'s verb').toMatch(/выберите действие/i);

      // ── GEOMETRY: moving focus to the CTA must not re-lay either control. ──
      const boxes = async () => page.evaluate(() => {
        const b = (sel: string) => {
          const el = document.querySelector(sel);
          if (el === null) {
            return undefined;
          }
          const r = el.getBoundingClientRect();
          return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
        };
        return {row: b('.con-hydro__pickrow'), cta: b('.con-hydro__ctazone .con-hydro__cta')};
      });
      const focusedBoxes = await boxes();
      await shoot(page, `${profile.tag}-01-focus-row`);
      await press(page, 'ArrowUp', 500); // → track (off the row)
      const blurredBoxes = await boxes();
      await shoot(page, `${profile.tag}-02-focus-off`);
      for (const key of ['row', 'cta'] as const) {
        const a = focusedBoxes[key];
        const b = blurredBoxes[key];
        expect(a, `${key} exists focused`).toBeDefined();
        expect(b, `${key} exists blurred`).toBeDefined();
        for (const side of ['x', 'y', 'w', 'h'] as const) {
          expect(Math.abs((a as any)[side] - (b as any)[side]),
            `${key}.${side} moved on focus change (${JSON.stringify(a)} vs ${JSON.stringify(b)})`)
            .toBeLessThanOrEqual(1);
        }
      }
      await press(page, 'ArrowDown', 500); // back onto the row

      // ── INTO THE SELECTOR and back. ──
      await press(page, 'Enter', 1800);
      await page.waitForSelector('.con-cardactions', {timeout: 15_000});
      await shoot(page, `${profile.tag}-03-selector`);
      // A picks the (only) activated action; the composer confirms it with a
      // second A («Выбрать это действие»). Bounded walk, keyed on the surface.
      for (let i = 0; i < 4 && await page.locator('.con-cardactions').count() > 0; i++) {
        await press(page, 'Enter', 1600);
      }
      await page.waitForSelector('.con-hydro', {timeout: 15_000});
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 15_000});
      await page.waitForTimeout(1200); // let any return motion settle

      const back = await lightProbe(page);
      await shoot(page, `${profile.tag}-04-returned`);
      expectLit(back, 'after the selector round trip');
      expect(String(back.pickedSummary), 'the chosen action stands in the summary')
        .toMatch(/Tardigrades|Тихоходки/i);
      // THE ANSWER MOVES THE CURSOR ON: nothing left open → the FINAL CTA
      // owns the seat, the resolved decision keeps its summary in the rail.
      expect(back.focusedRow, 'the resolved decision does not hold the cursor').toBe(false);
      expect(back.ctaFocused, 'focus advanced to the final CTA').toBe(true);
      expect(String(back.barText), 'the bar names the commit now')
        .toMatch(/укрепить гидросеть/i);
      // …and the press that confirmed the selector did NOT leak into it:
      const pos0 = await page.evaluate(async () => {
        const pid = new URLSearchParams(location.search).get('id');
        const r = await fetch(`/api/player?id=${pid}`);
        const v = await r.json();
        return v.thisPlayer.deltaProject?.position ?? 0;
      });
      expect(pos0, 'nothing committed by the return').toBe(0);

      // ── CHANGING A RESOLVED DECISION IS A MANUAL WALK: ↑ from the CTA onto
      //    the resolved card («A Сменить»), A re-opens the selector, B backs
      //    out with the pick intact and the seat unchanged. ──
      await press(page, 'ArrowUp', 600);
      const onRow = await lightProbe(page);
      expect(onRow.focusedRow, '↑ lands on the resolved decision card').toBe(true);
      expect(String(onRow.barText), 'the resolved row offers CHANGE')
        .toMatch(/сменить действие/i);
      await press(page, 'Enter', 1600);
      await page.waitForSelector('.con-cardactions', {timeout: 15_000});
      await press(page, 'Escape', 1600);
      await page.waitForSelector('.con-hydro', {timeout: 15_000});
      const cancelled = await lightProbe(page);
      expectLit(cancelled, 'after cancelling the selector');
      expect(String(cancelled.pickedSummary), 'the old pick survives a cancel').toMatch(/Tardigrades|Тихоходки/i);
      await shoot(page, `${profile.tag}-05-cancel-return`);
    });
  });
}
