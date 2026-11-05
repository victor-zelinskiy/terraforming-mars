import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, bootFixtureSeats, bootIntoGame, cinematicBeat, fetchPlayerModel, openConsole, press, pressUntilVisible, reloadConsole, settle,
  soloGameConfig, waitForBoardHome,
} from './consoleStart';
import {armTransferWitness, transferTrail, transferWitness} from './transferWitness';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * PC01 NIRGAL ENTERPRISES — «ЦЕНА ДОСТИЖЕНИЯ / НАГРАДЫ НАЗЫВАЕТ СВОЮ ПРИЧИНУ» (docs/claude/prompts/
 * prelude2-pc01-nirgal-enterprises.md, ledger GN / GO). The corporation's one mechanic is a price the engine waives; the
 * console used to print it as a bare «Бесплатно» with no cause, the awards ladder lied about three times, and the effect
 * left no record. Now:
 *
 *   A (a table with MarsBot — the product's main mode) — the corporation is dealt and played, the bot is never its twin
 *     C42, and the price chip on the board's own MA screen is WAIVED.
 *   B (`nirgal-ma`) — the milestone: the overview's chip «8 → 0» + the seal, the detail's «ЦЕНА» cell the same and the
 *     source named once in words; A claims with NOTHING armed (no price token, the M€ row never ticks), «+5 ПО» as for
 *     anybody; the server's M€ 2 → 2; the journal's child «−8 · Nirgal Enterprises»; «Ваши эффекты» 1 firing, 8 saved.
 *   C (`nirgal-ma` → two fundings) — the ladder «8→0 · 14→0 · 20→0» with the seals, nothing wrapped or cut; after the
 *     first funding the slot reads «0» with the seal and the sponsor's seat, the next «14→0»; saved 8 + 14.
 *   D (`nirgal-ma-funded`, the RIVAL's seat) — Nirgal's slot reads «0» with the seal (never «8»), the rival's own «14»,
 *     the rival's next price a plain number; no source line (it is not the rival's waiver).
 *   F (reload) — the same reading after a reload, and nothing repeated after the claim.
 *   G (`nirgal-ma-venus`, tv4k + deck) — six awards under a waived price: two columns, no scroll, the ladder whole.
 *     The second profile is the claim: the ladder's width budget is a per-profile NUMBER.
 *   S (a one-seat table) — frames only, no product change: the effect that never fires here (the named gap, GO).
 */

const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
// G alone runs the handheld profile too: it asserts a per-profile width budget (rules/tests.md — the KEEP case).
const DECK = {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'} as const;
const NIRGAL = 'Nirgal Enterprises';
const OUT = path.resolve('screenshots', 'pc01');

type Wire = {
  thisPlayer: {megaCredits?: number, megacredits?: number, color: string},
  game: {
    milestones: Array<{name: string, color?: string}>,
    awards: Array<{name: string, color?: string, paid?: number, waivedBy?: string}>,
    automa?: {corporation?: {id: string, original: string}},
  },
  players: Array<{color: string, tableau?: Array<{name: string}>}>,
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const mcOf = (w: Wire) => w.thisPlayer.megaCredits ?? w.thisPlayer.megacredits ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The MA workspace of one kind (LB opens the milestones; RB walks over to the awards). */
async function openKind(page: Page, kind: 'milestones' | 'awards'): Promise<void> {
  await press(page, 'KeyQ', 1400);
  await page.waitForSelector('.con-ma', {timeout: 10_000});
  if (kind === 'awards') {
    await press(page, 'KeyE', 1400);
    await expect(page.locator('.con-ma.con-ma--awards'), 'RB walked to the awards workspace').toHaveCount(1);
  }
}

/** Walk the 2 × N grid onto the first item whose name matches, then descend into its detail stage. */
async function openItem(page: Page, match: (name: string) => boolean, label: string): Promise<void> {
  const names = await page.locator('.con-ma__card').evaluateAll((cards) => cards.map((c) => c.getAttribute('data-ma-row') ?? ''));
  const target = names.findIndex(match);
  expect(target, `${label} is on the screen — ${names.join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let hop = 0; hop < 10; hop++) {
    const cur = await page.locator('.con-ma__card').evaluateAll((cards) => cards.findIndex((c) => c.classList.contains('con-ma__card--focused')));
    if (cur === target || cur < 0) {
      break;
    }
    const [curRow, tgtRow] = [Math.floor(cur / 2), Math.floor(target / 2)];
    await press(page, curRow !== tgtRow ? (curRow < tgtRow ? 'ArrowDown' : 'ArrowUp') : (cur % 2 < target % 2 ? 'ArrowRight' : 'ArrowLeft'), 300);
  }
  await expect.poll(() => page.locator('.con-ma__card--focused').getAttribute('data-ma-row'), {message: `the cursor on ${label}`, timeout: 5_000})
    .toBe(names[target]);
  await press(page, 'Enter', 1200);
  await page.waitForSelector('.con-mafocus', {timeout: 8_000});
  await cinematicBeat(page, 500, 'the detail must be READABLE before its commit arms (COMMIT_ARM_MS)');
}

type StepRead = {kind: string | null, printed: string | null, source: string | null, text: string, sponsor: boolean, fits: boolean};
/** Every step of the open ladder as PAINTED: its reading's kind, the struck price, the seal's source, whole or cut. */
async function ladderOf(page: Page): Promise<Array<StepRead>> {
  return await page.locator('.con-mafocus [data-ma-ladder-step]').evaluateAll((steps) => steps.map((s) => {
    const el = s as HTMLElement;
    return {
      kind: el.getAttribute('data-ma-price-kind'),
      printed: el.querySelector('[data-ma-price-printed]')?.getAttribute('data-ma-price-printed') ?? null,
      source: el.querySelector('[data-ma-price-source]')?.getAttribute('data-ma-price-source') ?? null,
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      sponsor: el.querySelector('.con-mafocus__dot') !== null,
      fits: el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height < 3 * parseFloat(getComputedStyle(el).fontSize),
    };
  }));
}

/** The ladder row itself stands whole: no step wraps under another, the row is not wider than its plate. */
async function ladderWhole(page: Page): Promise<{whole: boolean, detail: string}> {
  return await page.locator('.con-mafocus [data-ma-ladder]').evaluate((row) => {
    const el = row as HTMLElement;
    const plate = el.closest('.con-mafocus__plate') as HTMLElement | null;
    const tops = [...el.children].map((c) => Math.round((c as HTMLElement).getBoundingClientRect().top));
    const oneLine = new Set(tops).size === 1;
    const inPlate = plate === null || el.getBoundingClientRect().right <= plate.getBoundingClientRect().right + 1;
    return {whole: oneLine && inPlate && el.scrollWidth <= el.clientWidth + 1,
      detail: `tops=${tops.join(',')} row=${el.scrollWidth}/${el.clientWidth} inPlate=${inPlate}`};
  });
}

async function effectStat(request: APIRequestContext, id: string, color: string): Promise<{triggerCount: number, megacreditsSaved: number} | undefined> {
  const res = await request.get(`/api/game/effect-stats?id=${id}&color=${color}`);
  expect(res.ok(), 'the effect stats answer').toBe(true);
  const stats = await res.json() as Array<{card?: string, triggerCount: number, megacreditsSaved: number}>;
  return stats.find((s) => s.card === NIRGAL);
}

test.describe(`PC01 Nirgal Enterprises · the price names its cause · ${TV.id}`, () => {
  test.use({viewport: TV.viewport});

  test('A · a table with MarsBot: Nirgal dealt and played, the bot never C42, the price chip WAIVED', async ({page, request}) => {
    test.setTimeout(300_000);
    const config = soloGameConfig({
      automa: {difficulty: 'normal'}, testMode: false,
      customCorporationsList: [NIRGAL], startingCorporations: 1,
    });
    const id = await bootIntoGame(page, request, {config, corporation: NIRGAL, query: TV.query});
    await settle(page);
    const wire = await wireOf(request, id);
    const me = wire.players.find((p) => p.color === wire.thisPlayer.color);
    expect(me?.tableau?.some((c) => c.name === NIRGAL), 'the human plays Nirgal Enterprises').toBe(true);
    expect(wire.game.automa, 'MarsBot is seated').toBeTruthy();
    expect(wire.game.automa?.corporation?.original, 'the bot is never Nirgal\'s twin C42').not.toBe(NIRGAL);
    await openKind(page, 'milestones');
    const chip = page.locator('[data-ma-price="milestones"]');
    await expect(chip, 'the milestone price is waived on a bot table').toHaveAttribute('data-ma-price-kind', 'waived');
    await expect(chip.locator('[data-ma-price-source]')).toHaveAttribute('data-ma-price-source', NIRGAL);
    await shoot(page, 'a-bot-milestones');
  });

  test('B · the milestone: «8 → 0» with the seal, nothing flies, the saving journaled', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'nirgal-ma', {query: TV.query});
    await settle(page);
    const before = await wireOf(request, id);
    expect(mcOf(before), 'the fixture: 2 M€').toBe(2);

    await openKind(page, 'milestones');
    const chip = page.locator('[data-ma-price="milestones"]');
    await expect(chip).toHaveAttribute('data-ma-price-kind', 'waived');
    await expect(chip.locator('[data-ma-price-printed]'), 'the table\'s price, struck').toHaveAttribute('data-ma-price-printed', '8');
    await expect(chip.locator('[data-req-mark="card"]'), 'the seal of a standing corporation effect').toHaveCount(1);
    await expect(chip, 'never the bare «Бесплатно»').not.toContainText('Бесплатно');
    await shoot(page, 'b-overview');

    await openItem(page, (n) => n.startsWith('Terraformer'), 'Terraformer');
    const cell = page.locator('.con-mafocus [data-ma-exchange] .con-mafocus__xcell--price');
    await expect(cell).toHaveAttribute('data-ma-price-kind', 'waived');
    await expect(cell.locator('[data-ma-price-printed]')).toHaveAttribute('data-ma-price-printed', '8');
    await expect(page.locator('.con-mafocus [data-ma-price-target]'), 'a waived price arms no flight target').toHaveCount(0);
    await expect(page.locator('.con-mafocus [data-ma-waiver]'), 'the source named once, in words').toContainText(NIRGAL);
    await shoot(page, 'b-detail');

    await recordTransient(page, 'pc01-mc', () => (document.querySelector('.con-res__row--megacredits .con-res__digits')?.textContent ?? '').trim());
    await armTransferWitness(page);
    await press(page, 'Enter', 200);
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    await expect(page.locator('.con-mafocus__cere [data-ma-price-kind]'), 'a milestone\'s ceremony prints no price').toHaveCount(0);
    await expect.poll(async () => (await wireOf(request, id)).game.milestones.some((m) => m.name.startsWith('Terraformer') && m.color === before.thisPlayer.color),
      {timeout: 20_000, message: 'the server: Terraformer claimed'}).toBe(true);
    await expect(page.locator('.con-ma'), 'the workspace leaves after its ceremony').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});

    const after = await wireOf(request, id);
    expect(mcOf(after), 'the claim cost nothing: 2 → 2').toBe(2);
    const witness = await transferWitness(page);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'b-trail.txt'), transferTrail(witness) + '\n');
    expect(witness.births.filter((b) => b.under === 'rail:megacredits'), `no price token leaves the M€ row — ${transferTrail(witness)}`).toEqual([]);
    expect(witness.landings.filter((l) => l.under === 'ma-price'), 'nothing is absorbed into a price').toEqual([]);
    expect(witness.births.some((b) => b.under === 'ma-vp'), `«+5 ПО» as for anybody — ${transferTrail(witness)}`).toBe(true);
    const mc = (await readTransient<string>(page, 'pc01-mc')).map((s) => s.v).filter((v) => v !== '');
    expect(new Set(mc), `the M€ row never ticked: ${mc.join(' → ')}`).toEqual(new Set(['2']));

    const journal = await request.get(`/api/game/journal-events?id=${id}&generation=1`);
    expect(journal.ok(), 'the journal answers').toBe(true);
    const events = await journal.json() as Array<{source?: {kind: string, card?: string}, impact?: {megacreditsSaved?: number}}>;
    expect(events.some((e) => e.source?.card === NIRGAL && e.impact?.megacreditsSaved === 8), 'the journal\'s child «−8 · Nirgal Enterprises»').toBe(true);
    const stat = await effectStat(request, id, before.thisPlayer.color);
    expect(stat?.triggerCount, '«Ваши эффекты»: one firing').toBe(1);
    expect(stat?.megacreditsSaved, '…and 8 M€ saved').toBe(8);
  });

  test('C · the awards ladder: three times, the truth — then two fundings for 0', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'nirgal-ma', {query: TV.query});
    await settle(page);
    const me = (await wireOf(request, id)).thisPlayer.color;
    await openKind(page, 'awards');
    await expect(page.locator('[data-ma-price="awards"]')).toHaveAttribute('data-ma-price-kind', 'waived');
    const first = (await page.locator('.con-ma__card').first().getAttribute('data-ma-row')) ?? '';
    await openItem(page, (n) => n === first, first);
    const steps = await ladderOf(page);
    expect(steps.map((s) => [s.kind, s.printed, s.source]), 'the ladder before: 8 → 0 · 14 → 0 · 20 → 0, each with the seal')
      .toEqual([['waived', '8', NIRGAL], ['waived', '14', NIRGAL], ['waived', '20', NIRGAL]]);
    expect(steps.every((s) => s.fits), `no step wrapped or cut — ${JSON.stringify(steps)}`).toBe(true);
    const whole = await ladderWhole(page);
    expect(whole.whole, `the ladder stands whole in its plate — ${whole.detail}`).toBe(true);
    await expect(page.locator('.con-mafocus [data-ma-price-target]'), 'nothing to fly into').toHaveCount(0);
    await shoot(page, 'c-ladder-before');

    await press(page, 'Enter', 200);
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    await expect(page.locator('.con-mafocus__cere [data-ma-price-kind="waived"]'), 'the ceremony states the waived price').toHaveCount(1);
    await shoot(page, 'c-ceremony');
    await expect.poll(async () => (await wireOf(request, id)).game.awards.find((a) => a.name === first)?.paid,
      {timeout: 20_000, message: 'the server: the slot went for 0'}).toBe(0);
    await expect(page.locator('.con-ma'), 'the workspace leaves after its ceremony').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});

    await openKind(page, 'awards');
    const unfunded = await page.locator('.con-ma__card').evaluateAll((cards, name) => cards
      .map((c) => c.getAttribute('data-ma-row') ?? '').filter((n) => n !== name), first);
    await openItem(page, (n) => n === unfunded[0], unfunded[0]);
    const later = await ladderOf(page);
    expect(later[0], 'the funded slot reads «0» with the seal and its sponsor').toMatchObject({kind: 'waived', printed: null, source: NIRGAL, sponsor: true});
    expect([later[1].kind, later[1].printed], 'the next step: 14 → 0').toEqual(['waived', '14']);
    expect([later[2].kind, later[2].printed], 'the step after it: the table\'s 20, struck').toEqual(['waived', '20']);
    await shoot(page, 'c-ladder-after');
    await press(page, 'Enter', 200);
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    await expect.poll(async () => (await wireOf(request, id)).game.awards.find((a) => a.name === unfunded[0])?.paid,
      {timeout: 20_000, message: 'the server: the second slot went for 0'}).toBe(0);
    await expect(page.locator('.con-ma'), 'the workspace leaves after its ceremony').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    const stat = await effectStat(request, id, me);
    expect(stat?.megacreditsSaved, 'saved 8 + 14 — the server\'s sum').toBe(22);
    expect(stat?.triggerCount).toBe(2);
    expect(mcOf(await wireOf(request, id)), 'nothing paid').toBe(2);
  });

  test('D · the rival\'s seat: Nirgal\'s slot reads «0» with the seal, its own «14», its next a plain number', async ({page, request}) => {
    test.setTimeout(300_000);
    const {seats} = await bootFixtureSeats(page, request, 'nirgal-ma-funded', {query: TV.query});
    await openConsole(page, seats[1], TV.query);
    await waitForBoardHome(page, 25);
    await settle(page);
    await openKind(page, 'awards');
    await expect(page.locator('[data-ma-price="awards"]'), 'the rival\'s own next price is a plain number').toHaveAttribute('data-ma-price-kind', 'paid');
    const wire = await wireOf(request, seats[1]);
    const open = wire.game.awards.find((a) => a.color === undefined)?.name ?? '';
    await openItem(page, (n) => n === open, open);
    const steps = await ladderOf(page);
    expect(steps[0], 'Nirgal\'s slot: «0» with the seal — never «8»').toMatchObject({kind: 'waived', printed: null, source: NIRGAL, sponsor: true});
    expect(steps[0].text, 'no rules\' price on the waived slot').not.toContain('8');
    expect([steps[1].kind, steps[1].text], 'the rival\'s own slot: 14').toEqual(['paid', '14']);
    expect([steps[2].kind, steps[2].text], 'the rival\'s next: the table\'s 20, a plain number').toEqual(['paid', '20']);
    await expect(page.locator('.con-mafocus [data-ma-waiver]'), 'not the rival\'s waiver — no source line').toHaveCount(0);
    await shoot(page, 'd-rival-ladder');
  });

  test('F · a reload: the same reading, nothing repeated after the claim', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'nirgal-ma', {query: TV.query});
    await settle(page);
    const me = (await wireOf(request, id)).thisPlayer.color;
    await openKind(page, 'milestones');
    await openItem(page, (n) => n.startsWith('Terraformer'), 'Terraformer');
    await reloadConsole(page);
    await settle(page);
    if (await page.locator('.con-mafocus').count() === 0) {
      if (await page.locator('.con-ma').count() === 0) {
        await openKind(page, 'milestones');
      }
      await openItem(page, (n) => n.startsWith('Terraformer'), 'Terraformer');
    }
    const cell = page.locator('.con-mafocus [data-ma-exchange] .con-mafocus__xcell--price');
    await expect(cell, 'the same reading after the reload').toHaveAttribute('data-ma-price-kind', 'waived');
    await expect(cell.locator('[data-ma-price-printed]')).toHaveAttribute('data-ma-price-printed', '8');
    await press(page, 'Enter', 200);
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    await expect(page.locator('.con-ma')).toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await reloadConsole(page);
    await settle(page);
    expect(await page.locator('.con-mafocus__cere, .con-macere').count(), 'no ceremony replayed after the reload').toBe(0);
    const stat = await effectStat(request, id, me);
    expect(stat?.triggerCount, 'the firing is counted once').toBe(1);
  });

  test('S · a one-seat table: the effect that never fires here (frames for the named gap — no product change)', async ({page, request}) => {
    test.setTimeout(300_000);
    const config = soloGameConfig({testMode: false, customCorporationsList: [NIRGAL], startingCorporations: 1});
    const id = await bootIntoGame(page, request, {config, corporation: NIRGAL, query: TV.query});
    await settle(page);
    const wire = await wireOf(request, id);
    expect(wire.players.find((p) => p.color === wire.thisPlayer.color)?.tableau?.some((c) => c.name === NIRGAL)).toBe(true);
    await shoot(page, 's-solo-board');
    await press(page, 'KeyQ', 1400);
    await shoot(page, 's-solo-ma');
    await press(page, 'Escape', 900);
    await settle(page);

    // THE FACE (GN): the effect printed in ICONS — the award mark / the milestone mark, slashed, «: 0 M€». The table's
    // slot is the small scale, the fullscreen inspect the large one — both kept as acceptance frames.
    // «РАЗЫГРАНО» (X — the board home's own verb on this table).
    await pressUntilVisible(page, 'KeyX', '.con-played', {tries: 3, settleMs: 1200});
    await settle(page);
    const face = page.locator('.con-played .pcard').filter({hasText: /nirgal/i}).first();
    await expect(face, 'the corporation stands on the played table').toBeVisible({timeout: 15_000});
    await face.screenshot({path: path.join(OUT, 'face-small.png')});
    await press(page, 'Enter', 1600);
    const zoomed = page.locator('.con-zoom .card-zoom-stage .pcard');
    if (await zoomed.count() > 0 && /nirgal/i.test(await zoomed.innerText())) {
      await zoomed.screenshot({path: path.join(OUT, 'face-large.png')});
    }
  });
});

for (const profile of [TV, DECK]) {
  test.describe(`PC01 Nirgal Enterprises · G · six awards under a waived price · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});

    test(`G · two columns, no scroll, the ladder whole · ${profile.id}`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'nirgal-ma-venus', {query: profile.query});
      await settle(page);
      await openKind(page, 'awards');
      await expect(page.locator('.con-ma__card'), 'six awards on the Venus table').toHaveCount(6);
      await expect(page.locator('[data-ma-price="awards"]')).toHaveAttribute('data-ma-price-kind', 'waived');
      const fit = await page.locator('.con-ma__scroll-host').evaluate((host) => {
        const el = host as HTMLElement;
        const cards = [...el.querySelectorAll('.con-ma__card')].map((c) => c.getBoundingClientRect());
        const lefts = new Set(cards.map((r) => Math.round(r.left)));
        const widths = new Set(cards.map((r) => Math.round(r.width)));
        return {columns: lefts.size, widths: widths.size, scrolls: el.scrollHeight > el.clientHeight + 1};
      });
      expect(fit, 'two columns of one width, nothing to scroll').toEqual({columns: 2, widths: 1, scrolls: false});
      const chipFits = await page.locator('[data-ma-price="awards"]').evaluate((c) => (c as HTMLElement).scrollWidth <= (c as HTMLElement).clientWidth + 1);
      expect(chipFits, 'the waived chip is whole').toBe(true);
      const first = (await page.locator('.con-ma__card').first().getAttribute('data-ma-row')) ?? '';
      await openItem(page, (n) => n === first, first);
      const steps = await ladderOf(page);
      expect(steps.every((s) => s.fits), `no step wrapped or cut — ${JSON.stringify(steps)}`).toBe(true);
      const whole = await ladderWhole(page);
      expect(whole.whole, `the ladder stands whole — ${whole.detail}`).toBe(true);
      await shoot(page, `g-${profile.id}`);
    });
  });
}
