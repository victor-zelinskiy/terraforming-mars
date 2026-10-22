/*
 * TR55 NUCLEAR WARHEAD UTILIZATION («Утилизация ядерных боеголовок») + THE ITERATION «ЯЧЕЙКА ПО — КАЖДОЕ ОЧКО ИЗ
 * СВОЕЙ ПРИЧИНЫ» (`docs/claude/console/score-cell.md`) — the ONE spec of the iteration, four fixtures, fhd + tv4k:
 *
 *   A · `nuclear-warhead-utilization` — the PLAY: «+9 energy» lands on the rail, then the card's printed «2 VP» leave
 *       its badge (`vp-badge`) for the score cell (`rail:vp`); the VP cell reads N on EVERY sample before that token's
 *       contact beat and N + 2 after it; the energy row ticks before the VP token is born (the owner's decision 4: what
 *       the card gave, then what it is). The server: +9 energy, +2 VP.
 *   B · `nuclear-warhead-locked` — the Reds rule: the hand names the Industrialists' plate and the card cannot be played.
 *   C · `vp-cell-sources` — (1) Security Fleet's action: the score cell ticks with the fighter's touchdown, never with
 *       the view (К-V2); (2) Terraformer: the milestone's +5 is born on the ceremony's «+5», the cell never ahead of it.
 *   D · `vp-cell-rival` — red's greenery beside blue's city (red answers over the API): blue's score cell holds until the
 *       greenery has LANDED on blue's screen, the token is born on that cell (`cell:<id>`), lands on `rail:vp`.
 *
 * The probe samples the cells on the PAGE's clock (`setInterval` + `MutationObserver`, never rAF) and reads the VP
 * token's contact beat (`.con-transfer__beat--vp` painted) as its touchdown. The flight ends are WITNESSED
 * (`transferWitness.ts` — `endsOverGlass` empty). 4K timing claims: `TM_E2E_GPU=1`, `--workers=1`.
 */
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, cinematicBeat, fetchPlayerModel, focusCard, openActionFocus, openCardActions, playCardFromHand, press, pressUntil,
  sendPlayerInput, settle,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {storyboard} from './consoleEndgameHarness';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const TR55 = 'Nuclear Warhead Utilization';
const OUT = path.resolve('screenshots', 'tr55');

/** The VP token's text in the witness: the shield's own label («ПО») and its signed amount. */
const vpTokenValue = (signed: string) => (v: string) => v.replace(/\s+/g, '').endsWith(signed) && /ПО|VP/.test(v);

type Wire = {
  thisPlayer: {energy: number, victoryPointsBreakdown: {total: number}, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
  game: {spaces: Array<{id: string, tileType?: number, color?: string}>, milestones: Array<{name: string, color?: string}>},
};

async function serverModel(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** Poll the SERVER until `ok` holds — never a fixed sleep. */
async function untilServer(request: APIRequestContext, playerId: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 160; i++) {
    last = await serverModel(request, playerId);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached «${what}» — VP ${last?.thisPlayer.victoryPointsBreakdown.total}, energy ${last?.thisPlayer.energy}`);
}

type ScoreProbe = {
  samples: number,
  vp: Array<[number, string]>,
  energy: Array<[number, string]>,
  /** The VP token's first painted sample, and its contact beat's (the touchdown). */
  vpChipAt?: number,
  vpBeatAt?: number,
  reasons: Array<string>,
};

/** The score probe — the VP cell, the energy row, the VP token's birth and its contact beat, the named causes. */
async function armScoreProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__vpc?: ScoreProbe & {stop: () => void}};
    w.__vpc?.stop();
    const t0 = performance.now();
    const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? '';
    const painted = (el: Element | null) => el !== null && Number(getComputedStyle(el).opacity) > 0.05 && getComputedStyle(el).visibility !== 'hidden';
    const probe = {samples: 0, vp: [] as Array<[number, string]>, energy: [] as Array<[number, string]>, reasons: [] as Array<string>,
      vpChipAt: undefined as number | undefined, vpBeatAt: undefined as number | undefined, stop: () => {}};
    let lastVp = '';
    let lastEnergy = '';
    const sample = () => {
      const t = Math.round(performance.now() - t0);
      probe.samples++;
      const vp = text('.con-res .con-score__cell--vp .con-score__value');
      if (vp !== lastVp) {
        probe.vp.push([t, vp]);
        lastVp = vp;
      }
      // The digits' own number (its ±N delta chip lives inside the same box).
      const energy = (text('.con-res .con-res__row--energy .con-res__digits').match(/^-?\d+/) ?? [''])[0];
      if (energy !== lastEnergy) {
        probe.energy.push([t, energy]);
        lastEnergy = energy;
      }
      if (probe.vpChipAt === undefined && painted(document.querySelector('.con-transfer__chip--vp'))) {
        probe.vpChipAt = t;
      }
      if (probe.vpBeatAt === undefined && painted(document.querySelector('.con-transfer__beat--vp'))) {
        probe.vpBeatAt = t;
      }
      const reason = text('[data-vp-reason]');
      if (reason !== '' && !probe.reasons.includes(reason)) {
        probe.reasons.push(reason);
      }
    };
    const timer = window.setInterval(sample, 16);
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {subtree: true, childList: true, characterData: true});
    probe.stop = () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
    sample();
    (window as unknown as {__vpc: typeof probe}).__vpc = probe;
  });
}

async function readScoreProbe(page: Page): Promise<ScoreProbe> {
  return page.evaluate(() => {
    const p = (window as unknown as {__vpc: ScoreProbe}).__vpc;
    return {samples: p.samples, vp: p.vp, energy: p.energy, vpChipAt: p.vpChipAt, vpBeatAt: p.vpBeatAt, reasons: p.reasons};
  });
}

/**
 * THE LAW, read off the samples: the VP cell stood at its first value on EVERY sample before the token's contact beat,
 * and reached `to` no earlier than that beat — never in the frame the view applied.
 */
function expectVpOnItsToken(probe: ScoreProbe, to: number, label: string): void {
  expect(probe.samples, `${label}: the sampler ran`).toBeGreaterThan(10);
  expect(probe.vpBeatAt, `${label}: the VP token touched down (samples ${JSON.stringify(probe.vp)})`).toBeDefined();
  const first = Number(probe.vp[0]?.[1]);
  const reached = probe.vp.find(([, v]) => Number(v) === to);
  expect(reached, `${label}: the cell reached ${to}: ${JSON.stringify(probe.vp)}`).toBeDefined();
  const before = probe.vp.filter(([t]) => t < probe.vpBeatAt!);
  expect(before.every(([, v]) => Number(v) === first), `${label}: the cell read ${first} on every sample before the touchdown at ${probe.vpBeatAt} — ${JSON.stringify(probe.vp)}`).toBe(true);
  expect(reached![0], `${label}: the cell ticks on the touchdown (${probe.vpBeatAt}), never before`).toBeGreaterThanOrEqual(probe.vpBeatAt!);
}

for (const preset of PROFILES) {
  test.describe(`TR55 · the score cell · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the play: +9 energy on the rail, then the printed 2 VP from the card's badge into the score cell (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'nuclear-warhead-utilization', {query: preset.query});
      const before = await serverModel(request, playerId);
      await armScoreProbe(page);
      await armTransferWitness(page);
      const stop = await storyboard(page, path.join(OUT, preset.id), 'play');
      expect(await playCardFromHand(page, TR55), 'TR55 was played from the hand').toBe(true);
      const after = await untilServer(request, playerId, (m) => m.thisPlayer.tableau.some((c) => c.name === TR55), 'TR55 on the table');
      expect(after.thisPlayer.energy - before.thisPlayer.energy, 'the server: +9 energy').toBe(9);
      expect(after.thisPlayer.victoryPointsBreakdown.total - before.thisPlayer.victoryPointsBreakdown.total, 'the server: +2 VP').toBe(2);
      await expect.poll(async () => (await readScoreProbe(page)).vp.at(-1)?.[1], {timeout: 30_000, message: 'the VP cell never reached the server\'s score'})
        .toBe(String(after.thisPlayer.victoryPointsBreakdown.total));
      await settle(page, {timeoutMs: 30_000});
      await stop();
      await page.screenshot({path: path.join(OUT, preset.id, 'A-after.png')});
      const probe = await readScoreProbe(page);
      expectVpOnItsToken(probe, after.thisPlayer.victoryPointsBreakdown.total, 'A');
      const energyTick = probe.energy.find(([, v], i) => i > 0 && Number(v) === after.thisPlayer.energy);
      expect(energyTick, `A: the energy row ticked to ${after.thisPlayer.energy}: ${JSON.stringify(probe.energy)}`).toBeDefined();
      expect(probe.vpChipAt, 'A: the VP token was born').toBeDefined();
      // Both ends of the VP token: born on the landed card's printed badge, landed on the score cell's ink.
      const witness = await transferWitness(page);
      const vpBirth = witness.births.find((b) => vpTokenValue('+2')(b.value));
      // What the card GAVE comes first, what it IS follows as the NEXT token of the same wave (decision 4).
      const energyBirth = witness.births.find((b) => b.value.replace(/\s+/g, '') === '+9');
      expect(energyBirth, `A: the +9 energy token was born — ${transferTrail(witness)}`).toBeDefined();
      expect(vpBirth?.t ?? -1, `A: the VP token is born after the energy token — ${transferTrail(witness)}`).toBeGreaterThan(energyBirth!.t);
      expect(vpBirth?.under, `A: the VP token is born on the card's printed badge — ${transferTrail(witness)}`).toBe('vp-badge');
      const vpLanding = witness.landings.find((l) => l.id === vpBirth!.id);
      expect(vpLanding?.under, `A: the VP token lands on the score cell — ${transferTrail(witness)}`).toBe('rail:vp');
      expect(endsOverGlass(witness), 'A: no end over glass').toEqual([]);
      expect(probe.reasons, 'A: a share with a body is never a named cause').toEqual([]);
    });

    /*
     * THE A/B OF THE PLAY'S LENGTH (opt-in: `TM_E2E_AB=1`, a quiet machine, `--workers=1`, `--repeat-each=4`): the same
     * scene with the VP token (A) and with the private score ON — the ledger then seeds nothing and no token flies (B).
     * Measured on the PAGE's clock from the play's POST to the workspace gone; each run appends a line to
     * `screenshots/tr55/<profile>/ab.txt` — the medians are the report's, the law is «+0.25 s at most».
     */
    for (const masked of [false, true]) {
      test(`A/B · the play's length ${masked ? 'B (no token: private score)' : 'A (the VP token)'} (${preset.id})`, async ({page, request}) => {
        test.skip(process.env.TM_E2E_AB !== '1', 'the timing A/B is opt-in — a quiet machine, --workers=1');
        test.setTimeout(240_000);
        if (masked) {
          await page.addInitScript(() => {
            const get = Storage.prototype.getItem;
            Storage.prototype.getItem = function(key: string) {
              return key.startsWith('tm.privateScoreDisplay.') ? '1' : get.call(this, key);
            };
          });
        }
        await bootFixtureSeats(page, request, 'nuclear-warhead-utilization', {query: preset.query});
        // The workspace's presence on the page's clock (its every edge), the play's POST from the resource timing.
        await page.evaluate(() => {
          const w = window as unknown as {__ab: {edges: Array<[number, boolean]>}};
          w.__ab = {edges: []};
          let last: boolean | undefined;
          window.setInterval(() => {
            const open = document.querySelector('.con-ws') !== null;
            if (open !== last) {
              w.__ab.edges.push([performance.now(), open]);
              last = open;
            }
          }, 8);
        });
        expect(await playCardFromHand(page, TR55)).toBe(true);
        const measure = () => page.evaluate(() => {
          const post = performance.getEntriesByType('resource').find((e) => e.name.includes('/player/input'))?.startTime;
          const edges = (window as unknown as {__ab: {edges: Array<[number, boolean]>}}).__ab.edges;
          const gone = post === undefined ? undefined : edges.find(([t, open]) => t > post && !open)?.[0];
          return {post, gone};
        });
        await expect.poll(async () => (await measure()).gone, {timeout: 40_000}).toBeDefined();
        const ab = await measure();
        const ms = Math.round(ab.gone! - ab.post!);
        const fs = await import('fs');
        fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
        fs.appendFileSync(path.join(OUT, preset.id, 'ab.txt'), `${masked ? 'B' : 'A'} ${ms}\n`);
        console.log(`[A/B ${preset.id}] ${masked ? 'B' : 'A'} ${ms} ms`);
      });
    }

    test(`B · the Reds rule: the hand names the Industrialists' plate, the card cannot be played (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'nuclear-warhead-locked', {query: preset.query});
      await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
      await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
      expect(await focusCard(page, TR55, 12), 'TR55 focused in the hand').toBe(true);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
      // The TR15 class: the party is named by its EMBLEM beside the count of the player's delegates on its resolution.
      await expect(verdict, 'the count of your delegates on the party').toContainText('0/2');
      await page.screenshot({path: path.join(OUT, preset.id, 'B-locked.png')});
    });

    test(`C · the score cell's other sources: an action's fighter, a milestone's ceremony (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'vp-cell-sources', {query: preset.query});
      // (1) SECURITY FLEET — the fighter lands in the hero's capsule and brings its point WITH it.
      const v0 = (await serverModel(request, playerId)).thisPlayer.victoryPointsBreakdown.total;
      await armScoreProbe(page);
      await openCardActions(page);
      await openActionFocus(page);
      const stopFleet = await storyboard(page, path.join(OUT, preset.id), 'fleet');
      await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() === 0, {tries: 4, settleMs: 2500});
      const fleet = await untilServer(request, playerId, (m) => (m.thisPlayer.tableau.find((c) => c.name === 'Security Fleet')?.resources ?? 0) === 1, 'a fighter on Security Fleet');
      expect(fleet.thisPlayer.victoryPointsBreakdown.total - v0, 'the server: the fighter is 1 VP').toBe(1);
      await expect.poll(async () => (await readScoreProbe(page)).vp.at(-1)?.[1], {timeout: 30_000}).toBe(String(v0 + 1));
      await settle(page, {timeoutMs: 30_000});
      await stopFleet();
      const fleetProbe = await readScoreProbe(page);
      expect(fleetProbe.reasons, 'C1: the fighter IS the cause — nothing named').toEqual([]);
      expect(fleetProbe.vp.length, `C1: one step, ${JSON.stringify(fleetProbe.vp)}`).toBe(2);

      // (2) TERRAFORMER — the +5 leaves the ceremony's «+5» for the score cell.
      await armScoreProbe(page);
      await armTransferWitness(page);
      await pressUntil(page, 'KeyQ', async () => await page.locator('.con-ma').count() > 0, {tries: 4, settleMs: 1400});
      await pressUntil(page, 'Enter', async () => await page.locator('.con-mafocus').count() > 0, {tries: 4, settleMs: 1300});
      const stopMa = await storyboard(page, path.join(OUT, preset.id), 'milestone');
      await press(page, 'Enter', 400);
      const ma = await untilServer(request, playerId, (m) => m.game.milestones.some((x) => x.name.startsWith('Terraformer') && x.color !== undefined), 'Terraformer claimed');
      await expect.poll(async () => (await readScoreProbe(page)).vp.at(-1)?.[1], {timeout: 40_000})
        .toBe(String(ma.thisPlayer.victoryPointsBreakdown.total));
      await settle(page, {timeoutMs: 30_000});
      await stopMa();
      const maProbe = await readScoreProbe(page);
      expectVpOnItsToken(maProbe, ma.thisPlayer.victoryPointsBreakdown.total, 'C2');
      const witness = await transferWitness(page);
      const born = witness.births.find((b) => vpTokenValue('+5')(b.value));
      expect(born?.under, `C2: the +5 token is born on the ceremony's «+5» — ${transferTrail(witness)}`).toBe('ma-vp');
      expect(witness.landings.find((l) => l.id === born!.id)?.under, `C2: it lands on the score cell — ${transferTrail(witness)}`).toBe('rail:vp');
    });

    test(`E · red funds an award blue leads: no body on blue's screen — the cell ticks with its cause NAMED (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'vp-cell-rival', {query: preset.query});
      const red = seats[1];
      const v0 = (await serverModel(request, playerId)).thisPlayer.victoryPointsBreakdown.total;
      type Opt = {type: string, title?: string | {message?: string}, options?: Array<Opt>};
      const titleOf = (o: Opt) => (typeof o.title === 'string' ? o.title : o.title?.message ?? '');
      const menu = (await fetchPlayerModel(request, red) as unknown as {waitingFor?: Opt}).waitingFor?.options ?? [];
      const fund = menu.findIndex((o) => (o.options ?? []).some((n) => titleOf(n) === 'Landlord'));
      expect(fund, 'red\'s menu offers the award funding with Landlord').toBeGreaterThanOrEqual(0);
      const landlord = menu[fund].options!.findIndex((n) => titleOf(n) === 'Landlord');
      await armScoreProbe(page);
      await armTransferWitness(page);
      await sendPlayerInput(request, red, {type: 'or', index: fund, response: {type: 'or', index: landlord, response: {type: 'option'}}});
      const after = await untilServer(request, playerId, (m) => m.thisPlayer.victoryPointsBreakdown.total !== v0, 'blue\'s score moved');
      expect(after.thisPlayer.victoryPointsBreakdown.total - v0, 'the server: blue leads Landlord, +5').toBe(5);
      await expect.poll(async () => (await readScoreProbe(page)).reasons.length, {timeout: 30_000, message: 'the cell never named its cause'}).toBeGreaterThan(0);
      await cinematicBeat(page, 400, 'the ticket\'s fade-in settles before the frame is taken');
      await page.screenshot({path: path.join(OUT, preset.id, 'E-named-cause.png')});
      // The cause is read WHOLE: the ticket's label is never cut by an ellipsis.
      const cut = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-score__reason-label'))
        .some((el) => el.scrollWidth > el.clientWidth + 1));
      expect(cut, 'E: the cause is never cut').toBe(false);
      const probe = await readScoreProbe(page);
      expect(probe.reasons.join(' | '), 'the ticket names the award and its place').toMatch(/\+5.*Награда «Собственник»: место 1/);
      expect(probe.vpChipAt, 'no body on this screen — no token flies').toBeUndefined();
      expect(probe.vp.at(-1)?.[1]).toBe(String(v0 + 5));
    });

    test(`D · red's greenery beside blue's city: blue's score waits for the tile and its token is born on it (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'vp-cell-rival', {query: preset.query});
      const red = seats[1];
      const model = await serverModel(request, playerId);
      const blueCity = model.game.spaces.find((s) => s.tileType === 2 && s.color !== undefined);
      expect(blueCity, 'blue\'s city on the board').toBeDefined();
      const redModel = await fetchPlayerModel(request, red) as unknown as {waitingFor?: {type: string, options?: Array<{type: string, spaces?: Array<string>}>}};
      const index = (redModel.waitingFor?.options ?? []).findIndex((o) => o.type === 'space');
      expect(index, 'red\'s menu offers the plants conversion').toBeGreaterThanOrEqual(0);
      const cells = redModel.waitingFor!.options![index].spaces ?? [];
      const adjacent = await page.evaluate((city) => {
        // The board's own geometry decides «beside»: the nearest legal cell to blue's city by centre distance.
        const at = (id: string) => document.querySelector(`.board-space[data_space_id="${id}"]`)?.getBoundingClientRect();
        const c = at(city);
        return c === undefined ? undefined : {cx: c.x + c.width / 2, cy: c.y + c.height / 2, w: c.width};
      }, blueCity!.id);
      expect(adjacent, 'blue\'s city is drawn').toBeDefined();
      const greenery = await page.evaluate(({ids, c}) => {
        let best: {id: string, d: number} | undefined;
        for (const id of ids) {
          const r = document.querySelector(`.board-space[data_space_id="${id}"]`)?.getBoundingClientRect();
          if (r === undefined) {
            continue;
          }
          const d = Math.hypot(r.x + r.width / 2 - c.cx, r.y + r.height / 2 - c.cy);
          if (best === undefined || d < best.d) {
            best = {id, d};
          }
        }
        return best?.id;
      }, {ids: cells, c: adjacent!});
      expect(greenery, 'a legal greenery cell beside blue\'s city').toBeDefined();
      const v0 = model.thisPlayer.victoryPointsBreakdown.total;
      await armScoreProbe(page);
      await armTransferWitness(page);
      const stop = await storyboard(page, path.join(OUT, preset.id), 'rival');
      await sendPlayerInput(request, red, {type: 'or', index, response: {type: 'space', spaceId: greenery!}});
      const after = await untilServer(request, playerId, (m) => m.thisPlayer.victoryPointsBreakdown.total !== v0, 'blue\'s score moved');
      expect(after.thisPlayer.victoryPointsBreakdown.total - v0, 'the server: the city\'s adjacency +1').toBe(1);
      await expect.poll(async () => (await readScoreProbe(page)).vp.at(-1)?.[1], {timeout: 40_000}).toBe(String(v0 + 1));
      await settle(page, {timeoutMs: 30_000});
      await stop();
      const probe = await readScoreProbe(page);
      expectVpOnItsToken(probe, v0 + 1, 'D');
      const witness = await transferWitness(page);
      const born = witness.births.find((b) => vpTokenValue('+1')(b.value));
      expect(born?.under, `D: the token is born on red's greenery — ${transferTrail(witness)}`).toBe(`cell:${greenery}`);
      expect(witness.landings.find((l) => l.id === born!.id)?.under, `D: it lands on the score cell — ${transferTrail(witness)}`).toBe('rail:vp');
    });
  });
}
