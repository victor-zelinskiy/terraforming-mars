/*
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the card-reaction framework beyond its first owner
 * (`docs/claude/console/card-reaction.md`; the `card-reaction-many` fixture: blue on Hartlan Heating + Tharsis Republic,
 * with Rover Construction, Immigrant City and Pets on the table, Noctis City in hand, 60 M€):
 *
 *  MANY · ONE PLAY WAKES FIVE REACTORS (Noctis City — a green card placing a city on the reserved area, no cell to
 *         choose): Hartlan's answer rides the play's own rail half (attached — the corporation out of its place),
 *         Tharsis' +3 M€ / +1 M€ production, Rover's +2 M€, Immigrant City's +1 M€ production and Pets' animal are the
 *         STANDALONE chain — groups in the server's order on TWO seats beside the rail at the quickened pace, each
 *         reactor's tokens born on ITS effect row, under the wall-clock ceiling; not one delta lost (the server's
 *         numbers before / after), the play's own scene not slowed past its own tempo;
 *  BOARD · A STANDARD PROJECT CITY (nobody's card on stage) wakes the same table: Tharsis Republic SURFACES at a seat
 *          beside the rail, its +3 M€ born on its printed M€, the chain as above.
 * TIMING class (`timingSpecs.ts`): run `--exclusive --workers=1` on the box.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, commitFocusedSpace, fetchPlayerModel, focusCard, placeTile, press, pressUntil, settle, waitForBoardHome,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 'hartlan');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const HARTLAN = 'Hartlan Heating';
const THARSIS = 'Tharsis Republic';
const ROVER = 'Rover Construction';
const IMMIGRANT = 'Immigrant City';
const PETS = 'Pets';
const NOCTIS = 'Noctis City';
/** The owner's decision 4: the chain's wall-clock ceiling. */
const CHAIN_CEILING_MS = 1800;

type Wire = {
  thisPlayer: {color: string, megacredits: number, megacreditProduction: number, heat: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const animalsOn = (w: Wire, card: string): number => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, PRESET.id, `${name}.png`)});
}

function writeTrail(scene: string, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/card-reaction-${scene}-${PRESET.id}.txt`, trail);
}

type Sample = {t: number, phase: string, groups: string, seats: string, landed: string, summarized: string, seated: string, emerged: string, hero: string};

/** The reaction layer's state + the hero's phase, sampled on a task clock (never rAF): the chain's wall-clock and its seats. */
async function armReactionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__reaction: Array<Sample>};
    type Sample = {t: number, phase: string, groups: string, seats: string, landed: string, summarized: string, seated: string, emerged: string, hero: string};
    w.__reaction = [];
    let last = '';
    window.setInterval(() => {
      const root = document.querySelector('.con-reaction');
      const read = (a: string) => root?.getAttribute(a) ?? '';
      const sample: Sample = {
        t: performance.now(),
        phase: read('data-reaction-phase') || 'none',
        groups: read('data-reaction-groups'),
        seats: read('data-reaction-seats'),
        landed: read('data-reaction-landed'),
        summarized: read('data-reaction-summarized'),
        seated: Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card]')).map((e) => e.getAttribute('data-reaction-card')).join('|'),
        emerged: Array.from(document.querySelectorAll('.con-recv__emerge[data-played-key]')).map((e) => e.getAttribute('data-played-key')).join('|'),
        hero: document.querySelector('.con-played-hero')?.getAttribute('data-hero-phase') ?? 'none',
      };
      const key = JSON.stringify({...sample, t: 0});
      if (key !== last) {
        last = key;
        w.__reaction.push(sample);
      }
    }, 16);
  });
}

async function reactionProbe(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => (window as unknown as {__reaction?: Array<Sample>}).__reaction ?? []);
}

/** The chain's wall-clock: from the first `rising` sample of the standalone chain to its first `idle` after it. */
function chainWallMs(samples: ReadonlyArray<Sample>): number | undefined {
  const first = samples.findIndex((s) => s.phase === 'rising' || s.phase === 'paying');
  if (first < 0) {
    return undefined;
  }
  const idle = samples.slice(first).find((s) => s.phase === 'idle' || s.phase === 'none');
  return idle === undefined ? undefined : idle.t - samples[first].t;
}

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1400);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).first().waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/**
 * The wheel's centre (LT → «СТАНДАРТНЫЕ ПРОЕКТЫ»), then the cursor steered GEOMETRICALLY onto the named project's card
 * (the tile-language spec's road), then A — the board opens on the project's cell.
 */
async function openStandardProject(page: Page, card: string): Promise<void> {
  await press(page, 'Comma', 900);
  await expect(page.locator('.con-quick'), 'the wheel is open').toBeVisible({timeout: 15_000});
  await press(page, 'Enter', 1200);
  await expect(page.locator('.con-stdp'), 'the standard projects stand').toBeVisible({timeout: 15_000});
  let hit = false;
  for (let i = 0; i < 16 && !hit; i++) {
    const step = await page.evaluate((c) => {
      const at = document.querySelector('.con-stdp__card--focused');
      const target = document.querySelector(`.con-stdp__card[data-stdp-card="${c}"]`);
      if (at === null || target === null) {
        return 'none';
      }
      if (at === target) {
        return 'hit';
      }
      const a = at.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      return Math.abs(dy) > a.height / 2 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    }, card);
    expect(step, `the ${card} card stands on the screen`).not.toBe('none');
    hit = step === 'hit';
    if (!hit) {
      await press(page, step, 280);
    }
  }
  expect(hit, `the cursor reached ${card}`).toBe(true);
  await press(page, 'Enter', 900);
}

test.describe(`console · card reaction — one framework · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('MANY · one play wakes five reactors — the attached one out of its place, the chain on two seats under the ceiling, no delta lost', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (/card-reaction|rail-reward|transfer/.test(m.text())) {
        console.log(`[page ${m.type()}] ${m.text()}`);
      }
    });
    const playerId = await bootFixture(page, request, 'card-reaction-many', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.tableau.map((c) => c.name), 'the table: Hartlan + Tharsis + Rover + Immigrant City + Pets').toEqual(
      expect.arrayContaining([HARTLAN, THARSIS, ROVER, IMMIGRANT, PETS]));

    await openPlayComposer(page, NOCTIS);
    await expect(page.locator('.con-composer--play [data-forecast-row]'), 'the «Сработает» row stands').toHaveCount(1);
    await shoot(page, 'MANY-01-composer');
    await armTransferWitness(page);
    await armReactionProbe(page);
    // A → the STAGED placement on the board (Noctis City's reserved area is its only legal cell — the cell confirm is
    // the one post), then the commit. A play that posts outright (no staged step) is accepted too: the card left the hand.
    const played = async (): Promise<boolean> => ((await wireOf(request, playerId)).cardsInHand ?? []).every((c) => c.name !== NOCTIS);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0 || await played(), {tries: 3, settleMs: 1500}),
      'A opens the staged placement (or plays the card outright)').toBeTruthy();
    if (await page.locator('.con-board--placing').count() > 0) {
      expect(await placeTile(page), 'the city was placed on the reserved area').toBe(true);
    }
    await page.locator(`.con-recv__emerge[data-played-key="${HARTLAN}"], .con-reaction__face[data-reaction-card]`).first()
      .waitFor({state: 'visible', timeout: 60_000});
    await shoot(page, 'MANY-02-reactors-rise');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('many', transferTrail(witness));
    const samples = await reactionProbe(page);
    console.log(`[${PRESET.id} MANY probe] ${JSON.stringify(samples)}`);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    // Every risen reactor's tokens were born on ITS OWN face — never on the played card. Four rail groups fire in the
    // server's order (the three the city woke at the placement, then Hartlan's DEFERRED gain): the fourth's rise would
    // start past the 1.8 s ceiling, so by the owner's decision 4 it is SUMMARIZED — its counters tick, its name stands.
    for (const reactor of [THARSIS, ROVER, IMMIGRANT]) {
      expect(witness.births.some((b) => b.under.startsWith(`reactor:${reactor}:`)), `${reactor}'s answer was born on its effect row\n${transferTrail(witness)}`).toBe(true);
    }
    const seated = new Set(samples.flatMap((s) => s.seated.split('|').filter((x) => x !== '')));
    expect([...seated], 'the standalone reactors surfaced at seats beside the rail').toEqual(expect.arrayContaining([THARSIS, ROVER, IMMIGRANT]));
    expect(samples.some((s) => s.seats === '2'), 'MANY groups: two seats').toBe(true);
    const summarized = new Set(samples.flatMap((s) => s.summarized.split('|').filter((x) => x !== '')));
    expect([...summarized], 'the fourth group (the last in the server\'s order) is summarized by name — nothing else').toEqual([HARTLAN]);
    expect(witness.births.some((b) => b.under.startsWith(`reactor:${HARTLAN}:`)), 'a summarized group births nothing — it ticked').toBe(false);
    const wall = chainWallMs(samples);
    console.log(`[${PRESET.id} MANY] chain wall ${wall} ms`);
    expect(wall, 'the chain played').not.toBeUndefined();
    // The ceiling bounds the last RISE; that group's own rise, flight, contact beat and recede follow it.
    expect(wall ?? Infinity, `the chain's wall-clock: every rise under the ceiling, plus the last group's own flight`).toBeLessThan(CHAIN_CEILING_MS + 2200);
    // The server's numbers — not one delta lost: Hartlan +6 heat / +1 prod; Tharsis +3 M€ / +1 prod; Rover +2 M€; Immigrant +1 prod; Noctis +3 prod; Pets +1 animal.
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.heat).toBe(before.thisPlayer.heat + 6);
    expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits - 18 + 3 + 2);
    expect(after.thisPlayer.megacreditProduction).toBe(before.thisPlayer.megacreditProduction + 1 + 1 + 1 + 3);
    expect(animalsOn(after, PETS)).toBe(animalsOn(before, PETS) + 1);
    await shoot(page, 'MANY-03-board');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('BOARD · a standard-project city wakes Tharsis Republic — the corporation surfaces beside the rail, its 3 M€ born on its printed M€', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootFixture(page, request, 'card-reaction-many', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    await armTransferWitness(page);
    await armReactionProbe(page);
    await openStandardProject(page, 'City');
    await expect(page.locator('.con-board--placing'), 'the city placement opened').toBeVisible({timeout: 20_000});
    expect(await commitFocusedSpace(page, 0), 'the city committed').toBe(true);
    await page.locator(`.con-reaction__face[data-reaction-card="${THARSIS}"]`).waitFor({state: 'visible', timeout: 60_000});
    await shoot(page, 'BOARD-01-tharsis-rises');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('board', transferTrail(witness));
    const samples = await reactionProbe(page);
    console.log(`[${PRESET.id} BOARD probe] ${JSON.stringify(samples)}`);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const tharsis = witness.births.filter((b) => b.under.startsWith(`reactor:${THARSIS}:`));
    expect(tharsis.length, `Tharsis' answer was born on its printed M€ / production\n${transferTrail(witness)}`).toBeGreaterThan(0);
    expect(witness.landings.filter((l) => tharsis.some((b) => b.id === l.id)).every((l) => l.under.startsWith('rail:megacredits')),
      `…and landed on the M€ row / plate\n${transferTrail(witness)}`).toBe(true);
    expect(witness.births.some((b) => b.under.startsWith(`reactor:${ROVER}:`)), 'Rover Construction answered from its own row').toBe(true);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits, 'the city\'s price, Tharsis\' 3 and Rover\'s 2').toBe(before.thisPlayer.megacredits - 25 + 3 + 2);
    expect(after.thisPlayer.megacreditProduction, 'the city\'s own step + Tharsis + Immigrant City').toBe(before.thisPlayer.megacreditProduction + 3);
    expect(animalsOn(after, PETS)).toBe(animalsOn(before, PETS) + 1);
    await shoot(page, 'BOARD-02-board');
    expect(errors, 'no page errors').toEqual([]);
  });
});
