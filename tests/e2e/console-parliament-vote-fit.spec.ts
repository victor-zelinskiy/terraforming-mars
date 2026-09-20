import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, closeZoomViewer, fetchPlayerModel, openQuickWheel, openZoomViewer, press, pressUntil, settle} from './consoleStart';

/**
 * THE VOTE PANEL — ONE NUMBER (Turmoil Redux, docs/TURMOIL_REDUX_PARLIAMENT_VOTE_ONE_NUMBER.md).
 *
 * For every real resolution of the catalog — its own `*-vote` fixture, plus the
 * two edge tables (a Climate table whose win RAISES the influence, a Power Grid
 * table already at the maximum) — on the three display profiles, inside the
 * vote mode:
 *   (а) nothing under `.con-parl__vote` is clipped (no element with scrollable
 *       overflow behind a non-visible `overflow`) and nothing is a scroll
 *       container — the premium card faces excepted (they clip their own art by
 *       design and carry their own guards);
 *   (б) every block stands inside the viewport and inside its tier;
 *   (в) the BUDGET by the panel's own witnesses: ONE reading, no forecast plate,
 *       the win's difference as a suffix (the expected deltas per fixture), two
 *       kickers, two facts (three on the edge this delegate crosses), ≤ 28 words
 *       — and nothing the panel gave up (the printed sentences, the party, the
 *       quest, the delegate count, the winner's tile) is on it;
 *   (г) X opens the inspector with the whole forecast (every estimate the panel
 *       shows, a forecast plate wherever the panel shows a suffix, the four vote
 *       facts in words), LB/RB page, B closes, and the panel underneath is the
 *       same afterwards;
 *   (д) a screenshot per profile and fixture, and the panel/card metrics for
 *       the before/after table.
 *
 * Probes are `setInterval`/DOM-free reads — never rAF.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-vote-fit');

type Fixture = {
  name: 'parliament-aquifer-vote' | 'parliament-architecture-vote' | 'parliament-biodome-vote' | 'parliament-powergrid-vote' |
    'parliament-climate-vote' | 'parliament-climate-vote-raise' | 'parliament-powergrid-vote-cap';
  code: string;
  /** The catalog id of the resolution in the first slot (the selected card; its slug is the face's class). */
  id: string;
  /** The win's difference per effect, in reading order (empty: the win raises nothing). */
  suffix: ReadonlyArray<string>;
  why: string;
};

const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const AWARD = 'RDX_MARS_ARCHITECTURE_AWARD';
const BIODOME = 'RDX_GREENS_BIODOME_CONTEST';
const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
const CLIMATE = 'RDX_GREENS_CLIMATE_RESEARCH';

const FIXTURES: ReadonlyArray<Fixture> = [
  {name: 'parliament-aquifer-vote', code: 'RX01', id: AQUIFER, suffix: ['1'], why: 'step 2 → 3: 1 → 2 animals'},
  {name: 'parliament-architecture-vote', code: 'RX02', id: AWARD, suffix: ['1'], why: '2 + 2 → +4; the win reaches +5, the maximum'},
  {name: 'parliament-biodome-vote', code: 'RX03', id: BIODOME, suffix: ['2'], why: 'influence 1 → 2: +2 → +4 plants'},
  {name: 'parliament-powergrid-vote', code: 'RX04', id: GRID, suffix: ['1'], why: '3 + 1 → +4; the win reaches +5, the maximum'},
  {name: 'parliament-climate-vote', code: 'RX05', id: CLIMATE, suffix: [], why: 'step 3 → 4 is a TR step: the win raises nothing'},
  {name: 'parliament-climate-vote-raise', code: 'RX05', id: CLIMATE, suffix: ['1', '1'], why: 'step 2 → 3: +1 heat production AND +1 card, one suffix per link'},
  {name: 'parliament-powergrid-vote-cap', code: 'RX04', id: GRID, suffix: [], why: 'influence 5: the maximum already — no suffix'},
];

/** The face's class for a catalog id (`RDX_GREENS_AQUIFER_CONTEST` → `rdx-greens-aquifer-contest`). */
const slug = (id: string) => id.toLowerCase().replace(/_/g, '-');

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

const WORD_LIMIT = 28;

const parliament = (page: Page) => page.locator('.con-parl');

/** Open the Parliament from the wheel (RT → down). */
async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

/**
 * (а) THE CLIP PROBE — every laid-out element under the vote layer: a scroll
 * container is a defect, and so is content behind a hiding overflow. The card
 * faces are skipped (their art is clipped by design), as are the empty embed
 * zone and anything not on screen.
 */
const clipProblems = (page: Page) => page.evaluate(() => {
  const root = document.querySelector<HTMLElement>('.con-parl__vote');
  if (root === null) {
    return ['no vote layer'];
  }
  const out: Array<string> = [];
  const name = (el: Element) => {
    const cls = el.className.toString().split(' ').filter((c) => c !== '')[0] ?? el.tagName.toLowerCase();
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${cls}${text === '' ? '' : ` «${text}»`}`;
  };
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (el.closest('.pcard') !== null || el.closest('[data-embed-slot]') !== null) {
      continue;
    }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // Not laid out, not shown, or the 1×1 visually-hidden text of an icon badge (assistive tech's copy, clipped by design).
    if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || cs.display === 'none') {
      continue;
    }
    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
      out.push(`scroll container: ${name(el)} (${cs.overflowX}/${cs.overflowY})`);
    }
    if (cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) {
      out.push(`clipped-y ${name(el)}: ${el.scrollHeight} > ${el.clientHeight}`);
    }
    if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
      out.push(`clipped-x ${name(el)}: ${el.scrollWidth} > ${el.clientWidth}`);
    }
  }
  return out;
});

/** (б) Every block of the mode stands whole in the viewport and inside its tier. */
async function expectVoteFits(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const root = document.querySelector('.con-parl__vote');
    if (root === null) {
      return ['no vote layer'];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const blocks = '.con-parl__slot, .con-parl__info, .con-parl__info-own, .con-parl__info-party, .con-parl__info-block, .con-parl__fact, .con-parl__cta, ' +
      '.con-iyield, .con-iyield__reading, .con-iyield__suffix, .con-preact, .con-parl__info-src';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(blocks))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`off-screen ${name(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      const tier = el.parentElement?.closest<HTMLElement>('.con-parl__info, .con-parl__slot') ?? null;
      if (tier !== null && tier !== el) {
        const t = tier.getBoundingClientRect();
        if (r.bottom > t.bottom + 1 || r.top < t.top - 1 || r.right > t.right + 1 || r.left < t.left - 1) {
          out.push(`outside its tier: ${name(el)} in ${name(tier)} (${Math.round(r.top)}..${Math.round(r.bottom)} vs ${Math.round(t.top)}..${Math.round(t.bottom)})`);
        }
      }
    }
    return out;
  });
  expect(problems, `${label}: every block of the vote mode fits`).toEqual([]);
}

type Budget = {
  kickers: number, readings: number, forecastPlates: number, estimatePlates: number, suffixes: Array<string | null>,
  facts: Array<string | null>, words: number, text: string, gone: Array<string>, captions: number, partyGraphic: number, partyMoment: number,
};

/** (в) THE BUDGET by the panel's own witnesses. */
const budgetOf = (page: Page) => page.evaluate((limit) => {
  const surface = document.querySelector<HTMLElement>('[data-parl-vote-surface]');
  if (surface === null) {
    throw new Error('no vote surface');
  }
  const q = (sel: string) => Array.from(surface.querySelectorAll<HTMLElement>(sel));
  const own = surface.querySelector<HTMLElement>('[data-parl-info="own"]');
  const vote = surface.querySelector<HTMLElement>('[data-parl-vote-forecast]');
  const text = [own, vote].map((el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' ');
  const words = (text.match(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'’-]*/g) ?? []).length;
  const gone: Array<string> = [];
  for (const [sel, what] of [
    ['.con-parl__info-part', 'a printed sentence'], ['[data-parl-info="party"]', 'the party block'], ['[data-parl-info="quest"]', 'the quest block'],
    ['[data-parl-fact="votes"]', 'the delegate count'], ['[data-parl-fact="mine"]', 'the own-delegate count'], ['[data-parl-vote-winner]', 'the winner\'s tile'],
    ['.con-iyield__reading--forecast', 'a forecast plate'], ['.con-parl__info-subkicker', 'a second heading'], ['[data-reaction-caption]', 'the answer\'s caption'],
  ] as Array<[string, string]>) {
    if (q(sel).length > 0) {
      gone.push(what);
    }
  }
  return {
    kickers: q('[data-parl-kicker]').length,
    readings: q('[data-parl-vote-reading]').length,
    forecastPlates: q('[data-parl-vote-reading] [data-yield-context="forecast"]').length,
    estimatePlates: q('[data-parl-vote-reading] [data-yield-context="estimate"]').length,
    suffixes: q('[data-parl-vote-suffix]').map((el) => el.getAttribute('data-parl-vote-suffix')),
    facts: q('[data-parl-fact]').map((el) => el.getAttribute('data-parl-fact')),
    words,
    text,
    gone,
    captions: q('[data-parl-vote-reading] .con-iyield__caption').length,
    // The party's GRAPHIC beside the reading (registry example 4): its formula and one line of moment — no sentence.
    partyGraphic: q('[data-parl-info="party-effect"] .con-pformula').length,
    partyMoment: q('[data-parl-info="party-effect"] .con-parl__info-party-when').length,
    limit,
  } as Budget & {limit: number};
}, WORD_LIMIT);

/**
 * (д) The panel's and the selected card's geometry, for the before/after table —
 * and what the panel's content NEEDS (the head, the graphic, the number, the
 * vote block, the confirm), so the height token is set by measure, not by eye.
 */
const metricsOf = (page: Page) => page.evaluate(() => {
  const box = (sel: string) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r === undefined ? null : {w: Math.round(r.width), h: Math.round(r.height)};
  };
  const info = document.querySelector<HTMLElement>('.con-parl__info');
  const infoH = info === null ? null : getComputedStyle(document.querySelector<HTMLElement>('.con-parl') ?? document.body).getPropertyValue('--con-parl-info-h').trim();
  return {
    panel: box('.con-parl__info'), infoToken: infoH, card: box('.con-parl__slot--selected .pcard'), viewport: {w: window.innerWidth, h: window.innerHeight},
    head: box('.con-parl__info-head'), mech: box('.con-parl__info-mech'), readings: box('.con-parl__info-readings'), own: box('.con-parl__info-own'),
    party: box('.con-parl__info-party'), main: box('.con-parl__info-main'), vrow: box('.con-parl__vrow'), body: box('[data-parl-vote-body]'),
    voteBlock: box('.con-parl__info-block--after'), facts: box('.con-parl__facts'), cta: box('.con-parl__cta'),
  };
});

/**
 * THE PANEL'S SIGNATURE — what the player reads and every witness, never the
 * markup: a re-render leaves `style=""` residues and fresh SVG gradient ids on
 * the cubes, and none of that is a change of the panel.
 */
const panelSignature = (page: Page) => page.locator('[data-parl-vote-surface]').evaluate((el) => {
  const q = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));
  return JSON.stringify({
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    readings: q('[data-yield-context]').map((r) => [r.getAttribute('data-yield-context'), r.getAttribute('data-yield-influence'), r.getAttribute('data-yield-amount'), r.getAttribute('data-yield-total-after')]),
    suffixes: q('[data-parl-vote-suffix]').map((s) => [s.getAttribute('data-parl-vote-suffix'), s.getAttribute('data-suffix-step')]),
    facts: q('[data-parl-fact]').map((f) => [f.getAttribute('data-parl-fact'), f.getAttribute('data-parl-fact-tone')]),
    cubes: q('.player-cube').map((c) => c.className),
    cta: q('[data-parl-cta]').map((c) => c.className),
  });
});

/** The zoom's readings and facts. */
const inspectorOf = (page: Page) => page.evaluate(() => {
  const zoom = document.querySelector<HTMLElement>('dialog.con-zoom[open]');
  if (zoom === null) {
    return null;
  }
  const q = (sel: string) => Array.from(zoom.querySelectorAll<HTMLElement>(sel));
  return {
    estimates: q('[data-zoom-vote-reading] [data-yield-context="estimate"]').length,
    forecasts: q('[data-zoom-vote-reading] [data-yield-context="forecast"]').length,
    // The viewer's vote in the footer: the fact rows of the chip, the status chip's access projection, no winning tail beside a chip, no vote block in the columns.
    voteFacts: q('[data-zoom-vote-facts] [data-zoom-vote-fact]').map((el) => el.getAttribute('data-zoom-vote-fact')),
    voteFactTexts: q('[data-zoom-vote-facts] [data-zoom-vote-fact]').map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()),
    voteAccess: q('[data-zoom-vote-access]').length,
    winningTails: q('.con-rstatus__life-tail').length,
    voteBlocks: q('[data-rules-group="group:vote"]').length,
    position: q('[data-zoom-position]').map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())[0] ?? null,
    parties: q('.con-rinspect-aside').length,
  };
});

type Wire = {game: {parliament: {slots: Array<{resolution: string, viewerVotes: number, party: string}>, players: Array<{color: string, access: Array<{party: string, hasEffect: boolean}>}>}}, thisPlayer: {color: string}};

for (const preset of PRESETS) {
  test.describe(`the vote panel · one number · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    for (const fixture of FIXTURES) {
      test(`${fixture.code} ${fixture.name}: one reading, its suffix, two facts, nothing clipped; the inspector carries the rest (${preset.id})`, async ({page, request}) => {
        test.setTimeout(240_000);
        const playerId = await bootFixture(page, request, fixture.name, {query: preset.query});
        const wire = await fetchPlayerModel(request, playerId) as unknown as Wire;
        await openParliament(page);
        const overviewCard = await page.locator('.con-parl__slot .pcard').first().boundingBox();

        // ── the mode
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}),
          'the vote mode opens').toBe(true);
        await settle(page, {timeoutMs: 15_000});
        expect(await page.locator('.con-parl__slot--selected').getAttribute('data-instance'), 'the first slot — the fixture\'s resolution — is selected').toContain(fixture.id);

        // ── (а) + (б)
        // Polled, not read once: the entrance travels the late items in on a transform, and a
        // transformed box is scrollable overflow while it moves — a one-shot read on a loaded runner
        // sampled «clipped-y … 402 > 384» mid-flight; a real clip persists and fails here the same way.
        await expect.poll(() => clipProblems(page), {timeout: 8_000, message: `${fixture.name} @ ${preset.id}: nothing under the vote layer is clipped or scrollable`}).toEqual([]);
        await expectVoteFits(page, `${fixture.name} @ ${preset.id}`);

        // ── (в) the budget — and the edge, read off the server's own model
        const budget = await budgetOf(page);
        const slot0 = wire.game.parliament.slots[0];
        const me = wire.game.parliament.players.find((p) => p.color === wire.thisPlayer.color);
        const held = me?.access.find((a) => a.party === slot0.party)?.hasEffect === true;
        const onEdge = !held && slot0.viewerVotes === 1;
        expect(budget.readings, 'ONE reading').toBe(1);
        expect(budget.forecastPlates, 'a forecast is never a plate on the panel').toBe(0);
        expect(budget.estimatePlates, 'the estimate plates — one per effect').toBeGreaterThan(0);
        expect(budget.captions, 'the kicker is the caption; the plates print none').toBe(0);
        expect(budget.partyGraphic, 'the party\'s formula stands beside the reading').toBe(1);
        expect(budget.partyMoment, 'with its one line of moment').toBe(1);
        expect(budget.suffixes, `the win's difference (${fixture.why})`).toEqual(fixture.suffix);
        expect(budget.kickers, 'two kickers').toBe(2);
        expect(budget.facts.slice(0, 2), 'the leader and the winning state').toEqual(['lead', 'win']);
        expect(budget.facts.length, onEdge ? 'on the edge: the party effect is the third fact' : 'off the edge: two facts').toBe(onEdge ? 3 : 2);
        if (onEdge) {
          expect(budget.facts[2]).toBe('access');
        }
        expect(budget.words, `≤ ${WORD_LIMIT} words on the panel: «${budget.text}»`).toBeLessThanOrEqual(WORD_LIMIT);
        expect(budget.gone, 'what left the panel stays off it').toEqual([]);
        const metrics = await metricsOf(page);
        expect((metrics.card?.h ?? 0) > (overviewCard?.height ?? 0) * 1.15, `the mode's card is larger than the overview's (${Math.round(overviewCard?.height ?? 0)} → ${metrics.card?.h})`).toBeTruthy();

        // ── (д) the screenshot and the metrics
        const dir = path.join(OUT_ROOT, preset.id);
        fs.mkdirSync(dir, {recursive: true});
        await page.screenshot({path: path.join(dir, `${fixture.code}-${fixture.name}.png`)});
        fs.writeFileSync(path.join(dir, `${fixture.code}-${fixture.name}.json`), JSON.stringify({...metrics, budget: {...budget, text: undefined}, onEdge}, null, 2));

        // ── (г) the inspector carries the whole forecast; the panel under it does not move
        const panelBefore = await panelSignature(page);
        await openZoomViewer(page);
        const zoom = page.locator('dialog.con-zoom[open]');
        await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the selected resolution on the stage').toHaveClass(new RegExp(slug(fixture.id)));
        await expect.poll(() => inspectorOf(page), {timeout: 10_000}).not.toBeNull();
        const inspector = (await inspectorOf(page))!;
        expect(inspector.estimates, 'every estimate the panel shows').toBe(budget.estimatePlates);
        expect(inspector.forecasts, 'a forecast plate wherever the panel shows a suffix').toBe(fixture.suffix.length);
        expect(inspector.voteFacts, `the vote's facts as the panel's rows in the footer: ${inspector.voteFactTexts.join(' | ')}`).toEqual(['lead', 'win']);
        expect(inspector.voteBlocks, 'no vote block in the columns (registry R-10)').toBe(0);
        expect(inspector.winningTails, 'the status chip drops its winning tail beside the vote chip').toBe(0);
        expect(inspector.voteAccess, onEdge ? 'on the edge the access line projects «→ эффект ваш»' : 'off the edge the access line projects nothing').toBe(onEdge ? 1 : 0);
        expect(inspector.parties, 'the party column').toBe(1);
        // LB/RB page the proposals (three on every fixture table).
        const position = inspector.position;
        expect(position, 'the paging position rides the footer').toMatch(/1\s*\/\s*\d/);
        await press(page, 'KeyE', 900);
        await expect.poll(async () => (await inspectorOf(page))?.position ?? null, {timeout: 6_000, message: 'RB pages to the second proposal'}).toMatch(/2\s*\/\s*\d/);
        await press(page, 'KeyQ', 900);
        await expect.poll(async () => (await inspectorOf(page))?.position ?? null, {timeout: 6_000, message: 'LB pages back'}).toMatch(/1\s*\/\s*\d/);
        await closeZoomViewer(page);
        await settle(page, {timeoutMs: 8_000});
        await expect(page.locator('.con-parl__vote.con-parl__vote--up'), 'the mode survives the inspector').toHaveCount(1);
        const panelAfter = await panelSignature(page);
        expect(panelAfter, 'the panel under the inspector is the same afterwards').toBe(panelBefore);
        await expect.poll(() => clipProblems(page), {timeout: 8_000, message: 'still nothing clipped after the inspector'}).toEqual([]);

        await press(page, 'Escape', 900);
      });
    }
  });
}
