/*
 * TR80 HARTLAN HEATING — the third new corporation of Turmoil Redux and the first owner of the CARD-REACTION
 * framework («СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК», `docs/claude/console/card-reaction.md`,
 * `docs/TURMOIL_REDUX_HARTLAN_HEATING.md`). The `hartlan-heating` fixture on the TV profile — blue on Hartlan alone:
 *
 *  B · A GREEN CARD WITH NO TILE (Research): the composer promises NOTHING — no «Сработает» row, no Hartlan in the
 *      R3 layer (Hartlan is not «almost» on it);
 *  C · THE ACTION («12 heat → 2 cards»): the ACTION COMMIT — the price leaves the heat row FIRST (born on the row,
 *      absorbed into the hero's printed heat), the deck answers with ONE batch of two, taken into the hand;
 *  A · A GREEN CARD THAT PLACES A TILE (Nuclear Zone): the composer's «Сработает: +6 [heat] +1 [M€ prod]» (bare
 *      deltas, both chips named by their rail rows), R3 → the layer's «Вы получите» with Hartlan's own face as the
 *      focused source; A → ONE POST → the staged placement → the landing: the corporation RISES OUT OF ITS PLACE on
 *      the receiving stage, six heat tokens are born on ITS printed heat and land on the heat row (ticking on the
 *      touchdowns), the production token on its plate — every end visible, nothing over glass; the server: +6 heat,
 *      +1 M€ production.
 * TIMING class (`timingSpecs.ts`): the births are sampled motion — run `--exclusive --workers=1` on the box.
 * The rule itself (the printed class, the forecast twin, the record) is pinned server-side.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, fetchPlayerModel, focusCard, openActionFocus, openCardActions, placeTile, press, pressUntil, settle, takeRevealCards,
  waitForBoardHome,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 'hartlan');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const HARTLAN = 'Hartlan Heating';
const TILE_CARD = 'Nuclear Zone';
const PLAIN_CARD = 'Research';

type Wire = {
  thisPlayer: {color: string, megacredits: number, megacreditProduction: number, heat: number, cardsInHandNbr?: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string}>,
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, PRESET.id, `${name}.png`)});
}

function writeTrail(scene: string, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/hartlan-${scene}-${PRESET.id}.txt`, trail);
}

const composer = (page: Page) => page.locator('.con-composer--play');
const forecastRow = (page: Page) => page.locator('.con-composer--play [data-forecast-row]');
const layer = (page: Page) => page.locator('.con-composer__fxlayer');

/** Open the hand workspace and descend into `card`'s play composer (the forecast spec's road). */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1400);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/** Leave the composer and the hand — back to the board home. */
async function closeToBoard(page: Page): Promise<void> {
  expect(await pressUntil(page, 'Escape', async () => await composer(page).count() === 0, {tries: 4, settleMs: 900}), 'B must fold the composer').toBeTruthy();
  expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 900}), 'B must leave the hand').toBeTruthy();
  await settle(page);
}

/** The reaction scene's phases, sampled on a task clock (never rAF) — the witness that the reactor ROSE before anything was born. */
async function armReactionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__reaction: Array<{t: number, phase: string, emerged: string, seated: string}>};
    w.__reaction = [];
    let last = '';
    window.setInterval(() => {
      const phase = document.querySelector('.con-reaction')?.getAttribute('data-reaction-phase') ?? 'none';
      const emerged = Array.from(document.querySelectorAll('.con-recv__emerge[data-played-key]')).map((e) => e.getAttribute('data-played-key')).join('|');
      const seated = Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card]')).map((e) => e.getAttribute('data-reaction-card')).join('|');
      const now = `${phase}/${emerged}/${seated}`;
      if (now !== last) {
        last = now;
        w.__reaction.push({t: performance.now(), phase, emerged, seated});
      }
    }, 16);
  });
}

async function reactionProbe(page: Page): Promise<Array<{t: number, phase: string, emerged: string, seated: string}>> {
  return page.evaluate(() => (window as unknown as {__reaction?: Array<{t: number, phase: string, emerged: string, seated: string}>}).__reaction ?? []);
}

test.describe(`console · TR80 Hartlan Heating · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('B · C · A — nothing promised without a tile; the action pays its heat first; a green tile card wakes the corporation out of its place', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (/card-reaction|rail-reward|transfer/.test(m.text())) {
        console.log(`[page ${m.type()}] ${m.text()}`);
      }
    });
    const playerId = await bootFixture(page, request, 'hartlan-heating', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const start = await wireOf(request, playerId);
    expect(start.thisPlayer.tableau.map((c) => c.name), 'blue is on Hartlan Heating').toContain(HARTLAN);
    expect(start.thisPlayer.heat, 'the fixture: 12 heat for the action').toBe(12);

    // ── B · a green card with NO tile: nothing promised, nothing in the layer.
    await openPlayComposer(page, PLAIN_CARD);
    await expect(forecastRow(page), 'Research wakes nothing — no «Сработает» row').toHaveCount(0);
    await shoot(page, 'B-01-research-no-row');
    await closeToBoard(page);

    // ── C · the action: 12 heat → 2 cards. The price leaves the rail FIRST, the deck answers with ONE batch.
    const beforeAction = await wireOf(request, playerId);
    await openCardActions(page);
    const focusedTile = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
    for (let i = 0; i < 24 && await focusedTile() !== HARTLAN; i++) {
      await press(page, moves[i % moves.length], 260);
    }
    expect(await focusedTile(), 'the action tile of Hartlan is focused').toBe(HARTLAN);
    await openActionFocus(page);
    await settle(page);
    await shoot(page, 'C-01-action-composer');
    await armTransferWitness(page);
    // The deck answers either through the card-actions composer's OWN arrival beat (`.con-deal-proxy` — Ф3(2)) or
    // through the deck layer (`.con-deckdraw`); either is «the deck dealt».
    const deckSeen = {deal: false};
    const deckSampler = page.waitForFunction(() => document.querySelector('.con-deckdraw, .con-deal-proxy') !== null, undefined, {timeout: 60_000})
      .then(() => {
        deckSeen.deal = true;
      }).catch(() => {});
    // A commits the action from the composer's commit row.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-deckdraw, .con-reveal').count() > 0, {tries: 3, settleMs: 2500}),
      'A commits the action and the deck answers').toBeTruthy();
    await deckSampler;
    await takeRevealCards(page);
    await settle(page, {timeoutMs: 40_000});
    await waitForBoardHome(page, 30);
    const witnessC = await transferWitness(page);
    writeTrail('c', transferTrail(witnessC));
    expect(endsOverGlass(witnessC), `every end of the action's flights was visible\n${transferTrail(witnessC)}`).toEqual([]);
    const priceBirths = witnessC.births.filter((b) => b.under === 'rail:heat');
    expect(priceBirths.length, `the price was born on the heat row (PL-099)\n${transferTrail(witnessC)}`).toBeGreaterThan(0);
    const priceLandings = witnessC.landings.filter((l) => priceBirths.some((b) => b.id === l.id));
    expect(priceLandings.every((l) => l.under === 'hero'), `…and absorbed into the hero's printed heat\n${transferTrail(witnessC)}`).toBe(true);
    expect(deckSeen.deal, 'the deck dealt').toBe(true);
    const afterAction = await wireOf(request, playerId);
    expect(afterAction.thisPlayer.heat, 'the price was paid').toBe(beforeAction.thisPlayer.heat - 12);
    expect((afterAction.cardsInHand ?? []).length, 'two cards came as one batch').toBe((beforeAction.cardsInHand ?? []).length + 2);
    await shoot(page, 'C-02-after-action');

    // ── A · a green card that PLACES A TILE: the promise, the layer, then the corporation out of its place.
    await openPlayComposer(page, TILE_CARD);
    const row = forecastRow(page);
    await expect(row, 'the «Сработает» unit stands in the result cluster').toHaveCount(1);
    await expect(row.locator('[data-forecast-rail="stock:heat"]'), 'the +6 heat chip names its rail row').toHaveCount(1);
    await expect(row.locator('[data-forecast-rail="production:megacredits"]'), 'the +1 M€ production chip names its plate').toHaveCount(1);
    await shoot(page, 'A-01-row');
    expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100}), 'R3 opens the «Эффекты» layer').toBeTruthy();
    await expect(layer(page).locator('[data-forecast-group="receive"]'), '«Вы получите» stands').toHaveCount(1);
    // The forecast layer's focused tile reads in the browse DETAIL aside (the dossier stage is one A deeper).
    await expect(layer(page).locator('.con-efx__detail'), 'the focused source is Hartlan\'s own face').toContainText(HARTLAN);
    await shoot(page, 'A-02-layer');
    await press(page, 'KeyV', 900);
    await expect(layer(page)).toHaveCount(0, {timeout: 10_000});

    const beforePlay = await wireOf(request, playerId);
    await armTransferWitness(page);
    await armReactionProbe(page);
    // A → the staged placement on the board, then the commit.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 3, settleMs: 1500}),
      'A opens the staged placement').toBeTruthy();
    expect(await placeTile(page), 'the tile was placed').toBe(true);
    // The landing: the corporation comes forward out of its place on the receiving stage.
    await page.locator(`.con-recv__emerge[data-played-key="${HARTLAN}"], .con-reaction__face[data-reaction-card="${HARTLAN}"]`).first()
      .waitFor({state: 'visible', timeout: 60_000});
    await shoot(page, 'A-03-corporation-rises');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witnessA = await transferWitness(page);
    writeTrail('a', transferTrail(witnessA));
    const probe = await reactionProbe(page);
    console.log(`[${PRESET.id} reaction probe] ${JSON.stringify(probe)}`);
    expect(endsOverGlass(witnessA), `every end of the play's flights was visible\n${transferTrail(witnessA)}`).toEqual([]);
    const heatBirths = witnessA.births.filter((b) => b.under.startsWith(`reactor:${HARTLAN}:`) && /heat/.test(b.under));
    expect(heatBirths.length, `six heat tokens were born on Hartlan's printed heat\n${transferTrail(witnessA)}`).toBe(6);
    const heatLandings = witnessA.landings.filter((l) => heatBirths.some((b) => b.id === l.id));
    expect(heatLandings.every((l) => l.under === 'rail:heat'), `…and landed on the heat row\n${transferTrail(witnessA)}`).toBe(true);
    const prodBirths = witnessA.births.filter((b) => b.under.startsWith(`reactor:${HARTLAN}:`) && !/heat/.test(b.under));
    expect(prodBirths.length, `the production token was born on Hartlan's effect row\n${transferTrail(witnessA)}`).toBeGreaterThan(0);
    expect(probe.some((s) => s.emerged.includes(HARTLAN) || s.seated.includes(HARTLAN)), 'the corporation rose (emerged or seated)').toBe(true);
    const afterPlay = await wireOf(request, playerId);
    expect(afterPlay.thisPlayer.heat, 'the server: +6 heat').toBe(beforePlay.thisPlayer.heat + 6);
    expect(afterPlay.thisPlayer.megacreditProduction, 'the server: +1 M€ production').toBe(beforePlay.thisPlayer.megacreditProduction + 1);
    await shoot(page, 'A-04-board');
    expect(errors, 'no page errors').toEqual([]);
  });
});
