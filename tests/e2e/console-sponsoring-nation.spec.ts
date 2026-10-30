import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P83 «НАЦИЯ-СПОНСОР» — THE FIRST DECLARATIVE PLAY WHOSE DELEGATE GRANT IS A LIVE FOLLOW-UP WITH NO BOARD DOOR, and the
 * witness of «ONE PRESS, SEVERAL EFFECTS — THE SURFACES GO IN TURN» (docs/claude/prompts/prelude2-p83-sponsoring-nation.md,
 * ledger CX). T03 hosts its vote inside the hand because its flow stood aside for the board and came back; TR03 asks the
 * resolution before the POST; P83 has neither — the vote rises as the NEXT STEP of the same hand flow.
 *
 *   A · `sponsoring-nation-locked` (2 Earth tags): the verdict refuses the play with the tag count «2»; A sends nothing.
 *   B · `sponsoring-nation` (Teractor · Cartel · Luna Governor = 4 Earth tags; the Greens rule; reserve 6; 25 M€):
 *       the composer reads the whole play (the rating and the reserve chips, the row «затем: 2 делегата на одну
 *       резолюцию», the Greens' «+6 M€» in «Сработает», the price 18 after Teractor's discount); ONE POST; the three
 *       events of one press IN TURN — the card lands, the TR token reaches the rating cell, the Greens' M€ reach the
 *       row — and only THEN the vote door rises, INSIDE the hand («… › ГОЛОСОВАНИЕ», one Parliament); B «Свернуть» parks
 *       it, A brings the same step back; A on a resolution → ONE more POST, two cubes from the reserve (6 → 4), the flow
 *       LEAVES to the board.
 *
 * The ORDER is judged on the probe's MutationObserver record (FUNCTIONAL class — state, never a frame count).
 * Fixtures: tests/e2e/fixtures/generate.ts § P83 (the dry run there proves the numbers). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Sponsoring Nation';
const CARD_RU = 'Нация-спонсор';
const OUT = path.resolve('screenshots', 'p83');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const VOTE = '.con-hand .con-parl--embedded [data-parl-vote-door="card"]';

type Wire = {
  game: {parliament?: {players: Array<{color: string, reserve: number}>}},
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>},
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
  /** A `.con-parl` stood OUTSIDE the hand (a second surface) or as a band of its own. */
  parlOutsideHand: boolean;
  /** [ms, value] — the rating cell, the M€ row, the viewer's reserve as the Parliament draws it: every change. */
  tr: Array<[number, string]>;
  mc: Array<[number, string]>;
  reserve: Array<[number, number]>;
  /** The first moment the card's vote door stood (−1: never). */
  doorAt: number;
  /** The first moment a vote door stood with no hand around it (−1: never). */
  doorOutsideAt: number;
  /** Moments the hand was ABSENT while a vote door stood — the step outside its flow. */
  handGoneUnderVote: number;
  /** The first moment the hand was gone after the door had stood (the flow left). */
  handLeftAt: number;
  stranded: boolean;
};

/** MutationObserver + setInterval (never rAF): the story of the screen from the press on. */
async function armStory(page: Page, viewer: string): Promise<void> {
  await page.evaluate((viewer) => {
    const w = window as unknown as {__p83: Story};
    const p: Story = {
      samples: 0, steps: [], parlOutsideHand: false, tr: [], mc: [], reserve: [],
      doorAt: -1, doorOutsideAt: -1, handGoneUnderVote: 0, handLeftAt: -1, stranded: false,
    };
    w.__p83 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const push = <T>(list: Array<[number, T]>, value: T) => {
      if (list[list.length - 1]?.[1] !== value) {
        list.push([Date.now() - t0, value]);
      }
    };
    const sample = () => {
      p.samples++;
      const at = Date.now() - t0;
      const hand = document.querySelector('.con-hand');
      hand?.querySelectorAll('.con-wshead__step').forEach((el) => {
        const step = text(el);
        if (step !== '' && !p.steps.includes(step)) {
          p.steps.push(step);
        }
      });
      document.querySelectorAll('.con-parl').forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.parlOutsideHand = true;
        }
      });
      const door = document.querySelector('[data-parl-vote-door]');
      if (door !== null) {
        if (p.doorAt < 0 && door.closest('.con-hand') !== null && door.getAttribute('data-parl-vote-door') === 'card') {
          p.doorAt = at;
        }
        if (hand === null) {
          p.handGoneUnderVote++;
          if (p.doorOutsideAt < 0) {
            p.doorOutsideAt = at;
          }
        }
      }
      if (p.doorAt >= 0 && hand === null && p.handLeftAt < 0) {
        p.handLeftAt = at;
      }
      push(p.tr, text(document.querySelector('.con-res .con-score__value--tr')));
      push(p.mc, (text(document.querySelector('.con-res .con-res__row--megacredits .con-res__digits')).match(/^-?\d+/) ?? [''])[0]);
      const raw = document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count');
      const value = raw === null || raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(value)) {
        push(p.reserve, value);
      }
      p.stranded = p.stranded || document.querySelector('.con-stranded') !== null;
    };
    sample();
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 30);
  }, viewer);
}

const readStory = (page: Page): Promise<Story> => page.evaluate(() => (window as unknown as {__p83: Story}).__p83);

/** The first moment a recorded value reads `value` (−1: never). */
const firstAt = <T>(list: Array<[number, T]>, value: T): number => list.find(([, v]) => v === value)?.[0] ?? -1;

test.describe(`P83 Sponsoring Nation · the play's vote is a step of the same flow, the three events in turn · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · two Earth tags: the verdict refuses the play with the count; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'sponsoring-nation-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    test.info().annotations.push({type: 'verdict', description: (await verdict.innerText()).replace(/\s+/g, ' ')});
    await expect(verdict, 'the tag count: 2 of 4').toContainText(/2\s*\/\s*4|Нужно меток: 4/);
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · ONE POST: the card, the TR token, the Greens\' M€ — THEN the vote inside the hand; B/A round trip; the cubes from the reserve; the flow leaves', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'sponsoring-nation', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    const tr0 = before.thisPlayer.terraformRating;
    const mc0 = before.thisPlayer.megacredits;
    const reserve0 = reserveOf(before);
    const price = before.cardsInHand?.find((c) => c.name === CARD)?.calculatedCost;
    expect([mc0, reserve0, price], 'the fixture: 25 M€, reserve 6, P83 at 18 (Teractor −3)').toEqual([25, 6, 18]);

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'four Earth tags: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});

    // ── the composer reads the whole play ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const composerText = (await page.locator(COMPOSER).innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'composer', description: composerText.slice(0, 1200)});
    const next = (await page.locator(`${COMPOSER} .con-composer__next`).allTextContents()).join(' | ').replace(/\s+/g, ' ');
    expect(next, `the «next» row names the vote after the play — ${next}`).toMatch(/2 делегата на одну резолюцию/i);
    const forecast = page.locator(`${COMPOSER} [data-forecast-row]`);
    await expect(forecast.locator('[data-forecast-rail="stock:megacredits"]'), 'the Greens\' answer to the rating names its M€ row').toHaveCount(1);
    test.info().annotations.push({type: 'forecast', description: (await forecast.innerText()).replace(/\s+/g, ' ')});
    await expect(page.locator(`${COMPOSER} [aria-label^="Оплата"]`).first(), 'the payment head names Teractor\'s discount: 21 → 18')
      .toHaveAttribute('aria-label', /21\s*→\s*18/);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    // ── A: ONE POST; the three events in turn, THEN the vote ──
    await armTransferWitness(page);
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
    const story = await readStory(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-story.json'), JSON.stringify(story, null, 1));
    const told = JSON.stringify({...story, samples: story.samples});
    await expect(page.locator(VOTE), `the vote stands INSIDE the hand — story ${told}`).toHaveCount(1);
    expect(story.parlOutsideHand, `one Parliament, inside the hand — never a band of its own (${told})`).toBe(false);
    expect(story.doorOutsideAt, `no vote door ever stood without the hand (${told})`).toBe(-1);
    expect(story.steps.map((s) => s.toUpperCase()), 'the crumb names the vote').toContain('ГОЛОСОВАНИЕ');
    // The ORDER: the rating reads N until its token, the M€ row reaches the answer, and only then the door.
    const trUp = firstAt(story.tr, String(tr0 + 3));
    const mcAnswered = firstAt(story.mc, String(mc0 - 18 + 6));
    expect(trUp, `the rating reached ${tr0 + 3} on screen (${told})`).toBeGreaterThanOrEqual(0);
    expect(mcAnswered, `the M€ row reached the Greens' answer ${mc0 - 18 + 6} (${told})`).toBeGreaterThanOrEqual(0);
    expect(story.doorAt, `the door rose AFTER the TR touchdown (${told})`).toBeGreaterThan(trUp);
    expect(story.doorAt, `the door rose AFTER the Greens' M€ (${told})`).toBeGreaterThan(mcAnswered);
    const trBefore = story.tr.filter(([at]) => at < trUp).map(([, v]) => v).filter((v) => v !== '');
    expect(trBefore.every((v) => v === String(tr0)), `the rating read ${tr0} until its token — it read ${trBefore.join(', ')}`).toBe(true);
    const witness = await transferWitness(page);
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-trail.txt'), transferTrail(witness) + '\n');
    expect(witness.births.some((b) => b.under.startsWith('reactor:Greens')), `the Greens' answer born on their charter (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    const mid = await wireOf(request, id);
    expect([mid.thisPlayer.terraformRating - tr0, mid.thisPlayer.megacredits], 'the server: TR +3, 25 − 18 + 6 = 13 M€').toEqual([3, 13]);

    // B past the commit is «Свернуть» — a ROUND TRIP: the vote is parked with its flow, A on the board brings it back.
    await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 3, settleMs: 1200});
    await shoot(page, 'c-collapsed');
    expect(await pressUntil(page, 'Enter', async () => await page.locator(VOTE).count() === 1, {tries: 3, settleMs: 1500}),
      'A on the board home restores the vote inside the hand').toBe(true);

    // ── A on a resolution → ONE more POST → two cubes from the reserve → the flow leaves ──
    await settle(page, {timeoutMs: 20_000});
    await pressUntil(page, 'Enter', async () => reserveOf(await wireOf(request, id)) === reserve0 - 2, {tries: 3, settleMs: 2500});
    expect(posts.length, 'the vote is ONE more POST').toBe(2);
    await shoot(page, 'd-cubes');
    await expect(page.locator('.con-hand'), 'the flow ends on the board').toHaveCount(0, {timeout: 30_000});
    await expect(page.locator('.con-parl'), 'the Parliament left with the flow').toHaveCount(0, {timeout: 20_000});
    await settle(page, {timeoutMs: 30_000});
    await stopStory();
    const landed = await readStory(page);
    expect(landed.reserve.map(([, v]) => v), `the reserve count moved on screen — ${JSON.stringify(landed.reserve)}`).toContain(reserve0 - 2);
    expect(landed.stranded, 'no stranded prompt').toBe(false);
    const after = await wireOf(request, id);
    expect(reserveOf(after), 'the reserve: 6 → 4').toBe(reserve0 - 2);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the card on the table').toContain(CARD);
    await shoot(page, 'e-board');

    // ── the journal names the card ──
    await press(page, 'KeyR', 1200);
    await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
    await settle(page);
    const journal = (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'journal', description: journal.slice(0, 900)});
    expect(journal, 'the journal names the card').toContain(CARD_RU);
    await shoot(page, 'f-journal');
    await press(page, 'KeyR', 1000);
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});
