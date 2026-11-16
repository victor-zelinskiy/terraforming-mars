import {test, expect, APIRequestContext, Locator, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, fetchPlayerModel, openConsole, readiness, seedGameOverApi, sendPlayerInput, waitForBoardHome} from './consoleStart';
import {armWitness, Witness} from './witness';

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

const ZERO_PAY: Readonly<Record<string, number>> = {...NO_PAYMENT};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** ONE forced frame — a tiny screenshot is a BeginFrame (headless rAF starves on a quiet frame: toast lifetimes and
 *  transitions stop without one). */
async function pumpFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

/**
 * Wait for a STATE while keeping the page PAINTING — every poll forces one real frame, so a toast's entrance, its TTL
 * and its leave advance on a headless screen whose own frames starve (never a fixed pump of N ms standing in for «the
 * entrance is over»). Says whether the state came within `timeoutMs`; the caller asserts or reads on.
 */
async function pumpUntil(page: Page, done: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  return expect.poll(async () => {
    await pumpFrame(page);
    return done();
  }, {timeout: timeoutMs, intervals: [100]}).toBe(true).then(() => true, () => false);
}

/** The toast's ENTRANCE is over: its transition group let go of it (no `notification-pop-enter*` class left). */
async function toastEntered(card: Locator): Promise<boolean> {
  return card.first().evaluate((el) => !/notification-pop-enter/.test(el.className)).catch(() => false);
}

/** The feed is at rest: nothing visible, nothing queued, nothing leaving (`notificationsSettled`). */
async function feedSettled(page: Page): Promise<boolean> {
  return (await readiness(page))?.notificationsSettled === true;
}

type ToastRecord = {id: string, cls: string, you: string, cause: string, head: string, body: string, pills: string};
const TOAST_WITNESS = 'notification-semantics-toasts';

/** Arm the RECORDING before the acts (`armWitness` — the product's own writes observed in the task that makes them, so a
 *  starved frame can slow a card but never hide it): every card on screen, by its `data-notif-id`. */
async function armToastProbe(page: Page): Promise<Witness<Array<ToastRecord>>> {
  return armWitness<Array<ToastRecord>>(page, TOAST_WITNESS, () => {
    const text = (root: Element, sel: string): string =>
      (root.querySelector(sel) as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').trim() ?? '';
    return Array.from(document.querySelectorAll<HTMLElement>('.con-notif'))
      .filter((el) => (el.dataset.notifId ?? '') !== '')
      .map((el) => ({
        id: el.dataset.notifId ?? '',
        cls: el.className,
        you: text(el, '.con-notif__you'),
        cause: text(el, '.con-notif__cause'),
        head: text(el, '.con-notif__head'),
        body: text(el, '.con-notif__body'),
        pills: text(el, '.con-notif__clusters'),
      }));
  });
}

/**
 * The recording folded: every DISTINCT card by its id, in order of arrival. A card that UPGRADES in place (the
 * late-loss race repair: the band grows on the visible card) keeps ONE record whose fields follow the latest state —
 * so the audit reads the FINAL semantics and one action can never be counted twice.
 */
async function toastLog(probe: Witness<Array<ToastRecord>>): Promise<Array<ToastRecord>> {
  const log: Array<ToastRecord> = [];
  const byId = new Map<string, ToastRecord>();
  for (const cards of await probe.values()) {
    for (const rec of cards) {
      const existing = byId.get(rec.id);
      if (existing === undefined) {
        const own = {...rec};
        byId.set(rec.id, own);
        log.push(own);
      } else {
        Object.assign(existing, rec);
      }
    }
  }
  return log;
}

/** PRESENCE TIMELINE — per-id appear / vanish transitions on the page's clock (ms since the recording's first state),
 *  so «the dismiss never ran» and «the card came BACK» stop looking alike. */
async function toastTimeline(probe: Witness<Array<ToastRecord>>): Promise<Array<{t: number, id: string, present: boolean}>> {
  const samples = await probe.samples();
  const t0 = samples[0]?.t ?? 0;
  const timeline: Array<{t: number, id: string, present: boolean}> = [];
  const present = new Set<string>();
  for (const s of samples) {
    const now = new Set(s.v.map((c) => c.id));
    for (const id of now) {
      if (!present.has(id)) {
        present.add(id);
        timeline.push({t: s.t - t0, id, present: true});
      }
    }
    for (const id of [...present]) {
      if (!now.has(id)) {
        present.delete(id);
        timeline.push({t: s.t - t0, id, present: false});
      }
    }
  }
  return timeline;
}

/** The hostile cards still standing (id · classes). */
async function lingeringHostile(page: Page): Promise<Array<string>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.con-notif--sign-negative'))
      .map((el) => `${(el as HTMLElement).dataset.notifId}·${(el as HTMLElement).className}`));
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
      // The seeded stream is diffed SILENTLY (no spam on load) — the feed at rest before the probe arms.
      await pumpUntil(page, () => feedSettled(page), 15_000);
      const toasts = await armToastProbe(page);

      // ── ACT 1 · the AMBIENT event: the rival plays Power Plant ─────────
      await rivalPlaysCard(request, rival, NEUTRAL_CARD);
      const ambientCard = page.locator('.con-notif--sign-neutral.notification-card--variant-play-card');
      await ambientCard.waitFor({timeout: 20_000});
      // Let the entrance finish — evidence, not a mid-fade frame (the transition group's own «entered»).
      await pumpUntil(page, () => toastEntered(ambientCard), 10_000);
      await shoot(page, `${profile.tag}-01-ambient-opponent-play`);
      // The two axes render as classes; the actor chip names the initiator.
      await expect(ambientCard).toHaveClass(/con-notif--imp-ambient/);
      await expect(page.locator('.con-notif__actor').first()).toContainText('Rival');
      // The actor is stated ONCE (the head chip), and the TYPE label says what happened («КАРТА СЫГРАНА»): the
      // headline of a play is the CARD alone (TR59 — «сыграл ‹…›» said the type a second time).
      const headlineText = (await page.locator('.con-notif__headline').innerText()).trim();
      expect(headlineText.startsWith('Rival'), `headline repeats the actor: «${headlineText}»`).toBe(false);
      expect(headlineText, 'the headline is the played card').toMatch(/Электростанция|Power Plant/);
      expect(headlineText, 'no verb restating the type label').not.toMatch(/сыграл|played/i);
      // No viewer band — nothing personal happened.
      await expect.poll(() => page.locator('.con-notif__you').count(), {message: 'no «для вас» band on a bystander event'}).toBe(0);

      // …and it self-clears (the TTL lifecycle, kept painting by the pump).
      await pumpUntil(page, async () => await page.locator('.con-notif').count() === 0, 12_000);
      await expect.poll(() => page.locator('.con-notif').count(), {message: 'the ambient card auto-dismissed'}).toBe(0);

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
      await pumpUntil(page, () => toastEntered(hostile), 10_000);
      await shoot(page, `${profile.tag}-02-hostile-viewer-first`);

      // THE HIERARCHY: the viewer band leads («Вы потеряли» + the production
      // chip), the cause line names the initiator and the card, the importance
      // grade is critical — and the sign is spoken, never colour alone.
      await expect(hostile).toHaveClass(/con-notif--imp-critical/);
      const band = page.locator('.con-notif__you');
      await expect(band).toHaveClass(/con-notif__you--negative/);
      await expect(band.locator('.con-notif__you-sign')).toContainText(/Вы потеряли|You lost/i);
      // The actor is stated ONCE — the head's chip names the attacker; the
      // «почему»-zone names the attacking card under the «ИСТОЧНИК» anchor.
      await expect(hostile.locator('.con-notif__head')).toContainText('Rival');
      const cause = page.locator('.con-notif__why');
      await expect(cause).toContainText(/ИСТОЧНИК|Source/i);
      // The attack card's own name (its RU translation) closes the cause line.
      await expect(cause).toContainText(/Отвод от линии электропередач|Energy Tapping/);

      // ── the DETAIL contract: press-and-HOLD X opens the journal AT the
      //    event (the full causal chain behind the toast), and the toast's
      //    job is done — it dismisses. A quick TAP keeps the screen's verb. ──
      // The hold FIRES on its own clock while X is still down (`consoleNotifHold` — past NOTIF_HOLD_MS the journal
      // opens before the release): frames keep coming until it did, then X is released.
      await page.keyboard.down('KeyX');
      await pumpUntil(page, async () => await page.locator('.con-journal').count() > 0, 10_000);
      await page.keyboard.up('KeyX');
      await page.locator('.con-journal').waitFor({timeout: 10_000});
      // The toast's job is done — frames pumped until it LEFT (its leave included), the evidence shot after; the
      // claim is read once the hand-over had its time, on the state that stands.
      await pumpUntil(page, async () => (await lingeringHostile(page)).length === 0, 5_000);
      await shoot(page, `${profile.tag}-03-hold-x-journal`);
      const lingering = await lingeringHostile(page);
      const timeline = await toastTimeline(toasts);
      expect(lingering.length,
        `the toast hands over to the journal (lingering: ${JSON.stringify(lingering)}; timeline: ${JSON.stringify(timeline)})`).toBe(0);
      await page.keyboard.press('Escape');
      await pumpUntil(page, async () => await page.locator('.con-journal').count() === 0, 5_000);

      // ONE CARD PER ACTION: wait the queue out (the feed at rest: nothing visible, queued or leaving — bounded by the
      // old 16 s window), then audit the whole episode — exactly one distinct hostile card, no standalone `neg…` twin.
      await pumpUntil(page, () => feedSettled(page), 16_000);
      const log = await toastLog(toasts);
      console.log(`[notification-semantics·${profile.tag}] toast log:`, JSON.stringify(log, null, 2));
      expect((await toasts.samples()).length, 'the probe itself was alive').toBeGreaterThan(0);
      const hostileCards = log.filter((t) => t.cls.includes('con-notif--sign-negative'));
      expect(hostileCards.length, `ONE hostile card for one attack: ${JSON.stringify(hostileCards)}`).toBe(1);
      expect(hostileCards[0].id.startsWith('g'), 'the hostile card IS the root card (never a neg… twin)').toBe(true);
      expect(log.filter((t) => t.id.startsWith('neg')).length, 'no standalone hostile twin ever appeared').toBe(0);
      // The band led with the loss; the production scope is stated IN THE UNIT (TR59 — the «доход» line is gone:
      // «ПР. ЭНЕРГИИ −1»).
      expect(hostileCards[0].you).toMatch(/−1/);
      expect(hostileCards[0].you).toMatch(/пр\. энергии|energy prod\./i);
    });
  });
}
