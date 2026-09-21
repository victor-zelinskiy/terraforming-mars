import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, bootFixtureSeats, openMandatoryAnnounce, press, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, expectParliamentFits, expectRailHonest, mandatoryPlate, openParliament, parliament, parliamentWire,
  PARLIAMENT_PRESETS, sittingStage, waitSittingAtRest,
} from './parliamentDrive';

/**
 * «ИТОГИ: ЧЕСТНОСТЬ» — the panel does not restate what stands beside it, and no surface promises what
 * cannot happen.
 *
 * ① the results panel is TWO sections, and the government's three facts (the enacted resolution, the
 *    ruling party, the chairman's quest) appear in the government's zone and NOWHERE inside the panel;
 * ② НАРОДНАЯ ПОДДЕРЖКА is a STOCK in places that equals the server's own record, the ruling party is not
 *    in the row, this sitting's arrivals are told apart from the older ones, and nothing is cut;
 * ③ «В ЛОББИ» is GONE (the delegates ledger states it, permanently and by name) and its place is the
 *    EXCEPTION it never stated: the seats that enter the next vote with nothing to vote with;
 * ④ the RULER's plaque shows no support sockets and still has the row's exact height;
 * ⑤ the government's swap changes a plaque's state in the frame it ARRIVES, never in flight.
 *
 * EVERY PROBE ASSERTS VISIBILITY, not that an event fired — a rect, the element's own computed
 * `visibility`, and the box of the ancestor that could cut it. The sampler is `setInterval` +
 * `MutationObserver`, never rAF (headless Chromium drives rAF off the compositor and stops exactly when
 * the screen goes quiet), and a sample carries the CLOCK that took it: an `mo` sample runs as a microtask
 * and legitimately sees a FLIP's re-parent before the `nextTick` that writes its inverse transform — a
 * state the browser never paints. Claims about FRAMES are made on the `tick` samples only.
 */
type TileSample = {party: string, inSlot: boolean, socketsHidden: boolean, socketsBox: boolean};
type ZoneWord = {zone: string, text: string};
type HonestySample = {
  src: 'mo' | 'tick',
  t: number, stage: string, swapping: boolean,
  sections: Array<string>,
  panelText: string,
  /** The panel's text WITHOUT the declared exceptions (`PANEL_EXCEPTIONS`) — what the law is asserted on. */
  panelStrict: string,
  /** Every word the OTHER zones own right now, read off the live DOM (`ZONE_WORDS`). */
  zoneWords: Array<ZoneWord>,
  tiles: Array<TileSample>,
};
type HonestyProbe = {samples: Array<HonestySample>};

/*
 * ЗАКОН ПАНЕЛИ, ЗАКРЕПЛЁННЫЙ МЕХАНИЧЕСКИ (Ф2): the results panel never prints what is VISIBLE IN ANOTHER
 * ZONE of the screen at that moment. Three rows have already died of it — ЗАКОН (the government's three
 * facts), В ЛОББИ (the delegates ledger) — so the guard may not be a list of the rows we happened to
 * remove: it reads each zone's OWN WORDS off the live DOM and refuses to find any of them inside the
 * panel, in any beat. Adding a zone is one row here; re-adding any removed row fails immediately.
 */
const ZONE_WORDS: ReadonlyArray<{zone: string, selector: string, why: string}> = [
  {zone: 'government/enacted', selector: '.con-parl__gov-card .pcard__title',
    why: 'the enacted resolution names itself on its own card under «ПРИНЯТАЯ РЕЗОЛЮЦИЯ»'},
  {zone: 'government/ruler', selector: '[data-parl-ruler-slot] .con-pseal__name',
    why: 'the ruling party is the plaque standing in the government, with «ПРАВИТ» on it'},
  {zone: 'government/quest', selector: '.con-parl__quest-text',
    why: 'the chairman quest is its own block — with progress, reward and the chair'},
  {zone: 'delegates-ledger', selector: '.con-parl__seats .con-parl__seat-key',
    why: 'the lobby socket and the reserve stack are stated per seat, permanently, at the top of the screen'},
  {zone: 'voting-area', selector: '.con-parl__slot .con-parl__card .pcard__title',
    why: 'the freshly dealt resolutions stand on the table the whole time the panel is up'},
];

/*
 * THE ONE DECLARED EXCEPTION, and it is an OPEN QUESTION rather than a blessing: «НОВЫЕ РЕЗОЛЮЦИИ» names
 * the cards the deal put on the table — and those cards are standing in the VOTING AREA at that very
 * moment, so by the law above the row is a restatement too. Its one member that is genuinely nowhere else
 * is «остаётся · перетасована» (a loser dealt straight back never left the table). Removing the row was
 * not part of this task, so it is excluded HERE, by name, where the next reader can see the question —
 * never by weakening the rule.
 */
const PANEL_EXCEPTIONS: ReadonlyArray<string> = ['[data-sit-row="results-fresh"]'];

const OUT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'parliament-v5');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function armHonestyProbe(page: Page): Promise<void> {
  await page.evaluate(([zones, exceptions]: [typeof ZONE_WORDS, ReadonlyArray<string>]) => {
    const w = window as unknown as {__hon: HonestyProbe};
    w.__hon = {samples: []};
    const text = (el: Element | null | undefined): string =>
      (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const tiles = (): Array<TileSample> => Array.from(document.querySelectorAll('.con-parl__party[data-party]')).map((el) => {
      const sockets = el.querySelector<HTMLElement>('.con-pseal__support');
      const r = sockets?.getBoundingClientRect();
      return {
        party: el.getAttribute('data-party') ?? '',
        inSlot: el.closest('[data-parl-ruler-slot]') !== null,
        // The element's OWN computed visibility: a hidden ANCESTOR (the parked row behind the results
        // panel) must not be read as «the ruler hides its sockets».
        socketsHidden: sockets !== null && getComputedStyle(sockets).visibility === 'hidden',
        socketsBox: r !== undefined && r.width > 0 && r.height > 0,
      };
    });
    // A zone's own words, normalized for comparison: case-folded (the panel's kickers are uppercased by
    // CSS, so `textContent` keeps whatever case the key was written in) and stripped of the marks a zone
    // paints into its own text (the reserve key carries a «←» while a delegate is on its way home).
    const words = (): Array<ZoneWord> => zones.flatMap(({zone, selector}) =>
      Array.from(document.querySelectorAll(selector))
        .map((el) => ({zone, text: text(el).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()}))
        .filter((wrd) => wrd.text.length >= 5));
    const strict = (): string => {
      const panel = document.querySelector('[data-sit-results]');
      if (panel === null) {
        return '';
      }
      const clone = panel.cloneNode(true) as HTMLElement;
      for (const sel of exceptions) {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      }
      return text(clone).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
    };
    const sample = (src: 'mo' | 'tick') => {
      const root = document.querySelector('.con-parl');
      if (root === null) {
        return;
      }
      w.__hon.samples.push({
        src,
        t: performance.now(),
        stage: root.getAttribute('data-sitting-stage') ?? '',
        swapping: root.classList.contains('con-parl--swapping'),
        sections: Array.from(document.querySelectorAll('[data-sit-section]')).map((el) => el.getAttribute('data-sit-section') ?? ''),
        panelText: text(document.querySelector('[data-sit-results]')),
        panelStrict: strict(),
        zoneWords: words(),
        tiles: tiles(),
      });
    };
    new MutationObserver(() => sample('mo')).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample('tick'), 40);
    sample('tick');
  }, [ZONE_WORDS, PANEL_EXCEPTIONS] as [typeof ZONE_WORDS, ReadonlyArray<string>]);
}

const readHonesty = (page: Page): Promise<HonestyProbe> =>
  page.evaluate(() => (window as unknown as {__hon: HonestyProbe}).__hon);

const ticks = (s: ReadonlyArray<HonestySample>) => s.filter((x) => x.src === 'tick');

type SittingSummary = {
  support?: Array<{party: string, gained: number}>,
  lobbyRefilled?: Array<string>,
  enacted?: {party: string},
};

/** The SERVER's own record of the sitting on screen: its phase's summary while it runs, `lastPhase` once closed. */
function summaryOf(wire: Awaited<ReturnType<typeof parliamentWire>>): SittingSummary {
  const parl = wire.game.parliament as unknown as {phase?: {summary?: SittingSummary}, lastPhase?: SittingSummary} | undefined;
  return parl?.phase?.summary ?? parl?.lastPhase ?? {};
}

type HonestyFixture = 'parliament-architecture-assembly' | 'parliament-support-stock';

async function openSitting(page: Page, request: Parameters<typeof bootFixtureSeats>[1], fixture: HonestyFixture, query = '&consoleProfile=auto') {
  const boot = await bootFixtureSeats(page, request, fixture, {query, landing: 'prompt'});
  await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
  expect(await openMandatoryAnnounce(page)).toBe(true);
  await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
  await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
  await waitSittingAtRest(page, 20_000);
  return boot;
}

/** The last answer opens gate 1 and the walk plays itself; come back when everything is at rest. */
async function runWalk(page: Page, request: Parameters<typeof bootFixtureSeats>[1], seat: string): Promise<void> {
  await answerGateAs(request, seat, 'assembly');
  await press(page, 'Enter', 400);
  await expect.poll(() => sittingStage(page), {timeout: 40_000}).not.toBe('verdict');
  await waitSittingAtRest(page, 60_000);
  await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
  await waitSittingAtRest(page, 60_000);
  await settle(page, {timeoutMs: 20_000});
}

test.describe('«Итоги: честность» — панель, поддержка, исключение (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('И1+И3 · ДВЕ СЕКЦИИ, и правительство не пересказано; строки лобби нет, есть исключение', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await openSitting(page, request, 'parliament-architecture-assembly');
    await armHonestyProbe(page);
    await runWalk(page, request, seats[1]);
    await shoot(page, 'honesty-results');

    // ① THE GOVERNMENT'S THREE FACTS STAND IN THE GOVERNMENT'S ZONE — the positive witness, without which
    //    «they are not in the panel» would be satisfied by their not existing at all.
    const zone = await page.evaluate(() => {
      const t = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return {
        enacted: t('.con-parl__gov-card .pcard__title'),
        ruler: t('[data-parl-ruler-slot] .con-pseal__name'),
        quest: t('.con-parl__quest-text'),
      };
    });
    expect(zone.enacted.length, 'the enacted resolution names itself in the government').toBeGreaterThan(3);
    expect(zone.ruler.length, 'the ruling party names itself on the ruler\'s plaque').toBeGreaterThan(2);
    expect(zone.quest.length, 'the chairman\'s quest names itself in its own block').toBeGreaterThan(3);

    const all = ticks((await readHonesty(page)).samples);
    expect(all.length, 'the sampler ran (a dead probe passes everything)').toBeGreaterThan(40);

    // ② TWO SECTIONS, in every beat the panel is mounted in.
    const withPanel = all.filter((s) => s.sections.length > 0);
    expect(withPanel.length, 'the results panel was sampled').toBeGreaterThan(5);
    const wrongSections = withPanel.filter((s) => s.sections.join('|') !== 'payouts|table');
    expect(wrongSections.map((s) => `${s.stage}: ${s.sections.join('|')}`).slice(0, 4),
      'the payouts and the table — and nothing else').toEqual([]);

    // ③ …AND THE PANEL NEVER RESTATES ANY ZONE'S OWN WORDS, in any beat — the LAW, asserted mechanically
    //    over `ZONE_WORDS` rather than over the rows we happened to delete. Re-add ЗАКОН and the
    //    government's three facts fail it; re-add В ЛОББИ and the ledger's «Лобби» fails it; a row that
    //    restates some zone nobody has thought of yet fails it the moment that zone joins the table.
    const zoneSeen = new Map<string, number>();
    const echoes: Array<string> = [];
    for (const sample of withPanel) {
      for (const word of sample.zoneWords) {
        zoneSeen.set(word.zone, (zoneSeen.get(word.zone) ?? 0) + 1);
        if (sample.panelStrict.includes(word.text)) {
          echoes.push(`${sample.stage}: the panel repeats ${word.zone}'s «${word.text}»`);
        }
      }
    }
    expect([...new Set(echoes)].slice(0, 5), 'the panel restates a zone that is standing beside it').toEqual([]);
    // …and the guard is not vacuous: every zone in the table actually spoke while the panel was up.
    expect(ZONE_WORDS.filter((z) => (zoneSeen.get(z.zone) ?? 0) === 0).map((z) => `${z.zone} (${z.selector}) — ${z.why}`),
      'a zone whose own words were never read: the law is unguarded there').toEqual([]);
    await expect(page.locator('[data-sit-law]'), 'no law member survives anywhere').toHaveCount(0);
    // The three government facts are the ones the table's first three rows carry, and they are REAL.
    expect(`${zone.enacted}|${zone.ruler}|${zone.quest}`.toLowerCase(), 'the government still states all three')
      .not.toBe('||');

    // ④ «В ЛОББИ» IS GONE, and what replaced it is an EXCEPTION. The delegates ledger states every seat's
    //    lobby socket and reserve by name, permanently — so «who got one back» was a restatement (and a
    //    poorer one: `lobbyRefilled` records whose lobby was EMPTY and got filled). The panel now states
    //    only the consequence the ledger never says out loud, and only when somebody is in it.
    //    THE SUMMARY OF A SITTING STILL IN PROGRESS lives on the PHASE — `lastPhase` is only written when
    //    the adjourn gate closes, and the panel stands one press BEFORE that.
    const wire = await parliamentWire(request, playerId);
    const refilled = summaryOf(wire).lobbyRefilled ?? [];
    expect(refilled.length, 'the server DID refill somebody — the removed row was not vacuous').toBeGreaterThan(0);
    await expect(page.locator('[data-sit-row="results-lobby"]'), 'no lobby row survives').toHaveCount(0);
    await expect(page.locator('[data-sit-lobby]'), 'and no chip of it either').toHaveCount(0);

    const wireSeats = (wire.game.parliament as unknown as {players?: Array<{color: string, participates: boolean, lobby: boolean, reserve: number}>})?.players ?? [];
    const voteless = wireSeats.filter((p) => p.participates && !p.lobby && p.reserve <= 0).map((p) => p.color);
    const stated = await page.locator('[data-sit-nodelegate]').evaluateAll((els) => els.map((el) => ({
      seat: el.getAttribute('data-sit-nodelegate-seat') ?? '',
      name: (el.querySelector('.con-sit__seat-name')?.textContent ?? '').trim(),
      cube: el.querySelector('.player-cube') !== null,
    })));
    expect(stated.map((c) => c.seat), `the exception names exactly the voteless seats (server: ${voteless.join(',') || 'none'})`)
      .toEqual(voteless);
    expect(stated.filter((c) => c.name === '' || !c.cube), 'every chip carries a cube AND a name').toEqual([]);
    await expect(page.locator('[data-sit-row="results-nodelegate"]'), voteless.length > 0 ? 'the exception stands' : 'no row while everybody can vote')
      .toHaveCount(voteless.length > 0 ? 1 : 0);
  });

  // THE FIXTURE IS THE POINT: Unity has been collecting neutral delegates for two generations and has no
  // resolution in the deck, so the deal can never take them away — the row then holds a party with BOTH
  // older and fresh delegates. On the plain table every stock is fresh and «told apart from the older
  // ones» would be a claim about nothing.
  /*
   * И8 · ПЕРВОЕ ПОКОЛЕНИЕ: the one window where the ruler rules WITHOUT an enacted card (the starting
   * rule), so the «a party that rules holds no support» proof's first premise does not hold on the
   * server. The screen must still lose nothing: the starting-rule ruler is replaced by the enacted card's
   * party, descends into the ROW where sockets are drawn, and its stock reads there. The hole would be a
   * party left standing in the GOVERNMENT — sockets hidden — with a stock the server says it has.
   * (The server half is pinned in `ParliamentPhase.spec.ts` § THE STARTING-RULE RULER.)
   */
  test('И8 · ПЕРВОЕ ПОКОЛЕНИЕ: прежний правитель уезжает в ряд и его запас читается; в правительстве — партия принятой карты с нулём', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await openSitting(page, request, 'parliament-architecture-assembly');
    const before = await parliamentWire(request, playerId);
    const startingRuler = (before.game.parliament as unknown as {rulingParty: string}).rulingParty;
    expect((before.game.parliament as unknown as {enacted?: string}).enacted, 'generation 1: nothing is enacted yet — the ruler rules by the STARTING RULE')
      .toBeUndefined();

    await runWalk(page, request, seats[1]);
    // Close the sitting and walk back into the overview: the parties row is parked behind the results
    // panel while it stands, and «its stock reads in the row» is a claim about a row the player can see.
    await answerGateAs(request, seats[1], 'adjourn');
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 5, settleMs: 1500}), 'A answers the adjourn gate').toBe(true);
    await settle(page, {timeoutMs: 30_000});
    await openParliament(page);
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, 'honesty-first-generation');

    const wire = await parliamentWire(request, playerId);
    const model = wire.game.parliament as unknown as {rulingParty: string, popularSupport: Record<string, number>};
    const enactedParty = summaryOf(wire).enacted?.party ?? '';
    expect(enactedParty.length, 'the sitting enacted a resolution').toBeGreaterThan(0);
    expect(model.rulingParty, 'the party of the enacted card now rules').toBe(enactedParty);
    expect(model.rulingParty, 'the government changed hands — the starting-rule ruler stepped down').not.toBe(startingRuler);
    expect(model.popularSupport[model.rulingParty] ?? 0, 'the ruling party holds no stock (the rule the hidden sockets stand on)').toBe(0);

    const tiles = await page.locator('.con-parl__party[data-party]').evaluateAll((els) => els.map((el) => {
      const sockets = el.querySelector<HTMLElement>('.con-pseal__support');
      const r = sockets?.getBoundingClientRect();
      return {
        party: el.getAttribute('data-party') ?? '',
        inSlot: el.closest('[data-parl-ruler-slot]') !== null,
        socketsVisible: sockets !== null && getComputedStyle(sockets).visibility === 'visible',
        socketsBox: r !== undefined && r.width > 0 && r.height > 0,
        filled: el.querySelectorAll('.con-pseal__support-place--on').length,
      };
    }));
    expect(tiles.length, 'six plaques: five in the row and the one in the government').toBe(6);

    const ruler = tiles.find((t) => t.inSlot);
    expect(ruler?.party, 'the plaque in the government belongs to the party of the enacted card').toBe(enactedParty);
    expect(ruler?.socketsVisible, 'and it shows no sockets — its stock can never be anything but zero').toBe(false);
    expect(ruler?.socketsBox, '…while still taking their room').toBe(true);

    const row = tiles.filter((t) => !t.inSlot);
    const former = row.find((t) => t.party === startingRuler);
    expect(former, `the starting-rule ruler (${startingRuler}) descended into the row`).toBeDefined();
    expect(former?.socketsVisible, 'and its sockets are DRAWN there — nothing of its stock is hidden').toBe(true);
    // …and every row tile states the server's own number: a stock cannot be lost on the way down.
    const wrong = row.filter((t) => t.filled !== (model.popularSupport[t.party] ?? 0));
    expect(wrong.map((t) => `${t.party}: ${t.filled} shown, ${model.popularSupport[t.party] ?? 0} on the server`),
      'a row tile disagrees with the server about its stock').toEqual([]);
  });

  test('И2 · ПОДДЕРЖКА ЧЕСТНА: места равны запасу сервера, правителя в строке нет, свежие отличимы, ничего не срезано', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await openSitting(page, request, 'parliament-support-stock');
    await runWalk(page, request, seats[1]);
    await shoot(page, 'honesty-support-stock');

    const wire = await parliamentWire(request, playerId);
    const model = wire.game.parliament as unknown as {rulingParty: string, popularSupport: Record<string, number>};
    const gained = new Map((summaryOf(wire).support ?? []).map((e) => [e.party, e.gained]));

    const row = await page.locator('[data-sit-support]').evaluateAll((els) => els.map((el) => {
      const places = Array.from(el.querySelectorAll('.con-sit__support-place'));
      const rowBox = el.closest('[data-sit-row="results-support"]')!.getBoundingClientRect();
      const own = el.getBoundingClientRect();
      return {
        party: el.getAttribute('data-sit-support-party') ?? '',
        total: Number(el.getAttribute('data-sit-support-total') ?? '-1'),
        fresh: Number(el.getAttribute('data-sit-support-fresh') ?? '-1'),
        places: places.length,
        filled: places.filter((p) => p.classList.contains('con-sit__support-place--on')).length,
        marked: places.filter((p) => p.classList.contains('con-sit__support-place--fresh')).length,
        // A marked socket must LOOK different from a plain filled one, and by more than a hue.
        markRim: places.filter((p) => p.classList.contains('con-sit__support-place--fresh'))
          .map((p) => getComputedStyle(p).boxShadow).join(' | '),
        plainRim: places.filter((p) => p.classList.contains('con-sit__support-place--on') && !p.classList.contains('con-sit__support-place--fresh'))
          .map((p) => getComputedStyle(p).boxShadow).join(' | '),
        inside: own.left >= rowBox.left - 1 && own.right <= rowBox.right + 1,
      };
    }));

    expect(row.map((e) => e.party), `the RULING party (${model.rulingParty}) is not in the row`).not.toContain(model.rulingParty);
    expect(row.length, 'the row states every party but the one that rules').toBe(5);

    // EVERY MEMBER IS A STOCK IN PLACES, and the places agree with the server's own record.
    const wrong = row.filter((e) => e.places !== 3 || e.filled !== e.total || e.total !== (model.popularSupport[e.party] ?? 0));
    expect(wrong.map((e) => `${e.party}: ${e.filled}/${e.places} shown, ${model.popularSupport[e.party] ?? 0} on the server`),
      'the filled places are the server\'s stock, out of three').toEqual([]);

    // THE MARK IS THIS SITTING'S ARRIVALS, never more than the stock that is actually standing.
    const badMark = row.filter((e) => e.marked !== Math.min(e.total, gained.get(e.party) ?? 0) || e.marked !== e.fresh);
    expect(badMark.map((e) => `${e.party}: marked ${e.marked}, gained ${gained.get(e.party) ?? 0}, stock ${e.total}`),
      'the fresh delegates are exactly the ones this deal left standing').toEqual([]);
    const marked = row.filter((e) => e.marked > 0 && e.marked < e.total);
    expect(marked.length, `some party holds both fresh and older delegates (${row.map((e) => `${e.party} ${e.marked}/${e.total}`).join(', ')})`)
      .toBeGreaterThan(0);
    for (const e of marked) {
      expect(e.markRim, `${e.party}: a fresh socket is told apart from an older one`).not.toBe(e.plainRim);
    }

    // NOTHING IS CUT: every chip stands inside the row's own box, and the row's text is honest.
    expect(row.filter((e) => !e.inside).map((e) => e.party), 'a chip cut by the row').toEqual([]);
    await expectRailHonest(page, 'the support row', '[data-sit-row="results-support"]');
  });

  test('И5 · ОБМЕН МЕСТАМИ: гнёзда меняются в кадре прибытия, ни одного кадра в чужом состоянии', async ({page, request}) => {
    test.setTimeout(300_000);
    const {seats} = await openSitting(page, request, 'parliament-architecture-assembly');
    await armHonestyProbe(page);
    await runWalk(page, request, seats[1]);

    const all = ticks((await readHonesty(page)).samples);
    expect(all.length, 'the sampler ran').toBeGreaterThan(40);
    const full = all.filter((s) => s.tiles.length === 6);
    expect(full.length, 'the six plaques were sampled').toBeGreaterThan(20);

    // ① AT REST the sockets are hidden on exactly the tile standing in the government, and nowhere else.
    const settled = full.filter((s) => !s.swapping);
    const wrongAtRest = settled.filter((s) => s.tiles.some((t) => t.socketsHidden !== t.inSlot));
    expect(wrongAtRest.map((s) => `${s.stage}: ` + s.tiles.filter((t) => t.socketsHidden !== t.inSlot)
      .map((t) => `${t.party} slot=${t.inSlot} hidden=${t.socketsHidden}`).join(', ')).slice(0, 4),
    'only the ruler hides its support places, and it always does').toEqual([]);

    // ② THE PLACES ARE HIDDEN, NOT REMOVED — the ruler's plaque must keep the row's box.
    const collapsed = full.filter((s) => s.tiles.some((t) => t.inSlot && !t.socketsBox));
    expect(collapsed.length, 'the ruler\'s hidden places still take their room').toBe(0);

    // ③ IN FLIGHT each plaque still wears the state of the place it LEFT: the tile already re-parented
    //    into the government keeps its sockets until it lands, and the one descending into the row keeps
    //    them hidden. So during the swap the two facts are exactly INVERTED — and never partly so.
    const swapping = full.filter((s) => s.swapping);
    expect(swapping.length, 'the government changed hands and the swap was sampled').toBeGreaterThan(0);
    const early = swapping.filter((s) => s.tiles.some((t) => t.socketsHidden === t.inSlot && (t.inSlot || t.socketsHidden)));
    expect(early.map((s) => `t=${Math.round(s.t)} ` + s.tiles.filter((t) => t.socketsHidden === t.inSlot && (t.inSlot || t.socketsHidden))
      .map((t) => `${t.party} slot=${t.inSlot} hidden=${t.socketsHidden}`).join(', ')).slice(0, 4),
    'a plaque travelled already wearing the state of the place it had not reached').toEqual([]);

    // ④ …and it DID change: the tile that ends in the government is not the one that started there.
    const first = full[0].tiles.find((t) => t.inSlot)?.party;
    const last = full[full.length - 1].tiles.find((t) => t.inSlot)?.party;
    expect(first, 'a ruler stood before').toBeDefined();
    expect(last, `the government changed hands (${first} → ${last})`).not.toBe(first);
  });
});

/**
 * И6 · ВМЕЩАЕМОСТЬ on the two profiles the 1080 probes above do not cover — the Deck is the tight one
 * («Отдельно Deck: панель из двух секций и ряд из шести плиток должны умещаться без обрезаний»). The support row is
 * where the two-section panel got wider and the Deck's column is the narrowest, so the honest-rail rule is
 * asked there by name on top of the fit sweep.
 */
for (const preset of PARLIAMENT_PRESETS.filter((p) => p.id !== 'standard-1080')) {
  test.describe(`«Итоги: честность» — вмещаемость панели (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('И6 · панель из двух секций вмещается, ни одна строка не срезана', async ({page, request}) => {
      test.setTimeout(300_000);
      const {seats} = await openSitting(page, request, 'parliament-support-stock', preset.query);
      await runWalk(page, request, seats[1]);
      await shoot(page, `honesty-results-${preset.id}`);

      const sections = await page.locator('[data-sit-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-sit-section')));
      expect(sections, 'the payouts and the table — and nothing else').toEqual(['payouts', 'table']);
      const chips = await page.locator('[data-sit-support]').count();
      expect(chips, 'five parties state their stock').toBe(5);
      // Nothing of the parliament spills its box, scrolls, or runs past the stage's own tier.
      await expectParliamentFits(page, `${preset.id} results`);
      await expectRailHonest(page, `${preset.id} support row`, '[data-sit-row="results-support"]');
      await expect(page.locator('[data-sit-row="results-lobby"]'), 'the lobby row is gone on every profile').toHaveCount(0);
    });
  });
}

/**
 * И4 · ПЛИТКА ПРАВИТЕЛЯ, on every profile: its support places are invisible and still occupy their room,
 * and its box is the row's box — the condition of the physical swap, so the delta is ZERO pixels.
 */
for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`«Итоги: честность» — плитка правителя (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('И4 · гнёзда правителя не видны и не съедают место; высота правителя равна ряду', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'parliament-actions', {query: preset.query});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, `honesty-plaque-${preset.id}`);

      const geo = await page.evaluate(() => {
        const box = (el: Element | null) => {
          const r = el?.getBoundingClientRect();
          return r === undefined ? undefined : {w: Math.round(r.width), h: Math.round(r.height)};
        };
        const sockets = (tile: Element | null) => {
          const el = tile?.querySelector<HTMLElement>('.con-pseal__support');
          if (el === undefined || el === null) {
            return undefined;
          }
          const r = el.getBoundingClientRect();
          return {visibility: getComputedStyle(el).visibility, display: getComputedStyle(el).display, w: r.width, h: r.height};
        };
        const ruler = document.querySelector('[data-parl-ruler-slot] .con-parl__party[data-party]');
        const rowTiles = Array.from(document.querySelectorAll('.con-parl__parties .con-parl__party[data-party]'));
        return {
          rulerParty: ruler?.getAttribute('data-party') ?? '',
          rulerBox: box(ruler),
          rulerSockets: sockets(ruler),
          rowBoxes: rowTiles.map((el) => box(el)),
          rowSockets: rowTiles.map((el) => ({party: el.getAttribute('data-party') ?? '', ...sockets(el)})),
        };
      });

      expect(geo.rowBoxes.length, 'the five opposition tiles').toBe(5);
      expect(geo.rulerBox, 'the ruler\'s tile stands in its slot').toBeDefined();
      // THE RULER PROMISES NOTHING IT CANNOT KEEP…
      expect(geo.rulerSockets?.visibility, `${geo.rulerParty} rules and shows no support places`).toBe('hidden');
      // …AND PAYS NO ROOM FOR IT: hidden, never removed, or the two boxes stop being one chassis.
      expect(geo.rulerSockets?.display, 'the places are hidden, not taken out of the flow').not.toBe('none');
      expect((geo.rulerSockets?.w ?? 0) > 0 && (geo.rulerSockets?.h ?? 0) > 0, 'the hidden places keep their box').toBe(true);
      // The opposition keeps its own places visible — without this the check above passes on a plaque
      // family that simply never draws them.
      expect(geo.rowSockets.filter((s) => s.visibility !== 'visible').map((s) => s.party),
        'every opposition tile shows its own places').toEqual([]);

      // ONE BOX: the ruler's tile is the row's tile, to the pixel.
      const rowH = [...new Set(geo.rowBoxes.map((b) => b?.h))];
      expect(rowH, `the row's tiles are one height (${geo.rowBoxes.map((b) => b?.h).join(',')})`).toHaveLength(1);
      expect(geo.rulerBox?.h, `the ruler's tile is the row's height (${geo.rulerBox?.h} vs ${rowH[0]})`).toBe(rowH[0]);
      const rowW = [...new Set(geo.rowBoxes.map((b) => b?.w))];
      expect(rowW, `the row's tiles are one width (${geo.rowBoxes.map((b) => b?.w).join(',')})`).toHaveLength(1);
      expect(geo.rulerBox?.w, `the ruler's tile is the row's width (${geo.rulerBox?.w} vs ${rowW[0]})`).toBe(rowW[0]);
    });
  });
}
