import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, offeredCards, openConsole, pickCards, playQueueCard, press, reloadConsole,
  sendPlayerInput, settle, soloGameConfig, submitSummary, takeRevealCards, waitQueueIdle, walkToSummary,
} from './consoleStart';

/**
 * P55 OLD MINING COLONY — «Increase your titanium production 1 step. Place 1 colony. Discard 1 card» (Prelude 2,
 * `src/server/cards/prelude2/OldMiningColony.ts`). The server asks the colony FIRST (BUILD_COLONY) and the discard
 * SECOND (DISCARD_CARDS) — the first prelude of the scope with TWO hosted steps in one play, and the first whose start
 * play ASKS a discard.
 *
 * THE START IS ONE FLOW (A): A on the prelude → the colonies take the start's step inside the deployment's body → the
 * cube → the step hands the screen back after its story → the DISCARD is the start's NEXT step, in the SAME body
 * («СТАРТ ПАРТИИ › СТАРАЯ ГОРНЯЦКАЯ КОЛОНИЯ › СБРОС КАРТ»), never a plate, never nested in the colonies, never the
 * deployment unmounted (the same `.con-start__deploy` node all along) → one card chosen → the queue goes on.
 * (B) one card in hand: no step — the server discards it and records it. (C) an empty hand: the queue says the prelude
 * waits for a drawing prelude («Сначала карты»), the drawing prelude first, then P55 plays. (D) Pluto: the build's +2
 * cards are taken first, then the discard asks over all three. (E) a reload inside the discard: the step stands in the
 * start again.
 *
 * The rules are pinned by `tests/cards/prelude2/OldMiningColony.spec.ts`; the shell's reading by
 * `tests/console/startPreludeDiscard.spec.ts`. A TIMING-class spec (`timingSpecs.ts`): the order claims are sampled
 * from BEFORE the press (MutationObserver + setInterval, never rAF).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p55', PRESET.id);
const CARD = 'Old Mining Colony';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';
const COLONY_LIST = ['Luna', 'Ganymede', 'Miranda', 'Titan', 'Callisto'];

type WireCard = {name: string};
type Wire = {
  thisPlayer: {color: string, coloniesCount: number, cardsInHandNbr: number, tableau: Array<WireCard>, titaniumProduction: number},
  cardsInHand: Array<WireCard>,
  waitingFor?: {type: string, cards?: Array<WireCard>, discardPrompt?: {source?: {kind: string, card?: string}},
    coloniesModel?: Array<{name: string}>},
  game: {colonies: Array<{name: string, isActive: boolean}>, discardPileSize?: number},
};
type Probe = {
  samples: number, ticks: number,
  /** Frames a mandatory plate stood (the discard must never be announced). */
  plates: number,
  /** Frames the album stood OUTSIDE the start's hand slot while the discard was live. */
  albumOutside: number,
  /** Frames the hand was nested inside the colonies step. */
  albumInColonies: number,
  /** Frames the discard's album stood in the start's hand slot. */
  albumInSlot: number,
  /** Frames the colonies step and the hand slot stood together. */
  bothSteps: number,
  handSlotMounts: number,
  colonyStepMounts: number,
  crumbs: Array<string>,
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** `TM_E2E_STORYBOARD=1`: every painted frame of the scene, for the owner's 4K review. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** From the press on: the plate, where the album stands, the two step zones, the crumbs — and the deployment node. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__p55: Probe};
    const p: Probe = {samples: 0, ticks: 0, plates: 0, albumOutside: 0, albumInColonies: 0, albumInSlot: 0, bothSteps: 0,
      handSlotMounts: 0, colonyStepMounts: 0, crumbs: []};
    w.__p55 = p;
    const deploy = document.querySelector('.con-start__deploy');
    if (deploy !== null) {
      (deploy as unknown as {__p55Node?: boolean}).__p55Node = true;
    }
    const painted = (el: Element | null) => el !== null && (el as HTMLElement).offsetWidth > 0;
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      if (painted(document.querySelector('.con-mandatory'))) {
        p.plates++;
      }
      const slot = document.querySelector('.con-start__handslot');
      const colonies = document.querySelector('.con-start__colonystep');
      if (slot !== null && colonies !== null) {
        p.bothSteps++;
      }
      document.querySelectorAll('.con-hand').forEach((hand) => {
        if (!painted(hand)) {
          return;
        }
        if (hand.closest('.con-start__handslot') !== null) {
          p.albumInSlot++;
        } else if (hand.closest('.con-start__colonystep') !== null) {
          p.albumInColonies++;
        } else if (slot !== null) {
          p.albumOutside++;
        }
      });
      document.querySelectorAll('.con-wshead').forEach((el) => {
        const crumb = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (crumb !== '' && !p.crumbs.includes(crumb)) {
          p.crumbs.push(crumb);
        }
      });
    };
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) {
            return;
          }
          if (n.classList.contains('con-start__handslot')) {
            p.handSlotMounts++;
          }
          if (n.classList.contains('con-start__colonystep')) {
            p.colonyStepMounts++;
          }
        });
      }
      sample(false);
    }).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  });
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p55: Probe}).__p55);
const deploySurvived = (page: Page): Promise<boolean> => page.evaluate(() =>
  (document.querySelector('.con-start__deploy') as unknown as {__p55Node?: boolean} | null)?.__p55Node === true);

/**
 * The real start up to the queue, buying the first `buy` projects of the deal (the deal is the seed's — WHICH cards is
 * not this spec's subject, HOW MANY is).
 */
async function startToQueue(page: Page, request: APIRequestContext, opts: {buy: number, preludes?: ReadonlyArray<string>,
  colonies?: ReadonlyArray<string>, needColony?: string}): Promise<string> {
  const preludes = opts.preludes ?? [CARD, SECOND_PRELUDE];
  const config = soloGameConfig({
    expansions: {colonies: true, prelude: true, prelude2: true},
    startingCorporations: 1,
    customCorporationsList: [CORP],
    customPreludes: [...preludes, 'Business Empire', 'Mohole'],
    customColoniesList: [...(opts.colonies ?? COLONY_LIST)],
  });
  let playerId = '';
  // A tile the subject needs (Pluto) must be DEALT: the seed walks until the table has it.
  for (let attempt = 0; attempt < 30; attempt++) {
    playerId = await createGameWithCards(request, [], {config: {...config, seed: 0.13 + attempt * 0.029}});
    const need = opts.needColony;
    if (need === undefined || (await wireOf(request, playerId)).game.colonies.some((c) => c.name === need)) {
      break;
    }
  }
  await openConsole(page, playerId, PRESET.query);
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        expect(await pickCards(p, [CORP]), 'the corporation was offered and picked').toContain(CORP);
      } else if (kind === 'prelude') {
        const got = await pickCards(p, preludes.slice(0, 2));
        expect(got, 'both Preludes were picked').toEqual(expect.arrayContaining(preludes.slice(0, 2)));
      } else if (kind === 'project' && opts.buy > 0) {
        const offered = await offeredCards(p);
        if (offered.length > 0) {
          const got = await pickCards(p, offered.slice(0, opts.buy));
          expect(got.length, `bought ${opts.buy} of ${offered.join(', ')}`).toBe(opts.buy);
        }
      }
    },
  });
  await submitSummary(page);
  await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
  await settle(page, {timeoutMs: 30_000});
  expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
  // The solo setup's colony question (remove a tile) is not this spec's subject — answered over the API, and its step
  // must have handed the screen back on the CLIENT before the subject starts (the P48 stand's same wait).
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
  const serverAge = ((await fetchPlayerModel(request, playerId)) as unknown as {game: {gameAge: number}}).game.gameAge;
  await expect.poll(async () => page.evaluate((age) => {
    const r = (window as unknown as {__conReady?: () => {transport?: {gameAge: number}, wsFrames: Array<string>}}).__conReady?.();
    const applied = (r?.transport?.gameAge ?? -1) >= age;
    return `${applied ? 'applied' : 'behind'} ${(r?.wsFrames ?? []).some((f) => f.startsWith('colonies')) ? 'colonies-step' : 'clear'}`;
  }, serverAge), {timeout: 60_000, message: 'the setup colony step handed the screen back before the subject'}).toBe('applied clear');
  await waitQueueIdle(page);
  await settle(page, {timeoutMs: 30_000});
  return playerId;
}

/** The colony step stands in the start: A focuses a tile, A builds; `colony` names the tile when the cursor must walk. */
async function buildInStart(page: Page, request: APIRequestContext, id: string, before: number): Promise<void> {
  await page.locator('.con-start__colonystep .con-colonies').waitFor({timeout: 40_000});
  await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb: the start\'s flow, the colonies step'})
    .toMatch(/СТАРТ ПАРТИИ.*СТАРАЯ ГОРНЯЦКАЯ КОЛОНИЯ.*КОЛОНИИ/);
  for (let i = 0; i < 4 && await page.locator('.con-colfocus').count() === 0; i++) {
    await press(page, 'Enter', 1800);
  }
  await page.locator('.con-colfocus').waitFor({timeout: 20_000});
  await shoot(page, '03-build-stage');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await wireOf(request, id)).thisPlayer.coloniesCount, {timeout: 30_000, message: 'the server: a colony built'})
    .toBe(before + 1);
}

/** The discard step stands in the start's hand slot: A on the focused card answers it (one POST). */
async function discardInStart(page: Page, request: APIRequestContext, id: string): Promise<string> {
  await page.locator('.con-start__handslot .con-hand').first().waitFor({timeout: 60_000});
  await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb: the start\'s flow, the discard step'})
    .toMatch(/СТАРТ ПАРТИИ.*СТАРАЯ ГОРНЯЦКАЯ КОЛОНИЯ.*СБРОС КАРТ/);
  await settle(page, {timeoutMs: 20_000});
  await shoot(page, '05-discard-step');
  const asked = await wireOf(request, id);
  const hand = asked.cardsInHand.map((c) => c.name);
  for (let i = 0; i < 4 && (await wireOf(request, id)).waitingFor?.discardPrompt !== undefined; i++) {
    await press(page, 'Enter', 1500);
  }
  await expect.poll(async () => (await wireOf(request, id)).waitingFor?.discardPrompt === undefined,
    {timeout: 30_000, message: 'the discard was answered'}).toBe(true);
  const after = (await wireOf(request, id)).cardsInHand.map((c) => c.name);
  return hand.find((name) => !after.includes(name)) ?? '';
}

test.describe('P55 — Old Mining Colony: the colony, then the discard — two steps of the start, one flow', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A: two cards in hand — the colony step, its return, then the discard step in the SAME body, no plate', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await startToQueue(page, request, {buy: 2});
    const before = await wireOf(request, id);
    expect(before.cardsInHand.length, 'two cards bought').toBe(2);
    await shoot(page, '01-queue');

    await armProbe(page);
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type ?? 'none',
      {timeout: 40_000, message: 'the server asks the colony FIRST'}).toBe('colony');
    const asked = await wireOf(request, id);
    expect(asked.cardsInHand.length, 'nothing discarded before the build').toBe(2);
    await shoot(page, '02-colony-step');
    await buildInStart(page, request, id, before.thisPlayer.coloniesCount);
    // THE ORDER: the discard is asked in the build's response — and waits for the colony step to hand the screen back.
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.discardPrompt?.source?.card ?? 'none',
      {timeout: 30_000, message: 'the discard asked SECOND, naming the prelude'}).toBe(CARD);
    await expect.poll(() => page.locator('.con-start__colonystep').count(), {timeout: 60_000, message: 'the colony step hands the screen back'}).toBe(0);
    await shoot(page, '04-colony-returned');
    const gone = await discardInStart(page, request, id);
    expect(gone, 'one card left the hand').not.toBe('');
    // THE RETURN: the step leaves, the SAME deployment comes back — no remount.
    await expect.poll(() => page.locator('.con-start__handslot').count(), {timeout: 60_000, message: 'the discard step hands the screen back'}).toBe(0);
    await waitQueueIdle(page);
    await shoot(page, '06-returned');
    await stop();
    expect(await deploySurvived(page), 'the deployment is the SAME node (released in place, never remounted)').toBe(true);
    const probe = await readProbe(page);
    test.info().annotations.push({type: 'probe', description: JSON.stringify(probe)});
    expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(5);
    expect(probe.plates, 'no plate announced the discard').toBe(0);
    expect(probe.albumInColonies, 'the album never nested inside the colonies step').toBe(0);
    expect(probe.bothSteps, 'the two steps never stood together').toBe(0);
    expect(probe.albumOutside, 'the album never stood outside the start\'s slot').toBe(0);
    expect(probe.albumInSlot, 'the album stood in the start\'s slot').toBeGreaterThan(0);
    expect(probe.colonyStepMounts, 'the colony step mounted once').toBe(1);
    expect(probe.handSlotMounts, 'the discard step mounted once').toBe(1);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.coloniesCount, 'one colony').toBe(before.thisPlayer.coloniesCount + 1);
    expect(after.thisPlayer.titaniumProduction, 'titanium production +1').toBe(before.thisPlayer.titaniumProduction + 1);
    expect(after.cardsInHand.length, 'one card left').toBe(1);
  });

  test('B: one card in hand — no discard step; the server discards it and the start goes on', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await startToQueue(page, request, {buy: 1});
    const before = await wireOf(request, id);
    expect(before.cardsInHand.length, 'one card bought').toBe(1);
    await armProbe(page);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await buildInStart(page, request, id, before.thisPlayer.coloniesCount);
    await expect.poll(async () => (await wireOf(request, id)).cardsInHand.length, {timeout: 30_000, message: 'the last card discarded automatically'}).toBe(0);
    await expect.poll(() => page.locator('.con-start__colonystep').count(), {timeout: 60_000, message: 'the colony step hands the screen back'}).toBe(0);
    await waitQueueIdle(page);
    await shoot(page, 'B-auto-discarded');
    const probe = await readProbe(page);
    expect(probe.handSlotMounts, 'no discard step').toBe(0);
    expect(probe.plates, 'no plate').toBe(0);
  });

  test('C: an empty hand — the queue says «cards first», a drawing prelude first, then the play', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await startToQueue(page, request, {buy: 0, preludes: [CARD, 'Biolab']});
    const slot = page.locator(`.con-start__queue [data-queue-slot="${CARD}"]`);
    await expect(slot, 'the waiting prelude reads «cards first»').toContainText(/Сначала карты/, {timeout: 20_000});
    await shoot(page, 'C-cards-first');
    expect(await playQueueCard(page, 'Biolab'), 'the drawing prelude was played first').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).cardsInHand.length, {timeout: 40_000, message: 'Biolab drew'}).toBeGreaterThan(0);
    await takeRevealCards(page);
    await waitQueueIdle(page);
    await expect(slot, 'the prelude is whole again').not.toContainText(/Сначала карты/, {timeout: 20_000});
    const before = await wireOf(request, id);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await buildInStart(page, request, id, before.thisPlayer.coloniesCount);
    await discardInStart(page, request, id);
    const after = await wireOf(request, id);
    expect(after.cardsInHand.length, 'one card discarded of Biolab\'s three').toBe(before.cardsInHand.length - 1);
  });

  test('D: Pluto — the build\'s two cards are taken first, then the discard asks over all three', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await startToQueue(page, request, {buy: 1, colonies: ['Pluto', 'Luna', 'Ganymede', 'Titan', 'Callisto'], needColony: 'Pluto'});
    const before = await wireOf(request, id);
    test.skip(!before.game.colonies.some((c) => c.name === 'Pluto'), 'Pluto was not dealt on any seed tried');
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await page.locator('.con-start__colonystep .con-colonies').waitFor({timeout: 40_000});
    // WHICH tile the cursor lands on is the table's — the build is answered on the server (the subject is what follows).
    await sendPlayerInput(request, id, {type: 'colony', colonyName: 'Pluto'});
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.discardPrompt?.source?.card ?? 'none',
      {timeout: 30_000, message: 'the discard asked after the build'}).toBe(CARD);
    expect(((await wireOf(request, id)).waitingFor?.cards ?? []).length, 'three candidates: the bought card + Pluto\'s two').toBe(3);
    // The +2 are presented first — INSIDE the colony step (its own follow-up) — and taken; only then the discard step stands.
    await page.locator('.con-reveal').first().waitFor({timeout: 40_000});
    expect(await page.locator('.con-start__handslot').count(), 'no discard step while the draw stands').toBe(0);
    await takeRevealCards(page);
    await shoot(page, 'D-pluto-drawn');
    await discardInStart(page, request, id);
    await shoot(page, 'D-after');
    expect((await wireOf(request, id)).cardsInHand.length, 'two cards left').toBe(2);
  });

  test('E: a reload inside the colony step, then inside the discard — each step stands in the start again', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await startToQueue(page, request, {buy: 2});
    const before = await wireOf(request, id);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    // A reload INSIDE THE COLONY STEP (the P48 gap): the step stands in the start again, under the start's crumb.
    await page.locator('.con-start__colonystep .con-colonies').waitFor({timeout: 40_000});
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000});
    await page.locator('.con-start__colonystep .con-colonies').waitFor({timeout: 60_000});
    await shoot(page, 'E-reload-colony');
    await buildInStart(page, request, id, before.thisPlayer.coloniesCount);
    await page.locator('.con-start__handslot .con-hand').first().waitFor({timeout: 60_000});
    await reloadConsole(page);
    await armProbe(page);
    await settle(page, {timeoutMs: 40_000});
    await page.locator('.con-start__handslot .con-hand').first().waitFor({timeout: 60_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb after the reload'})
      .toMatch(/СТАРТ ПАРТИИ.*СТАРАЯ ГОРНЯЦКАЯ КОЛОНИЯ.*СБРОС КАРТ/);
    await shoot(page, 'E-reload-discard');
    expect((await readProbe(page)).plates, 'no plate after the reload').toBe(0);
    await discardInStart(page, request, id);
  });
});
