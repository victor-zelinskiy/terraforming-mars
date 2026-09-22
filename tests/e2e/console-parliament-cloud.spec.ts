import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle,
  waitForBoardHome,
} from './consoleStart';
import {answerAsksAs, answerGateAs, expectParliamentFits, openParliament, PARLIAMENT_PRESETS, turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * CLOUD DEVELOPMENT (Turmoil Redux, RX06) — the first DISTRIBUTED payout, the
 * first Unity card and the first card that exists only with Venus Next, end to
 * end at the console's real surface on the three display profiles:
 *
 *   · the FACE: its own art, the Unity emblem, the Venus dependency beside
 *     the module stamp, the two-tag count glyph in the formula, the quest;
 *   · the VOTE on a FOUR-PARTY table: the Greens rule by the starting rule and
 *     hold no card — their plaque in the government keeps its SOCKETS (the
 *     literal rule: a printed slot is not a card, rulebook p.8 / p.11); the
 *     viewer's own reading is «2 tags + 1 → 3», «+1 if you win»;
 *   · the ENACTMENT: the political phase asks the viewer to LAY OUT 4 floaters
 *     over Dirigibles and Jovian Lanterns — an honest mandatory
 *     prompt first, then the SAME card picker the family's single pick uses,
 *     in its layout mode, INSIDE the sitting (the resolution stays the hero on
 *     the left, the crumb's tail says «РАСКЛАДКА», the band keeps its height,
 *     the body is never empty): every counter opens at ZERO, A with a
 *     remainder sends NOTHING (the input endpoint is counted), LB on zero and
 *     RT with nothing left do nothing, RB / RT lay the units out, the status
 *     line reads the focused card and the total VP shift; the commit flies ONE
 *     chip per recipient from the resolution's icon and each capsule ticks at
 *     its own touchdown; the record carries the list; the other seat's single
 *     holder gets the family's ordinary pick; then Unity RULES — its tile in
 *     the government with VOID sockets, its action open to everyone.
 *
 * Fixtures: `parliament-cloud-vote` / `-enact` (a Venus game; blue at Agenda
 * step 2 with Dirigibles + Jovian Lanterns, red at step 5 with Atmo
 * Collectors; the area Unity / Mars First / Industrialists).
 * Screenshots under screenshots/parliament-cloud/<preset>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-cloud');
const CLOUD_ID = 'RDX_UNITY_CLOUD_DEVELOPMENT';
const CLOUD_INSTANCE = `${CLOUD_ID}#0`;
const STAGE = '.con-parl [data-embed-slot="parliament-stage"]';

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Outcome = {player: string, step: string, kind: string, amount?: number, card?: string, cards?: Array<{card: string, amount: number}>, reason?: string};
type Wire = {
  thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>},
  game: {
    generation: number, phase: string,
    parliament: {
      rulingParty: string, enacted?: {resolution: string, party: string}, phase?: {step: string},
      lastPhase?: {outcomes?: Array<Outcome>, support?: Array<{party: string, gained: number, reason: string}>},
    },
  },
  waitingFor?: {type?: string, cardResourceDistributionPrompt?: {amount: number, cardResource: string, cards: Array<{name: string}>}},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** The layout as the picker shows it: every slot's card, counter, band and capsule; the status line's state. */
const layoutState = (page: Page) => page.evaluate((stage) => {
  const slots = Array.from(document.querySelectorAll<HTMLElement>(`${stage} .con-cards__slot`)).map((el) => ({
    card: el.getAttribute('data-zoom-slot') ?? '',
    spread: el.getAttribute('data-spread') ?? '',
    focused: el.classList.contains('con-cards__slot--focused'),
    band: el.querySelector('[data-spread-band]')?.textContent?.trim() ?? '',
    capsule: el.querySelector('.pcard__res-count')?.textContent?.trim() ?? '',
  }));
  return {
    slots,
    blocked: document.querySelector(`${stage} [data-spread-blocked]`)?.textContent?.trim() ?? '',
    ready: document.querySelector(`${stage} [data-spread-ready]`) !== null,
    vpShift: document.querySelector(`${stage} [data-spread-vp]`)?.getAttribute('data-spread-vp-shift') ?? '',
  };
}, STAGE);

/** The readings a yield block prints, by context. */
const yieldReadings = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
  }));
}, scope);

/** The ruler's plaque as the government shows it: the party, whether its support sockets are drawn or void. */
const rulerPlaque = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector<HTMLElement>('[data-parl-ruler-slot] .con-parl__party[data-party]');
  const sockets = tile?.querySelector<HTMLElement>('[data-parl-support]') ?? null;
  return {
    party: tile?.getAttribute('data-party') ?? '',
    actionState: tile?.getAttribute('data-action-state') ?? '',
    sockets: sockets !== null,
    socketsVisible: sockets !== null && getComputedStyle(sockets).visibility === 'visible',
    socketsVoid: sockets?.getAttribute('data-support-void') !== null && sockets?.getAttribute('data-support-void') !== undefined,
    filled: tile?.querySelectorAll('.con-pseal__support-place--on').length ?? 0,
  };
});

type ZoneProbe = {
  samples: number, bandHeights: Array<number>, emptyBodyFrames: number, chips: number, chipTexts: Array<string>,
  /** The highest stored-resource count each layout slot's capsule ever showed WHILE the slot stood in the stage. */
  capsules: Record<string, string>,
};

/**
 * The zone contract's witnesses, sampled on a task clock (MutationObserver + setInterval — never rAF, which
 * headless Chromium starves on a quiet screen): the band's height on every frame the Parliament stands, whether
 * the body zone ever has NO laid-out child (a blink), and every payout chip that ever appeared.
 */
async function armZoneProbe(page: Page): Promise<void> {
  await page.evaluate((stage) => {
    const w = window as unknown as {__cloudProbe: ZoneProbe & {seen: WeakSet<Element>}};
    w.__cloudProbe = {samples: 0, bandHeights: [], emptyBodyFrames: 0, chips: 0, chipTexts: [], capsules: {}, seen: new WeakSet<Element>()};
    const sample = () => {
      const probe = w.__cloudProbe;
      probe.samples++;
      // The capsules' ticks are read IN the sample (a poll from outside can arrive after a short flight has
      // already handed the surface on — the Deck's small stage flies its chips in a few hundred ms).
      for (const slot of Array.from(document.querySelectorAll<HTMLElement>(`${stage} .con-cards__slot`))) {
        const card = slot.getAttribute('data-zoom-slot') ?? '';
        const text = slot.querySelector('.pcard__res-count')?.textContent?.trim() ?? '';
        if (card !== '' && text !== '' && Number(text) > Number(probe.capsules[card] ?? '-1')) {
          probe.capsules[card] = text;
        }
      }
      const band = document.querySelector<HTMLElement>('.con-band');
      if (band !== null) {
        const h = Math.round(band.getBoundingClientRect().height);
        if (!probe.bandHeights.includes(h)) {
          probe.bandHeights.push(h);
        }
      }
      const body = document.querySelector<HTMLElement>('.con-parl__bodyzone');
      if (body !== null) {
        const laidOut = Array.from(body.children).some((child) => {
          const r = child.getBoundingClientRect();
          const cs = getComputedStyle(child);
          return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
        });
        if (!laidOut) {
          probe.emptyBodyFrames++;
        }
      }
      for (const chip of Array.from(document.querySelectorAll('.con-transfer__chip'))) {
        if (!probe.seen.has(chip)) {
          probe.seen.add(chip);
          probe.chips++;
          probe.chipTexts.push((chip.textContent ?? '').trim());
        }
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 16);
  }, STAGE);
}

const readZoneProbe = (page: Page) => page.evaluate(() => {
  const p = (window as unknown as {__cloudProbe: ZoneProbe}).__cloudProbe;
  return {samples: p.samples, bandHeights: p.bandHeights, emptyBodyFrames: p.emptyBodyFrames, chips: p.chips, chipTexts: p.chipTexts, capsules: p.capsules};
});

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`Cloud Development · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the face (Venus dependency, the two-tag formula), the four-party overview, the vote's reading (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await page.addInitScript(() => window.localStorage.setItem('tm_console_card_numbers', '1'));
      await bootFixture(page, request, 'parliament-cloud-vote', {query: preset.query});
      await openParliament(page);

      // ── THE FACE in the voting area: the Unity emblem, its own art, the code, the Venus dependency, the two-tag glyph, the quest.
      const face = page.locator(`.con-parl__slot[data-instance="${CLOUD_INSTANCE}"] .pcard`);
      await expect(face, 'Cloud Development stands in the voting area').toHaveCount(1);
      await expect(face.locator('.pcard__code'), 'the printed code (opted in)').toHaveText('RX06');
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the code').toContain('RX06');
      await expect(face.locator('.pcard__party-emblem'), 'the Unity emblem').toHaveCount(1);
      // The module stamp is the Turmoil Redux medallion; the DEPENDENCY medallion beside it is Venus Next's.
      const compat = await face.locator('.pcard-bill__compat').evaluateAll((els) => els.map((el) => `${el.getAttribute('data-bill-compat')}:${(el as HTMLElement).style.backgroundImage}`));
      expect(compat.length, 'the dependency medallion beside the module stamp').toBe(1);
      expect(compat[0], `the Venus dependency is shown (${compat.join(' | ')})`).toMatch(/^venus:url\(.*venus/i);
      // The formula's MEMBERS match the printed scan: a floater, then the Venus tag + the Jovian tag + the influence.
      const formula = await face.locator('.pcard-bill__articles').evaluate((el) => {
        const urls = Array.from(el.querySelectorAll<HTMLElement>('img, [style*="background-image"]')).map((node) =>
          node instanceof HTMLImageElement ? node.src : node.style.backgroundImage);
        return {floater: urls.some((u) => /floater/i.test(u)), venus: urls.some((u) => /venus\.png/i.test(u)), jovian: urls.some((u) => /jovian\.png/i.test(u)), influence: urls.some((u) => /influence/i.test(u)), urls};
      });
      expect(formula, `the formula prints floater / Venus + Jovian + influence (${formula.urls.join(' | ')})`).toMatchObject({floater: true, venus: true, jovian: true, influence: true});
      await expect(face.locator('.pcard__quest-graphic'), 'the two-Venus-tag quest as a graphic').toHaveCount(1);

      // ── THE FOUR-PARTY OVERVIEW: the Greens rule by the STARTING RULE and hold no card — their sockets are DRAWN.
      const ruler = await rulerPlaque(page);
      expect(ruler.party, 'the Greens rule generation 1').toBe('Greens');
      expect(ruler.sockets && ruler.socketsVisible, 'a ruler WITHOUT an enacted card keeps its support sockets').toBe(true);
      expect(ruler.socketsVoid, 'and they are not void').toBe(false);
      await expectParliamentFits(page, `${preset.id} overview`);
      await shoot(page, preset.id, '01-overview');

      // ── THE VOTE MODE: the own-effect block reads «2 tags + 1 → 3», winning adds 1 (step 3 = influence 2).
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      await expect(page.locator('[data-parl-vote-yield]'), 'the floaters block').toHaveCount(1);
      expect(await yieldReadings(page, '[data-parl-vote-yield]')).toEqual([{context: 'estimate', influence: '1', amount: '3'}]);
      await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]'), 'the win\'s difference rides the one number').toHaveAttribute('data-parl-vote-suffix', '1');
      // …and WHERE the number comes from: the Venus tags and the Jovian tags, each named.
      await expect(page.locator('[data-parl-vote-yield] [data-yield-in="tag:venus"]'), 'the Venus tags').toHaveText('1');
      await expect(page.locator('[data-parl-vote-yield] [data-yield-in="tag:jovian"]'), 'the Jovian tags').toHaveText('1');
      await expect(page.locator('[data-parl-vote-yield] [data-yield-note]'), 'blue holds two floater cards — no «no recipient» note').toHaveCount(0);
      await expectParliamentFits(page, `${preset.id} vote mode`);
      await shoot(page, preset.id, '02-vote-reading');

      await openZoomViewer(page);
      await expect(page.locator('dialog.con-zoom[open] [data-zoom-yield]'), 'the footer\'s yield chip').toHaveCount(1);
      expect((await yieldReadings(page, 'dialog.con-zoom[open] [data-zoom-yield]')).map((r) => r.amount)).toEqual(['3', '4']);
      await shoot(page, preset.id, '03-fullscreen');
      await closeZoomViewer(page);
      await press(page, 'Escape', 900);
    });

    test(`the enactment: the LAYOUT inside the sitting — zero start, no partial send, LB/RB/RT, the commit's chips, the record, Unity in power (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-cloud-enact', {query: preset.query, landing: 'prompt'});
      const before = await wireOf(request, playerId);
      expect(before.game.phase, 'the political phase stands').toBe('parliament');
      expect(before.waitingFor?.type, 'the shared distribution\'s marked and').toBe('and');
      expect(before.waitingFor?.cardResourceDistributionPrompt?.amount).toBe(4);
      const holders = (before.waitingFor?.cardResourceDistributionPrompt?.cards ?? []).map((c) => c.name);
      expect(holders.sort()).toEqual(['Dirigibles', 'Jovian Lanterns']);

      // ── AN HONEST MANDATORY PROMPT FIRST — nothing opens by itself.
      const plate = page.locator('.con-mandatory');
      await expect(plate, 'the sitting is announced on the board home').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator('.con-parl'), 'the Parliament does not open by itself').toHaveCount(0);
      await shoot(page, preset.id, '04a-enact-announce');
      expect(await openMandatoryAnnounce(page), 'A on the plate opens the sitting').toBe(true);
      await expect(page.locator('.con-sit'), 'the sitting surface').toHaveCount(1, {timeout: 30_000});
      await armZoneProbe(page);
      await settle(page, {timeoutMs: 20_000});

      // ── THE LAYOUT STANDS INSIDE THE SITTING: the hero on the left, the two holders as real faces, every counter at ZERO.
      await expect(page.locator(`${STAGE} .con-cards__slot`), 'the two floater holders, inside the Parliament').toHaveCount(2);
      await expect(page.locator('.con-parl__gov-card .pcard'), 'exactly one enacted card on screen').toHaveCount(1);
      await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'carried onto the stage as the hero').toHaveClass(/rdx-unity-cloud-development/);
      await expect(page.locator('[data-parl-sit-hero] .pcard__art img')).toHaveAttribute('src', /RX06/);
      expect(await crumbText(page), 'the crumb\'s tail names the layout stage').toMatch(/РАСКЛАДКА|DISTRIBUTION/i);
      // The reading names where the number comes from: the tags by kind and the influence.
      await expect(page.locator('.con-parl [data-yield-in="tag:venus"]').first(), 'the Venus tags').toHaveText('1');
      await expect(page.locator('.con-parl [data-yield-in="tag:jovian"]').first(), 'the Jovian tags').toHaveText('1');
      await expect(page.locator('.con-parl [data-yield-in="influence"]').first(), 'the influence after the winner\'s step').toHaveText('2');
      let state = await layoutState(page);
      expect(state.slots.map((s) => s.spread), 'every counter opens at zero — no prefilled layout').toEqual(['0', '0']);
      expect(state.slots.every((s) => s.band === ''), 'no counter band while nothing is laid out').toBe(true);
      expect(state.slots.map((s) => s.capsule), 'the capsules read the cards\' current floaters').toEqual(['0', '0']);
      expect(state.blocked, 'the status line names what is left').toMatch(/4/);
      expect(state.ready).toBe(false);
      const focusedFirst = state.slots.find((s) => s.focused)?.card ?? '';
      expect(holders, 'the focus stands on one of the holders').toContain(focusedFirst);
      await expectParliamentFits(page, `${preset.id} layout`);
      await shoot(page, preset.id, '04-layout-zero');

      // ── A WITH A REMAINDER SENDS NOTHING: the input endpoint is counted, the prompt still stands, the layout is unchanged.
      let inputRequests = 0;
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          inputRequests++;
        }
      });
      await press(page, 'Enter', 1200);
      await settle(page, {timeoutMs: 15_000});
      expect(inputRequests, 'A on an incomplete layout produced no request').toBe(0);
      expect((await wireOf(request, playerId)).waitingFor?.type, 'the layout still stands on the server').toBe('and');
      state = await layoutState(page);
      expect(state.slots.map((s) => s.spread)).toEqual(['0', '0']);
      // LB on zero does nothing.
      await press(page, 'KeyQ', 600);
      state = await layoutState(page);
      expect(state.slots.map((s) => s.spread), 'LB on zero is a no-op').toEqual(['0', '0']);

      // ── RB / RB on the focused card, then RT pours the rest onto the other: the counters, the bands, the status line.
      await press(page, 'KeyE', 500);
      await press(page, 'KeyE', 500);
      state = await layoutState(page);
      const first = state.slots.find((s) => s.card === focusedFirst);
      expect(first?.spread, 'RB twice — two on the focused card').toBe('2');
      expect(first?.band, 'the counter band on the card').toMatch(/\+2/);
      expect(state.blocked, 'two left to place').toMatch(/2/);
      expect(state.ready).toBe(false);
      await shoot(page, preset.id, '05-layout-half');
      await press(page, 'ArrowRight', 500);
      state = await layoutState(page);
      const second = state.slots.find((s) => s.focused);
      expect(second?.card, 'the d-pad moved the focus to the other holder').not.toBe(focusedFirst);
      await press(page, 'Period', 700);
      state = await layoutState(page);
      expect(state.slots.map((s) => s.spread).sort(), 'RT poured the remainder').toEqual(['2', '2']);
      expect(state.ready, 'the layout is complete — the status line says so').toBe(true);
      expect(state.blocked).toBe('');
      // Jovian Lanterns scores 1 VP per 2 floaters: two on it is +1, Dirigibles scores nothing — the total shift is the server's table.
      expect(state.vpShift, 'the whole layout\'s VP shift from the server\'s per-k table').toBe('1');
      // RT with nothing left and RB past the remainder do nothing.
      await press(page, 'Period', 400);
      await press(page, 'KeyE', 400);
      state = await layoutState(page);
      expect(state.slots.map((s) => s.spread).sort(), 'no overflow').toEqual(['2', '2']);
      expect(inputRequests, 'still nothing was sent').toBe(0);
      await expectParliamentFits(page, `${preset.id} layout ready`);
      await shoot(page, preset.id, '06-layout-ready');

      // ── L3 = THE SOURCE: the resolution inspector lifts the hero; closing it leaves the layout standing.
      await openZoomViewer(page, 'KeyC');
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]'), 'L3 opens the RESOLUTION inspector').toHaveCount(1);
      await closeZoomViewer(page);
      state = await layoutState(page);
      expect(state.slots.map((s) => s.spread).sort(), 'the layout survived the inspection').toEqual(['2', '2']);

      // ── THE COMMIT: ONE chip per recipient leaves the resolution's icon; each capsule ticks at its own touchdown.
      await press(page, 'Enter', 1200);
      try {
        // Read off the PROBE's samples (taken while each slot stood in the stage), never a late poll of the DOM.
        await expect.poll(async () => Object.values((await readZoneProbe(page)).capsules).sort(), {
          timeout: 20_000, message: 'both capsules tick to their floaters while the layout is still on screen',
        }).toEqual(['2', '2']);
      } catch (error) {
        // Name the state the tick was missed IN: the layout as it stands, every chip the probe ever saw, the console's own readiness facts.
        const diag = await page.evaluate(() => {
          const w = window as unknown as {__cloudProbe: ZoneProbe, __conReady?: unknown};
          const readiness = typeof w.__conReady === 'function' ? (w.__conReady as () => unknown)() : w.__conReady;
          return {
            chips: w.__cloudProbe.chips, chipTexts: w.__cloudProbe.chipTexts, samples: w.__cloudProbe.samples,
            ready: String(JSON.stringify(readiness ?? null) ?? '').slice(0, 1500),
            stageSlots: document.querySelectorAll('.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot').length,
            sitting: document.querySelector('.con-parl')?.getAttribute('data-sitting-motion') ?? '',
            hero: document.querySelector('[data-parl-sit-hero] .con-parl__gov-card') !== null,
            govCarry: document.querySelector('.con-parl [data-parl-gov-carry] .con-parl__gov-card') !== null,
          };
        });
        throw new Error(`${(error as Error).message}\n[cloud diag] ${JSON.stringify(diag)}`);
      }
      const probe = await readZoneProbe(page);
      expect(probe.samples, 'the probe ran').toBeGreaterThan(20);
      expect(probe.chips, `one chip per recipient (${JSON.stringify(probe.chipTexts)})`).toBe(2);
      expect(probe.chipTexts.every((t) => t.includes('+2')), `each chip carries its card's amount (${JSON.stringify(probe.chipTexts)})`).toBe(true);
      expect(inputRequests, 'the commit was ONE request').toBe(1);
      const mid = await wireOf(request, playerId);
      for (const name of holders) {
        expect(mid.thisPlayer.tableau.find((c) => c.name === name)?.resources, `the floaters landed on ${name}`).toBe(2);
      }

      // ── RED's single holder gets the family's ordinary pick (3 floaters onto Atmo Collectors); the sitting walks to the results.
      const red = seats[1];
      await expect.poll(async () => (await wireOf(request, red)).waitingFor?.type, {timeout: 30_000}).toBe('card');
      await answerAsksAs(request, red);
      await waitSittingAtRest(page, 30_000);
      expect(await turnTo(page, 'results'), 'the results page').toBe(true);
      await shoot(page, preset.id, '07-results');
      const zone = await readZoneProbe(page);
      expect(zone.bandHeights.length <= 1 || Math.max(...zone.bandHeights) - Math.min(...zone.bandHeights) <= 1,
        `the band kept its height through the layout, the commit and the results (${zone.bandHeights.join(', ')})`).toBe(true);
      expect(zone.emptyBodyFrames, 'the body zone never stood empty').toBe(0);
      await press(page, 'Enter', 1200);
      await answerGateAs(request, red, 'adjourn');
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);

      // ── THE RECORD: the viewer's list of recipients, red's single card, the Greens paid as ABSENT (the literal rule).
      const after = await wireOf(request, playerId);
      const parliament = after.game.parliament;
      expect(parliament.enacted?.resolution).toBe(CLOUD_ID);
      expect(parliament.rulingParty, 'Unity rules by its card').toBe('Unity');
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      const mine = outcomes.find((o) => o.player === after.thisPlayer.color && o.kind === 'cardResource');
      expect(mine?.amount).toBe(4);
      expect(mine?.card, 'a list of two names no single card').toBeUndefined();
      expect((mine?.cards ?? []).map((c) => `${c.card}:${c.amount}`).sort()).toEqual(['Dirigibles:2', 'Jovian Lanterns:2']);
      const redWire = await wireOf(request, red);
      const theirs = outcomes.find((o) => o.player === redWire.thisPlayer.color && o.kind === 'cardResource');
      expect(theirs?.amount).toBe(3);
      expect(theirs?.card).toBe('Atmo Collectors');
      expect(redWire.thisPlayer.tableau.find((c) => c.name === 'Atmo Collectors')?.resources).toBe(3);
      const greens = (parliament.lastPhase?.support ?? []).find((s) => s.party === 'Greens');
      expect(greens, 'the starting-rule ruler held no card: paid as a party not present on any card').toMatchObject({reason: 'absent', gained: 1});

      // ── UNITY IN POWER: its tile in the government with VOID sockets, its action open to the viewer.
      await waitForBoardHome(page);
      await openParliament(page);
      const unity = await rulerPlaque(page);
      expect(unity.party).toBe('Unity');
      expect(unity.sockets, 'the sockets keep their room').toBe(true);
      expect(unity.socketsVoid, 'a ruler BY AN ENACTED CARD shows no sockets').toBe(true);
      expect(unity.actionState, 'the ruling party\'s action is everyone\'s (not «no access»)').not.toBe('no-access');
      await expectParliamentFits(page, `${preset.id} unity rules`);
      await shoot(page, preset.id, '08-unity-rules');
    });
  });
}
