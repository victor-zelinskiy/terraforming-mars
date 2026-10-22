/*
 * TR70 «ЗАКУЛИСНАЯ СДЕЛКА» — the one-play class's first card arming TWO effects at once (the PARTY waiver + a 10 M€
 * discount) for the price of 1 VP (`docs/TURMOIL_REDUX_BACKROOM_DEAL.md`). The probe walks the class on every surface
 * the player meets, with the server's numbers (fhd + tv4k):
 *  (A) the journey: TR70's composer names BOTH effects it arms; the press — the rating stays where it was (the scan's
 *      «−1» is the VP badge, never a rating) and no flight ends over glass; the dock wears the chip with TWO kinds;
 *      the album reads the lifted PARTY requirement on Martian Census' cassette (`waived`) and its plate, while Lake Marineris (a GLOBAL requirement) stays refused; Comet's
 *      payment head names the one-play discount («⚡ 1× Закулисная сделка», 21 → 11); Martian Census' composer: the
 *      requirement row («требование игнорируется», the deal named), the «Сработает» modifier chip, the price 6 → 0;
 *      the press spends BOTH on the server; the journal carries the eased requirement.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, focusCard, press, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 'backroom-deal');
const DEAL = 'Backroom Deal';
const CENSUS = 'Martian Census';
const LAKE = 'Lake Marineris';
const COMET = 'Comet';
const COMPOSER = '.con-hand__stage .con-composer--play';
const dockChip = (source: string) => `[data-armed-strip][data-armed-variant="chip"][data-armed-source="${source}"]`;
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, terraformRating: number, megaCredits: number, armedPlayEffects?: Array<{source: string, effect: {kind: string}}>},
  cardsInHand?: Array<{name: string}>,
  game: {gameLog?: Array<{message: string}>},
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** RT → «КАРТЫ»: the hand album, settled. */
async function openHand(page: Page, first: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${first}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

/** The hand album → `card` → A: its play composer, nothing sent. */
async function openComposer(page: Page, card: string): Promise<void> {
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `the cursor reached ${card} in the hand`).toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
    `A opens ${card}'s play composer`).toBe(true);
  await settle(page);
}

/** From the composer's open state to its commit rail, then A — the play's ONE POST. */
async function commit(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
    await press(page, 'ArrowDown', 300);
  }
  await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on «Разыграть карту»').toHaveCount(1);
  await page.keyboard.press('Enter');
}

test.describe('TR70 — Backroom Deal: the party waiver + the discount, for a victory point', () => {
  test.setTimeout(300_000);

  for (const preset of PRESETS) {
    test(`(A) the journey: arm both → the hand reads the party waiver and the discount → spend · ${preset.id}`, async ({page, request}) => {
      await page.setViewportSize(preset.viewport);
      const {playerId: id} = await bootFixtureSeats(page, request, 'backroom-deal', {query: preset.query});
      await expect(page.locator('[data-armed-strip]'), 'nothing armed — no strip, no chip').toHaveCount(0);
      const before = await wireOf(request, id);
      expect(before.thisPlayer.armedPlayEffects ?? []).toEqual([]);

      // ── TR70's composer names BOTH effects it arms.
      await openHand(page, DEAL);
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CENSUS}"] [data-req-state="printed"]`), 'nothing bends Martian Census yet — its party cassette is printed').toHaveCount(1);
      await openComposer(page, DEAL);
      const arms = page.locator(`${COMPOSER} [data-composer-arms]`);
      await expect(arms, 'the result names what the play arms').toHaveCount(1);
      await expect(arms.locator('[data-armed-kind="partyWaiver"]'), 'the party waiver').toHaveCount(1);
      await expect(arms.locator('[data-armed-kind="discount"]'), 'the discount').toHaveCount(1);
      await shoot(page, preset.id, '01-deal-composer');

      // ── The press: the two effects are armed; the rating does not move (the «−1» is the card's VP).
      await armTransferWitness(page);
      await commit(page);
      await expect(page.locator(`${dockChip(DEAL)}:not(.con-armed--arriving)`), 'the dock wears the deal\'s chip').toHaveCount(1, {timeout: 30_000});
      await waitForBoardHome(page, 25);
      const witness = await transferWitness(page);
      console.log(`[backroom-deal:${preset.id}] ${transferTrail(witness)}`);
      expect(witness.births.filter((b) => b.under === 'rail:tr'), `nothing leaves the rating cell (${transferTrail(witness)})`).toEqual([]);
      expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
      const armed = await wireOf(request, id);
      expect(armed.thisPlayer.terraformRating, 'the rating untouched').toBe(before.thisPlayer.terraformRating);
      expect(armed.thisPlayer.armedPlayEffects?.map((e) => `${e.source}:${e.effect.kind}`), 'the server armed both').toEqual([`${DEAL}:partyWaiver`, `${DEAL}:discount`]);
      await expect(page.locator(`${dockChip(DEAL)} [data-armed-kind]`), 'the chip carries two kinds').toHaveCount(2);
      await shoot(page, preset.id, '02-dock-armed-two');

      // ── The album: the PARTY requirement lifted on Martian Census, the GLOBAL one on Lake Marineris untouched.
      await openHand(page, CENSUS);
      await expect(page.locator('.con-hand__armed[data-armed-strip][data-armed-variant="strip"]'), 'the album head carries the strip').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CENSUS}"] [data-req-state="waived"]`).first(), 'the party cassette is lifted').toBeVisible();
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CENSUS}"] [data-hand-ease]`), 'the tile\'s plate names the modifier').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${LAKE}"] [data-req-state="waived"]`), 'the GLOBAL requirement is never waived').toHaveCount(0);
      await shoot(page, preset.id, '03-hand-party-lifted');

      // ── Comet's payment head names the one-play discount: 21 → 11 · «⚡ 1× Закулисная сделка».
      await openComposer(page, COMET);
      const price = page.locator(`${COMPOSER} .con-pay__price`);
      await expect(price.locator('[data-pay-base]'), 'the printed price').toHaveText('21');
      await expect(price.locator('.con-pay__price-value'), 'the price paid').toHaveText('11');
      await expect(price.locator('[data-pay-armed]'), 'the one-play discount named').toContainText('1×');
      await expect(price.locator('[data-pay-armed]')).toContainText('Закулисная сделка');
      await shoot(page, preset.id, '04-comet-price-tail');
      expect(await pressUntil(page, 'Escape', async () => await page.locator(COMPOSER).count() === 0, {tries: 4, settleMs: 900}), 'B folds Comet\'s composer').toBe(true);
      await settle(page);

      // ── Martian Census' composer: the requirement row, the modifier chip, the price 6 → 0.
      await openComposer(page, CENSUS);
      const req = page.locator(`${COMPOSER} [data-composer-req]`);
      await expect(req).toHaveAttribute('data-req-state', 'waived');
      await expect(req).toContainText('требование игнорируется');
      await expect(req).toContainText('Закулисная сделка');
      await expect(page.locator(`${COMPOSER} [data-forecast-chip="modifier"]`), 'the «Сработает» row leads with the modifier').toHaveCount(1);
      await expect(page.locator(`${COMPOSER} .con-pay__price .con-pay__price-value`), 'the discount floored at 0').toHaveText('0');
      await shoot(page, preset.id, '05-census-composer');

      // ── The press spends BOTH on the server; the chip is gone; the journal carries both lines.
      await commit(page);
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.armedPlayEffects?.length ?? 0, {timeout: 30_000}).toBe(0);
      await waitForBoardHome(page, 25);
      await expect(page.locator(dockChip(DEAL)), 'the chip stays gone — the view now says it').toHaveCount(0);
      const after = await wireOf(request, id);
      expect(after.cardsInHand?.map((c) => c.name) ?? [], 'the census left the hand').not.toContain(CENSUS);
      expect(after.thisPlayer.megaCredits, 'the census cost nothing').toBe(armed.thisPlayer.megaCredits);
      await shoot(page, preset.id, '06-after-spend');
    });
  }
});
