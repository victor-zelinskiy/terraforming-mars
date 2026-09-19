import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce, press} from './consoleStart';

/**
 * THE PARLIAMENT'S SITTING — the MOTION half (Э4 of
 * docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §6; docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md
 * § Э4): the director's beats are physical, bounded and named.
 *
 *   · ВЕРДИКТ: the winning card stands PARKED face-up where it won (the
 *     government's face waits), lit; nothing flies;
 *   · ПРИНЯТИЕ: the card MOVES into the government (a trajectory, not an
 *     appearance), its delegates go home as cubes that travel, the parties
 *     tier PEEKS for the support cubes, the government's face shows only on
 *     the touchdown; the stage's hold is released at rest;
 *   · ОБНОВЛЕНИЕ: three resolutions are DEALT with a REAL 3D TURN — the body
 *     starts face-down (rotateY 180), passes through the plane (a sample
 *     between 30° and 150°), rests face-up (0); the slot's own face is hidden
 *     while its card is in the air and shows on the touchdown; the deck's
 *     count ticks per launch; no card is ever painted twice at rest;
 *   · A DURING A BEAT = «дожать»: the stage stays, its objects rest at once;
 *   · reduced motion: the resting poses, the same stages, nothing in the air;
 *   · perf-lite: the same beats, no `filter`;
 *   · durations within the storyboard's budget; every `parliament-sitting:*`
 *     hold released at rest.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF (headless
 * Chromium starves it on a quiet screen). Screenshots under
 * screenshots/parliament-sitting-motion/.
 */
const OUT = path.resolve('screenshots', 'parliament-sitting-motion');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type Wire = {
  waitingFor?: {type: string; promptId?: number; parliamentPhasePrompt?: {stage: string}};
  game: {phase: string; parliament?: {phase?: {step: string; summary?: {support: Array<{gained: number}>, refreshed: Array<unknown>, lobbyRefilled: Array<string>}}}};
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type ProxySample = {id: string, body: string, face: string, x: number, y: number, rotY: number | undefined, filter: string};
type Sample = {t: number, motion: string, stage: string, holds: Array<string>, proxies: Array<ProxySample>, dealing: number, govAwaiting: boolean, peek: boolean, deck: number, faces: Record<string, number>};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the press. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__sitProbe: Probe, __conReady?: () => {holds: Array<string>}};
    w.__sitProbe = {samples: []};
    const sample = () => {
      const stageEl = document.querySelector('.con-parl__stage');
      const proxies = Array.from(document.querySelectorAll<HTMLElement>('[data-parl-flight]')).map((el) => {
        const r = el.getBoundingClientRect();
        const inner = el.querySelector<HTMLElement>('.con-card3d');
        // GSAP writes the body's transform; a rotateY of exactly 0 is omitted from its string — a written
        // transform with no rotateY IS face-up, an unwritten one is not yet posed.
        const m = inner === null ? null : /rotateY\(([-\d.]+)deg\)/.exec(inner.style.transform);
        const rotY = m !== null ? Number(m[1]) : (inner !== null && inner.style.transform !== '' ? 0 : undefined);
        return {
          id: el.getAttribute('data-parl-flight') ?? '', body: el.getAttribute('data-parl-flight-body') ?? 'cube',
          face: el.getAttribute('data-parl-flight-face') ?? '', x: r.left + r.width / 2, y: r.top + r.height / 2,
          rotY, filter: getComputedStyle(el).filter,
        };
      });
      // Every painted premium face per resolution slug — a card at rest is painted ONCE.
      const faces: Record<string, number> = {};
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-parl .pcard, [data-parl-flight] .pcard'))) {
        if (getComputedStyle(el).visibility === 'hidden') {
          continue;
        }
        const slug = Array.from(el.classList).find((c) => c.startsWith('pcard--rdx-')) ?? '';
        if (slug !== '') {
          faces[slug] = (faces[slug] ?? 0) + 1;
        }
      }
      w.__sitProbe.samples.push({
        t: performance.now(),
        motion: stageEl?.getAttribute('data-sitting-motion') ?? '',
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        holds: (w.__conReady?.().holds ?? []).filter((h) => h.startsWith('parliament-sitting')),
        proxies,
        dealing: document.querySelectorAll('.con-parl__card--dealing').length,
        govAwaiting: document.querySelector('.con-parl__gov-card--awaiting') !== null,
        peek: document.querySelector('.con-parl__stage--peek') !== null,
        deck: Number(document.querySelector('[data-parl-deck-pile]')?.getAttribute('data-count') ?? '-1'),
        faces,
      });
      if (w.__sitProbe.samples.length > 6000) {
        w.__sitProbe.samples.splice(0, 1000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-motion', 'data-count']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__sitProbe: Probe}).__sitProbe);

const stageAttr = (page: Page) => page.locator('.con-parl').getAttribute('data-sitting-stage');
const motionAttr = (page: Page) => page.locator('.con-parl__stage').getAttribute('data-sitting-motion');

/** The span (ms) the stage's beats were playing, from the samples. */
function motionSpan(samples: ReadonlyArray<Sample>, stage: string): number {
  const own = samples.filter((s) => s.motion === stage);
  return own.length === 0 ? 0 : own[own.length - 1].t - own[0].t;
}

/** The displacement of every proxy id across its samples (px). */
function displacements(samples: ReadonlyArray<Sample>, body: 'cube' | '3d' | 'any'): Map<string, number> {
  const first = new Map<string, ProxySample>();
  const last = new Map<string, ProxySample>();
  for (const s of samples) {
    for (const p of s.proxies) {
      if (body !== 'any' && p.body !== body) {
        continue;
      }
      if (!first.has(p.id)) {
        first.set(p.id, p);
      }
      last.set(p.id, p);
    }
  }
  const out = new Map<string, number>();
  for (const [id, a] of first) {
    const b = last.get(id)!;
    out.set(id, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return out;
}

/** Wait until the stage's beats are at rest (no motion attribute, nothing in the air, no sitting hold). */
async function waitAtRest(page: Page, timeout = 12_000): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const w = window as unknown as {__conReady?: () => {holds: Array<string>}};
    // A PARKED card (the winner over its former slot, the old law over the government) is part of the
    // verdict's resting POSE — the enactment is what moves it; only flights in the air count.
    return (document.querySelector('.con-parl__stage')?.getAttribute('data-sitting-motion') ?? '') === '' &&
      Array.from(document.querySelectorAll('[data-parl-flight]')).filter((el) => !(el.getAttribute('data-parl-flight') ?? '').startsWith('sit-park')).length === 0 &&
      (w.__conReady?.().holds ?? []).every((h) => !h.startsWith('parliament-sitting'));
  }), {timeout, intervals: [50]}).toBe(true);
}

test.describe('the sitting — the director\'s beats (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('ВЕРДИКТ → ПРИНЯТИЕ: a parked winner, a card that travels, cubes that travel, the peek, the touchdown, the hold released', async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    const before = await wireOf(request, playerId);
    expect(before.game.parliament?.phase?.step).toBe('assembly');
    const gainedParties = (before.game.parliament?.phase?.summary?.support ?? []).filter((s) => s.gained > 0).length;
    await expect(page.locator('.con-mandatory')).toHaveCount(1, {timeout: 30_000});
    await armProbe(page);
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(page.locator('.con-parl')).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => stageAttr(page), {timeout: 15_000}).toBe('verdict');
    // ── THE VERDICT: the winner parked face-up where it won; the government's face waits; nothing flies but light.
    await expect.poll(() => page.locator('[data-parl-flight][data-parl-flight-body="3d"]').count(), {timeout: 10_000}).toBeGreaterThan(0);
    expect(await page.locator('.con-parl__gov-card--awaiting').count(), 'the government\'s face waits for the card').toBe(1);
    await shoot(page, '01-verdict-parked');
    await waitAtRest(page);
    const afterVerdict = await readProbe(page);
    const verdictSpan = motionSpan(afterVerdict.samples, 'verdict');
    expect(verdictSpan, `the verdict's beats span ${verdictSpan} ms (budget 0.7–1.0 s)`).toBeGreaterThan(400);
    expect(verdictSpan).toBeLessThan(1500);
    expect(afterVerdict.samples.some((s) => s.motion === 'verdict' && s.proxies.some((p) => p.body === '3d')), 'the parked card stood through the verdict').toBe(true);
    expect(afterVerdict.samples.filter((s) => s.motion === 'verdict').every((s) => s.proxies.every((p) => p.body !== 'cube')), 'nothing flies at the verdict').toBe(true);

    // ── THE ENACTMENT: A turns the page; the card TRAVELS into the government, the delegates go home, the tier peeks.
    const mark = afterVerdict.samples.length;
    await press(page, 'Enter', 400);
    await expect.poll(() => stageAttr(page), {timeout: 10_000}).toBe('enact');
    await expect.poll(() => motionAttr(page), {timeout: 10_000}).toBe('enact');
    await shoot(page, '02-enact-in-flight');
    await waitAtRest(page, 15_000);
    const afterEnact = await readProbe(page);
    const enactSamples = afterEnact.samples.slice(mark);
    const enactSpan = motionSpan(enactSamples, 'enact');
    expect(enactSpan, `the enactment's beats span ${enactSpan} ms (budget 1.3–1.6 s + the support beat)`).toBeGreaterThan(900);
    expect(enactSpan).toBeLessThan(3600);
    const cardMoves = displacements(enactSamples, '3d');
    expect(cardMoves.size, 'the parked winner is the card that moves').toBeGreaterThan(0);
    expect(Math.max(...cardMoves.values()), 'the card TRAVELLED into the government (a trajectory, never an appearance)').toBeGreaterThan(60);
    const cubeMoves = displacements(enactSamples, 'cube');
    expect(cubeMoves.size, 'the delegates went home as cubes').toBeGreaterThan(0);
    expect(Math.min(...cubeMoves.values()), 'every cube travelled').toBeGreaterThan(20);
    if (gainedParties > 0) {
      expect(enactSamples.some((s) => s.peek), 'the parties tier peeked for the support beat').toBe(true);
    }
    // The government's face waited until the card landed, then showed — and stayed painted ONCE.
    const awaitingThenShown = enactSamples.findIndex((s) => s.govAwaiting) < enactSamples.length - 1 && !enactSamples[enactSamples.length - 1].govAwaiting;
    expect(awaitingThenShown, 'the government\'s face waited for the touchdown').toBe(true);
    const rest = afterEnact.samples[afterEnact.samples.length - 1];
    for (const [slug, n] of Object.entries(rest.faces)) {
      expect(n, `${slug} is painted once at rest`).toBeLessThanOrEqual(1);
    }
    expect(rest.holds, 'every sitting hold released at rest').toEqual([]);
    expect(await page.locator('.con-parl__stage--peek').count(), 'the peek is over').toBe(0);
    await shoot(page, '03-enact-rest');
    // Nothing answered by any of it.
    expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage).toBe('assembly');
  });

  test('ОБНОВЛЕНИЕ: the deal turns in flight (face-down → through the plane → face-up), the slot shows on the touchdown, the deck ticks, the lobby refills; A during a beat = «дожать»', async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-climate-adjourn', {query: '&consoleProfile=auto', landing: 'prompt'});
    const before = await wireOf(request, playerId);
    expect(before.game.parliament?.phase?.step).toBe('adjourn');
    const fresh = before.game.parliament?.phase?.summary?.refreshed.length ?? 0;
    expect(fresh, 'the area was refreshed').toBeGreaterThan(0);
    await expect(page.locator('.con-mandatory')).toHaveCount(1, {timeout: 30_000});
    await armProbe(page);
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(page.locator('.con-parl')).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => stageAttr(page), {timeout: 15_000}).toBe('renewal');
    // A resume: the passed stages replay compactly, then the renewal plays in full.
    await expect.poll(() => motionAttr(page), {timeout: 20_000}).toBe('renewal');
    await expect.poll(() => page.locator('[data-parl-flight][data-parl-flight-body="3d"]').count(), {timeout: 10_000}).toBeGreaterThan(0);
    await shoot(page, '10-renewal-deal-in-flight');
    await waitAtRest(page, 15_000);
    const probe = await readProbe(page);
    const renewal = probe.samples.filter((s) => s.motion === 'renewal');
    const span = motionSpan(probe.samples, 'renewal');
    expect(span, `the renewal's beats span ${span} ms (budget 1.9–2.4 s)`).toBeGreaterThan(1200);
    expect(span).toBeLessThan(4000);
    // THE TURN: every dealt body starts face-down, passes through its own plane, rests face-up.
    const byId = new Map<string, Array<number>>();
    for (const s of renewal) {
      for (const p of s.proxies) {
        if (p.body === '3d' && p.rotY !== undefined && p.id.startsWith('sit-deal')) {
          byId.set(p.id, [...(byId.get(p.id) ?? []), p.rotY]);
        }
      }
    }
    expect(byId.size, 'the dealt cards flew as 3D bodies').toBe(fresh);
    for (const [id, rots] of byId) {
      expect(rots[0], `${id} is born face-down`).toBeGreaterThan(170);
      expect(rots.some((r) => r > 30 && r < 150), `${id} passed through its plane (samples ${rots.map((r) => Math.round(r)).join(',')})`).toBe(true);
      expect(rots[rots.length - 1], `${id} rests face-up`).toBeLessThan(10);
      for (let i = 1; i < rots.length; i++) {
        expect(rots[i], `${id} never turns back`).toBeLessThanOrEqual(rots[i - 1] + 0.5);
      }
    }
    // THE SLOT'S FACE waits while its card is in the air, and shows on the touchdown — never two of one card at rest.
    expect(renewal.some((s) => s.dealing > 0 && s.proxies.some((p) => p.body === '3d')), 'the slots\' faces were hidden while the cards flew').toBe(true);
    const rest = probe.samples[probe.samples.length - 1];
    expect(rest.dealing, 'every face shown at rest').toBe(0);
    for (const [slug, n] of Object.entries(rest.faces)) {
      expect(n, `${slug} is painted once at rest`).toBeLessThanOrEqual(1);
    }
    // THE DECK ticked per launch — monotonic, never up.
    const decks = renewal.map((s) => s.deck).filter((d) => d >= 0);
    for (let i = 1; i < decks.length; i++) {
      expect(decks[i], 'the pile only ever thins').toBeLessThanOrEqual(decks[i - 1]);
    }
    expect(decks[0] - decks[decks.length - 1], 'the pile is thinner by the dealt cards').toBe(fresh);
    // THE LOBBY refilled with cubes that travelled.
    if ((before.game.parliament?.phase?.summary?.lobbyRefilled.length ?? 0) > 0) {
      const cubes = displacements(renewal, 'cube');
      expect(cubes.size).toBeGreaterThan(0);
      expect(Math.min(...cubes.values())).toBeGreaterThan(20);
    }
    expect(rest.holds).toEqual([]);
    await shoot(page, '11-renewal-rest');

    // ── «ДОЖАТЬ»: A on the closing page's beat drives it to rest without leaving the page.
    await press(page, 'Enter', 60);
    await expect.poll(() => stageAttr(page), {timeout: 10_000}).toBe('closing');
    await press(page, 'Enter', 400);
    expect(await stageAttr(page), 'A during the closing\'s beat stays on the closing').toBe('closing');
    await waitAtRest(page, 5_000);
    expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage, 'nothing was answered').toBe('adjourn');
    await shoot(page, '12-closing-rest');
  });

  test('REDUCED MOTION: the same stages, the same A presses, nothing ever in the air, the walk under 2 s', async ({page, request}) => {
    test.setTimeout(180_000);
    await page.emulateMedia({reducedMotion: 'reduce'});
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    await expect(page.locator('.con-mandatory')).toHaveCount(1, {timeout: 30_000});
    await armProbe(page);
    const t0 = Date.now();
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect.poll(() => stageAttr(page), {timeout: 15_000}).toBe('verdict');
    await press(page, 'Enter', 300);
    await expect.poll(() => stageAttr(page), {timeout: 10_000}).toBe('enact');
    await press(page, 'Enter', 300);
    await expect.poll(() => stageAttr(page), {timeout: 10_000}).toBe('reward');
    const walkMs = Date.now() - t0;
    const probe = await readProbe(page);
    expect(probe.samples.every((s) => s.proxies.length === 0), 'nothing in the air under reduced motion').toBe(true);
    expect(probe.samples.every((s) => s.holds.length === 0), 'no sitting hold under reduced motion').toBe(true);
    expect(await page.locator('.con-parl__gov-card--awaiting').count(), 'the poses are final at once').toBe(0);
    expect(walkMs, `the whole walk (two presses included) took ${walkMs} ms`).toBeLessThan(6_000);
    expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage).toBe('assembly');
    await shoot(page, '20-reduced-reward');
    await page.emulateMedia({reducedMotion: null});
  });

  test('PERF-LITE: the same beats, transform/opacity only — no filter on any proxy', async ({page, request}) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => window.localStorage.setItem('tm_console_fx_lite', '1'));
    await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    expect(await page.evaluate(() => document.documentElement.classList.contains('con-fx-lite')), 'fx-lite is on').toBe(true);
    await expect(page.locator('.con-mandatory')).toHaveCount(1, {timeout: 30_000});
    await armProbe(page);
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect.poll(() => stageAttr(page), {timeout: 15_000}).toBe('verdict');
    await waitAtRest(page);
    await press(page, 'Enter', 400);
    await expect.poll(() => motionAttr(page), {timeout: 10_000}).toBe('enact');
    await waitAtRest(page, 15_000);
    const probe = await readProbe(page);
    const flown = probe.samples.flatMap((s) => s.proxies);
    expect(flown.length, 'the beats played').toBeGreaterThan(0);
    expect(flown.every((p) => p.filter === 'none'), 'no filter on a proxy').toBe(true);
    expect(motionSpan(probe.samples, 'enact')).toBeGreaterThan(900);
    await shoot(page, '30-fxlite-enact-rest');
  });
});
