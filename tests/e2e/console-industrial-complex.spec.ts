import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {
  press, settle, waitPressable, summaryVisible, pickCards, submitSummary,
  queueCards, waitQueueIdle, focusCard, stepKind, stepSubject, fetchPlayerModel,
} from './consoleStart';
import {armTransferWitness, transferWitness, transferTrail, endsOverGlass} from './transferWitness';

/**
 * P52 INDUSTRIAL COMPLEX — THE PRICE OF A PRELUDE LEAVES THE RAIL FIRST (ledger FH).
 *
 * A start play used to «cost nothing it pays here»: the 18 M€ came off the rail silently, in the frame the view
 * applied, while the six production lines flew in from the card. The law (PL-104 / PL-099): the price is a token born
 * on the M€ row's digits that leaves SIDEWAYS into the card, the row ticking on the departure — and only THEN the
 * result's wave lands on the production cells.
 *
 * A — the opening with Teractor (60 M€), every production at 0: «Промышленный комплекс» played from the queue →
 *     a «−18» token is born on `rail:megacredits` BEFORE any «+1» production token is born; the server reads every
 *     production at 1 and 18 M€ less.
 *
 * ⚠️ The SUBJECT is the pregame, so the walk is the UI road by contract (`console-start-prompt-pad`'s idiom).
 */
const OUT_DIR = path.resolve('screenshots', 'p52');
const CORP = 'Teractor';
const SUBJECT = 'Industrial Complex';
const PARTNER = 'Donation';

type Seat = {megacredits: number, megacreditProduction: number, steelProduction: number, titaniumProduction: number,
  plantProduction: number, energyProduction: number, heatProduction: number};

const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

function cfg() {
  return {
    players: [{name: 'Industry', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: true, prelude2: true, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    customCorporationsList: [CORP, 'Ecoline'],
    customPreludes: [SUBJECT, PARTNER, 'Business Empire', 'Loan'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function reachDeployment(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  for (let round = 0; round < 10 && !(await summaryVisible(page)); round++) {
    await waitPressable(page);
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* the walk reports what it reached */ });
    const kind = stepKind(await stepSubject(page));
    if (kind === 'corporation') {
      expect(await pickCards(page, [CORP]), 'the forced corporation deal contained Teractor').toContain(CORP);
    } else if (kind === 'prelude') {
      expect(await pickCards(page, [SUBJECT, PARTNER]), 'both preludes were offered and picked')
        .toEqual(expect.arrayContaining([SUBJECT, PARTNER]));
    }
    await press(page, 'Period', 1600);
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* ditto */ });
  }
  await submitSummary(page);
  await page.waitForSelector('.con-start__queue', {timeout: 45_000});
}

async function playQueued(page: Page, card: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await waitQueueIdle(page);
    if (!(await queueCards(page)).includes(card)) {
      return;
    }
    if (!(await focusCard(page, card))) {
      await settle(page, {timeoutMs: 10_000}).catch(() => { /* retried below */ });
      continue;
    }
    await waitPressable(page);
    await press(page, 'Enter', 1800);
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* verified below */ });
    if (!(await queueCards(page)).includes(card)) {
      return;
    }
  }
  expect(await queueCards(page), `«${card}» left the queue`).not.toContain(card);
}

async function drainToPreludes(page: Page): Promise<void> {
  for (let round = 0; round < 12; round++) {
    await waitQueueIdle(page);
    const rest = (await queueCards(page)).filter((n) => n !== SUBJECT && n !== PARTNER);
    if (rest.length === 0) {
      return;
    }
    await playQueued(page, rest[0]);
  }
}

test.describe('console — P52 Industrial Complex: the price leaves the rail first', () => {
  for (const profile of PROFILES) {
    test.use({viewport: profile.viewport});

    test(`${profile.id} · A — «−18» off the M€ row before the production wave; the server raises every line to 1`, async ({page, request}) => {
      test.setTimeout(360_000);
      const created = await request.post('/api/creategame', {data: cfg()});
      expect(created.ok(), 'the server accepted the forced deal').toBeTruthy();
      const {players} = await created.json();
      const playerId: string = players[0].id;
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);

      await reachDeployment(page);
      await drainToPreludes(page);
      const before = await fetchPlayerModel(request, playerId);
      const mcBefore = (before.thisPlayer as Seat).megacredits;
      expect(mcBefore, 'Teractor\'s money covers the price').toBeGreaterThanOrEqual(18);
      await shoot(page, 'tv4k-a-01-queue');

      await armTransferWitness(page);
      await playQueued(page, SUBJECT);
      await settle(page, {timeoutMs: 30_000}).catch(() => { /* the server reads below */ });
      const w = await transferWitness(page);
      await shoot(page, 'tv4k-a-02-after');

      const price = w.births.filter((b) => b.under === 'rail:megacredits' && /18/.test(b.value));
      expect(price.length, `the «−18» was born on the M€ row — trail:\n${transferTrail(w)}`).toBeGreaterThan(0);
      const firstGain = w.births.filter((b) => /^\+/.test(b.value)).map((b) => b.t).sort((a, b) => a - b)[0];
      if (firstGain !== undefined) {
        expect(price[0].t, `the price leaves BEFORE the first gain is born — trail:\n${transferTrail(w)}`).toBeLessThan(firstGain);
      }
      expect(endsOverGlass(w), 'no end of any token over glass').toEqual([]);
      expect(w.landings.filter((l) => l.value === price[0].value).map((l) => l.under),
        `the price is drawn INTO the card standing in the queue — trail:
${transferTrail(w)}`).toContain(`queue:${SUBJECT}`);

      const after = await fetchPlayerModel(request, playerId);
      const prod = after.thisPlayer as Seat;
      expect([prod.megacreditProduction, prod.steelProduction, prod.titaniumProduction, prod.plantProduction, prod.energyProduction, prod.heatProduction],
        'every production line below 1 rose to 1').toEqual([1, 1, 1, 1, 1, 1]);
      expect(prod.megacredits, 'the price was paid').toBe(mcBefore - 18);
    });
  }
});
