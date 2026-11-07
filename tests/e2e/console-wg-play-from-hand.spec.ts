import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, playCardFromHand, press, settle, walkFocusUntil} from './consoleStart';

/**
 * A PRELUDE THAT PLAYS A CARD FROM THE HAND, MID-GAME (the owner's bug, 2026-11-07): WG Project deals a prelude whose
 * play is the server's bare `projectCard` — «play a card from your hand» (P11 Eccentric Sponsor −25 M€, P10 Ecology
 * Experts — the global requirements waived). The hand that played WG Project is the surface that answers it, as the
 * NEXT STEP of the same flow: the card the prelude opens is playable there, A plays it — never «Сначала завершите текущее
 * действие» over the very hand the question is about.
 *   · `eccentric-sponsor-wg` — Space Elevator (27 M€, 11 M€ in the bank) is playable ONLY through the −25;
 *   · `ecology-experts-wg`   — Grass (−16 °C) is playable ONLY with the requirement waived.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const CASES = [
  {fixture: 'eccentric-sponsor-wg', prelude: 'Eccentric Sponsor', card: 'Space Elevator'},
  {fixture: 'ecology-experts-wg', prelude: 'Ecology Experts', card: 'Grass'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  waitingFor?: {type: string, cards?: Array<{name: string}>},
  thisPlayer: {tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

/** What stands on screen — named in a red's message, never asserted on. */
async function standing(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify({
    notice: document.querySelector('.con-notice')?.textContent ?? '',
    bar: document.querySelector('.con-cmdbar')?.textContent ?? '',
    hand: document.querySelectorAll('.con-hand').length,
    ready: (window as unknown as {__conReady?: () => unknown}).__conReady?.(),
  }));
}

test.describe('a prelude dealt by WG Project plays a card from the hand', () => {
  test.use({viewport: PRESET.viewport});
  for (const c of CASES) {
    test(`${c.prelude} — the opened card is played from the same hand`, async ({page, request}) => {
      test.setTimeout(240_000);
      const id = await bootFixture(page, request, c.fixture, {query: PRESET.query});
      await settle(page);
      expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
      const pick = '.con-hand__outcome .con-deckpick--play';
      await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
      const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
      expect(await walkFocusUntil(page, async () => await focused() === c.prelude, focused, 12), `focused ${c.prelude}`).toBeTruthy();
      await press(page, 'Enter', 400);
      await press(page, 'Period', 300); // RT — the commit
      await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 20_000, message: 'the server asks the play from the hand'}).toBe('projectCard');
      await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
      // LAW 2 — the WG Project flow's ending hands the hand to the question: it stays on screen, never the board
      // under the stranded guard.
      await expect(page.locator('.con-hand'), `the hand stays for the play-from-hand question — ${await standing(page)}`).toHaveCount(1);
      expect(await focusCard(page, c.card, 20), `the cursor reaches ${c.card} in the hand — ${await standing(page)}`).toBeTruthy();
      // LAW 1 — the hand opened FOR the question never set it aside: A opens the play composer, never the refusal.
      await press(page, 'Enter', 1200);
      await expect(page.locator('.con-notice', {hasText: 'Сначала завершите'}), 'no «finish the current action» refusal').toHaveCount(0);
      await expect(page.locator('.con-composer--play'), `the play composer opens for ${c.card} — ${await standing(page)}`).toHaveCount(1, {timeout: 15_000});
      await press(page, 'Enter', 1500); // A — «Разыграть карту»
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((t) => t.name === c.card),
        {timeout: 30_000, message: `${c.card} is played`}).toBe(true);
      await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    });
  }
});
