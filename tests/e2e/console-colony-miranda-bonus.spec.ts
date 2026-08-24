import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, playCardFromHand, press, soloGameConfig} from './consoleStart';

/**
 * MIRANDA — THE OWNER BONUS THAT IS A PLAIN DRAW.
 *
 * Pluto's owner bonus is «draw 1, then discard 1», and the console renders that
 * per-colony sequence in its own ZONE. Miranda's is just «возьмите карту» — no
 * discard, no sequence, no zone — and that is exactly what broke: the reveal
 * split the batch's bonus wave out of the strip unconditionally, so a bonus
 * card with no zone to receive it rendered in NEITHER place. No slot meant no
 * landing target for the trade covers and nowhere for the take to fly from:
 * the player saw an empty stage with a card name under it and «Взять» did
 * nothing.
 *
 * This probe is the fence. It plays an animal card (Miranda's activation
 * gate), builds a colony there, trades with it, and asserts the payout is a
 * REAL card on the stage that can actually be taken.
 */

const OUT = path.resolve('screenshots', 'colony-miranda');

/** Pets: an animal card cheap enough to buy in the initial deal, and the
 *  activation Miranda waits for. `customProjectCards` puts it on TOP of the
 *  deck, so the deal always offers it (a seed search is a coin flip). */
const PETS = 'Pets';

const CFG = soloGameConfig({
  expansions: {colonies: true},
  customProjectCards: [PETS],
  // Miranda plus resource colonies: the solo setup removal can take one and
  // Miranda still survives into the action phase (`keepColony`).
  customColoniesList: ['Miranda', 'Luna', 'Triton', 'Callisto'],
  // A calm corporation with money and no colony/animal interference.
  customCorporationsList: ['CrediCor'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: CFG});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

async function openColoniesAndFocus(page: Page, target: string): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

test.describe.configure({mode: 'serial'});

test('Miranda OWNER BONUS: the drawn card is on the stage and can be taken', async ({page, request}) => {
  test.setTimeout(480_000);
  const playerId = await createGame(request);
  await bootSeededGame(page, request, playerId, {cards: [PETS], buy: 2, keepColony: 'Miranda'});

  // ── 1 · Activate Miranda (an animal card must be in play). ───────────────
  expect(await playCardFromHand(page, PETS), 'Pets was never played (Miranda stays inactive)').toBeTruthy();
  await page.waitForTimeout(1500);

  // ── 2 · Build a colony on Miranda (the standard project) — the viewer must
  //      OWN a settlement there for the trade to pay them an owner bonus. ──
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(/колони/i.test(await focusedName()), 'could not focus the colony standard project').toBeTruthy();
  await press(page, 'Enter', 1800);
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Miranda');
  await press(page, 'Enter', 2000);

  // ⚠️ ACT → VERIFY → RETRY, WITH THE SERVER AS THE WITNESS. The build confirm
  // was a blind press, and a swallowed one costs nothing HERE and everything
  // sixty seconds later: with no settlement on Miranda the trade still pays
  // income but NO owner bonus, so the subject of this whole probe silently
  // stops existing and the failure surfaces two screens away as «the reveal
  // never came» — on a settled board home, with no batch on the server.
  // «The colony is standing» is a fact only the server can state.
  const ownsMiranda = async (): Promise<boolean> => {
    const view = await (await request.get(`/api/player?id=${playerId}`)).json() as
      {thisPlayer: {color: string}, game: {colonies: Array<{name: string, colonies: Array<string>}>}};
    return (view.game.colonies.find((c) => c.name === 'Miranda')?.colonies ?? [])
      .includes(view.thisPlayer.color);
  };
  //
  // …AND THE CONFIRM IS NOT ALWAYS «A». The focus stage's own grammar: a build
  // that ASKS something — and Miranda's build bonus is «add 1 animal to a
  // card», so it does — speaks the trade's phrasing instead, A answering the
  // focused decision and **X** committing (`ConsoleColonyFocusStage`: A is the
  // one-press confirm only for `intent === 'build' && !hasDecisions`). The
  // spec pressed A alone and called it «build confirm», which is why the
  // colony was sometimes never built at all. Alternate the two verbs rather
  // than hardcode one — that follows the surface for both shapes.
  let built = false;
  for (let tries = 0; tries < 6 && !built; tries++) {
    await press(page, tries % 2 === 0 ? 'Enter' : 'KeyX', 1600);
    for (let w = 0; w < 8 && !built; w++) {
      await page.waitForTimeout(400);
      built = await ownsMiranda();
    }
  }
  expect(built, 'the colony was never built on Miranda — without a settlement there is no owner ' +
    `bonus to probe (stage ${await page.locator('.con-colfocus').count()}, ` +
    `colonies ${await page.locator('.con-colonies').count()})`).toBe(true);
  // The build bonus is an ANIMAL onto Pets — no reveal, no cards. Let it settle.
  await page.waitForTimeout(3500);
  await shoot(page, '01-built');

  // ── 3 · Trade with Miranda: income = animals onto Pets, owner bonus = the
  //      card this probe is about. ───────────────────────────────────────────
  await openColoniesAndFocus(page, 'Miranda');
  await press(page, 'Enter', 2000);
  expect(await page.locator('.con-colfocus').count(), 'the trade stage did not open').toBeGreaterThan(0);

  /*
   * THE TRACK RESET IS THE RESOLUTION'S LAST BEAT — it may only start once
   * every card has been taken and the colony's own stage is back in front of
   * the player. This watch is the fence: it records the marker proxy flying
   * while cards are still on the table (`glideOverReveal`), and the moment
   * each of the two events first happened.
   */
  const watching = page.evaluate((budget) => {
    const out = {glideOverReveal: false, glideOverBlankStage: false, markerAtMs: -1, lastTakeAtMs: -1};
    (window as unknown as {__miranda?: typeof out}).__miranda = out;
    const t0 = performance.now();
    const visible = (el: Element | null) => el !== null && (el as HTMLElement).getClientRects().length > 0;
    const tick = () => {
      const now = Math.round(performance.now() - t0);
      const marker = document.querySelector('.con-coltrade-marker');
      const cardsOnTable = document.querySelectorAll('.con-reveal .con-cards__slot:not(.con-cards__slot--taken)').length;
      if (cardsOnTable > 0) {
        out.lastTakeAtMs = now; // the last frame a card was still owed
      }
      if (visible(marker)) {
        if (out.markerAtMs < 0) {
          out.markerAtMs = now;
        }
        if (cardsOnTable > 0) {
          out.glideOverReveal = true;
        }
        // …and the track it crosses must be BACK: the payout pose takes the
        // stage's working area to opacity 0, and a marker launched into that
        // fade is a white dot over an empty panel.
        const main = document.querySelector('.con-colfocus__main');
        if (main !== null && Number(getComputedStyle(main).opacity || '1') < 0.9) {
          out.glideOverBlankStage = true;
        }
      }
      if (performance.now() - t0 < budget) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, 30_000);

  // CONFIRM THE TRADE — with evidence, never blind. A press dropped on a heavy
  // frame is indistinguishable from «the product did nothing», and the wait
  // below would then spend 30 s on a board that was never asked to do anything
  // (observed once in five repeats: the run ended on a settled board home).
  //
  // ⚠️⚠️ THE EVIDENCE IS THE TRADE, NOT «SOMETHING CHANGED». This loop used to
  // accept `.con-colfocus === null` — the stage going away — as proof the
  // press had landed. That is equally true of a press that merely LEFT the
  // stage, so a misrouted press read as a commit, the loop stopped retrying,
  // and the 30 s wait below then watched a board nobody had asked to trade
  // (CI: the run ended on a settled board home, one card in hand — the two
  // the probe bought minus the one it played, i.e. no bonus card anywhere).
  // Miranda's owner bonus IS a draw, so the authoritative evidence is the
  // SERVER's own queued batch — it cannot be faked by navigation, and it
  // stays true across the payout's whole flight.
  const serverBatches = async (): Promise<Array<Array<string>>> => {
    const view = await (await request.get(`/api/player?id=${playerId}`)).json() as
      {cardDrawReveals?: Array<{cards: Array<{name: string}>}>};
    return (view.cardDrawReveals ?? []).map((b) => b.cards.map((c) => c.name));
  };
  const traded = async (): Promise<boolean> =>
    await page.locator('.con-reveal').count() > 0 || (await serverBatches()).length > 0;

  // The console's OWN view of the resolution (`ConsoleShell` publishes it).
  const diag = async () => page.evaluate(() => {
    const fn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
    return fn === undefined ? {} : fn();
  });

  // What the stage looked like at each press — the state a failing run needs
  // and the one a screenshot cannot give (the class list carries the phase,
  // the command bar carries the verb the press was supposed to be, and the
  // shell's own diagnostic says who it thinks owns the pad).
  const stageState = async (): Promise<string> => {
    const dom = await page.evaluate(() => {
      const st = document.querySelector('.con-colfocus');
      const bar = document.querySelector('.con-cmdbar');
      return {
        cls: st === null ? null : st.className,
        bar: bar === null ? null : (bar as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 120),
        // WHICH STEP IS STILL UNANSWERED — the stage marks it itself
        // (`rowMissing` → `--missing`), and an unanswered step is exactly what
        // holds `canConfirm` down and makes X inert.
        rows: Array.from(document.querySelectorAll('.con-colfocus__steprow')).map((r) => ({
          missing: r.className.includes('--missing'),
          focused: r.className.includes('--focused'),
          text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 70),
        })),
        focus: document.hasFocus(),
      };
    });
    return JSON.stringify({...dom, shell: await diag()});
  };
  // …and X ALONE IS NOT THE TRADE EITHER, for the same reason the build was
  // not A alone: «a choice is a press, never a seeded default». With every
  // resource affordable the trade offers several payment lanes and seeds
  // none, so `canConfirm` is false and X is inert until A has chosen one —
  // the bar says both verbs at once («A ВЫБРАТЬ · X ПОДТВЕРДИТЬ ТОРГОВЛЮ»),
  // and the run that failed pressed X three times into that exact state.
  // ── ANSWER THE TRADE'S OWN STEPS FIRST ──────────────────────────────────
  // Whether this trade HAS a step is not under the probe's control. Miranda's
  // income is «add 1 animal to a card»: with a single animal holder in play
  // the target is unambiguous and the stage shows NO rows at all (measured:
  // `rows: []` on every passing run), while a SECOND holder — a random
  // corporation, and the deal is not reproducible — turns it into a CHOICE,
  // and «a choice is a press, never a seeded default». `canConfirm` then
  // stays false, X is inert, and the cursor does NOT start on that row: the
  // failing runs pressed X six times into «ЦЕЛЬ ТОРГОВОЙ НАГРАДЫ · Выберите
  // себе карту…», `missing: true, focused: false`, and never moved.
  //
  // The stage marks its own unanswered rows, so drive THAT rather than a
  // guessed key sequence: walk down onto the row (step rows sort last in the
  // focus ring, so «down» always approaches them), A to descend into the
  // target step, A to take the focused candidate.
  const stepRows = async (): Promise<Array<{missing: boolean, focused: boolean}>> =>
    page.evaluate(() => Array.from(document.querySelectorAll('.con-colfocus__steprow'))
      .map((el) => ({
        missing: el.className.includes('--missing'),
        focused: el.className.includes('--focused'),
      })));
  for (let guard = 0; guard < 16; guard++) {
    const missing = (await stepRows()).find((r) => r.missing);
    if (missing === undefined) {
      break;
    }
    if (!missing.focused) {
      await press(page, 'ArrowDown', 240);
      continue;
    }
    await press(page, 'Enter', 900); // A = descend into the target step
    await press(page, 'Enter', 1200); // A = take the focused candidate
  }
  expect((await stepRows()).some((r) => r.missing),
    `a trade step stayed unanswered, so the confirm can never arm — ${await stageState()}`).toBe(false);

  const pressLog: Array<string> = [];
  let committed = false;
  for (let tries = 0; tries < 6 && !committed; tries++) {
    const verb = tries % 2 === 0 ? 'KeyX' : 'Enter';
    pressLog.push(`before ${verb}#${tries}: ${await stageState()}`);
    await page.keyboard.press(verb);
    pressLog.push(`after ${verb}#${tries}: ${await stageState()}`);
    // The budget is spent WATCHING THE TRADE rather than watching the screen
    // change — and it never presses into a live payout, because the first
    // sample that sees one stops the loop.
    for (let w = 0; w < 10 && !committed; w++) {
      await page.waitForTimeout(400);
      committed = await traded();
    }
  }
  expect(committed, 'the trade never committed: no reveal on screen and no owner-bonus batch ' +
    `on the server (stage ${await page.locator('.con-colfocus').count()}, ` +
    `colonies ${await page.locator('.con-colonies').count()}) · ${pressLog.join(' · ')}`).toBe(true);

  // THE CARD MUST BE ON THE STAGE. The bug rendered a reveal with a title, a
  // status line naming the card — and nothing in the strip.
  //
  // ⚠️ The verdict is the FOCUSED slot, not a visible node: a held card (the
  // covers are still flying, the reveal is veiled) has a box and passes
  // `toBeVisible` while the pad is still locked — pressing A there is
  // swallowed and reads as «the take is dead».
  //
  // …and when it does not, SAY WHICH BUG IT IS. A queued batch the client never
  // presented and a trade that never queued one are different defects with the
  // same symptom, and only the server's own view separates them on a runner
  // nobody can attach a debugger to.
  const focusedInReveal = await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000})
    .then(() => true).catch(() => false);
  expect(focusedInReveal, 'the owner-bonus card never took focus in the reveal — server batches ' +
    `${JSON.stringify(await serverBatches())}, reveal roots ${await page.locator('.con-reveal').count()}, ` +
    `colony stage ${await page.locator('.con-colfocus').count()}`).toBe(true);
  const revealCard = page.locator('.con-reveal [data-zoom-slot] :is(.card-container, .pcard)');
  await expect(revealCard.first(), 'the owner-bonus card never rendered in the reveal')
    .toBeVisible({timeout: 30_000});
  // …and the cover flight must have HANDED OVER before the take: while the
  // covers are airborne the real cards are held invisible under them and the
  // pad is deliberately absorbing presses (the beat-in-flight contract), so
  // pressing here would be swallowed and read as «the take is dead».
  await expect(page.locator('.con-reveal--bonus-held'), 'the covers never released the real card')
    .toHaveCount(0, {timeout: 30_000});
  await shoot(page, '02-bonus-reveal');

  const box = await revealCard.first().boundingBox();
  expect(box, 'the bonus card has no box').not.toBeNull();
  expect(box?.width ?? 0, 'the bonus card rendered collapsed').toBeGreaterThan(60);
  // …and it presents INSIDE the colony workspace, like every other payout.
  expect(await page.locator('.con-colonies .con-reveal, .con-colfocus .con-reveal').count(),
    'the payout did not present inside the colony workspace').toBeGreaterThan(0);

  // ── 4 · «Взять» must actually take it: the card leaves the reveal and the
  //      dock's count grows (the take used to be a dead press — with no slot
  //      the intake flight had no origin and never committed). ──────────────
  const handCount = async (): Promise<number> => {
    const txt = (await page.locator('.con-handdock__count, .con-handdock').first().textContent().catch(() => '')) ?? '';
    const m = /(\d+)\s*\/\s*(\d+)/.exec(txt.replace(/\s+/g, ' '));
    return m === null ? -1 : Number(m[2]);
  };
  const before = await handCount();
  console.log('── before the take ──', JSON.stringify(await diag()));
  await press(page, 'Enter', 3200); // A = take
  console.log('── after the take ──', JSON.stringify(await diag()));
  await page.waitForTimeout(2500);
  await shoot(page, '03-after-take');
  await expect(page.locator('.con-reveal'), 'the reveal never closed after the take')
    .toHaveCount(0, {timeout: 20_000});
  const after = await handCount();
  if (before >= 0 && after >= 0) {
    expect(after, `the taken card never reached the hand (${before} → ${after})`).toBeGreaterThan(before);
  }

  // ── 5 · …and the resolution closes itself: the track glide is the last beat
  //      and the workspace goes home on its own. ──────────────────────────────
  await expect(page.locator('.con-colonies'), 'the colony workspace never closed after the payout')
    .toHaveCount(0, {timeout: 25_000});
  await shoot(page, '04-closed');

  await watching;
  const order = await page.evaluate(() => (window as unknown as {__miranda?: {glideOverReveal: boolean, glideOverBlankStage: boolean, markerAtMs: number, lastTakeAtMs: number}}).__miranda);
  console.log('── glide ordering ──', JSON.stringify(order));
  expect(order?.glideOverReveal, 'the track marker glided while cards were still on the table').toBeFalsy();
  expect(order?.glideOverBlankStage, 'the track marker glided over a HIDDEN track').toBeFalsy();
  if ((order?.markerAtMs ?? -1) >= 0 && (order?.lastTakeAtMs ?? -1) >= 0) {
    expect(order?.markerAtMs, 'the track reset started before the payout was collected')
      .toBeGreaterThan(order?.lastTakeAtMs ?? 0);
  }
});
