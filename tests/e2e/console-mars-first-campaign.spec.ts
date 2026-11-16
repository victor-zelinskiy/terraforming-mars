import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, placeTile, playQueueCard, queueCards, sendPlayerInput, settle,
  soloGameConfig, submitSummary, waitForBoardHome, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {armWitness, witnessOf} from './witness';

/**
 * TRP3 MARS FIRST CAMPAIGN — the second of the six Prelude CAMPAIGNS of Turmoil Redux: «Place a city tile. Increase your
 * steel production 1 step. Add 3 neutral delegates to Mars First's Popular Support Area»
 * (`src/server/cards/turmoilRedux/MarsFirstCampaign.ts`, the class `PopularSupportCampaign.ts`).
 *
 * THE START IS ONE FLOW: A on the Prelude in the queue → the steel production is the play's → the start yields the
 * board to the city's placement (two presses) → the city lands → the start takes the screen back and the Parliament
 * takes its scene as the campaign's step («СТАРТ ПАРТИИ › … › ДЕЛЕГАТЫ»): three neutral cubes fly from the common supply
 * onto MARS FIRST'S PLAQUE, one by one — never onto Mars First's resolution, no recount, no coin → the read → the step
 * leaves, one level → the queue shows the NEXT Prelude. One Parliament instance; no Parliament while the city is still
 * being placed.
 *
 * The rule (the area, never the resolution — rulebook p.9 / p.11 step 5) is pinned by
 * `tests/cards/turmoilRedux/MarsFirstCampaign.spec.ts`; this spec is the JOURNEY on the TV profile — TRP2's stand
 * (`console-unity-campaign`) with the board's placement instead of the colonies step. Order claims are RECORDED from
 * BEFORE the press (`armWitness`, every state a task leaves) — a TIMING-class spec (`timingSpecs.ts`).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'mars-first-campaign', PRESET.id);
const CARD = 'Mars First Campaign';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';
const PARTY = 'Mars First';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>};
type Wire = {
  thisPlayer: {color: string, steelProduction: number, citiesCount: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, coloniesModel?: Array<{name: string}>},
  game: {parliament: {slots: Array<WireSlot>, popularSupport: Record<string, number>, lastRally?: {card?: string, recount: boolean, megacredits: number, votes: Array<unknown>}}},
};
/**
 * The record folded. The counts are of recorded STATES (never frames) and are only ever compared with zero — «did it
 * ever happen» / «never».
 */
type Probe = {
  samples: number, parlMax: number, crumbs: Array<string>, beats: Array<string>,
  supportShown: Array<number>, countChip: number, degraded: Array<string>, parlWhilePlacing: number,
  /** States of the SUPPORT beat with Mars First's plaque painted on top (its centre hit-tests inside its own tile) / covered. */
  plaqueSeen: number, plaqueCovered: number,
  /** States of the SUPPORT beat with a card reaction's face painted on screen. */
  reactionOverRally: number,
};
/** ONE observation of the screen — what stands now (the reader's answer; the folding is `readProbe`'s). */
type RallySeen = {
  parls: number, beat: string, degraded: string | null, shown: number | null,
  plaque: '' | 'seen' | 'covered', reaction: boolean, countChip: boolean, placing: boolean, crumbs: Array<string>,
};
const RALLY_WITNESS = 'trp3-rally';

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const partyVotes = (wire: Wire) => wire.game.parliament.slots.find((s) => s.party === PARTY)?.votes.length;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/**
 * From the press on: the Parliament roots, the crumbs, the rally's beats, Mars First's plaque as DRAWN, the recount chip
 * — RECORDED (FLAKE ZERO — `armWitness`, replace-proof). The reader returns what stands NOW; the folding (beats in turn,
 * the plaque's counts, «ever» / «never») is `readProbe`'s. The claims are ORDER and COEXISTENCE («one Parliament», «never
 * while the city is placed», «never covered while the cubes land»), so the record is `settled` — the state a task leaves.
 */
async function armProbe(page: Page): Promise<void> {
  await armWitness<RallySeen>(page, RALLY_WITNESS, () => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const parls = document.querySelectorAll('.con-parl:not([data-parl-leaving])');
    const root = document.querySelector('.con-parl:not([data-parl-leaving])');
    const beat = root?.getAttribute('data-rally-beat') ?? '';
    const degraded = root?.getAttribute('data-parl-rally-degraded') ?? null;
    const plaque = root?.querySelector('[data-parl-support="Mars First"]') ?? null;
    const shownRaw = Number(plaque?.getAttribute('data-support') ?? NaN);
    const shown = beat !== '' && !Number.isNaN(shownRaw) ? shownRaw : null;
    let seen: RallySeen['plaque'] = '';
    let reaction = false;
    // THE LANDING ZONE IS SEEN: while the cubes land, Mars First's plaque is on top — no dossier, no panel over it.
    if (beat === 'support' && plaque !== null) {
      const rect = plaque.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const tile = plaque.closest('.con-parl__party');
        seen = hit !== null && tile !== null && (tile.contains(hit) || hit.closest('.con-transfer, [class*="flight"], [class*="proxy"]') !== null) ?
          'seen' : 'covered';
        // …and no CARD REACTION's face stands over the Parliament while they land (a table's answer to the city — the
        // server's EARLIER effect — plays first, the rally after; a face is pointer-events: none, so the hit test
        // above cannot see it).
        for (const face of document.querySelectorAll<HTMLElement>('.con-reaction .pcard')) {
          const b = face.getBoundingClientRect();
          let op = 1;
          for (let n: HTMLElement | null = face; n !== null; n = n.parentElement) {
            const st = getComputedStyle(n);
            if (st.visibility === 'hidden' || st.display === 'none') {
              op = 0;
              break;
            }
            op *= Number(st.opacity);
          }
          if (b.width > 0 && b.height > 0 && op > 0.05) {
            reaction = true;
            break;
          }
        }
      }
    }
    return {
      parls: parls.length, beat, degraded, shown, plaque: seen, reaction,
      countChip: document.querySelector('[data-parl-count-id="rally"]') !== null,
      // The Parliament may not stand while the city is still being placed (the rally waits its turn).
      placing: parls.length > 0 && document.querySelector('.con-context__task-kicker') !== null,
      crumbs: Array.from(document.querySelectorAll('.con-wshead')).map(text).filter((c) => c !== ''),
    };
  }, {settled: true});
}
/** The record, folded — the recording stops here. */
async function readProbe(page: Page): Promise<Probe> {
  const samples = await witnessOf<RallySeen>(page, RALLY_WITNESS).stop();
  const p: Probe = {samples: samples.length, parlMax: 0, crumbs: [], beats: [], supportShown: [], countChip: 0, degraded: [], parlWhilePlacing: 0, plaqueSeen: 0, plaqueCovered: 0, reactionOverRally: 0};
  for (const {v} of samples) {
    p.parlMax = Math.max(p.parlMax, v.parls);
    if (v.beat !== '' && p.beats[p.beats.length - 1] !== v.beat) {
      p.beats.push(v.beat);
    }
    if (v.degraded !== null && !p.degraded.includes(v.degraded)) {
      p.degraded.push(v.degraded);
    }
    if (v.shown !== null && p.supportShown[p.supportShown.length - 1] !== v.shown) {
      p.supportShown.push(v.shown);
    }
    if (v.plaque === 'seen') {
      p.plaqueSeen++;
    } else if (v.plaque === 'covered') {
      p.plaqueCovered++;
    }
    if (v.reaction) {
      p.reactionOverRally++;
    }
    if (v.countChip) {
      p.countChip++;
    }
    if (v.placing) {
      p.parlWhilePlacing++;
    }
    for (const crumb of v.crumbs) {
      if (!p.crumbs.includes(crumb)) {
        p.crumbs.push(crumb);
      }
    }
  }
  return p;
}

test.describe('TRP3 — Mars First Campaign: a Prelude\'s city and its support, inside the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('the city is placed on the board, then the Parliament: three cubes onto Mars First\'s PLAQUE (never its resolution), the queue goes on', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true, prelude: true},
      startingCorporations: 1,
      customCorporationsList: [CORP],
      customPreludes: [CARD, SECOND_PRELUDE, 'Business Empire', 'Mohole'],
    })});
    // THE REAL START (the Proteus / TRP1 precedent): the wizard answered through the console.
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
    for (let i = 0; i < 20; i++) {
      const wire = await wireOf(request, playerId);
      if (wire.waitingFor?.type === 'colony') {
        await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wire.waitingFor.coloniesModel ?? [])[0]?.name ?? ''});
        break;
      }
      if (wire.thisPlayer.tableau.some((c) => c.name === CORP) && wire.waitingFor?.type !== 'colony') {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    expect(before.game.parliament.popularSupport[PARTY] ?? 0, 'Mars First\'s area is empty at the start').toBe(0);
    const partyVotesBefore = partyVotes(before);
    await shoot(page, '01-queue');

    // A on the Prelude → the steel production comes with the play, the city asks, the support WAITS behind it.
    await armProbe(page);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type ?? 'none',
      {timeout: 40_000, message: 'the server raises the city\'s cell pick after the Prelude'}).toBe('space');
    const asked = await wireOf(request, playerId);
    expect(asked.thisPlayer.steelProduction, 'the steel production came with the play').toBe(before.thisPlayer.steelProduction + 1);
    expect(asked.game.parliament.popularSupport[PARTY] ?? 0, 'the support waits for the city').toBe(0);
    await page.locator('.con-context__task-kicker').waitFor({timeout: 40_000});
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, '02-city-placement');

    // THE PLACEMENT: two presses on a legal cell (the two-phase commit — `placeTile`).
    expect(await placeTile(page), 'the city was placed').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.citiesCount, {timeout: 30_000, message: 'the server: a city placed'})
      .toBe(before.thisPlayer.citiesCount + 1);
    const after = await wireOf(request, playerId);
    expect(after.game.parliament.popularSupport[PARTY], 'three neutrals in Mars First\'s AREA').toBe(3);
    expect(partyVotes(after), 'Mars First\'s resolution (if it is up for a vote) took none of them').toBe(partyVotesBefore);
    expect(after.game.parliament.lastRally, 'ONE record, the campaign\'s — no recount, no M€').toMatchObject({card: CARD, recount: false, megacredits: 0, votes: []});

    // The campaign's step: the Parliament takes the start's scene once the city has landed.
    await page.locator('.con-parl[data-rally-beat]').waitFor({timeout: 60_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the tail advances to the delegates'})
      .toMatch(/СТАРТ ПАРТИИ.*ДЕЛЕГАТЫ/);
    await shoot(page, '03-rally-in-start');
    // The frame of the FIRST cube's touchdown — the landing zone as the player sees it.
    const firstLanded = await page.waitForFunction(
      () => document.querySelector('.con-parl [data-parl-support="Mars First"]')?.getAttribute('data-support') === '1',
      undefined, {timeout: 10_000, polling: 20}).then(() => true, () => false);
    if (firstLanded) {
      await shoot(page, '03a-first-cube-landed');
    }
    // The frame of the landed cubes — the read beat is short; a missed frame is not a failure (the probe holds the claims).
    if (await page.locator('.con-parl[data-rally-beat="read"]').waitFor({timeout: 15_000}).then(() => true, () => false)) {
      await shoot(page, '03b-rally-read');
    }
    await expect.poll(() => page.locator('.con-parl').count(), {timeout: 60_000, message: 'the step leaves once the rally is read'}).toBe(0);

    // THE QUEUE GOES ON.
    await waitQueueIdle(page);
    await expect.poll(() => queueCards(page), {timeout: 30_000, message: 'the next Prelude is in the queue'}).toContain(SECOND_PRELUDE);
    await shoot(page, '04-queue-goes-on');
    const probe = await readProbe(page);
    const dump = JSON.stringify({crumbs: probe.crumbs, beats: probe.beats, parlMax: probe.parlMax, supportShown: probe.supportShown,
      countChip: probe.countChip, degraded: probe.degraded, parlWhilePlacing: probe.parlWhilePlacing, plaqueSeen: probe.plaqueSeen, plaqueCovered: probe.plaqueCovered, reactionOverRally: probe.reactionOverRally});
    // The record keeps DISTINCT states, never frames: its floor catches only a dead recorder (`tests.md`).
    expect(probe.samples, `the probe's recorder ran (${probe.samples} states)`).toBeGreaterThan(0);
    expect(probe.parlMax, `ONE Parliament instance (${dump})`).toBe(1);
    expect(probe.parlWhilePlacing, `no Parliament while the city was being placed (${dump})`).toBe(0);
    expect(probe.beats, `the rally's beats: the cubes, the read — no count, no coin (${dump})`).toEqual(expect.arrayContaining(['support', 'read']));
    expect(probe.beats.filter((b) => b === 'count' || b === 'coin'), `no recount, no coin (${dump})`).toEqual([]);
    expect(probe.countChip, `no «в игре» count on the band (${dump})`).toBe(0);
    expect(probe.degraded, `every cube's flight was measured (${dump})`).toEqual([]);
    expect(probe.plaqueSeen, `Mars First's plaque was seen while the cubes landed (${dump})`).toBeGreaterThan(0);
    expect(probe.plaqueCovered, `…and never covered (${dump})`).toBe(0);
    expect(probe.reactionOverRally, `no card reaction's face over the Parliament while the cubes land — the reaction plays first (${dump})`).toBe(0);
    expect(probe.supportShown[0], `Mars First's plaque drawn at its OLD count first (${dump})`).toBe(0);
    expect(probe.supportShown[probe.supportShown.length - 1], `…and at three by the end (${dump})`).toBe(3);
    expect(probe.supportShown.every((n, i, all) => i === 0 || n >= all[i - 1]), `the plaque only ever grows, cube by cube (${dump})`).toBe(true);
    expect(probe.crumbs.some((c) => /ДЕЛЕГАТЫ/i.test(c)), `the crumb named the delegates (${dump})`).toBe(true);
    expect(probe.crumbs.filter((c) => /^Парламент/i.test(c)), `no head of the Parliament's own (${dump})`).toEqual([]);

    expect(await playQueueCard(page, SECOND_PRELUDE), 'the second Prelude was played').toBe(true);
    await waitForBoardHome(page);
    const done = await wireOf(request, playerId);
    expect(done.thisPlayer.tableau.map((c) => c.name), 'both Preludes on the table').toEqual(expect.arrayContaining([CARD, SECOND_PRELUDE]));
    expect(errors, 'no page errors').toEqual([]);
  });
});
