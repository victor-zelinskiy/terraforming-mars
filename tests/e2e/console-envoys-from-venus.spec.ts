import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P72 «ДЕЛЕГАТЫ ВЕНЕРЫ» — THE FIRST EVENT WHOSE WHOLE PLAY IS A DELEGATE GRANT, and the witness of the class «THE GRANT IS
 * ONE PHRASE FROM THE PRESS TO THE TOUCHDOWN» (docs/claude/prompts/prelude2-p72-envoys-from-venus.md, ledger CZ):
 *
 *   A · `envoys-from-venus-locked` (2 Venus tags): the verdict refuses the play with the tag count; A sends nothing.
 *   B · `envoys-from-venus-overtake` (Venus Governor + Dirigibles = 3 Venus tags; a government outside the voting area;
 *       red already holding 1 delegate on the FIRST resolution; reserve 6; 10 M€): the composer reads the play (the
 *       reserve chip, the row «затем: 2 делегата на одну резолюцию», the price 1); ONE POST; the event lies face down;
 *       the vote rises INSIDE the hand with no empty scene between, the bar saying the crumb's stage in every sample and
 *       the resolutions' art already painted in the door's first frame; the cursor never stands on the government; A on
 *       the first resolution → ONE more POST → the PAIR flies as ONE phrase (the second cube lifts before the first
 *       touches down, the starts ≥ 90 ms apart, the reserve ticking on each departure, the ribbon on each touchdown), the
 *       lead turns ONCE — red → blue — after the LAST touchdown; the flow leaves to the board.
 *
 * The ORDER is judged on the probe's MutationObserver record (FUNCTIONAL class — state, never a frame count).
 * Fixtures: tests/e2e/fixtures/generate.ts § P72 (the dry run there proves the numbers). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Envoys From Venus';
const CARD_RU = 'Делегаты Венеры';
const OUT = path.resolve('screenshots', 'p72');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const VOTE = '.con-hand .con-parl--embedded [data-parl-vote-door="card"]';

type Wire = {
  game: {parliament?: {players: Array<{color: string, reserve: number}>}},
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const reserveOf = (wire: Wire): number => wire.game.parliament?.players.find((p) => p.color === wire.thisPlayer.color)?.reserve ?? NaN;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, PRESET.id, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** RT → the wheel's centre (the hand) → the card focused. */
async function focusInHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
}

type Story = {
  samples: number;
  /** The hand head's stage words, deduped in order of first appearance. */
  steps: Array<string>;
  /** [ms, bar context, crumb tail] — every change of the pair. */
  seam: Array<[number, string, string]>;
  /** Samples in which the crumb's tail named the vote while the bar said something else (PL-1167). */
  seamMismatch: number;
  /** A `.con-parl` stood OUTSIDE the hand (a second surface) or as a band of its own. */
  parlOutsideHand: boolean;
  /** The first moment the card's vote door stood (−1: never). */
  doorAt: number;
  /** The first sample in which the voting area's faces stood in the door (−1: never) — and the cold art in it (PL-1168). */
  facesAt: number;
  coldArtAtDoor: number;
  artAtDoor: number;
  /** The last moment the play's own scene (the hero, the composer) stood before the door; the stage's EMPTY time in between. */
  sceneLastAt: number;
  emptyMs: number;
  emptyLongest: number;
  /** The first moment a vote door stood with no hand around it (−1: never). */
  doorOutsideAt: number;
  /** The first moment the hand was gone after the door had stood (the flow left). */
  handLeftAt: number;
  /** [ms, value] — the viewer's reserve as the Parliament draws it: every change. */
  reserve: Array<[number, number]>;
  /** Every vote-flight proxy's first sighting (a cube lifting) and every landed cube's first sighting (a touchdown). */
  lifts: Array<[number, string]>;
  touches: Array<[number, number]>;
  /** [ms, tally · mine · winning] of the TARGET resolution (the first one): every change. */
  target: Array<[number, string]>;
  /** A government element wore a focus / selection mark while the vote stood (the enacted law read as a target). */
  govFocused: boolean;
  /** THE GAP's diagnosis — [ms, what stood] on every change while the play's scene was gone and the vote not yet seen. */
  gap: Array<[number, string]>;
  stranded: boolean;
};

/** MutationObserver + setInterval (never rAF): the story of the screen from the press on. */
async function armStory(page: Page, viewer: string): Promise<void> {
  await page.evaluate((viewer) => {
    const w = window as unknown as {__p72: Story};
    const p: Story = {
      samples: 0, steps: [], seam: [], seamMismatch: 0, parlOutsideHand: false, doorAt: -1, facesAt: -1, coldArtAtDoor: -1, artAtDoor: -1,
      sceneLastAt: -1, emptyMs: 0, emptyLongest: 0, doorOutsideAt: -1, handLeftAt: -1, reserve: [], lifts: [], touches: [],
      target: [], govFocused: false, gap: [], stranded: false,
    };
    w.__p72 = p;
    const t0 = Date.now();
    let last = 0;
    let emptyRun = 0;
    let sceneSeen = false;
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return false;
      }
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) {
          return false;
        }
      }
      return true;
    };
    /** The first element up the chain that hides `el` (none: 'seen'; no element: 'absent'). */
    const hiderOf = (el: Element | null): string => {
      if (el === null) {
        return 'absent';
      }
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) {
          return `${n.tagName.toLowerCase()}.${n.className.toString().trim().split(/s+/).slice(0, 3).join('.')}[${cs.display === 'none' ? 'none' : cs.visibility === 'hidden' ? 'hidden' : 'op' + Number(cs.opacity).toFixed(2)}]`;
        }
      }
      const r = el.getBoundingClientRect();
      return r.width < 2 ? 'zero-box' : 'seen';
    };
    const sample = () => {
      p.samples++;
      const at = Date.now() - t0;
      const dt = at - last;
      last = at;
      const hand = document.querySelector('.con-hand');
      let tail = '';
      hand?.querySelectorAll('.con-wshead__step').forEach((el) => {
        const step = text(el);
        if (step !== '') {
          tail = step;
          if (!p.steps.includes(step)) {
            p.steps.push(step);
          }
        }
      });
      const bar = text(document.querySelector('.con-cmdbar__context'));
      const lastSeam = p.seam[p.seam.length - 1];
      if (lastSeam === undefined || lastSeam[1] !== bar || lastSeam[2] !== tail) {
        p.seam.push([at, bar, tail]);
      }
      if (tail.toUpperCase() === 'ГОЛОСОВАНИЕ' && bar.toUpperCase() !== tail.toUpperCase()) {
        p.seamMismatch++;
      }
      document.querySelectorAll('.con-parl').forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.parlOutsideHand = true;
        }
      });
      // THE STAGE between the play and the vote: the play's own scene (the composer, the hero) or the vote standing.
      const scene = shown(document.querySelector('.con-played-hero')) || shown(document.querySelector('.con-composer--play'));
      const parl = shown(document.querySelector('.con-hand .con-parl'));
      if (scene) {
        sceneSeen = true;
        p.sceneLastAt = at;
      }
      if (p.doorAt < 0 || at < p.doorAt + 1500) {
        const parlEl = document.querySelector<HTMLElement>('.con-parl');
        const ready = (window as unknown as {__conReady?: () => {holds: Array<string>, wsFrames: Array<string>, outcome: {stage: string}}}).__conReady?.();
        const state = [
          parlEl === null ? 'no-parl' : `parl:${parlEl.closest('.con-hand') === null ? 'out' : 'in'}:op${Number(getComputedStyle(parlEl).opacity).toFixed(2)}:${parlEl.className.toString().replace(/s+/g, '.')}`,
          `hider=${hiderOf(document.querySelector('.con-hand .con-parl__slot[data-instance]'))}`,
          `info=${hiderOf(document.querySelector('.con-hand .con-parl__info'))}`,
          `scene=${scene ? 'hero/composer' : '-'}`,
          `holds=${(ready?.holds ?? []).join(',')}`,
          `frames=${(ready?.wsFrames ?? []).join('>')}`,
          `outcome=${ready?.outcome.stage ?? '?'}`,
        ].join(' ');
        if (p.gap[p.gap.length - 1]?.[1] !== state && p.gap.length < 80) {
          p.gap.push([at, state]);
        }
      }
      if (sceneSeen && p.doorAt < 0 && !scene && !parl) {
        emptyRun += dt;
        p.emptyMs += dt;
        p.emptyLongest = Math.max(p.emptyLongest, emptyRun);
      } else {
        emptyRun = 0;
      }
      const door = document.querySelector('[data-parl-vote-door]');
      if (door !== null) {
        if (p.doorAt < 0 && door.closest('.con-hand') !== null && door.getAttribute('data-parl-vote-door') === 'card') {
          p.doorAt = at;
        }
        const arts = Array.from(document.querySelectorAll('.con-hand .con-parl__slot[data-instance] .pcard__art'));
        if (p.facesAt < 0 && arts.length >= 3 && shown(arts[0])) {
          p.facesAt = at;
          p.artAtDoor = arts.length;
          p.coldArtAtDoor = arts.filter((a) => {
            const img = a.querySelector('img');
            return !a.classList.contains('pcard__art--void') && (img === null || !img.complete || img.naturalWidth === 0);
          }).length;
        }
        if (hand === null && p.doorOutsideAt < 0) {
          p.doorOutsideAt = at;
        }
        document.querySelectorAll('.con-parl__gov, .con-parl__gov *').forEach((el) => {
          if (/(--focus|--selected|--target)\b/.test(el.className.toString())) {
            p.govFocused = true;
          }
        });
      }
      if (p.doorAt >= 0 && hand === null && p.handLeftAt < 0) {
        p.handLeftAt = at;
      }
      const raw = document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count');
      const value = raw === null || raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(value) && p.reserve[p.reserve.length - 1]?.[1] !== value) {
        p.reserve.push([at, value]);
      }
      document.querySelectorAll('[data-parl-flight^="vote"]').forEach((el) => {
        const id = el.getAttribute('data-parl-flight') ?? '';
        if (!p.lifts.some(([, seen]) => seen === id)) {
          p.lifts.push([at, id]);
        }
      });
      document.querySelectorAll('.con-hand .con-parl__slot [data-seq][data-landed]').forEach((el) => {
        const seq = Number(el.getAttribute('data-seq'));
        if (!p.touches.some(([, seen]) => seen === seq)) {
          p.touches.push([at, seq]);
        }
      });
      const first = document.querySelector('.con-hand .con-parl__slot[data-instance]');
      if (first !== null) {
        const reading = [
          text(first.querySelector('.con-parl__tally-num')),
          first.querySelector('[data-parl-mine]')?.getAttribute('data-parl-mine-count') ?? '',
          first.classList.contains('con-parl__slot--mine') ? 'lead' : '-',
          first.querySelector('.con-parl__slot-win') !== null ? 'win' : '-',
        ].join('·');
        if (p.target[p.target.length - 1]?.[1] !== reading) {
          p.target.push([at, reading]);
        }
      }
      p.stranded = p.stranded || document.querySelector('.con-stranded') !== null;
    };
    sample();
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 30);
  }, viewer);
}

const readStory = (page: Page): Promise<Story> => page.evaluate(() => (window as unknown as {__p72: Story}).__p72);

/** The vote mode's cursor stands on the FIRST resolution (the overtake target). */
async function onFirstResolution(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const first = document.querySelector('.con-hand .con-parl__slot[data-instance]');
    return first !== null && first.querySelector('[data-parl-vote-card]') !== null;
  });
}

test.describe(`P72 Envoys from Venus · the grant is ONE phrase from the press to the touchdown · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · two Venus tags: the verdict refuses the play with the count; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'envoys-from-venus-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    test.info().annotations.push({type: 'verdict', description: (await verdict.innerText()).replace(/\s+/g, ' ')});
    await expect(verdict, 'the tag count: 2 of 3').toContainText(/2\s*\/\s*3|Нужно меток: 3/);
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · ONE POST: the event face down, the vote inside the hand (no empty stage, warm art, the bar = the crumb); the pair as ONE phrase; the lead turns once; the flow leaves', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'envoys-from-venus-overtake', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    const mc0 = before.thisPlayer.megacredits;
    const reserve0 = reserveOf(before);
    const price = before.cardsInHand?.find((c) => c.name === CARD)?.calculatedCost;
    expect([mc0, reserve0, price], 'the fixture: 10 M€, reserve 6, P72 at 1').toEqual([10, 6, 1]);

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'three Venus tags: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});

    // ── the composer reads the play ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const composerText = (await page.locator(COMPOSER).innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'composer', description: composerText.slice(0, 1200)});
    const next = (await page.locator(`${COMPOSER} .con-composer__next`).allTextContents()).join(' | ').replace(/\s+/g, ' ');
    expect(next, `the «next» row names the vote after the play — ${next}`).toMatch(/2 делегата на одну резолюцию/i);
    expect(composerText, 'the reserve chip: 6 → 4').toMatch(/6\s*→\s*4/);
    await expect(page.locator(`${COMPOSER} [aria-label^="Оплата"]`).first(), 'the payment head names the price 1')
      .toHaveAttribute('aria-label', /\b1\s*M€/);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    // ── A: ONE POST; the event face down; THEN the vote ──
    await armStory(page, before.thisPlayer.color);
    const stopStory = await storyboard(page, 'play');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
    await page.locator(VOTE).waitFor({timeout: 60_000}).catch(() => undefined);
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    await shoot(page, 'c-vote');
    const seam = await readStory(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-seam.json'), JSON.stringify(seam, null, 1));
    const toldSeam = JSON.stringify({gap: seam.gap, steps: seam.steps, seam: seam.seam, doorAt: seam.doorAt, facesAt: seam.facesAt, sceneLastAt: seam.sceneLastAt,
      emptyMs: seam.emptyMs, emptyLongest: seam.emptyLongest, coldArtAtDoor: seam.coldArtAtDoor, artAtDoor: seam.artAtDoor});
    test.info().annotations.push({type: 'seam', description: toldSeam});
    await expect(page.locator(VOTE), `the vote stands INSIDE the hand — ${toldSeam}`).toHaveCount(1);
    expect(seam.parlOutsideHand, `one Parliament, inside the hand — never a band of its own (${toldSeam})`).toBe(false);
    expect(seam.doorOutsideAt, `no vote door ever stood without the hand (${toldSeam})`).toBe(-1);
    expect(seam.steps.map((s) => s.toUpperCase()), 'the crumb names the vote').toContain('ГОЛОСОВАНИЕ');
    const mid = await wireOf(request, id);
    expect(mid.thisPlayer.megacredits, 'the server: 10 − 1 = 9 M€').toBe(9);
    // PL-1167 — the bar says the crumb's stage in EVERY sample; the stage is never left empty between the play and the vote.
    expect(seam.seamMismatch, `the bar said another stage under «ГОЛОСОВАНИЕ» (${toldSeam})`).toBe(0);
    expect(seam.emptyLongest, `the stage stood empty between the play and the vote (${toldSeam})`).toBeLessThanOrEqual(60);
    // PL-1168 — the door's first frame paints the resolutions' art (warmed at the press).
    expect(seam.artAtDoor, `the door shows the voting area's faces (${toldSeam})`).toBeGreaterThanOrEqual(3);
    expect(seam.coldArtAtDoor, `a resolution's art was still cold in the door's first frame (${toldSeam})`).toBe(0);

    // ── the cursor walks the voting area only — the government is never a target ──
    await settle(page, {timeoutMs: 20_000});
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
      await press(page, key, 260);
    }
    await expect(page.locator(VOTE), 'the walk never left the vote').toHaveCount(1);
    for (let i = 0; i < 4 && !await onFirstResolution(page); i++) {
      await press(page, 'ArrowLeft', 300);
    }
    expect(await onFirstResolution(page), 'the cursor reached the first resolution').toBe(true);
    expect((await readStory(page)).govFocused, 'the enacted law never wore the cursor').toBe(false);
    await shoot(page, 'c-vote-first');

    // ── A on the first resolution → ONE more POST → the pair as one phrase → the lead turns once → the flow leaves ──
    await armTransferWitness(page);
    await armStory(page, before.thisPlayer.color);
    await pressUntil(page, 'Enter', async () => posts.length >= 2, {tries: 3, settleMs: 1500});
    expect(posts.length, 'the vote is ONE more POST').toBe(2);
    await expect(page.locator('.con-hand'), 'the flow ends on the board').toHaveCount(0, {timeout: 30_000});
    await expect(page.locator('.con-parl'), 'the Parliament left with the flow').toHaveCount(0, {timeout: 20_000});
    await settle(page, {timeoutMs: 30_000});
    await stopStory();
    const pair = await readStory(page);
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-pair.json'), JSON.stringify(pair, null, 1));
    const toldPair = JSON.stringify({lifts: pair.lifts, touches: pair.touches, reserve: pair.reserve, target: pair.target});
    test.info().annotations.push({type: 'pair', description: toldPair});
    expect(pair.lifts.length, `two cubes flew (${toldPair})`).toBe(2);
    expect(pair.touches.length, `two cubes touched down (${toldPair})`).toBe(2);
    const [lift0, lift1] = pair.lifts.map(([at]) => at);
    const [touch0, touch1] = pair.touches.map(([at]) => at);
    // (the ≥ 90 ms rhythm is a TIMING claim at motion ×1 — `console-delegate-grant-pace`; here: the ORDER of the phrase)
    expect(lift1, `the second cube starts after the first (${toldPair})`).toBeGreaterThan(lift0);
    expect(lift1, `ONE PHRASE — the second cube lifts BEFORE the first touches down (${toldPair})`).toBeLessThan(touch0);
    expect(touch1, `the touchdowns follow the starts (${toldPair})`).toBeGreaterThanOrEqual(touch0);
    expect(pair.reserve.map(([, v]) => v), `the reserve ticks per departure: 6 → 5 → 4 (${toldPair})`).toEqual(expect.arrayContaining([reserve0 - 1, reserve0 - 2]));
    // THE LEAD turns once — red's → blue's — and only after the LAST touchdown.
    const leadAt = pair.target.find(([, r]) => r.split('·')[2] === 'lead')?.[0] ?? -1;
    expect(leadAt, `the first resolution became blue's (${toldPair})`).toBeGreaterThanOrEqual(0);
    expect(leadAt, `the lead turned only after the LAST touchdown (${toldPair})`).toBeGreaterThanOrEqual(touch1);
    const leads = pair.target.map(([, r]) => r.split('·')[2]).filter((v, i, all) => i === 0 || v !== all[i - 1]);
    expect(leads.filter((v) => v === 'lead').length, `the lead turned ONCE (${toldPair})`).toBe(1);
    const tallies = pair.target.map(([, r]) => r.split('·')[0]).filter((v, i, all) => i === 0 || v !== all[i - 1]);
    test.info().annotations.push({type: 'tally', description: tallies.join(' → ')});
    expect(tallies[tallies.length - 1], 'the first resolution counts red 1 + blue 2').toBe('3');
    const witness = await transferWitness(page);
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-trail.txt'), transferTrail(witness) + '\n');
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(pair.stranded, 'no stranded prompt').toBe(false);
    const after = await wireOf(request, id);
    expect(reserveOf(after), 'the reserve: 6 → 4').toBe(reserve0 - 2);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the event on the table').toContain(CARD);
    await shoot(page, 'd-board');

    // ── the journal names the card ──
    await press(page, 'KeyR', 1200);
    await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
    await settle(page);
    const journal = (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'journal', description: journal.slice(0, 900)});
    expect(journal, 'the journal names the card').toContain(CARD_RU);
    await shoot(page, 'e-journal');
    await press(page, 'KeyR', 1000);
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});
