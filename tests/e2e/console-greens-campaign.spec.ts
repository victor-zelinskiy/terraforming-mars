import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playQueueCard, queueCards, sendPlayerInput, settle,
  soloGameConfig, submitSummary, waitForBoardHome, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {armWitness, witnessOf} from './witness';

/**
 * TRP5 GREENS CAMPAIGN — the fourth of the six Prelude CAMPAIGNS of Turmoil Redux: «Gain 2 TR. Increase your plant
 * production 1 step. Add 3 neutral delegates to the Greens' Popular Support Area»
 * (`src/server/cards/turmoilRedux/GreensCampaign.ts`, the class `PopularSupportCampaign.ts`).
 *
 * THE START IS ONE FLOW — and the campaign's party RULES: the Greens rule generation 1 by default (the ENACTED slot is
 * empty), so their plaque stands in the GOVERNMENT (the ruler's tile, teleported into the ruler slot), and the ruling
 * Greens ANSWER the play (2 M€ per TR step, +1 M€ production for the plant production — the card-reaction scene). One
 * press, one answer: the rating and the production land with the play → the table's answer plays → only then the
 * Parliament takes the start's scene as the campaign's step («СТАРТ ПАРТИИ › … › ДЕЛЕГАТЫ»): three neutral cubes fly
 * onto the GREENS' PLAQUE IN THE GOVERNMENT, one by one — no recount, no coin → the read → the step leaves → the queue
 * shows the NEXT Prelude. One Parliament instance; no reaction face over the Parliament.
 *
 * The rules (the area, never the resolution; the ruler's area fills and waits) are pinned by
 * `tests/cards/turmoilRedux/GreensCampaign.spec.ts`; this spec is the JOURNEY on the TV profile — TRP4's stand with the
 * ruler's plaque. Order claims are RECORDED from BEFORE the press (`armWitness`, every state a task leaves) — a
 * TIMING-class spec (`timingSpecs.ts`).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'greens-campaign', PRESET.id);
const CARD = 'Greens Campaign';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';
const PARTY = 'Greens';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>};
type Wire = {
  thisPlayer: {color: string, terraformRating: number, plantProduction: number, megacredits: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, coloniesModel?: Array<{name: string}>},
  game: {parliament: {slots: Array<WireSlot>, popularSupport: Record<string, number>, lastRally?: {card?: string, recount: boolean, megacredits: number, votes: Array<unknown>}}},
};
/**
 * The record folded. The counts are of recorded STATES (never frames) and are only ever compared with zero — «did it
 * ever happen» / «never».
 */
type Probe = {
  samples: number, parlMax: number, crumbs: Array<string>, beats: Array<string>,
  supportShown: Array<number>, countChip: number, degraded: Array<string>, parlWhileDrawing: number,
  /** States of the SUPPORT beat with the Greens' plaque painted on top (its centre hit-tests inside its own tile) / covered. */
  plaqueSeen: number, plaqueCovered: number,
  /** States of the SUPPORT beat with the Greens' plaque inside the government's ruler slot (the ruler's tile). */
  plaqueInRulerSlot: number,
  /** States of the SUPPORT beat with a card reaction's face painted on screen. */
  reactionOverRally: number,
};
/** ONE observation of the screen — what stands now (the reader's answer; the folding is `readProbe`'s). */
type RallySeen = {
  parls: number, beat: string, degraded: string | null, shown: number | null,
  plaque: '' | 'seen' | 'covered', inRuler: boolean, reaction: boolean,
  countChip: boolean, drawing: boolean, crumbs: Array<string>,
};
const RALLY_WITNESS = 'trp5-rally';

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const partyVotes = (wire: Wire) => wire.game.parliament.slots.find((s) => s.party === PARTY)?.votes.length;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/**
 * From the press on: the Parliament roots, the crumbs, the rally's beats, the Greens' plaque as DRAWN, the recount chip —
 * RECORDED (FLAKE ZERO — `armWitness`, replace-proof). The reader returns what stands NOW; the folding (beats in turn,
 * the plaque's counts, «ever» / «never») is `readProbe`'s. The claims are ORDER and COEXISTENCE («one Parliament», «never
 * over a reveal», «never covered while the cubes land»), so the record is `settled` — the state a task leaves.
 */
async function armProbe(page: Page): Promise<void> {
  await armWitness<RallySeen>(page, RALLY_WITNESS, () => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const parls = document.querySelectorAll('.con-parl:not([data-parl-leaving])');
    const root = document.querySelector('.con-parl:not([data-parl-leaving])');
    const beat = root?.getAttribute('data-rally-beat') ?? '';
    const degraded = root?.getAttribute('data-parl-rally-degraded') ?? null;
    const plaque = root?.querySelector('[data-parl-support="Greens"]') ?? null;
    const shownRaw = Number(plaque?.getAttribute('data-support') ?? NaN);
    const shown = beat !== '' && !Number.isNaN(shownRaw) ? shownRaw : null;
    let seen: RallySeen['plaque'] = '';
    let inRuler = false;
    let reaction = false;
    // THE LANDING ZONE IS SEEN: while the cubes land, the Greens' plaque is on top — no dossier, no panel over it.
    if (beat === 'support' && plaque !== null) {
      const rect = plaque.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const tile = plaque.closest('.con-parl__party');
        inRuler = plaque.closest('[data-parl-ruler-slot]') !== null;
        seen = hit !== null && tile !== null && (tile.contains(hit) || hit.closest('.con-transfer, [class*="flight"], [class*="proxy"]') !== null) ?
          'seen' : 'covered';
        // …and no CARD REACTION's face stands over the Parliament while they land (a table's answer to the play — the
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
      parls: parls.length, beat, degraded, shown, plaque: seen, inRuler, reaction,
      countChip: document.querySelector('[data-parl-count-id="rally"]') !== null,
      // The Parliament may not stand while a deck scene or a reveal stands (the rally waits its turn).
      drawing: parls.length > 0 && document.querySelector('.con-deckdraw, .con-reveal') !== null,
      crumbs: Array.from(document.querySelectorAll('.con-wshead')).map(text).filter((c) => c !== ''),
    };
  }, {settled: true});
}
/** The record, folded — the recording stops here. */
async function readProbe(page: Page): Promise<Probe> {
  const samples = await witnessOf<RallySeen>(page, RALLY_WITNESS).stop();
  const p: Probe = {samples: samples.length, parlMax: 0, crumbs: [], beats: [], supportShown: [], countChip: 0, degraded: [], parlWhileDrawing: 0, plaqueSeen: 0, plaqueCovered: 0, plaqueInRulerSlot: 0, reactionOverRally: 0};
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
    if (v.inRuler) {
      p.plaqueInRulerSlot++;
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
    if (v.drawing) {
      p.parlWhileDrawing++;
    }
    for (const crumb of v.crumbs) {
      if (!p.crumbs.includes(crumb)) {
        p.crumbs.push(crumb);
      }
    }
  }
  return p;
}

test.describe('TRP5 — Greens Campaign: a Prelude\'s rating, the ruler\'s answer and its support, inside the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('the table answers, then the Parliament: three cubes onto the RULING Greens\' plaque in the government, the queue goes on', async ({page, request}) => {
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
    expect(before.game.parliament.popularSupport[PARTY] ?? 0, 'the Greens\' area is empty at the start').toBe(0);
    const partyVotesBefore = partyVotes(before);
    await shoot(page, '01-queue');

    // A on the Prelude → ONE answer: the 2 TR, the plant production, the ruling Greens' answer and the support.
    await armProbe(page);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).game.parliament.popularSupport[PARTY] ?? 0,
      {timeout: 40_000, message: 'the play\'s own answer carries the support'}).toBe(3);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.terraformRating, 'the 2 TR came with the play').toBe(before.thisPlayer.terraformRating + 2);
    expect(after.thisPlayer.plantProduction, 'the plant production came with the play').toBe(before.thisPlayer.plantProduction + 1);
    expect(after.thisPlayer.megacredits, 'the ruling Greens\' answer: 2 M€ per TR step').toBe(before.thisPlayer.megacredits + 4);
    expect(after.waitingFor?.type, 'nothing of the campaign\'s is asked').not.toBe('space');
    expect(partyVotes(after), 'the Greens\' resolution (if it is up for a vote) took none of them').toBe(partyVotesBefore);
    expect(after.game.parliament.lastRally, 'ONE record, the campaign\'s — no recount, no M€').toMatchObject({card: CARD, recount: false, megacredits: 0, votes: []});

    // The campaign's step: the Parliament takes the start's scene once the table's answer has played.
    await page.locator('.con-parl[data-rally-beat]').waitFor({timeout: 60_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the tail advances to the delegates'})
      .toMatch(/СТАРТ ПАРТИИ.*ДЕЛЕГАТЫ/);
    await shoot(page, '03-rally-in-start');
    // The frame of the FIRST cube's touchdown — the landing zone as the player sees it.
    const firstLanded = await page.waitForFunction(
      () => document.querySelector('.con-parl [data-parl-support="Greens"]')?.getAttribute('data-support') === '1',
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
      countChip: probe.countChip, degraded: probe.degraded, parlWhileDrawing: probe.parlWhileDrawing, plaqueSeen: probe.plaqueSeen, plaqueCovered: probe.plaqueCovered, plaqueInRulerSlot: probe.plaqueInRulerSlot, reactionOverRally: probe.reactionOverRally});
    // The record keeps DISTINCT states, never frames: its floor catches only a dead recorder (`tests.md`).
    expect(probe.samples, `the probe's recorder ran (${probe.samples} states)`).toBeGreaterThan(0);
    expect(probe.parlMax, `ONE Parliament instance (${dump})`).toBe(1);
    expect(probe.parlWhileDrawing, `no Parliament while a reveal stood (${dump})`).toBe(0);
    expect(probe.plaqueInRulerSlot, `the cubes landed on the RULER's plaque, in the government (${dump})`).toBeGreaterThan(0);
    expect(probe.beats, `the rally's beats: the cubes, the read — no count, no coin (${dump})`).toEqual(expect.arrayContaining(['support', 'read']));
    expect(probe.beats.filter((b) => b === 'count' || b === 'coin'), `no recount, no coin (${dump})`).toEqual([]);
    expect(probe.countChip, `no «в игре» count on the band (${dump})`).toBe(0);
    expect(probe.degraded, `every cube's flight was measured (${dump})`).toEqual([]);
    expect(probe.plaqueSeen, `the Greens' plaque was seen while the cubes landed (${dump})`).toBeGreaterThan(0);
    expect(probe.plaqueCovered, `…and never covered (${dump})`).toBe(0);
    expect(probe.reactionOverRally, `no card reaction's face over the Parliament while the cubes land — the reaction plays first (${dump})`).toBe(0);
    expect(probe.supportShown[0], `the Greens' plaque drawn at its OLD count first (${dump})`).toBe(0);
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
