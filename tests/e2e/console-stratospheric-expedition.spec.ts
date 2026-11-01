import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {armEventFaceProbe, eventFaceLine, readEventFaceProbe} from './eventFaceWitness';

/**
 * P84 «ЭКСПЕДИЦИЯ В СТРАТОСФЕРУ» — the NINETEENTH Prelude 2 card, and the stand of «СОБЫТИЕ ПЛАТИТ ЛИЦОМ» (DK): ONE press,
 * TWO effects of different nature — 2 floaters on a holder the composer's target step names, then the search for 2 Venus
 * cards (P76's tape) — played by an EVENT that PAYS FACE UP while it still stands in the composer, from its printed icons,
 * and only then lifts, turns over in the arc and lands face down on its pile (the owner's direction of 2026-11-01;
 * docs/claude/prompts/prelude2-p84-stratospheric-expedition.md, ledger DK).
 *
 *   A · `stratospheric-expedition` (Dirigibles 3 · Floating Habs 0; 10 M€ + 2 titanium): the composer asks WHERE (two
 *       holders — an open question), names the search on its draw chip; the holder answered, ONE POST; BEFORE the lift
 *       the floaters are born on the standing card's PRINTED floaters and land on the holder's miniature in the
 *       composer, its point on its printed badge; then the card lifts, turns over in the arc and lands face down — the
 *       pile reads N + 1 from that landing; the search's reveal stands in the hand after it; the take; the server: 2
 *       floaters on the holder (less what its floaters paid), 2 Venus cards, the price paid by the POST.
 *   B · `stratospheric-expedition-sole` (Dirigibles alone): the row is SEEDED and shown, the POST carries Dirigibles.
 *   C · `stratospheric-expedition-noholder`: the composer NAMES the loss («аэростаты пропадут»), the play stands, the tape runs.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P84 (the dry run there proves both effects). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Stratospheric Expedition';
const FOUND = ['Venusian Insects', 'Aerial Mappers'];
const OUT = path.resolve('screenshots', 'p84');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const ZONE = '.con-hand__outcome';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{cards: Array<{name: string}>}>,
  thisPlayer: {megacredits: number, titanium: number, tableau: Array<{name: string, resources?: number}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const resourcesOn = (w: Wire, card: string) => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

type Paid = {megacredits: number, titanium: number, floaters: number};
/** What the play's ONE POST paid — the payment panel may spend Dirigibles' floaters on a Venus card (its own lane). */
function paidOf(post: string): Paid {
  const found: Partial<Paid> = {};
  const walk = (v: unknown): void => {
    if (v !== null && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.payment === 'object' && o.payment !== null) {
        Object.assign(found, o.payment);
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(JSON.parse(post));
  return {megacredits: found.megacredits ?? 0, titanium: found.titanium ?? 0, floaters: found.floaters ?? 0};
}

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

/** RT → the wheel's centre (the hand) → the card focused → A: the play composer, nothing sent. */
async function openComposer(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await page.locator(COMPOSER).waitFor({timeout: 15_000});
  await settle(page);
}

/** A on the open target row → the table zone → A on the focused holder; the row answered. Returns the holder chosen. */
async function answerTarget(page: Page): Promise<string> {
  const zone = page.locator(`${COMPOSER} .con-ptsel`);
  for (let i = 0; i < 3 && await zone.count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(zone, 'A opens the table zone').toHaveCount(1, {timeout: 10_000});
  await settle(page);
  const chosen = await zone.locator('.con-ptsel__slot--focused[data-zoom-slot]').first().getAttribute('data-zoom-slot', {timeout: 10_000}) ?? '';
  for (let i = 0; i < 4 && await zone.count() > 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(zone, 'the zone closes on the answer').toHaveCount(0, {timeout: 10_000});
  await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'no open question left').toHaveCount(0);
  await settle(page);
  return chosen.replace(/#.*$/, '');
}

/** A on the commit → ONE POST (a retry only while nothing was sent). */
async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 6 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 300);
  }
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'the play is ONE POST').toBe(1);
  expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
}

/** The search's reveal standing in the hand, landed and quiet. */
async function revealStands(page: Page): Promise<void> {
  const summary = page.locator(`${ZONE} .con-reveal [data-reveal-search]`);
  await summary.waitFor({timeout: 60_000});
  await expect(page.locator(`${ZONE} .con-reveal__namebar:not(.con-reveal__namebar--held)`), 'the batch has landed').toHaveCount(1, {timeout: 30_000});
  await settle(page, {timeoutMs: 40_000});
  await expect(summary).toHaveAttribute('data-search-taken', '2');
  await expect(summary).toHaveAttribute('data-search-discarded', '2');
  for (const name of FOUND) {
    await expect(page.locator(`${ZONE} .con-reveal [data-zoom-slot^="${name}#"]`), `«${name}» found`).toHaveCount(1);
  }
}

/** B takes the finds into the dock; the workspace LEAVES. */
async function take(page: Page): Promise<void> {
  await press(page, 'Escape', 600);
  await expect(page.locator('.con-hand'), 'the workspace leaves after the take').toHaveCount(0, {timeout: 30_000});
  await settle(page, {timeoutMs: 30_000});
  expect(await page.locator('.con-ws').count(), 'no workspace left standing').toBe(0);
}

test.describe(`P84 Stratospheric Expedition · 2 floaters to ANY card + the search for 2 Venus cards, an event that pays before its lift · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · two holders: WHERE asked, ONE POST, the event pays FACE UP in the composer, then lifts, turns over in the arc, lies on its pile; then the search', async ({page, request}) => {
    test.setTimeout(480_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'stratospheric-expedition', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect(before.thisPlayer.titanium, 'the fixture: 2 titanium').toBe(2);

    // ── (2) the composer: the target is an OPEN question, the search named on its chip, the price in two lanes ──
    await openComposer(page);
    await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'two holders: WHERE is a decision').toHaveCount(1);
    const draw = page.locator(`${COMPOSER} .action-effect-chip`).filter({has: page.locator('.resource_icon--cards')});
    await expect(draw.locator('[data-draw-search]'), 'the chip carries the server\'s search').toHaveAttribute('data-draw-search', 'with:venus');
    await expect(page.locator(`${COMPOSER} .con-pay`), 'the price reads its two lanes').toContainText(/12/);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'a-composer-open');
    const chosen = await answerTarget(page);
    expect(['Dirigibles', 'Floating Habs'], `the holder chosen on the table zone («${chosen}»)`).toContain(chosen);
    await shoot(page, 'a-composer-answered');

    // ── (3) A → ONE POST → the scene, by ORDER ──
    await armTransferWitness(page);
    await armEventFaceProbe(page);
    const stop = await storyboard(page, 'play');
    await commit(page, posts);
    const body = JSON.parse(posts[0]) as {responses?: Array<{type: string, cards?: Array<string>}>};
    const answer = (body.responses ?? []).find((r) => r.type === 'card');
    expect(answer?.cards, 'the batch carries the holder the player chose').toEqual([chosen]);
    await revealStands(page);
    await stop();
    const probe = await readEventFaceProbe(page);
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'a-trail.txt'), `${eventFaceLine(probe)}\n${transferTrail(witness)}\n`);
    test.info().annotations.push({type: 'event-face', description: eventFaceLine(probe)});
    expect(probe.ticks, 'the probe sampled').toBeGreaterThan(10);

    // THE PAY-BACK BEFORE THE LIFT: the floaters on the standing card's PRINTED floater icons, landed on the holder's
    // miniature in the composer; the point on the printed badge — every one of the play's tokens born while the card still
    // stood (`shipping`), none on the pile or the landed card.
    const floaters = witness.births.filter((b) => /^printed:.*floater/.test(b.under));
    expect(floaters.length, `the floaters were born on the printed floaters (trail:\n${transferTrail(witness)})`).toBeGreaterThan(0);
    expect(witness.landings.some((l) => l.under === `composer-card:${chosen}`), `the floaters landed on «${chosen}» in the composer (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(witness.births.some((b) => b.under === 'vp-badge'), `the point was born on the printed badge (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(witness.births.filter((b) => /^recv:/.test(b.under)).map((b) => `${b.value}@${b.under}`), 'nothing born on the stage — the event paid before it left').toEqual([]);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(probe.paybacks.map(([, st]) => st), `the pay-back ran before the lift (${eventFaceLine(probe)})`).toEqual(['paying', 'paid']);
    expect(probe.birthPhases.filter((ph) => ph !== 'shipping'), `every token was born before the lift (${probe.birthPhases.join(' ')})`).toEqual([]);
    expect(probe.tPaid, 'paid').toBeDefined();
    expect(probe.tLifting, 'lifted').toBeDefined();
    expect(probe.tLifting!, 'the card lifts only after it paid').toBeGreaterThanOrEqual(probe.tPaid!);
    // THE ARC: the event turns over in flight (the flip chassis' m11 reaches its back) and lands face down.
    expect(probe.flipCosMin, `the event turned over in the arc (${eventFaceLine(probe)})`).toBeLessThan(-0.9);
    const ticked = probe.counts.findIndex(([, c], i) => i > 0 && c !== probe.counts[0][1]);
    expect(ticked, `the pile ticked N + 1 (${eventFaceLine(probe)})`).toBeGreaterThan(0);
    expect(probe.counts[ticked][0], 'the pile ticks on the landing').toBeGreaterThanOrEqual(probe.tRevealed ?? Infinity);
    expect(probe.tNext, 'the search\'s reveal stood').toBeDefined();
    expect(probe.tNext!, 'the search opened after the landing').toBeGreaterThanOrEqual(probe.tRevealed!);
    await shoot(page, 'a-search');

    await take(page);
    const after = await wireOf(request, id);
    const paid = paidOf(posts[0]);
    test.info().annotations.push({type: 'paid', description: JSON.stringify(paid)});
    expect(paid.megacredits + paid.titanium * 3 + paid.floaters * 3, 'the price 12 paid in full').toBe(12);
    expect(paid.titanium, 'the titanium lane used (a Space tag)').toBeGreaterThan(0);
    // The holder: +2 from the play, minus what its floaters paid (the payment's own lane — Dirigibles only).
    const spentHere = chosen === 'Dirigibles' ? paid.floaters : 0;
    expect(resourcesOn(after, chosen) - resourcesOn(before, chosen), `2 floaters on «${chosen}» (${spentHere} of its own paid the price)`).toBe(2 - spentHere);
    for (const name of FOUND) {
      expect(after.cardsInHand?.map((c) => c.name), `«${name}» in hand`).toContain(name);
    }
    expect(after.thisPlayer.titanium, 'the titanium paid').toBe(before.thisPlayer.titanium - paid.titanium);
    expect(after.thisPlayer.megacredits, 'the M€ paid').toBe(before.thisPlayer.megacredits - paid.megacredits);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the event on the table').toContain(CARD);
    await shoot(page, 'a-after');
    expect(pageErrors, 'no page errors').toEqual([]);
  });

  test('B · one holder: the row is SEEDED and shown — the POST carries Dirigibles', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'stratospheric-expedition-sole', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openComposer(page);
    await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'nothing left open').toHaveCount(0);
    expect(await page.locator(`${COMPOSER} [data-seeded]`).count(), 'the one holder seeded and SHOWN').toBeGreaterThan(0);
    await shoot(page, 'b-composer-seeded');
    await commit(page, posts);
    const body = JSON.parse(posts[0]) as {responses?: Array<{type: string, cards?: Array<string>}>};
    expect((body.responses ?? []).find((r) => r.type === 'card')?.cards, 'the seeded holder rides the batch').toEqual(['Dirigibles']);
    await revealStands(page);
    await take(page);
    expect(resourcesOn(await wireOf(request, id), 'Dirigibles'), '3 + 2 floaters, less what paid the price').toBe(5 - paidOf(posts[0]).floaters);
  });

  test('C · no holder: the composer NAMES the loss; the play stands; the search runs', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'stratospheric-expedition-noholder', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openComposer(page);
    await expect(page.locator(`${COMPOSER} .con-composer__warn`), 'the loss is named before the press').toHaveCount(1);
    await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'nothing to ask').toHaveCount(0);
    await shoot(page, 'c-composer-noholder');
    await commit(page, posts);
    await revealStands(page);
    await take(page);
    const after = await wireOf(request, id);
    for (const name of FOUND) {
      expect(after.cardsInHand?.map((c) => c.name), `«${name}» in hand`).toContain(name);
    }
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the event on the table').toContain(CARD);
  });
});
