import {test, expect, Page} from './consoleTest';
import {
  corporationsExcluding, createGameWithCards, fetchPlayerModel, openConsole,
  pressUntil, seedGameOverApi, settle, soloGameConfig,
} from './consoleStart';
import {armWitness, witnessOf} from './witness';

/** The two recorded flights: the claimed steel, and the M€ that resolve by themselves on the return. */
const CLAIM_FLIGHT = 'head-start-claim-flight';
const AUTO_FLIGHT = 'head-start-auto-flight';

/**
 * «ФОРА» (Head Start) — THE BONUS-ACTION TURN, end to end.
 *
 * The card grants two ORDINARY actions taken IMMEDIATELY, during the PRELUDES
 * phase. So the window has to FEEL like an ordinary turn — every action the
 * rules allow, on every surface — and the preparation has to resume afterwards.
 * The flow is: the workspace ANNOUNCES the trip → the player confirms → the
 * workspace LETS GO of the screen entirely → the bonuses are spent as a normal
 * turn → the workspace COMES BACK to finish the preparation.
 *
 * Five claims, each of which was a separate way to get this wrong:
 *  1. the stage stands INSIDE the workspace and names what it is (`1/2`),
 *     rather than the board silently appearing;
 *  2. `A` hands the screen over — the workspace is GONE, not merely hidden.
 *     While it merely hid, it stayed the HOST for every step: the hand
 *     teleported into its hidden zone (no cards at all) and walking to another
 *     screen DEFERRED it, after which every board action was refused with
 *     «сначала завершите текущее действие» — about a decision the player had
 *     been sent away to make;
 *  3. the hand therefore opens as its OWN screen, with the player's cards in it;
 *  4. the LT wheel refuses «Пас» / «Пропустить ход» and says WHY — and refuses
 *     nothing else;
 *  5. the ORDERING CHOICE is real: the briefing offers the card's gains as
 *     claimable rows (a claim costs no action), and whatever the player does
 *     not claim arrives BY ITSELF when the window closes — computed against
 *     the hand as it stands then, which is what «after» means;
 *  6. spending the last bonus brings the workspace BACK, exactly once.
 */

const HEAD_START = 'Head Start';
const OTHER_PRELUDE = 'Allied Bank';

function preludeConfig(): Record<string, unknown> {
  return soloGameConfig({
    expansions: {corpera: true, promo: true, prelude: true},
    customPreludes: [HEAD_START, OTHER_PRELUDE],
    // A corporation with no mandatory first action of its own: that action is a
    // legitimate way to spend a bonus, and it has its OWN stage — a different
    // story than this one.
    customCorporationsList: corporationsExcluding(),
    startingPreludes: 2,
  });
}

/**
 * Spend ONE bonus action FROM THE BROWSER — LT wheel → «Конвертация тепла»
 * (the one basic action that needs no payment, no board space and no
 * follow-up, and `testMode` guarantees the heat).
 *
 * Deliberately NOT over the API: the client refuses a poll-driven refresh
 * while the VIEWER holds a prompt (partial input must survive), so answering
 * this player's own prompt from another HTTP client would leave the browser
 * looking at a state the server left minutes ago — a probe artifact that says
 * nothing about the product.
 */
async function spendOneBonus(page: Page): Promise<void> {
  // act → verify → retry: LT until the wheel stands (a press swallowed by a beat of the last spend is sent again).
  expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}),
    'the basic-actions wheel').toBe(true);
  await page.keyboard.press('ArrowRight'); // the heat-conversion slot
  // ON A QUICK WHEEL THE DIRECTION PRESS *IS* THE ACTIVATION — the wheel's own departure is the witness it landed.
  await expect(page.locator('.con-quick'), 'the heat slot activated — the wheel left').toHaveCount(0, {timeout: 10_000});
}

/** One frame of the resource-transfer language: chips in the air, and what the panel reads WHILE they fly. */
type TransferSeen = {chips: number, panel: string, rail: number};

/**
 * WATCH THE RESOURCE-TRANSFER LANGUAGE — RECORDED (FLAKE ZERO — `armWitness`,
 * armed before the press, off the product's own writes): a short flight can
 * no longer be slept through. `settled`: «the panel was still holding when the
 * chip took off» is an ORDER claim — a sample is the state a task LEAVES.
 */
async function startTransferProbe(page: Page, key: string): Promise<void> {
  await armWitness<TransferSeen>(page, key, () => {
    const read = (row: string): string =>
      document.querySelector(`.con-res__row--${row} .con-res__value`)?.textContent?.trim() ?? '';
    const chips = document.querySelectorAll('.con-transfer__chip').length;
    // The player rail's own paint (its opacity, rounded): the landing zone of every chip — and a STANDING rail.
    const railEl = document.querySelector('.con-res');
    const rail = railEl === null ? -1 : Math.round(Number(getComputedStyle(railEl).opacity) * 100) / 100;
    return {chips, panel: chips > 0 ? `${read('steel')}|${read('megacredits')}` : '', rail};
  }, {settled: true});
}

type TransferProbe = {samples: number, maxChips: number, heldPanel: Array<string>, railMin: number};

/** The record, stopped and folded on the Node side (`samples` = distinct states, never frames). */
async function readTransferProbe(page: Page, key: string): Promise<TransferProbe> {
  const seen = (await witnessOf<TransferSeen>(page, key).stop()).map((s) => s.v);
  return {
    samples: seen.length,
    maxChips: Math.max(0, ...seen.map((v) => v.chips)),
    heldPanel: seen.filter((v) => v.chips > 0).map((v) => v.panel),
    railMin: Math.min(1, ...seen.map((v) => v.rail)),
  };
}

/** The blocked slots' reasons, read out of the open LT wheel. */
async function blockedReasons(page: Page): Promise<Array<string>> {
  await page.keyboard.press('Comma');
  await expect(page.locator('.con-quick'), 'the LT wheel opens on the live bonus menu')
    .toBeVisible({timeout: 10_000});
  const reasons = await page.locator('.con-quick__slot-reason').allTextContents();
  await page.keyboard.press('Escape');
  await expect(page.locator('.con-quick'), 'the wheel closes again').toHaveCount(0, {timeout: 10_000});
  return reasons;
}

test.describe('console — Head Start bonus actions', () => {
  test.setTimeout(180_000);

  test('announces the trip, hands the whole board over, refuses only to pass, and comes back', async ({page, request}) => {
    const playerId = await createGameWithCards(request, [], {config: preludeConfig()});
    // The API seeder answers the pregame and stops on the first ACTION MENU —
    // which, with Head Start played, is the first BONUS action.
    await seedGameOverApi(request, playerId, {
      preludes: [HEAD_START, OTHER_PRELUDE],
      first: HEAD_START,
      // A non-empty hand: «Фора» pays 2 M€ per project card held, and the hand
      // is one of the surfaces this probe is about.
      buy: 3,
    });

    const seeded = await fetchPlayerModel(request, playerId);
    const marker = (seeded.waitingFor as {bonusActionPrompt?: {granted?: number}} | undefined)?.bonusActionPrompt;
    expect(marker, 'the server marks the bonus action menu structurally').toBeDefined();
    expect(marker?.granted).toBe(2);
    expect((seeded.thisPlayer as {bonusActions?: number}).bonusActions,
      'and the LEDGER is public, so every seat can read the window').toBe(2);

    await openConsole(page, playerId);

    // ── 1. THE STAGE STANDS, and it names itself ────────────────────────────
    await expect(page.locator('.con-start__bonusact'), 'the workspace announces the trip')
      .toBeVisible({timeout: 30_000});
    await expect(page.locator('.con-start__bonusact-count')).toHaveText('1/2');
    // The CTA names the DESTINATION (the press moves the player, it performs
    // nothing) and promises the return, or the hand-off reads as a dismissal.
    await expect(page.locator('.con-start__bonusact-cta')).toBeVisible();
    await expect(page.locator('.con-start__bonusact-cta-tail')).toBeVisible();

    // ── 1b. THE ORDERING CHOICE — claim the steel BEFORE the actions ────────
    await expect(page.locator('.con-start__gainrow'), 'both gains offered').toHaveCount(2);
    // The panel's cursor is in VISUAL order — the rows are drawn ABOVE the
    // CTA it opens on, so ↑↑ walks up to the steel row.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.con-start__gainrow').nth(0)).toHaveClass(/--focused/);
    // A GAIN IS A REWARD, so it arrives like every other one in this console: a
    // chip out of the thing that produced it, onto its row in the panel, its
    // delta chip firing at the TOUCHDOWN. It used to be a number that simply
    // changed — no flight, no contact, nothing to connect the card to the
    // counter.
    await startTransferProbe(page, CLAIM_FLIGHT);
    await page.keyboard.press('Enter');
    await expect(page.locator('.con-start__gainrow'), 'the claimed row is gone')
      .toHaveCount(1, {timeout: 20_000});
    const claimed = await fetchPlayerModel(request, playerId);
    expect((claimed.thisPlayer as {steel?: number}).steel, 'the steel arrived early (base 500)').toBe(502);
    expect((claimed.thisPlayer as {bonusActions?: number}).bonusActions, 'claiming cost no action').toBe(2);

    // THE PANEL LANDS ON THE COMMITTED VALUE — and not before the chip does.
    // Read the probe only once it HAS, or the sampler is stopped mid-flight and
    // reports a flight that had not started yet (measured: 1 sample).
    await expect
      .poll(() => page.locator('.con-res__row--steel .con-res__value').first().textContent(),
        {timeout: 20_000, message: 'the steel lands on the panel'})
      .toBe('502');
    const claimFlight = await readTransferProbe(page, CLAIM_FLIGHT);
    expect(claimFlight.samples, 'the probe was alive (a dead recorder passes everything)').toBeGreaterThan(0);
    expect(claimFlight.maxChips, 'the steel physically flew to the panel').toBeGreaterThan(0);
    // …and THE PANEL WAS STILL HOLDING when the chip took off — that hold is
    // what makes the delta chip fire at the CONTACT instead of at the commit,
    // which is the entire point of the language. (The LAST samples legitimately
    // read the new value: `arrival: 'auto'` absorbs the chip a beat AFTER the
    // touchdown that released the hold, so the tail of a flight is decoration
    // over an already-landed number.)
    expect(claimFlight.heldPanel[0],
      `the steel row jumped before its chip took off: ${claimFlight.heldPanel.join(' ')}`)
      .toMatch(/^500\|/);

    // ── 2. A HANDS THE SCREEN OVER — COMPLETELY ─────────────────────────────
    await page.keyboard.press('Enter');
    await expect(page.locator('.con-start'), 'the workspace lets go of the screen')
      .toHaveCount(0, {timeout: 20_000});
    // Nothing is owed and nothing is deferred: this is an ordinary turn.
    await expect(page.locator('.con-mandatory'), 'no decision is owed on the board').toHaveCount(0);

    // ── 3. THE HAND IS THE PLAYER'S OWN SCREEN, WITH THEIR CARDS IN IT ──────
    await page.keyboard.press('Period'); // RT wheel
    // The wheel STANDS and its entrance is over (a state — never a fixed 900 ms) before the A that picks «Карты».
    await expect(page.locator('.con-quick'), 'the RT wheel opens').toBeVisible({timeout: 10_000});
    await settle(page);
    await page.keyboard.press('Enter'); // «Карты»
    await expect(page.locator('.con-hand'), 'the hand opens').toBeVisible({timeout: 20_000});
    await expect
      .poll(() => page.locator('.con-hand .pcard').count(),
        {timeout: 15_000, message: 'the bought cards are actually in it'})
      .toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 15_000});

    // ── 4. THE WHEEL REFUSES THE TURN-CONTROL VERBS, AND NOTHING ELSE ───────
    const reasons = await blockedReasons(page);
    // The two turn-control slots must NAME the rule. Falling back to «сейчас
    // недоступно» over a plainly live menu is exactly what this replaces, so
    // the assertion is on the WORD, not on «some reason exists».
    expect(reasons.join(' | '), 'the wheel explains the withheld turn control')
      .toMatch(/бонусн/i);
    expect(reasons.length, 'only the two turn-control slots are blocked').toBeLessThan(4);

    // ── 5. THE LAST BONUS BRINGS THE WORKSPACE BACK ─────────────────────────
    // The chip is the readout every seat shares, so it doubles as the honest
    // probe that the spend actually registered.
    const counter = page.locator('.con-status__pstatus-counter').first();
    await expect(counter, 'the first bonus is standing').toHaveText('1/2');

    await spendOneBonus(page);
    await expect(counter, 'the chip walks 1/2 → 2/2').toHaveText('2/2', {timeout: 25_000});
    await expect(page.locator('.con-start'), 'the board keeps the screen between bonuses').toHaveCount(0);

    // …and the LAST spend also RESOLVES the unclaimed gain, server-side, while
    // the player is still on the board. What they must not meet on their return
    // is a number that changed while they were not looking: the M€ come out of
    // «Фора» itself, in the workspace, once it is back.
    await startTransferProbe(page, AUTO_FLIGHT);
    await spendOneBonus(page);
    // The start workspace PAINTS again (a laid-out box, not hidden, not `display: none` — the locator's own visibility).
    await expect(page.locator('.con-start').first(), 'the workspace returns to finish the preparation')
      .toBeVisible({timeout: 40_000});
    // …and it returns to the DEPLOYMENT, not to the bonus stage it just left.
    await expect(page.locator('.con-start__bonusact')).toHaveCount(0);

    // ── 6. THE UNCLAIMED GAIN ARRIVED BY ITSELF at the window's end ─────────
    // The M€ were never claimed → resolved against the hand as it stood after
    // the actions (3 bought cards, untouched by two heat conversions) → +6.
    const final = await fetchPlayerModel(request, playerId);
    expect((final.thisPlayer as {megacredits?: number}).megacredits,
      'the M€ auto-resolved at the window\'s close (500 + 2×3)').toBe(506);
    expect((final.thisPlayer as {bonusActions?: number}).bonusActions ?? 0).toBe(0);

    // ── 7. …AND THE PLAYER SAW IT ARRIVE ───────────────────────────────────
    await expect
      .poll(() => page.locator('.con-res__row--megacredits .con-res__value').first().textContent(),
        {timeout: 20_000, message: 'the M€ land on the panel'})
      .toBe('506');
    const autoFlight = await readTransferProbe(page, AUTO_FLIGHT);
    expect(autoFlight.samples, 'the probe was alive').toBeGreaterThan(0);
    // The rail the player was reading on the board STANDS through the return — the bars materialize once per seat
    // (`startBarsStood.ts`); re-played, the whole rail blinked to opacity 0 and the M€ landing was unpainted when the
    // wave measured it (CI 43884064237).
    expect(autoFlight.railMin, 'the player rail stood through the return — no second materialization').toBe(1);
    // The flights' own trail rides the message: a wave that never flew names WHY (`bonus-gain:*` · `run:*` · `flight:*`).
    const trail = autoFlight.maxChips > 0 ? [] : await page.evaluate(() =>
      (window as unknown as {__conReady?: () => {transfer?: {trail: ReadonlyArray<unknown>}}}).__conReady?.()?.transfer?.trail ?? []);
    expect(autoFlight.maxChips, `the auto-resolved M€ flew out of «Фора» on the return — trail: ${JSON.stringify(trail)}`)
      .toBeGreaterThan(0);
    expect(autoFlight.heldPanel[0],
      `the M€ row jumped before its chip took off: ${autoFlight.heldPanel.join(' ')}`)
      .toMatch(/\|500$/);
  });
});
