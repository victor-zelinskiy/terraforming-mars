import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openMandatoryAnnounce, press, settle} from './consoleStart';
import {answerGateAs, mandatoryPlate, openParliament, parliament, parliamentWire, sittingStage, waitSittingAtRest} from './parliamentDrive';

/**
 * «ЗАСЕДАНИЕ v3» — THE GOVERNMENT CHANGES AS ONE SET, AND THE SUPPORT IS ONE SCENE (В2 · В3).
 *
 * ① THE SET. The old law leaves, the winner flies into the government, the delegates go home, the plaques
 *    CHANGE PLACES (the new ruler's tile rises out of the row, the old one takes its place) and only then
 *    does the quest turn over. Three laws are measured, not admired: the government's ACCENT never belongs
 *    to one party while its tile shows another (both are read off the DOM, so they cannot be compared by
 *    eye); the QUEST never changes before the CARD it is printed on; and the support cubes a rising party
 *    had brought with it are still in its sockets after the swap.
 * ② THE SCENE. Every cube that lands is the server's own record, and every cube comes from a PLACE: the
 *    neutral supply, an unenacted card, or that card's delegate ribbon — never the middle of the screen.
 *    At a touchdown ONE socket answers and nothing else on the tiers changes (the traffic light of v2 is
 *    gone: no party tile carries a stage accent at all).
 *
 * The sampler is `setInterval` + `MutationObserver`, never rAF.
 */
type Rect = {x: number, y: number, w: number, h: number};
type Flight = {id: string, x: number, y: number, shown: boolean};
type V3Sample = {
  t: number, motion: string, beat: string, stage: string,
  /** The government's accent, and the party of the tile standing in its slot — the two must never disagree. */
  accent: string, rulerTile: string, accentOf: Record<string, string>,
  /** The enacted card's own slug and the quest's text — the caption may never move before its object. */
  card: string, quest: string,
  row: Array<string>, support: Record<string, number>,
  lit: number, landed: number, flights: Array<Flight>,
  supply: Rect | undefined, cards: Record<string, Rect>, ribbons: Record<string, Rect>,
};
type V3Probe = {samples: Array<V3Sample>};

async function armV3Probe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__v3: V3Probe};
    w.__v3 = {samples: []};
    const rect = (el: Element | null): Rect | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const sample = () => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      if (root === null) {
        return;
      }
      const gov = root.querySelector<HTMLElement>('.con-parl__gov');
      const accentOf: Record<string, string> = {};
      for (const tile of Array.from(root.querySelectorAll<HTMLElement>('.con-parl__party[data-party]'))) {
        const party = tile.getAttribute('data-party') ?? '';
        const plaque = tile.querySelector<HTMLElement>('.con-pseal');
        accentOf[party] = (plaque === null ? '' : getComputedStyle(plaque).getPropertyValue('--parl-accent')).trim();
      }
      const support: Record<string, number> = {};
      for (const box of Array.from(root.querySelectorAll<HTMLElement>('[data-parl-support]'))) {
        support[box.getAttribute('data-parl-support') ?? ''] = box.querySelectorAll('.con-pseal__support-place--on').length;
      }
      const cards: Record<string, Rect> = {};
      const ribbons: Record<string, Rect> = {};
      for (const slot of Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot[data-instance]'))) {
        const key = slot.getAttribute('data-instance') ?? '';
        const c = rect(slot.querySelector('.con-parl__card'));
        const r = rect(slot.querySelector('.con-parl__ribbon'));
        if (c !== undefined) {
          cards[key] = c;
        }
        if (r !== undefined) {
          ribbons[key] = r;
        }
      }
      w.__v3.samples.push({
        t: performance.now(),
        motion: root.getAttribute('data-sitting-motion') ?? '',
        beat: root.getAttribute('data-sitting-beat') ?? '',
        stage: root.getAttribute('data-sitting-stage') ?? '',
        accent: gov === null ? '' : getComputedStyle(gov).getPropertyValue('--parl-accent').trim(),
        rulerTile: root.querySelector('[data-parl-ruler] .con-parl__party')?.getAttribute('data-party') ?? '',
        accentOf,
        card: Array.from(root.querySelector('.con-parl__gov-card .pcard')?.classList ?? []).find((c) => c.startsWith('pcard--rdx-')) ?? '',
        quest: root.querySelector('.con-parl__quest-text')?.textContent?.trim() ?? '',
        row: Array.from(root.querySelectorAll<HTMLElement>('.con-parl__parties .con-parl__party')).map((el) => el.getAttribute('data-party') ?? ''),
        support,
        lit: root.querySelectorAll('.con-parl__party--lit').length,
        landed: root.querySelectorAll('.con-pseal__support-place--landed').length,
        flights: Array.from(document.querySelectorAll<HTMLElement>('[data-parl-flight]')).map((el) => {
          const r = el.getBoundingClientRect();
          return {id: el.getAttribute('data-parl-flight') ?? '', x: r.left + r.width / 2, y: r.top + r.height / 2, shown: getComputedStyle(el).visibility !== 'hidden'};
        }),
        supply: rect(root.querySelector('[data-parl-neutral-cube]')),
        cards, ribbons,
      });
      if (w.__v3.samples.length > 9000) {
        w.__v3.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-motion', 'data-party']});
    window.setInterval(sample, 16);
  });
}
const readV3 = (page: Page): Promise<V3Probe> => page.evaluate(() => (window as unknown as {__v3: V3Probe}).__v3);

/** Is a point inside a rect, with a tolerance? */
function inside(p: {x: number, y: number}, r: Rect | undefined, slack: number): boolean {
  return r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}

test.describe('the sitting v3 (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('THE GOVERNMENT CHANGES AS ONE SET: the accent never precedes the tile, the quest never precedes its card, the plaques change places and the support rides along', async ({page, request}) => {
    test.setTimeout(300_000);
    // Architecture Award: RED wins from the middle slot and the government changes (the Greens' starting rule → Mars First).
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 20_000);

    // THE VERDICT already states the CHAIRMANSHIP's outcome (v3 В2): the generation is over, so the quest
    // block reads closed — the enactment then has nothing left to add to it.
    await expect(page.locator('[data-parl-quest][data-parl-quest-closed]'), 'the quest reads closed at the verdict').toHaveCount(1);

    await armV3Probe(page);
    await answerGateAs(request, seats[1], 'assembly');
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await parliamentWire(request, playerId)).game.parliament?.phase?.step, {timeout: 40_000}).not.toBe('assembly');
    await expect.poll(() => sittingStage(page), {timeout: 40_000}).not.toBe('verdict');
    await waitSittingAtRest(page, 40_000);
    await settle(page, {timeoutMs: 20_000});

    const s = (await readV3(page)).samples;
    expect(s.length, 'the sampler ran').toBeGreaterThan(20);
    const first = s[0];
    const rest = s[s.length - 1];
    expect(first.rulerTile, 'the Greens ruled at the verdict').toBe('Greens');
    expect(rest.rulerTile, 'Mars First rules at rest').toBe('Mars First');
    expect(rest.row, 'the row kept five tiles and the Greens came back into it').toHaveLength(5);
    expect(rest.row).toContain('Greens');
    expect(rest.row).not.toContain('Mars First');

    // ① THE ACCENT TRAVELS WITH THE TILE: no sample where the government's accent is the NEW ruler's while
    //    its slot still shows the OLD one (a stage accent over somebody else's object).
    const mismatched = s.filter((x) => x.rulerTile !== '' && x.accent !== '' && (x.accentOf[x.rulerTile] ?? '') !== '' && x.accentOf[x.rulerTile] !== x.accent);
    expect(mismatched.length, `the government's accent always belongs to the tile standing in it (${mismatched.length} of ${s.length} samples; first ${JSON.stringify(mismatched[0]?.accent)} vs tile ${mismatched[0]?.rulerTile})`).toBe(0);

    // ② THE QUEST NEVER MOVES BEFORE ITS CARD — it is printed on the resolution that lands above it.
    const cardAt = s.findIndex((x) => x.card !== '' && x.card !== first.card);
    const questAt = s.findIndex((x) => x.quest !== first.quest);
    if (questAt >= 0) {
      expect(cardAt, 'the enacted card changed').toBeGreaterThanOrEqual(0);
      expect(questAt, `the quest turned over only after the card had landed (card @${cardAt}, quest @${questAt})`).toBeGreaterThanOrEqual(cardAt);
    }

    // ③ NO STAGE ACCENT ON A PARTY TILE, in any frame of the whole walk (the v2 traffic light).
    expect(s.filter((x) => x.lit > 0).length, 'no party tile ever carries a stage accent').toBe(0);

    // ④ THE SUPPORT RIDES WITH THE TILE: whatever the rising party had in its sockets, it still has.
    const before = first.support['Mars First'] ?? 0;
    const after = rest.support['Mars First'] ?? 0;
    expect(after, `Mars First kept the support it had through the swap (${before} → ${after})`).toBeGreaterThanOrEqual(before);
  });

  test('НАРОДНАЯ ПОДДЕРЖКА is one scene: every cube is the server\'s own, it comes from a PLACE, and only the receiving socket answers', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 20_000);
    // The support step runs PAST the barrier (v2's order), so the record does not exist yet at the verdict:
    // arm first, open the barrier, and read the server's own payment once it has been made.
    await armV3Probe(page);
    await answerGateAs(request, seats[1], 'assembly');
    await press(page, 'Enter', 400);
    await expect.poll(() => sittingStage(page), {timeout: 40_000}).not.toBe('verdict');
    await waitSittingAtRest(page, 40_000);
    const wire = await parliamentWire(request, playerId);
    const record = (wire.game.parliament?.phase?.summary?.support ?? []).filter((e) => e.gained > 0);
    expect(record.length, 'the server paid somebody').toBeGreaterThan(0);
    const s = (await readV3(page)).samples;

    // ① THE SOCKETS ARE ALWAYS RESERVED: three places per party, in every frame — the arrival is never a layout jump.
    const places = await page.evaluate(() => Array.from(document.querySelectorAll('[data-parl-support]')).map((el) => el.querySelectorAll('.con-pseal__support-place').length));
    expect(places.length, 'every party reserves its support places').toBeGreaterThan(0);
    expect(Array.from(new Set(places)), `three reserved places on every tile (${places.join(', ')})`).toEqual([3]);

    // ② EVERY PARTY ENDS WITH WHAT THE SERVER RECORDED.
    const rest = s[s.length - 1];
    for (const entry of record) {
      expect(rest.support[entry.party], `${entry.party} shows the server's own total (${entry.total})`).toBe(Math.min(3, entry.total));
    }

    // ③ EVERY CUBE COMES FROM A PLACE: the supply, a card, or a card's delegate ribbon — never the middle of nowhere.
    // A proxy is created invisible and revealed where it belongs (v3): its BIRTHPLACE is the first sample in
    // which it is actually shown. Cube flights only — a parked card face is a pose, not a cube.
    const firstSeen = new Map<string, {x: number, y: number, at: number}>();
    s.forEach((x, i) => x.flights.forEach((f) => {
      // …and only the SUPPORT scene's own cubes: the enactment's returning delegates leave the government's
      // card by design, and the Agenda's marker is not a support cube at all.
      if (!firstSeen.has(f.id) && f.shown && f.id.startsWith('f') && x.beat === 'support') {
        firstSeen.set(f.id, {x: f.x, y: f.y, at: i});
      }
    }));
    // ANTI-VACUOUS: with no cube seen, every check below passes by saying nothing. (This filter read the
    // STAGE before v4 — `data-sitting-motion` is 'enact' for the whole enactment, never 'support' — so the
    // birthplace law was asserted over an empty set.)
    expect(firstSeen.size, 'support cubes were seen in the air').toBeGreaterThan(0);
    const strays: Array<string> = [];
    for (const [id, p] of firstSeen) {
      const frame = s[p.at];
      const fromSupply = inside(p, frame.supply, 24);
      const fromCard = Object.values(frame.cards).some((r) => inside(p, r, 24));
      const fromRibbon = Object.values(frame.ribbons).some((r) => inside(p, r, 24));
      if (!fromSupply && !fromCard && !fromRibbon) {
        strays.push(`${id} @${Math.round(p.x)},${Math.round(p.y)} — supply ${JSON.stringify(frame.supply)} cards ${JSON.stringify(Object.values(frame.cards).map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)]))}`);
      }
    }
    expect(strays, `every cube is born on the supply, a card or a ribbon (${strays.length} of ${firstSeen.size} were not)`).toEqual([]);

    // ④ ONE SOCKET AT A TIME ANSWERS, and no tile carries a stage accent in any frame.
    const crowded = s.filter((x) => x.landed > 1);
    expect(crowded.length, `at most one socket answers at a time (${crowded.length} samples had ${crowded[0]?.landed})`).toBe(0);
    expect(s.filter((x) => x.lit > 0).length, 'no party tile ever lights').toBe(0);
    // ⑤ …and the scene's own words leave with it: no roll-call line survives the rest.
    await expect(page.locator('[data-pseal-roll]'), 'the roll call\'s words are the scene\'s, not the tiles\'').toHaveCount(0);
  });

  test('ПОВЕСТКА has no ordinals: the three reward nodes share one disc, the influence node carries its GLYPH with the level, and the panel prints no second number', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'parliament', {query: '&consoleProfile=auto', landing: 'board'});
    await openParliament(page);
    await settle(page, {timeoutMs: 20_000});
    const read = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__track .con-parl__step:not(.con-parl__step--start) .con-parl__step-node'));
      const head = document.querySelector<HTMLElement>('.con-parl__agenda-next');
      return {
        boxes: nodes.map((el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)]),
        influence: Array.from(document.querySelectorAll<HTMLElement>('.con-parl__step--influence')).map((el) => ({
          glyph: el.querySelector('.con-parl__step-res--inf') !== null,
          level: el.querySelector('.con-parl__step-level')?.textContent?.trim() ?? '',
        })),
        headText: head?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        headGlyph: head?.querySelector('.con-parl__step-res--inf, .con-parl__step-res--tr, .con-parl__step-res--card') !== null,
      };
    });
    // ① ONE DISC for the three rewards — an influence step is not a different shape.
    const widths = new Set(read.boxes.map((b) => b[0]));
    const heights = new Set(read.boxes.map((b) => b[1]));
    expect(Array.from(widths), `one node width (${read.boxes.map((b) => b.join('x')).join(', ')})`).toHaveLength(1);
    expect(Array.from(heights), 'one node height').toHaveLength(1);
    // ② THE INFLUENCE NODE carries its glyph WITH its level — never a bare numeral.
    expect(read.influence.length, 'the track has influence steps').toBeGreaterThan(0);
    expect(read.influence.filter((i) => !i.glyph), 'every influence node carries the influence glyph').toEqual([]);
    expect(read.influence.every((i) => i.level !== ''), '…and its level').toBe(true);
    // ③ THE PANEL says «ДАЛЕЕ» with the reward's own symbol — the retired «следующий шаг» printed a second number.
    expect(read.headText, `the head reads «далее» (${read.headText})`).toMatch(/ДАЛЕЕ|далее/i);
    expect(read.headText).not.toMatch(/СЛЕДУЮЩИЙ ШАГ|следующий шаг/i);
    expect(read.headGlyph, 'the next reward is a symbol, not a number').toBe(true);
  });
});
