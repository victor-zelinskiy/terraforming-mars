import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playQueueCard, sendPlayerInput, settle, soloGameConfig,
  submitSummary, waitQueueIdle, walkToSummary,
} from './consoleStart';

/**
 * P51 HIGH CIRCLES — the thirty-third Prelude 2 card, adapted to Turmoil Redux (ledger FF): «Raise your TR 1 step and
 * draw 1 card with a party requirement. Add 2 delegates to one resolution. Effect: you have +1 influence.»
 *
 * THE START IS ONE FLOW (the TRP1 road, `console-lobbying-campaign`): A on the prelude in the queue → the rating rises,
 * the draw is a NAMED search (its rule «с требованием партии» stands on the reveal — `[data-draw-search=
 * "partyRequirement"]`), the influence is the Parliament's ledger (0 → 1) → the Parliament takes the start's scene in
 * its VOTE mode («СТАРТ ПАРТИИ › … › ГОЛОСОВАНИЕ», the grant for TWO, no law enacted yet) → A → both delegates leave
 * the reserve for ONE resolution → the queue goes on with ONE Parliament instance all along.
 *
 * The rules are pinned by `tests/cards/prelude2/HighCircles.spec.ts` (the Redux table); this stand is the JOURNEY on
 * the TV profile. Order claims are sampled from BEFORE the press (MutationObserver + setInterval).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p51', PRESET.id);
const CARD = 'High Circles';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>};
type WireSeat = {color: string, reserve: number, agenda: number, influence: number};
type Wire = {
  thisPlayer: {color: string, terraformRating: number, cardsInHandNbr: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, votePrompt?: {source?: string, count?: number}, coloniesModel?: Array<{name: string}>},
  game: {parliament: {slots: Array<WireSlot>, players: Array<WireSeat>, enacted?: unknown}},
};
type Probe = {samples: number, parlMax: number, search: number, crumbs: Array<string>};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const seatOf = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === wire.thisPlayer.color)!;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** From the press on: the Parliament roots, the search rule seen on any surface, the crumbs. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__p51: Probe};
    const p: Probe = {samples: 0, parlMax: 0, search: 0, crumbs: []};
    w.__p51 = p;
    const sample = () => {
      p.samples++;
      p.parlMax = Math.max(p.parlMax, document.querySelectorAll('.con-parl:not([data-parl-leaving])').length);
      if (document.querySelector('[data-draw-search="partyRequirement"]') !== null) {
        p.search++;
      }
      document.querySelectorAll('.con-wshead').forEach((el) => {
        const crumb = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (crumb !== '' && !p.crumbs.includes(crumb)) {
          p.crumbs.push(crumb);
        }
      });
    };
    new MutationObserver(() => sample()).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(), 30);
  });
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p51: Probe}).__p51);

test.describe('P51 — High Circles: the named search, the influence, the vote inside the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · the start: TR +1, the search names «с требованием партии», influence 0 → 1, two delegates on ONE resolution', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true, prelude: true, prelude2: true},
      startingCorporations: 1,
      customCorporationsList: [CORP],
      customPreludes: [CARD, SECOND_PRELUDE, 'Business Empire', 'Mohole'],
    })});
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, [CORP]), 'the corporation was offered and picked').toContain(CORP);
        } else if (kind === 'prelude') {
          const got = await pickCards(p, [CARD, SECOND_PRELUDE]);
          expect(got, 'both preludes were picked').toEqual(expect.arrayContaining([CARD, SECOND_PRELUDE]));
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});

    // The corporation first; the solo setup's colony removal answered over the API when it stands.
    expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
    for (let i = 0; i < 20; i++) {
      const wire = await wireOf(request, playerId);
      if (wire.waitingFor?.type === 'colony') {
        await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wire.waitingFor.coloniesModel ?? [])[0]?.name ?? ''});
        break;
      }
      if (wire.thisPlayer.tableau.some((c) => c.name === CORP)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    const seat0 = seatOf(before);
    expect(before.game.parliament.slots.length, 'three resolutions up for the vote').toBe(3);
    expect(seat0.influence, 'no influence before the card').toBe(0);
    await shoot(page, '01-queue');

    // A on the prelude → the rating, the named draw, the influence; the server raises the GRANT for two.
    await armProbe(page);
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.votePrompt?.source ?? 'none',
      {timeout: 40_000, message: 'the server raises the delegate grant after the prelude'}).toBe('grant');
    const asked = await wireOf(request, playerId);
    expect(asked.waitingFor?.votePrompt?.count, 'the grant offers TWO delegates').toBe(2);
    expect(asked.thisPlayer.terraformRating, 'TR +1 came with the play').toBe(before.thisPlayer.terraformRating + 1);
    expect(asked.thisPlayer.cardsInHandNbr, 'ONE card drawn before the vote (the search)').toBe(before.thisPlayer.cardsInHandNbr + 1);
    expect(seatOf(asked).influence, 'the Parliament\'s ledger: influence 0 → 1').toBe(1);

    // The reveal of the drawn card comes first (the draw is immediate, the grant deferred) — take it until the vote stands.
    const vote = page.locator('.con-parl__vote.con-parl__vote--up');
    for (let i = 0; i < 12 && await vote.count() === 0; i++) {
      await settle(page, {timeoutMs: 15_000}).catch(() => undefined);
      if (await vote.count() > 0) {
        break;
      }
      if (await page.locator('.con-reveal, .con-deckdraw').count() > 0) {
        await shoot(page, '02-search-reveal');
        await page.keyboard.press('Enter');
      }
    }
    try {
      await expect(vote, 'the vote mode opens inside the start flow').toHaveCount(1, {timeout: 40_000});
    } catch (e) {
      const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => unknown}).__conReady?.() ?? {}));
      console.log('[p51-diag]', diag.slice(0, 3000), '| parl:', await page.locator('.con-parl').count(), '| crumb:', await crumbText(page));
      throw e;
    }
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb: the start\'s flow, one level deeper'})
      .toMatch(/СТАРТ ПАРТИИ.*ГОЛОСОВАНИЕ/);
    await expect(page.locator('.con-parl:not([data-parl-leaving])'), 'ONE Parliament instance').toHaveCount(1);
    await shoot(page, '03-vote-in-start');

    // THE PRESS: two delegates from the RESERVE onto the chosen resolution.
    const chosen = await page.locator('.con-parl__slot--selected').first().getAttribute('data-party');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.votePrompt?.source ?? 'none',
      {timeout: 30_000, message: 'the grant was answered'}).not.toBe('grant');
    const after = await wireOf(request, playerId);
    const mine = after.game.parliament.slots.map((s) => ({party: s.party, n: s.votes.filter((v) => v.owner === after.thisPlayer.color).length}));
    expect(mine.filter((s) => s.n > 0), 'TWO delegates, on the ONE chosen resolution').toEqual([{party: chosen, n: 2}]);
    expect(seatOf(after).reserve, 'both left the RESERVE').toBe(seat0.reserve - 2);
    expect(seatOf(after).influence, 'the influence stands at 1').toBe(1);
    await settle(page, {timeoutMs: 40_000});
    await shoot(page, '04-after-vote');

    const probe = await readProbe(page);
    console.log('[p51-probe]', JSON.stringify(probe));
    expect(probe.search, 'the reveal named its rule «с требованием партии» (the search badge)').toBeGreaterThan(0);
    expect(probe.parlMax, 'never two Parliament instances').toBeLessThanOrEqual(1);
    // The queue goes on: the second prelude is still there to play.
    await waitQueueIdle(page);
    expect(await playQueueCard(page, SECOND_PRELUDE), 'the opening continues with the next prelude').toBe(true);
    expect(errors, 'no page error').toEqual([]);
  });
});
