import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, pressUntil, settle} from './consoleStart';
import {enterSittingByPass, focusParliamentZone, openParliament, parliament, PARLIAMENT_PRESETS, parliamentWire, parliamentZone, sittingStage, waitSittingAtRest} from './parliamentDrive';

/*
 * THE BROWSE LAYER IS STILL WHILE THE PLAYER POINTS (ПОЛИРОВКА — the registry's
 * «скачки раскладки» class). A d-pad walk over the three zones and the six
 * party tiles is a HUD read: the cursor moves, nothing else may. Two laws,
 * measured on every profile:
 *   · every layout-bearing block of the overview (head, seats, government,
 *     voting slots, party tiles, agenda) keeps its transform-free box
 *     (`offset*` geometry) through the whole walk — a focused tile may glow
 *     and scale, it may not push its neighbours;
 *   · the six tiles are the SAME chassis: equal tile heights and an EQUAL
 *     state-row height whether the tile carries «ПРАВИТ», «2/2 ВАШ ЭФФЕКТ»,
 *     «ВЫДАН КАРТОЙ» or nothing at all — a caption that exists on three tiles
 *     and not on the other three is exactly the jump this guards.
 * The DENSE table (five seats, every tile state at once) is the worst case.
 */
type Box = {x: number, y: number, w: number, h: number};
type Snapshot = Record<string, Box>;

const BLOCKS = ['.con-parl__head', '.con-parl__seats', '.con-parl__gov', '.con-parl__voting', '.con-parl__parties', '.con-parl__agenda'];

/** Transform-free boxes of every layout-bearing block of the overview, keyed by a stable id. */
async function layoutSnapshot(page: Page): Promise<Snapshot> {
  return page.evaluate((blocks) => {
    const out: Record<string, {x: number, y: number, w: number, h: number}> = {};
    const box = (el: HTMLElement) => ({x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight});
    const root = document.querySelector<HTMLElement>('.con-parl');
    if (root === null) {
      return out;
    }
    for (const sel of blocks) {
      const el = root.querySelector<HTMLElement>(sel);
      if (el !== null) {
        out[sel] = box(el);
      }
    }
    root.querySelectorAll<HTMLElement>('.con-parl__party').forEach((el, i) => {
      const id = el.getAttribute('data-party') ?? String(i);
      out[`party:${id}`] = box(el);
      const plaque = el.querySelector<HTMLElement>('.con-pseal');
      if (plaque !== null) {
        out[`party:${id}:plaque`] = box(plaque);
      }
      const state = el.querySelector<HTMLElement>('.con-pseal__state');
      out[`party:${id}:state`] = state === null ? {x: 0, y: 0, w: 0, h: 0} : box(state);
    });
    root.querySelectorAll<HTMLElement>('.con-parl__slot').forEach((el, i) => {
      out[`slot:${el.getAttribute('data-instance') ?? i}`] = box(el);
    });
    return out;
  }, BLOCKS);
}

function diff(before: Snapshot, after: Snapshot, slackPx = 1): Array<string> {
  const out: Array<string> = [];
  for (const key of Object.keys(before)) {
    const a = before[key];
    const b = after[key];
    if (b === undefined) {
      out.push(`${key}: gone`);
      continue;
    }
    const moved = (['x', 'y', 'w', 'h'] as const).filter((k) => Math.abs(a[k] - b[k]) > slackPx);
    if (moved.length > 0) {
      out.push(`${key}: ${moved.map((k) => `${k} ${a[k]}→${b[k]}`).join(', ')}`);
    }
  }
  for (const key of Object.keys(after)) {
    if (before[key] === undefined) {
      out.push(`${key}: appeared`);
    }
  }
  return out;
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`parliament stability (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('the d-pad walk over the overview moves the cursor and nothing else', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'parliament-dense', {query: preset.query, landing: 'board'});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      const parties = await parliament(page).locator('.con-parl__party').count();
      expect(parties, 'six party tiles — one DOM instance per party').toBe(6);
      // v2: the FIVE opposition tiles stand in the row, the RULING party's tile in the government's ruler slot.
      await expect(parliament(page).locator('.con-parl__parties .con-parl__party'), `${preset.id}: five opposition tiles in the row`).toHaveCount(5);
      await expect(parliament(page).locator('[data-parl-ruler] .con-parl__party'), `${preset.id}: the ruler's tile in the government`).toHaveCount(1);

      // The chassis law first («Зал» v7): the FIVE opposition rows share one box and one state-row height, before
      // anything moves; the ruler's medallion is a column of its own (its box is the government's), measured apart.
      const rulerParty = await page.evaluate(() => document.querySelector('[data-parl-ruler] .con-parl__party')?.getAttribute('data-party') ?? '');
      const base = await layoutSnapshot(page);
      const rowKeys = Object.keys(base).filter((k) => /^party:[^:]+$/.test(k) && k !== `party:${rulerParty}`);
      const tileHeights = new Set(rowKeys.map((k) => base[k].h));
      const tileWidths = rowKeys.map((k) => base[k].w);
      const stateHeights = new Set(rowKeys.map((k) => base[`${k}:state`]?.h ?? 0));
      expect(rowKeys, `${preset.id}: five opposition rows beside the ruler «${rulerParty}»`).toHaveLength(5);
      expect(Array.from(tileHeights), `${preset.id}: the five rows share one height (${rowKeys.map((k) => base[k].h).join(', ')})`).toHaveLength(1);
      expect(Math.max(...tileWidths) - Math.min(...tileWidths), `${preset.id}: the five rows share one width (${tileWidths.join(', ')})`).toBeLessThanOrEqual(2);
      expect(Array.from(stateHeights), `${preset.id}: the five state rows share one height (a caption is reserved on every row)`).toHaveLength(1);
      expect(Math.min(...Array.from(stateHeights)), `${preset.id}: the state row is reserved, not collapsed`).toBeGreaterThan(0);

      // Then the walk («Зал» v7): the opposition column → up to its head, down its five rows and back → the table →
      // across the bills → the ruler's medallion → back to the column.
      const trail: Array<string> = [];
      const check = async (step: string) => {
        const now = await layoutSnapshot(page);
        const moved = diff(base, now);
        trail.push(`${step}: zone=${await parliamentZone(page)} moved=${moved.length}`);
        expect(moved, `${preset.id} · after ${step} — nothing but the cursor moved\n${trail.join('\n')}`).toEqual([]);
      };
      await focusParliamentZone(page, 'parties');
      await check('focus parties');
      for (let i = 0; i < 4; i++) {
        await press(page, 'ArrowUp', 350);
        await check(`parties ↑ ${i + 1}`);
      }
      for (let i = 0; i < 4; i++) {
        await press(page, 'ArrowDown', 350);
        await check(`parties ↓ ${i + 1}`);
      }
      for (let i = 0; i < 2; i++) {
        await press(page, 'ArrowUp', 350);
        await check(`parties ↑ back ${i + 1}`);
      }
      await focusParliamentZone(page, 'voting');
      await check('focus voting');
      for (let i = 0; i < 3; i++) {
        await press(page, 'ArrowRight', 350);
        await check(`voting → ${i + 1}`);
      }
      await focusParliamentZone(page, 'ruler');
      await check('focus the ruler\'s tile');
      // «Зал» v7: the ENGINE under the ruler, then the edge's STOPS (◀ ▶ walk them inside the one ring stop) — the
      // focused stop enlarges by a transform and nothing else moves.
      await press(page, 'ArrowDown', 350);
      await check('↓ the engine');
      await press(page, 'ArrowRight', 350);
      await check('→ the first stop');
      for (let i = 0; i < 3; i++) {
        await press(page, 'ArrowRight', 350);
        await check(`stops → ${i + 2}`);
      }
      await press(page, 'ArrowUp', 350);
      await check('↑ back to the table');
      await focusParliamentZone(page, 'parties');
      await check('back to parties');
    });

    /*
     * THE VOTE MODE IS STILL WHILE THE PLAYER POINTS (final polish B): the
     * selection moves across the three cards, the info surface — the reading,
     * the party box beside it, the vote block, the confirm — keeps its box.
     */
    test('the d-pad walk across the vote mode moves the selection and nothing else', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'parliament-dense', {query: preset.query, landing: 'board'});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      await focusParliamentZone(page, 'voting');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const blocks = ['.con-parl__vote', '.con-parl__vrow', '.con-parl__info', '.con-parl__info-res', '.con-parl__info-vote', '.con-parl__info-main', '.con-parl__info-own', '.con-parl__cta'];
      const snap = () => page.evaluate((sel) => {
        const out: Record<string, {x: number, y: number, w: number, h: number}> = {};
        for (const s of sel) {
          const el = document.querySelector<HTMLElement>(s);
          if (el !== null) {
            const r = el.getBoundingClientRect();
            out[s] = {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
          }
        }
        document.querySelectorAll<HTMLElement>('.con-parl__slot[data-instance]').forEach((el) => {
          const r = el.getBoundingClientRect();
          out[`slot:${el.getAttribute('data-instance')}`] = {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
        });
        return out;
      }, blocks);
      const base = await snap();
      // «Зал» v7 (Ф4): the mode is ONE block — the reading stands, the party box does not (its formula is the
      // government's / the dossier's; the box exists only under TR03's door, which pays the party).
      expect(base['.con-parl__info-own'], `${preset.id}: the reading block stands`).toBeDefined();
      expect(await page.locator('.con-parl__info-party').count(), `${preset.id}: no party box on the panel`).toBe(0);
      const trail: Array<string> = [];
      for (const [key, label] of [['ArrowRight', '→ 1'], ['ArrowRight', '→ 2'], ['ArrowLeft', '← 1'], ['ArrowLeft', '← 2']] as const) {
        await press(page, key, 700);
        const moved = diff(base, await snap());
        trail.push(`${label}: moved=${moved.length}`);
        expect(moved, `${preset.id} · vote mode after ${label} — nothing but the selection moved\n${trail.join('\n')}`).toEqual([]);
      }
      await press(page, 'Escape', 1100);
    });

    /*
     * THE SITTING'S PAGES ARE STILL AT REST (final polish B): a page turn by A
     * moves the stage's pose, never the tiers around it (head, seats,
     * government, voting, agenda) — and on the reward page the readings share
     * ONE left edge (registry R-30: centred, a wider second reading stood
     * 18 px left of the first).
     */
    test('the sitting: the tiers keep their boxes through the walk and the opposition row through the government\'s change; the reward readings share one left edge', async ({page, request}) => {
      test.setTimeout(300_000);
      // Architecture Award: RED wins from the middle slot and the government CHANGES (the Greens' starting rule →
      // Mars First) — the plaques change places, the row's five boxes must not.
      // ONE PASS before its sitting (the soft gates): the base is the OVERVIEW the player stands in one pass before —
      // the same tiers the sitting walks over (the band is there in every mode, at one height).
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly', {query: preset.query});
      await openParliament(page);
      await waitSittingAtRest(page, 30_000);
      // The tiers, the opposition row and the RULER'S SLOT (the tile's box — the party in it changes with the
      // government, the box must not). The stage itself is not in the list: on the Deck the results pose takes the
      // Agenda track whole by its own rule (guarded by the v2 probe's «whole or none»).
      const tiers = ['.con-parl__head', '.con-parl__seats', '.con-parl__gov', '.con-parl__voting', '.con-parl__agenda', '.con-parl__parties', '[data-parl-ruler-slot]'];
      const snapTiers = () => page.evaluate((sel) => {
        const out: Record<string, {x: number, y: number, w: number, h: number}> = {};
        for (const s of sel) {
          const el = document.querySelector<HTMLElement>(s);
          if (el !== null) {
            out[s] = {x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight};
          }
        }
        // The opposition row's five boxes BY POSITION (the parties in them change with the government).
        document.querySelectorAll<HTMLElement>('.con-parl__parties .con-parl__party').forEach((el, i) => {
          out[`row:${i}`] = {x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight};
        });
        return out;
      }, tiers);
      // A COMPARISON IS ONLY AS SETTLED AS ITS LEAST SETTLED SIDE (tests.md): both reads go through ONE settle — two
      // consecutive equal snapshots. The government re-solves its zoom once its ROOM settles (sitting law 16: the quest
      // block takes its size a beat after the mount), and on a loaded 4K runner that landed AFTER the verdict's rest —
      // the base read 1.183, the room 1.179, and the ruler's slot «moved» 2 px on a walk that moved nothing.
      const settledTiers = async (): Promise<Awaited<ReturnType<typeof snapTiers>>> => {
        let prev = JSON.stringify(await snapTiers());
        await expect.poll(async () => {
          const now = JSON.stringify(await snapTiers());
          const same = now === prev;
          prev = now;
          return same;
        }, {timeout: 20_000, intervals: [400], message: 'the tiers settle (two equal reads)'}).toBe(true);
        return JSON.parse(prev);
      };
      const base = await settledTiers();
      // EVIDENCE, not a claim: the government row's children (the empty seat or the enacted card, then the ruler
      // block) — the ruler's slot sits right of the first, so a moved slot names which neighbour changed width.
      const rulingRow = () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-parl__ruling > *'))
        .map((el) => `${el.className.toString().split(' ')[0]}:${el.getBoundingClientRect().width.toFixed(2)}`).join(' '));
      const rulingBefore = await rulingRow();
      // The viewer's own pass runs the sitting — the walk plays the whole chain.
      await enterSittingByPass(page, request, playerId);
      await expect.poll(async () => (await parliamentWire(request, playerId)).game.parliament?.phase?.step, {timeout: 30_000}).toBe('done');
      await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      const trail: Array<string> = [];
      const moved = diff(base, await settledTiers());
      trail.push(`results: moved=${moved.length}`);
      trail.push(`the government row: ${rulingBefore} → ${await rulingRow()}`);
      expect(moved, `${preset.id} · from the overview through the walk (the government changed) — the tiers and the row's five boxes keep their places\n${trail.join('\n')}`).toEqual([]);
      await expect(page.locator('[data-parl-ruler] .con-parl__party[data-party="Mars First"]'), 'Mars First rules').toHaveCount(1);
      await expect(page.locator('.con-parl__parties .con-parl__party[data-party="Greens"]'), 'the Greens are back in the row').toHaveCount(1);
      expect(await sittingStage(page)).toBe('results');
      // R-30 (every reading of the viewer's yield block on one left edge; every hero row starting at one x) is pinned on
      // the v2 probe's DOOR pose — the reward page's one stable stop (`console-parliament-sitting-v2.spec.ts`).
    });
  });
}
