import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, waitForBoardHome} from './consoleStart';

/**
 * VIEWER-FIRST NOTIFICATIONS — the top-right toast leads with what changed FOR
 * THE VIEWER, and one logical action produces ONE card.
 *
 * The rework this pins: an opponent's action used to arrive as the initiator's
 * chronology («Rival сыграл карту, заплатил, получил…») with the viewer's own
 * delta buried in the details — and an attack arrived TWICE (the root card +
 * the standalone hostile card). Now the root card itself carries the viewer
 * band («Вы потеряли…», sign + importance as independent axes) and the hostile
 * id space is covered by it.
 *
 * WHY AN E2E (the repo default is a unit spec): the unit specs pin the mappers
 * with hand-built chains. What only a live run settles is the real wiring — a
 * real opponent acting over the real API, the viewer's real poll diffing the
 * real journal stream, the real card painting the band — plus the lifecycle
 * (arrival → TTL → dismissal) and the screenshots this iteration owes.
 *
 * THE OPPONENT IS DRIVEN OVER THE API (the same `player/input` endpoint the
 * real client posts to — no rules bypass): a second driven page would only add
 * flake, and the subject is the VIEWER's presentation, not the rival's.
 */

const OUT_DIR = path.resolve('screenshots', 'notification-semantics');

/** Base card, +1 energy production, no follow-up prompt — the AMBIENT event. */
const NEUTRAL_CARD = 'Power Plant';
/** Base card: −1 ANY energy production (a SelectPlayer attack) — the HOSTILE event. */
const ATTACK_CARD = 'Energy Tapping';

const VIEWER_COLOR = 'blue';

/** Base-only two-seat table: corporate era OFF ⇒ productions start at 1, so the
 *  attack card has a live target in generation 1 by construction. */
function tableConfig() {
  return {
    players: [
      {name: 'Rival', color: 'red', beginner: false, handicap: 0, first: true},
      {name: 'Viewer', color: VIEWER_COLOR, beginner: false, handicap: 0, first: false},
    ],
    expansions: {
      corpera: false, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    // The dev seam: both subject cards ride the deck top → the FIRST seat's deal.
    customProjectCards: [ATTACK_CARD, NEUTRAL_CARD],
  };
}

const ZERO_PAY: Readonly<Record<string, number>> = {
  heat: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
  floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
  auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** Keep the page PAINTING while waiting (headless rAF starves on a quiet frame —
 *  toast lifetimes and transitions stop without a BeginFrame). */
async function settle(page: Page, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(100);
  }
}

type ToastRecord = {id: string, cls: string, you: string, cause: string, head: string, body: string, pills: string};

/** Arm the in-page probe BEFORE the acts: MutationObserver + interval sampler
 *  (never rAF — headless compositors stop exactly when the screen goes quiet),
 *  recording every DISTINCT card by its `data-notif-id`. A card that UPGRADES
 *  in place (the late-loss race repair: the band grows on the visible card)
 *  keeps ONE record whose fields follow the latest state — so the audit reads
 *  the FINAL semantics and one action can never be counted twice. */
async function armToastProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Rec = {id: string, cls: string, you: string, cause: string, head: string, body: string, pills: string};
    const w = window as unknown as {__toastLog?: Array<Rec>, __toastSamples?: number, __toastTimer?: number};
    const log: Array<Rec> = [];
    const byId = new Map<string, Rec>();
    w.__toastLog = log;
    w.__toastSamples = 0;
    const text = (root: Element, sel: string): string =>
      (root.querySelector(sel) as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').trim() ?? '';
    const sample = () => {
      w.__toastSamples = (w.__toastSamples ?? 0) + 1;
      for (const el of Array.from(document.querySelectorAll('.con-notif'))) {
        const id = (el as HTMLElement).dataset.notifId ?? '';
        if (id === '') {
          continue;
        }
        const rec: Rec = {
          id,
          cls: (el as HTMLElement).className,
          you: text(el, '.con-notif__you'),
          cause: text(el, '.con-notif__cause'),
          head: text(el, '.con-notif__head'),
          body: text(el, '.con-notif__body'),
          pills: text(el, '.con-notif__pills'),
        };
        const existing = byId.get(id);
        if (existing === undefined) {
          byId.set(id, rec);
          log.push(rec);
        } else {
          Object.assign(existing, rec);
        }
      }
    };
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-notif-id', 'class']});
    w.__toastTimer = window.setInterval(sample, 120);
    sample();
  });
}

async function toastLog(page: Page): Promise<Array<ToastRecord>> {
  return await page.evaluate(() =>
    ((window as unknown as {__toastLog?: Array<ToastRecord>}).__toastLog ?? []));
}

async function probeSamples(page: Page): Promise<number> {
  return await page.evaluate(() =>
    (window as unknown as {__toastSamples?: number}).__toastSamples ?? 0);
}

/** Play a project card from the RIVAL seat over the API (the real endpoint,
 *  the real validation — a keyboard replaced by a request). */
async function rivalPlaysCard(request: APIRequestContext, rivalId: string, cardName: string): Promise<void> {
  type Wire = {
    waitingFor?: {
      type: string,
      options?: Array<{type: string, cards?: Array<{name: string, calculatedCost?: number}>}>,
    },
  };
  const model = await fetchPlayerModel(request, rivalId) as unknown as Wire;
  const menu = model.waitingFor;
  expect(menu?.type, `the rival must hold the action menu (got ${menu?.type})`).toBe('or');
  const idx = (menu?.options ?? []).findIndex((o) => o.type === 'projectCard');
  expect(idx, 'the action menu offers a project-card play').toBeGreaterThanOrEqual(0);
  const card = (menu?.options?.[idx].cards ?? []).find((c) => c.name === cardName);
  expect(card, `${cardName} must be playable (offered: ${(menu?.options?.[idx].cards ?? []).map((c) => c.name).join(', ')})`).toBeDefined();
  await sendPlayerInput(request, rivalId, {
    type: 'or', index: idx,
    response: {type: 'projectCard', card: cardName, payment: {...ZERO_PAY, megacredits: card?.calculatedCost ?? 0}},
  });
}

/** The two calibration points: the e2e default (720p logical) and the couch 4K
 *  (the TV profile activates off the viewport — the band's type scale and fit
 *  are a claim PER resolution, never one). */
const PROFILES: ReadonlyArray<{tag: string, viewport?: {width: number, height: number}}> = [
  {tag: 'hd'},
  {tag: 'tv4k', viewport: {width: 3840, height: 2160}},
];

for (const profile of PROFILES) {
  test.describe(`viewer-first notifications · ${profile.tag}`, () => {
    if (profile.viewport !== undefined) {
      test.use({viewport: profile.viewport});
    }

    test('an opponent play is one calm ambient card; an attack is ONE hostile card led by «Вы потеряли»', async ({page, request}) => {
      test.setTimeout(300_000);

      // ── the table ──────────────────────────────────────────────────────
      const created = await request.post('/api/creategame', {data: tableConfig()});
      expect(created.ok(), 'the game server accepted the config').toBeTruthy();
      const {players} = await created.json();
      const [rival, viewer] = players.map((p: {id: string}) => p.id);

      // Both pregames over the API, concurrently (the phases are simultaneous).
      await Promise.all([
        seedGameOverApi(request, rival, {cards: [ATTACK_CARD, NEUTRAL_CARD], buy: 2}),
        // The rival moves first, so this seat's seeding legitimately ends on
        // «the table never came back» — its state is asserted below.
        seedGameOverApi(request, viewer, {buy: 1}).catch(() => undefined),
      ]);

      // ── the viewer's console ───────────────────────────────────────────
      await openConsole(page, viewer, '');
      await waitForBoardHome(page, 25);
      await settle(page, 2_500); // the seeded stream is diffed SILENTLY (no spam on load)
      await armToastProbe(page);

      // ── ACT 1 · the AMBIENT event: the rival plays Power Plant ─────────
      await rivalPlaysCard(request, rival, NEUTRAL_CARD);
      const ambientCard = page.locator('.con-notif--sign-neutral.notification-card--variant-play-card');
      await ambientCard.waitFor({timeout: 20_000});
      await settle(page, 900); // let the entrance finish — evidence, not a mid-fade frame
      await shoot(page, `${profile.tag}-01-ambient-opponent-play`);
      // The two axes render as classes; the actor chip names the initiator.
      await expect(ambientCard).toHaveClass(/con-notif--imp-ambient/);
      await expect(page.locator('.con-notif__actor').first()).toContainText('Rival');
      // No viewer band — nothing personal happened.
      expect(await page.locator('.con-notif__you').count(), 'no «для вас» band on a bystander event').toBe(0);

      // …and it self-clears (the TTL lifecycle, kept painting by the settle).
      const cleared = Date.now() + 12_000;
      while (Date.now() < cleared && await page.locator('.con-notif').count() > 0) {
        await settle(page, 400);
      }
      expect(await page.locator('.con-notif').count(), 'the ambient card auto-dismissed').toBe(0);

      // ── ACT 2 · the HOSTILE event: Energy Tapping takes the viewer's
      //    energy production. ONE card, viewer-first. ─────────────────────
      await rivalPlaysCard(request, rival, ATTACK_CARD);
      // The play defers a SelectPlayer — the rival must SEE the target (the
      // no-auto-select invariant), then names the viewer.
      await expect.poll(async () => {
        const m = await fetchPlayerModel(request, rival) as unknown as {waitingFor?: {type: string}};
        return m.waitingFor?.type;
      }, {timeout: 20_000}).toBe('player');
      const prompt = await fetchPlayerModel(request, rival) as unknown as {waitingFor?: {players?: Array<string>}};
      const target = (prompt.waitingFor?.players ?? []).find((p) => String(p).includes(VIEWER_COLOR)) ?? VIEWER_COLOR;
      await sendPlayerInput(request, rival, {type: 'player', player: target});

      const hostile = page.locator('.con-notif--sign-negative');
      await hostile.waitFor({timeout: 25_000});
      await settle(page, 900);
      await shoot(page, `${profile.tag}-02-hostile-viewer-first`);

      // THE HIERARCHY: the viewer band leads («Вы потеряли» + the production
      // chip), the cause line names the initiator and the card, the importance
      // grade is critical — and the sign is spoken, never colour alone.
      await expect(hostile).toHaveClass(/con-notif--imp-critical/);
      const band = page.locator('.con-notif__you');
      await expect(band).toHaveClass(/con-notif__you--negative/);
      await expect(band.locator('.con-notif__you-sign')).toContainText(/Вы потеряли|You lost/i);
      const cause = page.locator('.con-notif__cause');
      await expect(cause).toContainText('Rival');
      // The attack card's own name (its RU translation) closes the cause line.
      await expect(cause).toContainText(/Отвод от линии электропередач|Energy Tapping/);

      // ── the DETAIL contract: press-and-HOLD X opens the journal AT the
      //    event (the full causal chain behind the toast), and the toast's
      //    job is done — it dismisses. A quick TAP keeps the screen's verb. ──
      await page.keyboard.down('KeyX');
      await settle(page, 850); // past NOTIF_HOLD_MS while frames keep coming
      await page.keyboard.up('KeyX');
      await page.locator('.con-journal').waitFor({timeout: 10_000});
      await settle(page, 600);
      await shoot(page, `${profile.tag}-03-hold-x-journal`);
      expect(await page.locator('.con-notif--sign-negative').count(),
        'the toast hands over to the journal').toBe(0);
      await page.keyboard.press('Escape');
      await settle(page, 800);

      // ONE CARD PER ACTION: wait the queue out, then audit the whole episode —
      // exactly one distinct hostile card, no standalone `neg…` twin.
      await settle(page, 16_000);
      const log = await toastLog(page);
      console.log(`[notification-semantics·${profile.tag}] toast log:`, JSON.stringify(log, null, 2));
      expect(await probeSamples(page), 'the probe itself was alive').toBeGreaterThan(20);
      const hostileCards = log.filter((t) => t.cls.includes('con-notif--sign-negative'));
      expect(hostileCards.length, `ONE hostile card for one attack: ${JSON.stringify(hostileCards)}`).toBe(1);
      expect(hostileCards[0].id.startsWith('g'), 'the hostile card IS the root card (never a neg… twin)').toBe(true);
      expect(log.filter((t) => t.id.startsWith('neg')).length, 'no standalone hostile twin ever appeared').toBe(0);
      // The band led with the loss; the production scope is stated.
      expect(hostileCards[0].you).toMatch(/−1/);
      expect(hostileCards[0].you).toMatch(/доход|production/i);
    });
  });
}
