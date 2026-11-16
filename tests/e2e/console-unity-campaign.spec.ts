import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, placeTile, playQueueCard, pressUntil, queueCards, sendPlayerInput, settle,
  soloGameConfig, submitSummary, waitForBoardHome, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {armWitness, Witness} from './witness';

/**
 * TRP2 UNITY CAMPAIGN — the first of the six Prelude CAMPAIGNS of Turmoil Redux: «Gain 3 titanium. Place a colony. Add
 * 3 neutral delegates to Unity's Popular Support Area» (`src/server/cards/turmoilRedux/UnityCampaign.ts`, the class
 * `PopularSupportCampaign.ts`).
 *
 * THE START IS ONE FLOW: A on the Prelude in the queue → the titanium is the play's → the colonies take the start's
 * step («СТАРТ ПАРТИИ › … › КОЛОНИИ») → A builds → the colonies step leaves → the Parliament takes the start's scene as
 * the campaign's step («… › ДЕЛЕГАТЫ»): three neutral cubes fly from the common supply onto UNITY'S PLAQUE, one by one
 * (the plaque draws each on its touchdown) — never onto Unity's resolution, no recount, no coin → the read → the step
 * leaves, one level → the queue shows the NEXT Prelude. One Parliament instance, the crumb only ever gaining a tail.
 *
 * The rule (the area, never the resolution — rulebook p.9 / p.11 step 5) is pinned by
 * `tests/cards/turmoilRedux/UnityCampaign.spec.ts`; this spec is the JOURNEY on the TV profile. Order claims are RECORDED
 * from BEFORE the press (`armWitness`, settled — never a sampler of our own) — a TIMING-class spec (`timingSpecs.ts`).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'unity-campaign', PRESET.id);
const CARD = 'Unity Campaign';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';
const UNITY = 'Unity';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>};
type Wire = {
  thisPlayer: {color: string, titanium: number, coloniesCount: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, coloniesModel?: Array<{name: string}>},
  game: {parliament: {slots: Array<WireSlot>, popularSupport: Record<string, number>, lastRally?: {card?: string, recount: boolean, megacredits: number, votes: Array<unknown>}}},
};
/** The recording folded on the Node side — every count is a count of recorded STATES (never of frames). */
type Probe = {
  samples: number, parlMax: number, crumbs: Array<string>, beats: Array<string>,
  unitySupport: Array<number>, countChip: number, degraded: Array<string>, parlWhileColonies: number, parlWhilePlacing: number,
  /** States of the SUPPORT beat with Unity's plaque painted on top (its centre hit-tests inside Unity's own tile) / covered. */
  unitySeen: number, unityCovered: number,
  /** States of the SUPPORT beat with a card reaction's face painted on screen. */
  reactionOverRally: number,
};
/** One moment as the reader sees it. */
type Seen = {
  parls: number, beat: string, degraded: string | null, shown: number | null,
  /** The SUPPORT beat only: the plaque painted on top / covered ('' when it has no box), a reaction face over it. */
  plaque: 'seen' | 'covered' | '', reactionOver: boolean,
  countChip: boolean, parlWhileColonies: boolean, parlWhilePlacing: boolean, crumbs: Array<string>,
};
const PROBE = 'trp2-rally';

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const unityVotes = (wire: Wire) => wire.game.parliament.slots.find((s) => s.party === UNITY)?.votes.length;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/**
 * From the press on: the Parliament roots, the crumbs, the rally's beats, Unity's plaque as DRAWN, the recount chip —
 * RECORDED (`armWitness`: the product's own writes observed in the task that makes them, a frame tick for what only a
 * computed style moves). The claims are about coexistence and order («one Parliament», «not while the colonies step or
 * its placement stands», the plaque only ever growing) — `settled`: a sample is the state a task leaves, the state a
 * frame can paint.
 */
async function armProbe(page: Page): Promise<Witness<Seen>> {
  return armWitness<Seen, string>(page, PROBE, (party) => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const parls = document.querySelectorAll('.con-parl:not([data-parl-leaving])');
    const root = document.querySelector('.con-parl:not([data-parl-leaving])');
    const beat = root?.getAttribute('data-rally-beat') ?? '';
    const shownRaw = Number(root?.querySelector(`[data-parl-support="${party}"]`)?.getAttribute('data-support') ?? NaN);
    let plaqueState: 'seen' | 'covered' | '' = '';
    let reactionOver = false;
    // THE LANDING ZONE IS SEEN: while the cubes land, Unity's plaque is on top — no dossier, no panel over it.
    if (beat === 'support') {
      const plaque = root?.querySelector(`[data-parl-support="${party}"]`);
      const rect = plaque?.getBoundingClientRect();
      if (plaque !== undefined && plaque !== null && rect !== undefined && rect.width > 0 && rect.height > 0) {
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const tile = plaque.closest('.con-parl__party');
        plaqueState = hit !== null && tile !== null && (tile.contains(hit) || hit.closest('.con-transfer, [class*="flight"], [class*="proxy"]') !== null) ?
          'seen' : 'covered';
        // …and no CARD REACTION's face stands over the Parliament while they land (the ruling Greens' answer to the
        // colony's heat production is the server's EARLIER effect: it plays first, the rally after — its face is
        // pointer-events: none, so the hit test above cannot see it).
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
            reactionOver = true;
            break;
          }
        }
      }
    }
    const crumbs: Array<string> = [];
    document.querySelectorAll('.con-wshead').forEach((el) => {
      const crumb = text(el);
      if (crumb !== '' && !crumbs.includes(crumb)) {
        crumbs.push(crumb);
      }
    });
    return {
      parls: parls.length,
      beat,
      degraded: root?.getAttribute('data-parl-rally-degraded') ?? null,
      shown: beat !== '' && !Number.isNaN(shownRaw) ? shownRaw : null,
      plaque: plaqueState,
      reactionOver,
      countChip: document.querySelector('[data-parl-count-id="rally"]') !== null,
      // The Parliament may not stand while the colonies step is still the start's step (the rally waits its turn).
      parlWhileColonies: parls.length > 0 && document.querySelector('.con-start__colonystep .con-colonies') !== null,
      // …nor while a board placement the colony's bonus asked for stands (Europa's ocean).
      parlWhilePlacing: parls.length > 0 && document.querySelector('.con-context__task-kicker') !== null,
      crumbs,
    };
  }, {args: UNITY, settled: true});
}

/** The recording folded: sequences with repeats collapsed, «ever» as a count of recorded states, the crumbs in order. */
async function readProbe(probe: Witness<Seen>): Promise<Probe> {
  const seen = await probe.values();
  const collapsed = <T>(xs: Array<T>): Array<T> => xs.filter((x, i) => i === 0 || x !== xs[i - 1]);
  const states = (pred: (s: Seen) => boolean) => seen.filter(pred).length;
  const crumbs: Array<string> = [];
  for (const crumb of seen.flatMap((s) => s.crumbs)) {
    if (!crumbs.includes(crumb)) {
      crumbs.push(crumb);
    }
  }
  return {
    samples: seen.length,
    parlMax: Math.max(0, ...seen.map((s) => s.parls)),
    crumbs,
    beats: collapsed(seen.map((s) => s.beat).filter((b) => b !== '')),
    unitySupport: collapsed(seen.map((s) => s.shown).filter((n): n is number => n !== null)),
    countChip: states((s) => s.countChip),
    degraded: [...new Set(seen.map((s) => s.degraded).filter((d): d is string => d !== null))],
    parlWhileColonies: states((s) => s.parlWhileColonies),
    parlWhilePlacing: states((s) => s.parlWhilePlacing),
    unitySeen: states((s) => s.plaque === 'seen'),
    unityCovered: states((s) => s.plaque === 'covered'),
    reactionOverRally: states((s) => s.reactionOver),
  };
}

test.describe('TRP2 — Unity Campaign: a Prelude\'s colony and its support, inside the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('the colony is the start\'s step, then the Parliament: three cubes onto Unity\'s PLAQUE (never its resolution), the queue goes on', async ({page, request}) => {
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
    expect(before.game.parliament.popularSupport[UNITY] ?? 0, 'Unity\'s area is empty at the start').toBe(0);
    const unityVotesBefore = unityVotes(before);
    await shoot(page, '01-queue');

    // A on the Prelude → the titanium comes with the play, the colony asks, the support WAITS behind it.
    const rally = await armProbe(page);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type ?? 'none',
      {timeout: 40_000, message: 'the server raises the colony pick after the Prelude'}).toBe('colony');
    const asked = await wireOf(request, playerId);
    expect(asked.thisPlayer.titanium, 'the titanium came with the play').toBe(before.thisPlayer.titanium + 3);
    expect(asked.game.parliament.popularSupport[UNITY] ?? 0, 'the support waits for the colony').toBe(0);
    await page.locator('.con-start__colonystep .con-colonies').waitFor({timeout: 40_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb: the start\'s flow, the colonies step'})
      .toMatch(/СТАРТ ПАРТИИ.*КОЛОНИИ/);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, '02-colony-step');

    // THE BUILD: A focuses a tile, A builds.
    await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 4, settleMs: 1800});
    await page.locator('.con-colfocus').waitFor({timeout: 20_000});
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.coloniesCount, {timeout: 30_000, message: 'the server: a colony built'})
      .toBe(before.thisPlayer.coloniesCount + 1);
    // THE COLONY'S OWN BONUS MAY ASK (the deal is the seed's and the pool's: Europa places an ocean) — the support stands
    // BEHIND it (the printed order, BACK_OF_THE_LINE), and the bonus's placement is answered on the board.
    let bonusPlacements = 0;
    for (let i = 0; i < 60; i++) {
      const wire = await wireOf(request, playerId);
      if ((wire.game.parliament.popularSupport[UNITY] ?? 0) > 0) {
        break;
      }
      if (wire.waitingFor?.type === 'space' && await page.locator('.con-context__task-kicker').count() > 0) {
        expect(wire.game.parliament.popularSupport[UNITY] ?? 0, 'the support waits for the colony\'s bonus placement').toBe(0);
        expect(await placeTile(page), 'the colony\'s bonus tile was placed').toBe(true);
        bonusPlacements++;
        continue;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    test.info().annotations.push({type: 'colony-bonus', description: `bonus placements answered: ${bonusPlacements}`});
    const after = await wireOf(request, playerId);
    expect(after.game.parliament.popularSupport[UNITY], 'three neutrals in Unity\'s AREA').toBe(3);
    expect(unityVotes(after), 'Unity\'s resolution (if it is up for a vote) took none of them').toBe(unityVotesBefore);
    expect(after.game.parliament.lastRally, 'ONE record, the campaign\'s — no recount, no M€').toMatchObject({card: CARD, recount: false, megacredits: 0, votes: []});

    // The campaign's step: the Parliament takes the start's scene once the colony is built.
    await page.locator('.con-parl[data-rally-beat]').waitFor({timeout: 60_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the tail advances to the delegates'})
      .toMatch(/СТАРТ ПАРТИИ.*ДЕЛЕГАТЫ/);
    await shoot(page, '03-rally-in-start');
    // The frame of the FIRST cube's touchdown — the landing zone as the player sees it.
    const firstLanded = await page.waitForFunction(
      () => document.querySelector('.con-parl [data-parl-support="Unity"]')?.getAttribute('data-support') === '1',
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
    const probe = await readProbe(rally);
    const dump = JSON.stringify({crumbs: probe.crumbs, beats: probe.beats, parlMax: probe.parlMax, unitySupport: probe.unitySupport,
      countChip: probe.countChip, degraded: probe.degraded, parlWhileColonies: probe.parlWhileColonies, parlWhilePlacing: probe.parlWhilePlacing, unitySeen: probe.unitySeen, unityCovered: probe.unityCovered, reactionOverRally: probe.reactionOverRally});
    expect(probe.samples, `the recording ran (${probe.samples} states)`).toBeGreaterThan(0);
    expect(probe.parlMax, `ONE Parliament instance (${dump})`).toBe(1);
    expect(probe.parlWhileColonies, `the Parliament waited for the colonies step to leave (${dump})`).toBe(0);
    expect(probe.parlWhilePlacing, `…and for the colony bonus's placement (${dump})`).toBe(0);
    expect(probe.beats, `the rally's beats: the cubes, the read — no count, no coin (${dump})`).toEqual(expect.arrayContaining(['support', 'read']));
    expect(probe.beats.filter((b) => b === 'count' || b === 'coin'), `no recount, no coin (${dump})`).toEqual([]);
    expect(probe.countChip, `no «в игре» count on the band (${dump})`).toBe(0);
    expect(probe.degraded, `every cube's flight was measured (${dump})`).toEqual([]);
    expect(probe.unitySeen, `Unity's plaque was seen while the cubes landed (${dump})`).toBeGreaterThan(0);
    expect(probe.unityCovered, `…and never covered (${dump})`).toBe(0);
    expect(probe.reactionOverRally, `no card reaction's face over the Parliament while the cubes land — the reaction plays first (${dump})`).toBe(0);
    expect(probe.unitySupport[0], `Unity's plaque drawn at its OLD count first (${dump})`).toBe(0);
    expect(probe.unitySupport[probe.unitySupport.length - 1], `…and at three by the end (${dump})`).toBe(3);
    expect(probe.unitySupport.every((n, i, all) => i === 0 || n >= all[i - 1]), `the plaque only ever grows, cube by cube (${dump})`).toBe(true);
    expect(probe.crumbs.some((c) => /КОЛОНИИ/i.test(c)), `the crumb named the colonies (${dump})`).toBe(true);
    expect(probe.crumbs.some((c) => /ДЕЛЕГАТЫ/i.test(c)), `…then the delegates (${dump})`).toBe(true);
    expect(probe.crumbs.filter((c) => /^Парламент/i.test(c)), `no head of the Parliament's own (${dump})`).toEqual([]);

    expect(await playQueueCard(page, SECOND_PRELUDE), 'the second Prelude was played').toBe(true);
    await waitForBoardHome(page);
    const done = await wireOf(request, playerId);
    expect(done.thisPlayer.tableau.map((c) => c.name), 'both Preludes on the table').toEqual(expect.arrayContaining([CARD, SECOND_PRELUDE]));
    expect(errors, 'no page errors').toEqual([]);
  });
});
