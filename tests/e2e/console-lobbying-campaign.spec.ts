import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playQueueCard, queueCards, sendPlayerInput, settle, soloGameConfig,
  submitSummary, waitForBoardHome, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {armWitness, witnessOf} from './witness';

/**
 * TRP1 LOBBYING CAMPAIGN — the first PRELUDE of Turmoil Redux: «Increase your M€ production 2 steps. Add 2 delegates to
 * a resolution. Advance your Agenda marker 1 step» (`src/server/cards/turmoilRedux/LobbyingCampaign.ts`).
 *
 * THE START IS ONE FLOW, and a Prelude that asks the Parliament is answered INSIDE it: A on the Prelude in the queue →
 * the card lands on «РАЗЫГРАНО» → the Parliament takes the start's scene in its VOTE mode («СТАРТ ПАРТИИ › … ›
 * ГОЛОСОВАНИЕ», the first action's road — TR83) → A → TWO cubes leave the reserve for the chosen card → the SAME step
 * continues one stage deeper («… › КАРЬЕРА»): the marker walks its one step on the track, its bonus is read → the step
 * leaves, one level → the queue shows the NEXT Prelude, the opening goes on. Never a second Parliament, never a
 * Parliament leaving between the vote and the walk, the crumb only ever gaining a tail.
 *
 * The rule (the printed order on the server, the grant's count, the named skip) is pinned by
 * `tests/cards/turmoilRedux/LobbyingCampaign.spec.ts`; this spec is the JOURNEY on the TV profile. Order claims are
 * RECORDED from BEFORE the press (`armWitness`) — a TIMING-class spec (`timingSpecs.ts`).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'lobbying-campaign', PRESET.id);
const CARD = 'Lobbying Campaign';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>};
type WireSeat = {color: string, reserve: number, agenda: number, influence: number};
type Wire = {
  thisPlayer: {color: string, megacreditProduction: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, votePrompt?: {source?: string, count?: number}, coloniesModel?: Array<{name: string}>},
  game: {parliament: {slots: Array<WireSlot>, players: Array<WireSeat>, lastAdvance?: {from: number, to: number, reason: string, card?: string}}},
};
type Probe = {samples: number, ticks: number, parlMax: number, leaving: number, crumbs: Array<string>, beats: Array<string>, voteUpWhileWalk: number};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const seatOf = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === wire.thisPlayer.color)!;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type Seen = {parls: number, beat: string, leaving: boolean, crumbs: Array<string>, voteUp: boolean};
const TRP1_WITNESS = 'trp1';

/** From the press on: the Parliament roots (and whether one was ever LEAVING), the crumbs, the walk's beats —
 *  RECORDED (FLAKE ZERO — `armWitness`, `settled`: «one instance», «never left between» are claims about what a frame
 *  can paint); the reader returns what stands, the counts are folded on the Node side. */
async function armProbe(page: Page): Promise<void> {
  await armWitness<Seen>(page, TRP1_WITNESS, () => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      parls: document.querySelectorAll('.con-parl:not([data-parl-leaving])').length,
      beat: document.querySelector('.con-parl')?.getAttribute('data-walk-beat') ?? '',
      leaving: document.querySelectorAll('.con-parl[data-parl-leaving]').length > 0,
      crumbs: Array.from(document.querySelectorAll('.con-wshead')).map(text).filter((c) => c !== ''),
      voteUp: document.querySelector('.con-parl__vote--up') !== null,
    };
  }, {settled: true});
}
const readProbe = async (page: Page): Promise<Probe> => {
  const seen = (await witnessOf<Seen>(page, TRP1_WITNESS).stop()).map((s) => s.v);
  const p: Probe = {samples: seen.length, ticks: seen.length, parlMax: 0, leaving: 0, crumbs: [], beats: [], voteUpWhileWalk: 0};
  for (const s of seen) {
    p.parlMax = Math.max(p.parlMax, s.parls);
    if (s.beat !== '' && p.beats[p.beats.length - 1] !== s.beat) {
      p.beats.push(s.beat);
    }
    // A Parliament LEAVING before the walk has even begun = the vote step left and a second one rose (the blink
    // the in-place continuation exists to remove); the step's own leave AFTER the walk is the expected ending.
    if (p.beats.length === 0 && s.leaving) {
      p.leaving++;
    }
    for (const crumb of s.crumbs) {
      if (!p.crumbs.includes(crumb)) {
        p.crumbs.push(crumb);
      }
    }
    if (s.beat !== '' && s.voteUp) {
      p.voteUpWhileWalk++;
    }
  }
  return p;
};

test.describe('TRP1 — Lobbying Campaign: a Prelude\'s vote and walk, inside the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('the vote opens as the start\'s step, two cubes land, the SAME step continues into the walk, the queue goes on', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true, prelude: true},
      startingCorporations: 1,
      customCorporationsList: [CORP],
      customPreludes: [CARD, SECOND_PRELUDE, 'Business Empire', 'Mohole'],
    })});
    // THE REAL START (the Proteus precedent): the wizard answered through the console — its commit takes the
    // workspace's lifetime hold; seeded over the API the workspace leaves with the last prompt and hosts nothing.
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, [CORP]), 'the corporation was offered and picked').toContain(CORP);
        } else if (kind === 'prelude') {
          const got = await pickCards(p, [CARD, SECOND_PRELUDE]);
          expect(got, 'both Preludes were picked').toEqual(expect.arrayContaining([CARD, SECOND_PRELUDE]));
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});

    // The corporation first. The solo setup's colony removal is deferred ahead — answered over the API when it stands.
    expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
    // Wait for the server's STATE (the removal asked, or the corporation on the table) — a poll, never a sleep — then
    // answer the removal if it is the one asked. Bounded and never an assertion, as before.
    const settledCorp = (wire: Wire) => wire.waitingFor?.type === 'colony' || wire.thisPlayer.tableau.some((c) => c.name === CORP);
    await expect.poll(async () => settledCorp(await wireOf(request, playerId)), {timeout: 10_000}).toBe(true).catch(() => undefined);
    const corpWire = await wireOf(request, playerId);
    if (corpWire.waitingFor?.type === 'colony') {
      await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (corpWire.waitingFor.coloniesModel ?? [])[0]?.name ?? ''});
    }
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    const seat0 = seatOf(before);
    expect(before.game.parliament.slots.length, 'three resolutions up for the vote').toBe(3);
    expect(seat0.agenda, 'the marker is not on the track yet').toBe(0);
    await shoot(page, '01-queue');

    // A on the Prelude → the server raises the GRANT (two delegates), the production is already +2, the marker has not moved.
    await armProbe(page);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.votePrompt?.source ?? 'none',
      {timeout: 40_000, message: 'the server raises the delegate grant after the Prelude'}).toBe('grant');
    const asked = await wireOf(request, playerId);
    expect(asked.waitingFor?.votePrompt?.count, 'the grant offers TWO delegates').toBe(2);
    expect(asked.thisPlayer.megacreditProduction, 'the production came with the play').toBe(before.thisPlayer.megacreditProduction + 2);
    expect(seatOf(asked).agenda, 'the walk WAITS for the vote').toBe(0);
    const vote = page.locator('.con-parl__vote.con-parl__vote--up');
    try {
      await expect(vote, 'the vote mode opens inside the start flow').toHaveCount(1, {timeout: 40_000});
    } catch (e) {
      const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => unknown}).__conReady?.() ?? {}));
      console.log('[trp1-diag]', diag.slice(0, 3000), '| parl:', await page.locator('.con-parl').count(), '| crumb:', await crumbText(page));
      throw e;
    }
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb: the start\'s flow, one level deeper'})
      .toMatch(/СТАРТ ПАРТИИ.*ГОЛОСОВАНИЕ/);
    await expect(page.locator('.con-parl:not([data-parl-leaving])'), 'ONE Parliament instance').toHaveCount(1);
    await expect.poll(() => page.locator('.con-parl__slot').count(), {message: 'three cards on offer'}).toBeGreaterThanOrEqual(3);
    await shoot(page, '02-vote-in-start');

    // THE PRESS: two delegates from the RESERVE onto the chosen card — then the marker walks, in the same step.
    const chosen = await page.locator('.con-parl__slot--selected').first().getAttribute('data-party');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.votePrompt?.source ?? 'none',
      {timeout: 30_000, message: 'the grant was answered'}).not.toBe('grant');
    const after = await wireOf(request, playerId);
    const mine = after.game.parliament.slots.map((s) => ({party: s.party, n: s.votes.filter((v) => v.owner === after.thisPlayer.color).length}));
    expect(mine.filter((s) => s.n > 0), 'TWO delegates, on the chosen card').toEqual([{party: chosen, n: 2}]);
    expect(seatOf(after).reserve, 'both left the RESERVE').toBe(seat0.reserve - 2);
    expect(seatOf(after).agenda, 'the marker walked to 1, after the vote').toBe(1);
    expect(seatOf(after).influence, 'the first step seats the marker: influence 1').toBe(1);
    expect(after.game.parliament.lastAdvance, 'ONE record, the Prelude\'s').toMatchObject({from: 0, to: 1, reason: 'card', card: CARD});

    // The walk plays INSIDE the same step (the crumb's tail advances, the vote's cubes stay); then the step leaves.
    await page.locator('.con-parl[data-walk-beat]').waitFor({timeout: 40_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the tail advances to the walk'})
      .toMatch(/СТАРТ ПАРТИИ.*КАРЬЕРА/);
    await shoot(page, '03-walk-in-start');
    await expect.poll(() => page.locator('.con-parl').count(), {timeout: 60_000, message: 'the step leaves once the walk is read'}).toBe(0);

    // THE QUEUE GOES ON: the next Prelude stands, the opening finishes.
    await waitQueueIdle(page);
    await expect.poll(() => queueCards(page), {timeout: 30_000, message: 'the next Prelude is in the queue'}).toContain(SECOND_PRELUDE);
    await shoot(page, '04-queue-goes-on');
    const probe = await readProbe(page);
    const dump = JSON.stringify({crumbs: probe.crumbs, beats: probe.beats, parlMax: probe.parlMax, leaving: probe.leaving, voteUpWhileWalk: probe.voteUpWhileWalk});
    // A recording keeps DISTINCT states (never a tally of frames): the floor catches only a dead recorder.
    expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(0);
    expect(probe.parlMax, `ONE Parliament instance (${dump})`).toBe(1);
    expect(probe.leaving, `the Parliament never LEFT between the vote and the walk (${dump})`).toBe(0);
    expect(probe.beats, `the walk's beats went forward (${dump})`).toEqual(['walk', 'read', 'done']);
    expect(probe.voteUpWhileWalk, `the vote mode stood down before the walk (${dump})`).toBe(0);
    expect(probe.crumbs.some((c) => /ГОЛОСОВАНИЕ/i.test(c)), `the crumb named the vote (${dump})`).toBe(true);
    expect(probe.crumbs.some((c) => /КАРЬЕРА/i.test(c)), `…then the walk (${dump})`).toBe(true);
    // Every head the step ever drew was the START's (the stack's crumb) — never the Parliament's standalone words,
    // not even for the dissolve after the frame has left the stack (the section's head leaves whole).
    expect(probe.crumbs.filter((c) => /^Парламент/i.test(c)), `no head of the Parliament's own (${dump})`).toEqual([]);

    expect(await playQueueCard(page, SECOND_PRELUDE), 'the second Prelude was played').toBe(true);
    await waitForBoardHome(page);
    const done = await wireOf(request, playerId);
    expect(done.thisPlayer.tableau.map((c) => c.name), 'both Preludes on the table').toEqual(expect.arrayContaining([CARD, SECOND_PRELUDE]));
    expect(errors, 'no page errors').toEqual([]);
  });
});
