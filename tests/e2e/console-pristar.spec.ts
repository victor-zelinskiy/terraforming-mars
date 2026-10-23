import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, cinematicBeat, createGameWithCards, fetchPlayerModel, openConsole, pickCards, playStartQueue,
  press, pressUntil, settle, soloGameConfig, submitSummary, summaryVisible, waitForBoardHome, walkToSummary,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness, TransferWitness} from './transferWitness';
import {storyboard} from './consoleEndgameHarness';

/**
 * R07 · PRISTAR — the fourth and last classic Turmoil corporation adapted in place. «During the production phase, if
 * you did not get TR so far this generation, add one preservation here and gain 6 M€.» The rules are pinned in
 * `tests/cards/turmoil/Pristar.spec.ts`; this stand reads the SCREENS — the owner's ask: «I see whether Pristar pays
 * this generation without counting — and it does not blink»:
 *
 *  A · the start: Pristar picked (its face with the art), the first frame — the rating two steps down, the rating
 *      cell's preservation token «waiting» with its one-sentence hint;
 *  B · a rise (the heat conversion on the pad): the SAME token turns «spent» — one state change, no animation on the
 *      cell but the crossfade — the hint says the effect will not trigger; the server's flag agrees;
 *  C · the rival's rail never wears it; the Information Workspace inspecting the rival shows a clean cell, the own
 *      seat the token;
 *  D · under RX42 UNMI Veto (red on Pristar, first by rating): TWO marks on one cell, neither over the digits, the
 *      hint naming both;
 *  E · the generation scene without a rise: the income wave carries Pristar's +6 M€ as its own token born on the
 *      token, AFTER the income; the server: +6, one preservation, +1 VP; the token «waiting» again;
 *  F · the generation scene after a rise: the token «spent» until the flip, no hook token, no +6.
 *
 * The TV profile only (the card / feature spec rule); FUNCTIONAL class — the scene tests read the transfer witness
 * like `console-generation-scene` (run them `--exclusive --workers=1` for a storyboard).
 */

const OUT = path.resolve('screenshots', 'pristar', 'tv');
const PRESET = {viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'};
const PRISTAR = 'Pristar';
const CELL = '.con-score__cell--tr';
const MARK = `${CELL} .con-score__pristar`;
const CONFIRM = '.con-confirm';

type Wire = {
  game: {phase: string, generation: number, temperature: number},
  thisPlayer: {
    color: string, megacredits: number, heat: number, terraformRating: number, ratingRaisedThisGeneration: boolean,
    victoryPointsBreakdown: {total: number}, tableau: Array<{name: string, resources?: number}>,
  },
  players: Array<{color: string, ratingRaisedThisGeneration: boolean, tableau: Array<{name: string}>}>,
  waitingFor?: {buyMode?: boolean},
};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** A close-up of the rail's score cap (the rating cell and its marks) — the frame the owner reads the mark on. */
async function shootCell(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  const box = await page.locator('.con-score').first().boundingBox();
  if (box !== null) {
    await page.screenshot({path: path.join(OUT, `${name}.png`), clip: {x: box.x, y: Math.max(0, box.y - 20), width: box.width, height: box.height + 40}});
  }
}

/** The rating cell as the player sees it: the mark's state, the hint, the digits, the geometry of both marks. */
const cellRead = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector<HTMLElement>('.con-res .con-score__cell--tr');
  const mark = cell?.querySelector<HTMLElement>('.con-score__pristar') ?? null;
  const veto = cell?.querySelector<HTMLElement>('.con-score__veto') ?? null;
  const value = cell?.querySelector<HTMLElement>('.con-score__value--tr') ?? null;
  const icon = cell?.querySelector<HTMLElement>('.con-score__icon') ?? null;
  const rect = (el: HTMLElement | null) => {
    const r = el?.getBoundingClientRect();
    return r === undefined ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
  };
  return {
    state: cell?.getAttribute('data-tr-pristar') ?? '',
    markClass: mark?.className ?? '',
    painted: mark !== null && mark.getBoundingClientRect().width > 0 && getComputedStyle(mark).opacity !== '0',
    hint: cell?.getAttribute('data-hint') ?? '',
    value: value?.textContent?.trim() ?? '',
    mark: rect(mark), veto: rect(veto), digits: rect(value), icon: rect(icon), cell: rect(cell ?? null),
  };
});

type Box = {x: number, y: number, w: number, h: number};
const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The pad's PASS (the basic wheel's DOWN slot, confirmed on its plate). */
async function passOnUi(page: Page): Promise<void> {
  await page.keyboard.down('Comma');
  await cinematicBeat(page, 550, 'the held LT opens the basic wheel (its own entrance)');
  await page.keyboard.press('ArrowDown');
  await cinematicBeat(page, 450, 'the slot step reads before the release');
  await page.keyboard.up('Comma');
  await expect(page.locator(CONFIRM), 'the pass asks on its plate').toBeVisible({timeout: 10_000});
  await press(page, 'Enter', 300);
}

/** ARM the mark probe: every state the cell shows and every animation that runs on the mark or the cell. */
async function armMarkProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const st = {states: [] as Array<string>, animations: [] as Array<string>};
    (window as unknown as {__pristarMark?: typeof st}).__pristarMark = st;
    const read = () => {
      const cell = document.querySelector<HTMLElement>('.con-res .con-score__cell--tr');
      const state = cell?.getAttribute('data-tr-pristar') ?? '';
      if (st.states[st.states.length - 1] !== state) {
        st.states.push(state);
      }
      const mark = cell?.querySelector<HTMLElement>('.con-score__pristar');
      for (const el of [cell, mark]) {
        for (const a of (el?.getAnimations?.({subtree: false}) ?? [])) {
          const name = a instanceof CSSTransition ? `transition:${a.transitionProperty}` : a instanceof CSSAnimation ? `animation:${a.animationName}` : 'web-animation';
          if (!st.animations.includes(name)) {
            st.animations.push(name);
          }
        }
      }
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true});
    const iv = setInterval(read, 30);
    setTimeout(() => {
      clearInterval(iv);
      mo.disconnect();
    }, 120_000);
  });
}
async function markProbe(page: Page): Promise<{states: Array<string>, animations: Array<string>}> {
  return page.evaluate(() => (window as unknown as {__pristarMark?: {states: Array<string>, animations: Array<string>}}).__pristarMark ?? {states: [], animations: []});
}

/** The landings on each rail row and the births by anchor. */
function byAnchor(ends: TransferWitness['births']): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of ends) {
    out[e.under] = (out[e.under] ?? 0) + 1;
  }
  return out;
}

const pristarResources = (w: Wire): number => w.thisPlayer.tableau.find((c) => c.name === PRISTAR)?.resources ?? 0;

test.describe('R07 Pristar · tv4k', () => {
  test.use({viewport: PRESET.viewport});

  test('A — the start: Pristar picked with its face; the first frame reads the rating two steps down and the token «waiting»', async ({page, request}) => {
    test.setTimeout(600_000);
    const config = soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true},
      testMode: false,
      customCorporationsList: [PRISTAR, 'CrediCor'],
      startingCorporations: 2,
    });
    const playerId = await createGameWithCards(request, [PRISTAR], {config});
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await pickCards(p, [PRISTAR], 10);
          await settle(p, {timeoutMs: 15_000});
          await shoot(p, 'a-01-corporation-face');
        }
      },
    });
    if (await summaryVisible(page)) {
      await shoot(page, 'a-02-summary');
      await submitSummary(page);
    }
    await playStartQueue(page);
    await waitForBoardHome(page, 70);
    await settle(page, {timeoutMs: 20_000});

    const m = await wireOf(request, playerId);
    expect(m.thisPlayer.tableau.some((c) => c.name === PRISTAR), 'the server: Pristar played').toBe(true);
    expect(m.thisPlayer.terraformRating, 'the solo start (14) two steps down').toBe(12);
    expect(m.thisPlayer.ratingRaisedThisGeneration, 'the lowering is no rise').toBe(false);
    const cell = await cellRead(page);
    expect(cell.value, 'the rail reads the server\'s rating').toBe(String(m.thisPlayer.terraformRating));
    expect(cell.state, 'the token stands «waiting»').toBe('waiting');
    expect(cell.painted, 'the token is PAINTED').toBe(true);
    expect(cell.hint, `the hint says the payout stands: ${cell.hint}`).toMatch(/Pristar: РТ в этом поколении не рос/);
    expect(cell.hint).toMatch(/\+1 сбережение и \+6 M€/);
    await shoot(page, 'a-03-first-frame');
    await shootCell(page, 'a-04-cell-waiting');
  });

  test('B — a rise turns the SAME token «spent» in one crossfade: nothing blinks, the hint changes, the server agrees', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId} = await bootFixtureSeats(page, request, 'pristar', {query: PRESET.query});
    await settle(page);
    const start = await wireOf(request, playerId);
    expect(start.thisPlayer.terraformRating, 'the fixture: TR 18').toBe(18);
    expect(start.thisPlayer.heat, 'the fixture: 8 heat').toBe(8);
    await expect(page.locator(`${CELL}[data-tr-pristar="waiting"]`), 'the token stands «waiting»').toHaveCount(1, {timeout: 15_000});
    await shootCell(page, 'b-01-cell-waiting');

    await armMarkProbe(page);
    const stop = await storyboard(page, OUT, 'b-rise');
    // The basic wheel's heat conversion (its RIGHT slot) → the confirm → A.
    expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}), 'the basic-actions wheel opens').toBe(true);
    const confirm = page.locator(`${CONFIRM}[data-confirm-kind="convertHeat"]`);
    expect(await pressUntil(page, 'ArrowRight', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), 'the heat confirm stands').toBe(true);
    await settle(page);
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.ratingRaisedThisGeneration, {timeout: 20_000, message: 'the server: the rating rose'}).toBe(true);
    await expect(page.locator(`${CELL}[data-tr-pristar="spent"]`), 'the token turns «spent»').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 30_000, notifications: false});
    await stop();

    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.terraformRating, 'the conversion paid its rating').toBe(19);
    const cell = await cellRead(page);
    expect(cell.markClass, 'the same token, struck').toContain('con-score__pristar--spent');
    expect(cell.painted, 'still PAINTED — dimmed, never gone').toBe(true);
    expect(cell.hint, `the hint says the effect will not trigger: ${cell.hint}`).toMatch(/Pristar: РТ в этом поколении вырос — эффект не сработает/);
    const probe = await markProbe(page);
    expect(probe.states, 'ONE state change — waiting → spent, never a flicker back').toEqual(['waiting', 'spent']);
    const foreign = probe.animations.filter((a) => !a.startsWith('transition:'));
    expect(foreign, `no animation on the cell or the token but the crossfade (saw ${probe.animations.join(', ')})`).toEqual([]);
    await shootCell(page, 'b-02-cell-spent');
    await shoot(page, 'b-03-after-rise');
  });

  test('C — the rival never wears it; the Information Workspace shows the token on the owner\'s seat only', async ({page, request}) => {
    test.setTimeout(420_000);
    const {seats} = await bootFixtureSeats(page, request, 'pristar', {query: PRESET.query});
    await settle(page);
    const rival = await wireOf(request, seats[1]);
    expect(rival.thisPlayer.tableau.some((c) => c.name === PRISTAR), 'the fixture: the rival is not on Pristar').toBe(false);
    await expect(page.locator(MARK), 'the own rail wears the token').toHaveCount(1, {timeout: 15_000});

    const infoRoot = page.locator('.con-info');
    for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
      if (i > 0) {
        await press(page, 'Escape', 500);
      }
      await press(page, 'KeyY', 1100);
    }
    await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    // RB walks the inspected seat until the rail shows the rival (its colour on the info root).
    const rivalShown = await pressUntil(page, 'BracketRight', async () => await page.locator(MARK).count() === 0, {tries: 4, settleMs: 1100});
    expect(rivalShown, 'the rail inspecting the rival shows a clean rating cell').toBe(true);
    const clean = await cellRead(page);
    expect(clean.state, 'no state on the rival\'s cell').toBe('');
    expect(clean.hint, 'no hint on the rival\'s cell').toBe('');
    await shoot(page, 'c-01-info-rival-clean');
    expect(await pressUntil(page, 'BracketRight', async () => await page.locator(MARK).count() === 1, {tries: 4, settleMs: 1100}), 'back on the own seat — the token').toBe(true);
    expect((await cellRead(page)).state).toBe('waiting');
    await shoot(page, 'c-02-info-own-token');
    for (let i = 0; i < 6 && await page.locator('.con-info').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
  });

  test('D — under the RX42 veto: two marks in their own places, the digits uncovered, the hint naming both', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId} = await bootFixtureSeats(page, request, 'pristar-veto', {query: PRESET.query});
    await settle(page);
    const m = await wireOf(request, playerId);
    expect(m.thisPlayer.terraformRating, 'the fixture: red first by rating at 30').toBe(30);
    expect(m.thisPlayer.tableau.some((c) => c.name === PRISTAR), 'the fixture: red on Pristar').toBe(true);
    await expect(page.locator(`${CELL}[data-tr-vetoed="30"][data-tr-pristar="waiting"]`), 'both marks on the one cell').toHaveCount(1, {timeout: 15_000});
    const cell = await cellRead(page);
    expect(cell.mark, 'the token is painted').toBeDefined();
    expect(cell.veto, 'the stamp is painted').toBeDefined();
    expect(overlaps(cell.mark!, cell.digits!), 'the token never covers the digits').toBe(false);
    // Two places: the token sits on the wrap's lower-right corner, never over the icon's middle the stamp strikes.
    const iconCentre = {x: cell.icon!.x + cell.icon!.w / 2, y: cell.icon!.y + cell.icon!.h / 2};
    expect(cell.mark!.x > iconCentre.x && cell.mark!.y > iconCentre.y, 'the token in the corner, away from the stamp\'s strike').toBe(true);
    const parts = cell.hint.split(' · ');
    expect(parts, `the hint names both: ${cell.hint}`).toHaveLength(2);
    expect(parts[0], 'the veto first').toMatch(/Вето UNMI/);
    expect(parts[1]).toMatch(/^Pristar:/);
    expect(cell.value, 'the digits are the rating').toBe('30');
    await shootCell(page, 'd-01-cell-veto-and-token');
    await shoot(page, 'd-02-veto-frame');
  });

  test('E — the generation scene without a rise: Pristar\'s +6 M€ and its preservation fly AFTER the income from its token; +1 VP', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId} = await bootFixtureSeats(page, request, 'pristar-production', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.megacredits, 'the fixture: 20 M€').toBe(20);
    expect(before.thisPlayer.ratingRaisedThisGeneration).toBe(false);
    await expect(page.locator(`${CELL}[data-tr-pristar="waiting"]`)).toHaveCount(1, {timeout: 15_000});
    await armTransferWitness(page);
    const stop = await storyboard(page, OUT, 'e-generation');
    await passOnUi(page);
    await expect(page.locator('.con-draftws__stage--buy .con-cards__slot'), 'the purchase rises').toHaveCount(4, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    await stop();
    const witness = await transferWitness(page);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'trail-e-income.txt'), transferTrail(witness) + '\n');
    await shoot(page, 'e-01-purchase');

    const after = await wireOf(request, playerId);
    // 20 + 22 (rating) + 3 (production) + 6 (Pristar).
    expect(after.thisPlayer.megacredits, 'the server: the income and Pristar\'s 6').toBe(20 + 22 + 3 + 6);
    expect(pristarResources(after), 'one preservation on the corporation').toBe(pristarResources(before) + 1);
    expect(after.thisPlayer.victoryPointsBreakdown.total - before.thisPlayer.victoryPointsBreakdown.total, '+1 VP (the preservation)').toBe(1);
    const births = byAnchor(witness.births);
    const landings = byAnchor(witness.landings);
    expect(landings['rail:megacredits'] ?? 0, `three M€ landings (rating · production · Pristar) — trail:\n${transferTrail(witness)}`).toBeGreaterThanOrEqual(3);
    expect(births['rail:tr'] ?? 0, `three births on the rating cell (the rating's M€, Pristar's 6 M€ and its preservation) — trail:\n${transferTrail(witness)}`).toBeGreaterThanOrEqual(3);
    // The preservation lands on the card's own counter — its satellite cell on this screen.
    expect(witness.landings.some((l) => /^aux:/.test(l.under)), `the preservation lands on the satellite — trail:\n${transferTrail(witness)}`).toBe(true);
    // The hook's token is the LAST birth on the rating cell: after the income.
    const trBirths = witness.births.filter((b) => b.under === 'rail:tr').map((b) => b.t);
    const otherBirths = witness.births.filter((b) => b.under !== 'rail:tr').map((b) => b.t);
    expect(Math.max(...trBirths), 'Pristar\'s token after every income token').toBeGreaterThanOrEqual(Math.max(...otherBirths));
    expect(endsOverGlass(witness), 'no end of a flight over glass').toEqual([]);
    expect((await cellRead(page)).state, 'a new generation — the token «waiting» again').toBe('waiting');
  });

  test('F — the generation scene after a rise: the token «spent» until the flip; no hook token, no +6', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId} = await bootFixtureSeats(page, request, 'pristar-production-raised', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.ratingRaisedThisGeneration, 'the fixture: the rating rose').toBe(true);
    await expect(page.locator(`${CELL}[data-tr-pristar="spent"]`), 'the token «spent» before the pass').toHaveCount(1, {timeout: 15_000});
    await shootCell(page, 'f-01-cell-spent');
    await armTransferWitness(page);
    await passOnUi(page);
    await expect(page.locator('.con-draftws__stage--buy .con-cards__slot'), 'the purchase rises').toHaveCount(4, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const witness = await transferWitness(page);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits, 'the server: the income alone').toBe(20 + 22 + 3);
    expect(pristarResources(after), 'no preservation').toBe(pristarResources(before));
    expect(byAnchor(witness.births)['rail:tr'] ?? 0, `one birth on the rating cell — the rating's M€ alone — trail:\n${transferTrail(witness)}`).toBe(1);
    expect((await cellRead(page)).state, 'the flip reset the flag — «waiting»').toBe('waiting');
    await shoot(page, 'f-02-purchase');
  });
});

// G — the mark on the OTHER profiles: a profile-specific claim (the token's painted size on the 1080 and the Deck
// layouts — the Deck's own smaller icon carries its own token size), so this one test leaves the TV row.
const SMALL_PROFILES = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;
for (const preset of SMALL_PROFILES) {
  test.describe(`R07 Pristar · the mark · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});
    test(`G — the token reads at ${preset.id}: painted, at least 12 px, off the digits; both states`, async ({page, request}) => {
      test.setTimeout(300_000);
      for (const fixture of ['pristar', 'pristar-raised'] as const) {
        await bootFixtureSeats(page, request, fixture, {query: preset.query});
        await settle(page);
        const state = fixture === 'pristar' ? 'waiting' : 'spent';
        await expect(page.locator(`${CELL}[data-tr-pristar="${state}"]`)).toHaveCount(1, {timeout: 15_000});
        const cell = await cellRead(page);
        expect(cell.painted, 'the token is PAINTED').toBe(true);
        expect(Math.min(cell.mark!.w, cell.mark!.h), `the token's side (${cell.mark!.w}×${cell.mark!.h} px)`).toBeGreaterThanOrEqual(12);
        expect(overlaps(cell.mark!, cell.digits!), 'the token never covers the digits').toBe(false);
        fs.mkdirSync(path.resolve('screenshots', 'pristar', preset.id), {recursive: true});
        const box = await page.locator('.con-score').first().boundingBox();
        if (box !== null) {
          await page.screenshot({path: path.resolve('screenshots', 'pristar', preset.id, `g-cell-${state}.png`), clip: {x: box.x, y: Math.max(0, box.y - 10), width: box.width, height: box.height + 20}});
        }
        await page.screenshot({path: path.resolve('screenshots', 'pristar', preset.id, `g-frame-${state}.png`)});
      }
    });
  });
}
