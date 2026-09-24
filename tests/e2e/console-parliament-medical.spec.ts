import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle,
} from './consoleStart';
import {answerAsksAs, answerGateAs, expectParliamentFits, openParliament, turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * MEDICAL DATABASE (Turmoil Redux, RX18) — the ONE e2e of the card's new
 * mechanism: a distributing payout whose unit comes in TWO KINDS («data or
 * microbe»), laid out over the holders of EITHER, each unit's kind its
 * card's. Three moments of one journey, on one profile (the owner's budget —
 * one e2e per new mechanic):
 *
 *   PART 1 · THE VOTE (fixture `parliament-medical-vote`): the face prints
 *   «[data] OR [microbe] / [science tag] + [influence]»; the panel reads
 *   «[science tag] 2 + [influence] 1 → +3» with the unit drawn as BOTH kinds
 *   joined by «или» — ONE unit, never two lines — and «+1 if you win».
 *
 *   PART 2 · THE LAYOUT (fixture `parliament-medical-enact`): the political
 *   phase asks the viewer to lay 4 units over GHG Producing Bacteria and
 *   Regolith Eaters — both microbe holders, the marker naming both kinds and
 *   each holder's own — INSIDE the sitting; every counter opens at zero; A on
 *   an incomplete layout SENDS NOTHING and the status line names what is left
 *   (the commit is withheld with its reason — never silently); each counter
 *   band wears ITS card's kind; the commit is ONE request, the capsules tick
 *   to exactly what was laid out, the server's tableau agrees.
 *
 *   PART 3 · THE RECORD: blue's list names each card with its own kind and
 *   the record's one kind (every unit landed as a microbe); red's single
 *   holder took the family's ordinary pick; the Scientists rule.
 *
 * The stand's mixed layout (a data holder beside a microbe holder — the
 * premium scope has no data card for a real game) is photographed on the
 * Polygon in its own describe. Screens under screenshots/parliament-medical/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-medical', 'standard-1080');
const MEDICAL_ID = 'RDX_SCIENTISTS_MEDICAL_DATABASE';
const MEDICAL_INSTANCE = `${MEDICAL_ID}#0`;
const MEDICAL_CLASS = /rdx-scientists-medical-database/;
const STAGE = '.con-parl [data-embed-slot="parliament-stage"]';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Outcome = {
  player: string, step: string, kind: string, amount?: number, count?: number, influence?: number, resource?: string, resources?: Array<string>,
  card?: string, cards?: Array<{card: string, amount: number, resource?: string}>, reason?: string,
};
type Wire = {
  thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>},
  game: {
    generation: number, phase: string,
    parliament: {rulingParty: string, enacted?: {resolution: string, party: string}, phase?: {step: string}, lastPhase?: {outcomes?: Array<Outcome>}},
  },
  waitingFor?: {
    type?: string,
    cardResourceDistributionPrompt?: {amount: number, cardResource?: string, cardResources?: Array<string>, cardResourceByCard?: Record<string, string>, cards: Array<{name: string}>},
  },
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/** The readings a yield block prints, by context. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    count: el.getAttribute('data-yield-count'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
  }));
}, scope);

/** The UNIT a yield block draws in `scope`: every icon's card-resource key in order, and the «or» words between them. */
const unitIn = (page: Page, scope: string) => page.evaluate((sel) => {
  const icons = Array.from(document.querySelectorAll<HTMLElement>(`${sel} .con-iyield__unit`)).map((el) =>
    Array.from(el.classList).find((c) => c.startsWith('card-resource-')) ?? '');
  const ors = Array.from(document.querySelectorAll<HTMLElement>(`${sel} .con-iyield__or`)).map((el) => el.textContent?.trim() ?? '');
  return {icons, ors};
}, scope);

/** The layout as the picker shows it: every slot's card, counter, band (with its icon) and capsule; the status line's state. */
const layoutState = (page: Page) => page.evaluate((stage) => {
  const slots = Array.from(document.querySelectorAll<HTMLElement>(`${stage} .con-cards__slot`)).map((el) => ({
    card: el.getAttribute('data-zoom-slot') ?? '',
    spread: el.getAttribute('data-spread') ?? '',
    focused: el.classList.contains('con-cards__slot--focused'),
    band: el.querySelector('[data-spread-band]')?.textContent?.trim() ?? '',
    bandIcon: Array.from(el.querySelector('[data-spread-band] .con-cards__spread-icon')?.classList ?? []).find((c) => c.startsWith('card-resource-')) ?? '',
    capsule: el.querySelector('.pcard__res-count')?.textContent?.trim() ?? '',
  }));
  return {
    slots,
    blocked: document.querySelector(`${stage} [data-spread-blocked]`)?.textContent?.trim() ?? '',
    ready: document.querySelector(`${stage} [data-spread-ready]`) !== null,
  };
}, STAGE);

type Probe = {samples: number, capsules: Record<string, string>, chips: Array<string>};

/** The capsules' ticks, read IN the sample (a poll from outside can arrive after a short flight has handed the surface on). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate((stage) => {
    const w = window as unknown as {__medicalProbe: Probe & {seen: WeakSet<Element>}};
    w.__medicalProbe = {samples: 0, capsules: {}, chips: [], seen: new WeakSet<Element>()};
    const sample = () => {
      const probe = w.__medicalProbe;
      probe.samples++;
      for (const slot of Array.from(document.querySelectorAll<HTMLElement>(`${stage} .con-cards__slot`))) {
        const card = slot.getAttribute('data-zoom-slot') ?? '';
        const text = slot.querySelector('.pcard__res-count')?.textContent?.trim() ?? '';
        if (card !== '' && text !== '' && Number(text) > Number(probe.capsules[card] ?? '-1')) {
          probe.capsules[card] = text;
        }
      }
      for (const chip of Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip'))) {
        if (!probe.seen.has(chip)) {
          probe.seen.add(chip);
          const kind = Array.from(chip.querySelectorAll<HTMLElement>('*')).flatMap((el) => Array.from(el.classList)).find((c) => c.startsWith('card-resource-')) ?? '';
          probe.chips.push(`${(chip.textContent ?? '').trim()}|${kind}`);
        }
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 16);
  }, STAGE);
}
const readProbe = (page: Page) => page.evaluate(() => {
  const p = (window as unknown as {__medicalProbe: Probe}).__medicalProbe;
  return {samples: p.samples, capsules: p.capsules, chips: p.chips};
});

test.describe('Medical Database · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the vote draws the unit as data OR microbe; the layout inside the sitting withholds the commit until every unit is placed, each counter wears its card\'s kind, the capsules tick to what was laid out, the record names each card\'s kind', async ({page, request}) => {
    test.setTimeout(600_000);

    // ════════════════ PART 1 · THE VOTE — the face and the two-kind unit ════════════════
    {
      await page.addInitScript(() => window.localStorage.setItem('tm_console_card_numbers', '1'));
      await bootFixtureSeats(page, request, 'parliament-medical-vote', {query: '&consoleProfile=auto'});
      await openParliament(page);

      // ── THE FACE in the voting area: its art (keyed by RX18), the Scientists' emblem, the printed row, the quest.
      const face = page.locator(`.con-parl__slot[data-instance="${MEDICAL_INSTANCE}"] .pcard`);
      await expect(face, 'Medical Database stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(MEDICAL_CLASS);
      await expect(face.locator('.pcard__code'), 'the printed code (opted in)').toHaveText('RX18');
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the code').toContain('RX18');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Scientists\' emblem').toContain('scientists');
      const formula = await face.locator('.pcard-bill__articles').evaluate((el) => {
        const urls = Array.from(el.querySelectorAll<HTMLElement>('img, [style*="background-image"]')).map((node) =>
          node instanceof HTMLImageElement ? node.src : node.style.backgroundImage);
        const classes = Array.from(el.querySelectorAll<HTMLElement>('*')).flatMap((node) => Array.from(node.classList));
        return {
          data: urls.some((u) => /data/i.test(u)) || classes.some((c) => /card-resource-data|--data\b/.test(c)),
          microbe: urls.some((u) => /microbe/i.test(u)) || classes.some((c) => /card-resource-microbe|--microbe\b/.test(c)),
          science: urls.some((u) => /science\.png/i.test(u)),
          influence: urls.some((u) => /influence/i.test(u)),
          or: (el.textContent ?? '').toUpperCase().includes('ИЛИ') || (el.textContent ?? '').toUpperCase().includes('OR'),
          urls, classes: classes.filter((c) => /resource|data|microbe/.test(c)),
        };
      });
      expect(formula, `the formula prints data OR microbe / science + influence (${formula.urls.join(' | ')} ${formula.classes.join(' ')})`)
        .toMatchObject({data: true, microbe: true, science: true, influence: true, or: true});
      await expect(face.locator('.pcard__quest-graphic'), 'the two-science-tag quest as a graphic').toHaveCount(1);
      await expectParliamentFits(page, 'overview');
      await shoot(page, '01-overview');

      // ── THE VOTE MODE: «[science tag] 2 + [influence] 1 → +3 [data|microbe]», winning adds 1 (step 3 = influence 2).
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      await expect(block, 'the block').toHaveCount(1);
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([{context: 'estimate', count: '2', influence: '1', amount: '3'}]);
      await expect(block.locator('[data-yield-in="count"]'), 'the science tags').toHaveText('2');
      await expect(block.locator('[data-yield-in="influence"]')).toHaveText('1');
      await expect(block.locator('[data-parl-vote-suffix]'), 'the win\'s difference rides the one number').toHaveAttribute('data-parl-vote-suffix', '1');
      // THE UNIT: both kinds, joined by «или», in the result — ONE unit, never two lines.
      const unit = await unitIn(page, '[data-parl-vote-yield] .con-iyield__out');
      expect(unit.icons, 'the result draws data and microbe').toEqual(['card-resource-data', 'card-resource-microbe']);
      expect(unit.ors, 'joined by the word').toEqual([expect.stringMatching(/или|or/i)]);
      await expect(block.locator('[data-yield-note]'), 'blue holds two microbe holders — no «no recipient» note').toHaveCount(0);
      await expectParliamentFits(page, 'vote mode');
      await shoot(page, '02-vote-reading');

      // ── THE FULLSCREEN: the rule of the count, the counted cards.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(MEDICAL_CLASS);
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules, 'the rule says what counts').toContainText(/карта с двумя метками даёт 2|two science tags counts twice/);
      await expect(rules, 'the counted cards').toContainText(/Учтены сейчас|Counted right now/);
      await shoot(page, '03-fullscreen');
      await closeZoomViewer(page);
      await press(page, 'Escape', 900);
    }

    // ════════════════ PART 2 · THE LAYOUT — inside the sitting, withheld until complete ════════════════
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-medical-enact', {query: '&consoleProfile=auto', landing: 'prompt'});
    const before = await wireOf(request, playerId);
    expect(before.game.phase, 'the political phase stands').toBe('parliament');
    expect(before.waitingFor?.type, 'the shared distribution\'s marked and').toBe('and');
    const meta = before.waitingFor?.cardResourceDistributionPrompt;
    expect(meta?.amount).toBe(4);
    expect(meta?.cardResource, 'no ONE kind on the marker — the step spans two').toBeUndefined();
    expect(meta?.cardResources).toEqual(['data', 'microbe']);
    expect(meta?.cardResourceByCard, 'each holder\'s own kind').toEqual({'GHG Producing Bacteria': 'microbe', 'Regolith Eaters': 'microbe'});
    const holders = (meta?.cards ?? []).map((c) => c.name);
    expect(holders.sort()).toEqual(['GHG Producing Bacteria', 'Regolith Eaters']);

    // ── AN HONEST MANDATORY PROMPT FIRST — nothing opens by itself.
    await expect(page.locator('.con-mandatory'), 'the sitting is announced on the board home').toHaveCount(1, {timeout: 30_000});
    await expect(page.locator('.con-parl'), 'the Parliament does not open by itself').toHaveCount(0);
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the sitting').toBe(true);
    await expect(page.locator('.con-sit'), 'the sitting surface').toHaveCount(1, {timeout: 30_000});
    await armProbe(page);
    await settle(page, {timeoutMs: 20_000});

    // ── THE LAYOUT STANDS INSIDE THE SITTING: the hero on the left, the two holders as real faces, every counter at ZERO.
    await expect(page.locator(`${STAGE} .con-cards__slot`), 'the two holders, inside the Parliament').toHaveCount(2);
    await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'carried onto the stage as the hero').toHaveClass(MEDICAL_CLASS);
    expect(await crumbText(page), 'the crumb\'s tail names the layout stage').toMatch(/РАСКЛАДКА|DISTRIBUTION/i);
    // The reading names where the number comes from: the tags and the influence after the winner's step — and the unit by both kinds.
    await expect(page.locator('.con-parl [data-yield-in="count"]').first(), 'the science tags').toHaveText('2');
    await expect(page.locator('.con-parl [data-yield-in="influence"]').first(), 'the influence after the winner\'s step').toHaveText('2');
    const stageUnit = await unitIn(page, '.con-parl [data-yield-context] .con-iyield__out');
    expect(stageUnit.icons.slice(0, 2), `the stage's reading draws both kinds (${stageUnit.icons.join(' ')})`).toEqual(['card-resource-data', 'card-resource-microbe']);
    let state = await layoutState(page);
    expect(state.slots.map((s) => s.spread), 'every counter opens at zero — no prefilled layout').toEqual(['0', '0']);
    expect(state.slots.map((s) => s.capsule), 'the capsules read the cards\' current microbes').toEqual(['0', '0']);
    expect(state.blocked, 'the status line names what is left').toMatch(/4/);
    expect(state.ready).toBe(false);
    const focusedFirst = state.slots.find((s) => s.focused)?.card ?? '';
    expect(holders, 'the focus stands on one of the holders').toContain(focusedFirst);
    await expectParliamentFits(page, 'layout');
    await shoot(page, '04-layout-zero');

    // ── RB ONCE, then A: an INCOMPLETE layout sends NOTHING — the commit is withheld with its reason on the status line.
    let inputRequests = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
        inputRequests++;
      }
    });
    await press(page, 'KeyE', 500);
    state = await layoutState(page);
    const first = state.slots.find((s) => s.card === focusedFirst);
    expect(first?.spread, 'RB — one on the focused card').toBe('1');
    expect(first?.band, 'the counter band on the card').toMatch(/\+1/);
    expect(first?.bandIcon, 'the band wears ITS card\'s kind — a microbe holder takes microbes').toBe('card-resource-microbe');
    expect(state.blocked, 'three left to place — the reason the commit is withheld').toMatch(/3/);
    expect(state.ready).toBe(false);
    await press(page, 'Enter', 1200);
    await settle(page, {timeoutMs: 15_000});
    expect(inputRequests, 'A on an incomplete layout produced no request').toBe(0);
    expect((await wireOf(request, playerId)).waitingFor?.type, 'the layout still stands on the server').toBe('and');
    state = await layoutState(page);
    expect(state.slots.find((s) => s.card === focusedFirst)?.spread, 'the layout is unchanged').toBe('1');
    expect(state.blocked, 'the reason still stands').toMatch(/3/);
    await shoot(page, '05-incomplete-withheld');

    // ── RB again on the focused card, then RT pours the rest onto the other: 2 / 2, the status line says complete.
    await press(page, 'KeyE', 500);
    await press(page, 'ArrowRight', 500);
    state = await layoutState(page);
    const second = state.slots.find((s) => s.focused);
    expect(second?.card, 'the d-pad moved the focus to the other holder').not.toBe(focusedFirst);
    await press(page, 'Period', 700);
    state = await layoutState(page);
    expect(state.slots.map((s) => s.spread).sort(), 'RT poured the remainder').toEqual(['2', '2']);
    expect(state.slots.map((s) => s.bandIcon), 'both bands wear the microbe').toEqual(['card-resource-microbe', 'card-resource-microbe']);
    expect(state.ready, 'the layout is complete — the status line says so').toBe(true);
    expect(state.blocked).toBe('');
    expect(inputRequests, 'still nothing was sent').toBe(0);
    await expectParliamentFits(page, 'layout ready');
    await shoot(page, '06-layout-ready');

    // ── THE COMMIT: ONE request; one chip per recipient wearing the microbe; each capsule ticks to exactly what was laid out.
    await press(page, 'Enter', 1200);
    await expect.poll(async () => Object.values((await readProbe(page)).capsules).sort(), {
      timeout: 20_000, message: 'both capsules tick to their microbes while the layout is still on screen',
    }).toEqual(['2', '2']);
    const probe = await readProbe(page);
    expect(probe.samples, 'the probe ran').toBeGreaterThan(20);
    expect(probe.chips.length, `one chip per recipient (${JSON.stringify(probe.chips)})`).toBe(2);
    expect(probe.chips.every((c) => c.startsWith('+2|') && c.endsWith('card-resource-microbe')), `each chip carries its card's amount and kind (${JSON.stringify(probe.chips)})`).toBe(true);
    expect(inputRequests, 'the commit was ONE request').toBe(1);
    const mid = await wireOf(request, playerId);
    for (const name of holders) {
      expect(mid.thisPlayer.tableau.find((c) => c.name === name)?.resources, `the units landed on ${name}, exactly as laid out`).toBe(2);
    }

    // ── RED's single holder gets the family's ordinary pick (3 onto Tardigrades); the sitting walks to the results.
    const red = seats[1];
    await expect.poll(async () => (await wireOf(request, red)).waitingFor?.type, {timeout: 30_000}).toBe('card');
    await answerAsksAs(request, red);
    await waitSittingAtRest(page, 30_000);
    expect(await turnTo(page, 'results'), 'the results page').toBe(true);
    await shoot(page, '07-results');
    await press(page, 'Enter', 1200);
    await answerGateAs(request, red, 'adjourn');
    await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);

    // ════════════════ PART 3 · THE RECORD ════════════════
    const after = await wireOf(request, playerId);
    const parliament = after.game.parliament;
    expect(parliament.enacted?.resolution).toBe(MEDICAL_ID);
    expect(parliament.rulingParty, 'the Scientists rule by their card').toBe('Scientists');
    const outcomes = parliament.lastPhase?.outcomes ?? [];
    const mine = outcomes.find((o) => o.player === after.thisPlayer.color && o.kind === 'cardResource');
    expect(mine?.amount).toBe(4);
    expect(mine?.count, 'the science tags').toBe(2);
    expect(mine?.influence).toBe(2);
    expect(mine?.resources, 'the kinds the unit comes in').toEqual(['Data', 'Microbe']);
    expect(mine?.resource, 'every unit landed as a microbe: the ONE kind').toBe('Microbe');
    expect(mine?.card, 'a list of two names no single card').toBeUndefined();
    expect((mine?.cards ?? []).map((c) => `${c.card}:${c.amount}:${c.resource}`).sort()).toEqual(['GHG Producing Bacteria:2:Microbe', 'Regolith Eaters:2:Microbe']);
    const redWire = await wireOf(request, red);
    const theirs = outcomes.find((o) => o.player === redWire.thisPlayer.color && o.kind === 'cardResource');
    expect(theirs?.amount).toBe(3);
    expect(theirs?.card).toBe('Tardigrades');
    expect(theirs?.resource).toBe('Microbe');
    expect(redWire.thisPlayer.tableau.find((c) => c.name === 'Tardigrades')?.resources).toBe(3);
  });
});

/**
 * THE STAND — the mixed case the premium scope cannot play: a DATA holder
 * beside a MICROBE holder. The layout's facts name each holder with its own
 * kind, the reading draws the unit as both, and the floater card's scenarios
 * are nowhere under this law (nor its under the floater card).
 */
test.describe('Medical Database · the Polygon stand', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the distributed family over two kinds reads on the stand: the mixed tableau, the unit as data or microbe, and only its own scenarios', async ({page}) => {
    test.setTimeout(240_000);
    await page.goto('/?resolutionsPlayground&consoleProfile=auto');
    await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});
    // ▶ …: RX18, addressed BY CODE — the catalog grows, the code does not move.
    const onRx18 = await pressUntil(page, 'ArrowRight',
      async () => await page.locator('[data-rxpg-catalog] .con-rxpg__slot--cursor[data-rxpg-code="RX18"]').count() > 0,
      {tries: 30, settleMs: 350});
    expect(onRx18, 'the catalog cursor reaches RX18').toBe(true);
    // RB → the face at the three sizes + the inspector's columns; RB again → the scenario section.
    await press(page, 'BracketRight', 700);
    await press(page, 'BracketRight', 700);

    // ── The family opens on the two-kind card's OWN scenario — never on the floater card's layout.
    await expect(page.locator('[data-rxpg-scenario="medical-mixed"]'), 'the mixed layout is the opening scenario under this law')
      .toHaveClass(/con-rxpg__scenario--active/, {timeout: 15_000});
    await expect(page.locator('[data-rxpg-scenario="cloud-layout"]'), 'the floater card\'s scenarios are not listed under a data-or-microbe law').toHaveCount(0);
    const readings = await readingsIn(page, '[data-rxpg-yield]');
    expect(readings.some((r) => r.count === '3' && r.influence === '1' && r.amount === '4'), `the reading «3 tags + 1 → 4» is drawn, got ${JSON.stringify(readings)}`).toBe(true);
    const unit = await unitIn(page, '[data-rxpg-yield] .con-iyield__out');
    expect(unit.icons, 'the unit draws both kinds').toEqual(['card-resource-data', 'card-resource-microbe']);
    // The layout's facts: the microbe holder and the data holder, each a candidate; the science-only card is not.
    const layout = page.locator('[data-rxpg-layout]');
    await expect(layout, 'the layout facts').toHaveCount(1);
    await expect(layout).toHaveAttribute('data-rxpg-layout-amount', '4');
    const holders = await layout.locator('[data-rxpg-holder]').evaluateAll((els) => els.map((el) => el.getAttribute('data-rxpg-holder')));
    expect(holders.sort(), 'the microbe holder and the data holder; the two-science-tag card holds nothing').toEqual(['GHG Producing Bacteria', 'Martian Culture']);
    await shoot(page, '08-stand-mixed');
  });
});
