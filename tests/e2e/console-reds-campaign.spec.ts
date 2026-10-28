import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playQueueCard, queueCards, sendPlayerInput, settle,
  soloGameConfig, submitSummary, takeRevealCards, waitForBoardHome, waitQueueIdle, walkToSummary,
} from './consoleStart';

/**
 * TRP4 REDS CAMPAIGN — the third of the six Prelude CAMPAIGNS of Turmoil Redux: «Gain 18 M€. Draw a card. Add 3 neutral
 * delegates to the Reds' Popular Support Area» (`src/server/cards/turmoilRedux/RedsCampaign.ts`, the class
 * `PopularSupportCampaign.ts`).
 *
 * THE START IS ONE FLOW — and this campaign ASKS NOTHING: one press, one answer carrying the 18 M€, the drawn card and
 * the support. The console tells them IN THE PRINTED ORDER: the play lands with its M€ → the card is drawn (the deck's
 * scene, the card into the hand) → only then the Parliament takes the start's scene as the campaign's step
 * («СТАРТ ПАРТИИ › … › ДЕЛЕГАТЫ»): three neutral cubes fly from the common supply onto THE REDS' PLAQUE, one by one —
 * never onto the Reds' resolution, no recount, no coin → the read → the step leaves, one level → the queue shows the
 * NEXT Prelude. One Parliament instance; no Parliament while the draw is still being dealt or taken.
 *
 * The rule (the area, never the resolution — rulebook p.9 / p.11 step 5) is pinned by
 * `tests/cards/turmoilRedux/RedsCampaign.spec.ts`; this spec is the JOURNEY on the TV profile — TRP3's stand
 * (`console-mars-first-campaign`) with the draw instead of the board's placement. Order claims are sampled from BEFORE
 * the press (MutationObserver + setInterval, never rAF) — a TIMING-class spec (`timingSpecs.ts`).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'reds-campaign', PRESET.id);
const CARD = 'Reds Campaign';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';
const PARTY = 'Reds';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>};
type Wire = {
  thisPlayer: {color: string, megacredits: number, cardsInHandNbr: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, coloniesModel?: Array<{name: string}>},
  game: {parliament: {slots: Array<WireSlot>, popularSupport: Record<string, number>, lastRally?: {card?: string, recount: boolean, megacredits: number, votes: Array<unknown>}}},
};
type Probe = {
  samples: number, ticks: number, parlMax: number, crumbs: Array<string>, beats: Array<string>,
  supportShown: Array<number>, countChip: number, degraded: Array<string>, parlWhileDrawing: number,
  /** Samples of the SUPPORT beat with the Reds' plaque painted on top (its centre hit-tests inside its own tile) / covered. */
  plaqueSeen: number, plaqueCovered: number,
  /** Samples of the SUPPORT beat with a card reaction's face painted on screen. */
  reactionOverRally: number,
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const partyVotes = (wire: Wire) => wire.game.parliament.slots.find((s) => s.party === PARTY)?.votes.length;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** From the press on: the Parliament roots, the crumbs, the rally's beats, the Reds' plaque as DRAWN, the recount chip. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__trp4: Probe};
    const p: Probe = {samples: 0, ticks: 0, parlMax: 0, crumbs: [], beats: [], supportShown: [], countChip: 0, degraded: [], parlWhileDrawing: 0, plaqueSeen: 0, plaqueCovered: 0, reactionOverRally: 0};
    w.__trp4 = p;
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const parls = document.querySelectorAll('.con-parl:not([data-parl-leaving])');
      p.parlMax = Math.max(p.parlMax, parls.length);
      const root = document.querySelector('.con-parl:not([data-parl-leaving])');
      const beat = root?.getAttribute('data-rally-beat') ?? '';
      if (beat !== '' && p.beats[p.beats.length - 1] !== beat) {
        p.beats.push(beat);
      }
      const degraded = root?.getAttribute('data-parl-rally-degraded');
      if (degraded !== null && degraded !== undefined && !p.degraded.includes(degraded)) {
        p.degraded.push(degraded);
      }
      if (beat !== '') {
        const shown = Number(root?.querySelector('[data-parl-support="Reds"]')?.getAttribute('data-support') ?? NaN);
        if (!Number.isNaN(shown) && p.supportShown[p.supportShown.length - 1] !== shown) {
          p.supportShown.push(shown);
        }
      }
      // THE LANDING ZONE IS SEEN: while the cubes land, the Reds' plaque is on top — no dossier, no panel over it.
      if (beat === 'support') {
        const plaque = root?.querySelector('[data-parl-support="Reds"]');
        const rect = plaque?.getBoundingClientRect();
        if (plaque !== undefined && plaque !== null && rect !== undefined && rect.width > 0 && rect.height > 0) {
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const tile = plaque.closest('.con-parl__party');
          if (hit !== null && tile !== null && (tile.contains(hit) || hit.closest('.con-transfer, [class*="flight"], [class*="proxy"]') !== null)) {
            p.plaqueSeen++;
          } else {
            p.plaqueCovered++;
          }
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
              p.reactionOverRally++;
              break;
            }
          }
        }
      }
      if (document.querySelector('[data-parl-count-id="rally"]') !== null) {
        p.countChip++;
      }
      // The Parliament may not stand while the draw is still being dealt or taken (the rally waits its turn).
      if (parls.length > 0 && document.querySelector('.con-deckdraw, .con-reveal') !== null) {
        p.parlWhileDrawing++;
      }
      document.querySelectorAll('.con-wshead').forEach((el) => {
        const crumb = text(el);
        if (crumb !== '' && !p.crumbs.includes(crumb)) {
          p.crumbs.push(crumb);
        }
      });
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  });
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__trp4: Probe}).__trp4);

test.describe('TRP4 — Reds Campaign: a Prelude\'s M€, its draw and its support, inside the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('the card is drawn, then the Parliament: three cubes onto the Reds\' PLAQUE (never their resolution), the queue goes on', async ({page, request}) => {
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
    expect(before.game.parliament.popularSupport[PARTY] ?? 0, 'the Reds\' area is empty at the start').toBe(0);
    const partyVotesBefore = partyVotes(before);
    await shoot(page, '01-queue');

    // A on the Prelude → ONE answer: the 18 M€, the drawn card and the support (nothing is asked).
    await armProbe(page);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).game.parliament.popularSupport[PARTY] ?? 0,
      {timeout: 40_000, message: 'the play\'s own answer carries the support'}).toBe(3);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits, 'the 18 M€ came with the play').toBe(before.thisPlayer.megacredits + 18);
    expect(after.thisPlayer.cardsInHandNbr, 'one card drawn into the hand').toBe(before.thisPlayer.cardsInHandNbr + 1);
    expect(after.waitingFor?.type, 'nothing of the campaign\'s is asked').not.toBe('space');
    expect(partyVotes(after), 'the Reds\' resolution (if it is up for a vote) took none of them').toBe(partyVotesBefore);
    expect(after.game.parliament.lastRally, 'ONE record, the campaign\'s — no recount, no M€').toMatchObject({card: CARD, recount: false, megacredits: 0, votes: []});

    // THE DRAW FIRST (the printed order): a card the console presents for the taking is taken; the step follows.
    for (let i = 0; i < 60 && await page.locator('.con-parl[data-rally-beat]').count() === 0; i++) {
      if (await page.locator('.con-reveal').count() > 0) {
        await shoot(page, '02-draw');
        await takeRevealCards(page);
        continue;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // The campaign's step: the Parliament takes the start's scene once the card is in the hand.
    await page.locator('.con-parl[data-rally-beat]').waitFor({timeout: 60_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the tail advances to the delegates'})
      .toMatch(/СТАРТ ПАРТИИ.*ДЕЛЕГАТЫ/);
    await shoot(page, '03-rally-in-start');
    // The frame of the FIRST cube's touchdown — the landing zone as the player sees it.
    const firstLanded = await page.waitForFunction(
      () => document.querySelector('.con-parl [data-parl-support="Reds"]')?.getAttribute('data-support') === '1',
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
      countChip: probe.countChip, degraded: probe.degraded, parlWhileDrawing: probe.parlWhileDrawing, plaqueSeen: probe.plaqueSeen, plaqueCovered: probe.plaqueCovered, reactionOverRally: probe.reactionOverRally});
    expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(5);
    expect(probe.parlMax, `ONE Parliament instance (${dump})`).toBe(1);
    expect(probe.parlWhileDrawing, `no Parliament while the draw was dealt or taken (${dump})`).toBe(0);
    expect(probe.beats, `the rally's beats: the cubes, the read — no count, no coin (${dump})`).toEqual(expect.arrayContaining(['support', 'read']));
    expect(probe.beats.filter((b) => b === 'count' || b === 'coin'), `no recount, no coin (${dump})`).toEqual([]);
    expect(probe.countChip, `no «в игре» count on the band (${dump})`).toBe(0);
    expect(probe.degraded, `every cube's flight was measured (${dump})`).toEqual([]);
    expect(probe.plaqueSeen, `the Reds' plaque was seen while the cubes landed (${dump})`).toBeGreaterThan(0);
    expect(probe.plaqueCovered, `…and never covered (${dump})`).toBe(0);
    expect(probe.reactionOverRally, `no card reaction's face over the Parliament while the cubes land — the reaction plays first (${dump})`).toBe(0);
    expect(probe.supportShown[0], `the Reds' plaque drawn at its OLD count first (${dump})`).toBe(0);
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
