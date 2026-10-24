import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openZoomViewer, pressUntil, settle,
} from './consoleStart';
import {
  armLeakWitness, enterSittingByPass, expectDossierIsRules, expectParliamentFits, openParliament, sittingStage, strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * JOINT RESEARCH (Turmoil Redux, RX16) — the ONE e2e of the card's new
 * mechanism: a value that is a LEVEL («draw until you have 6 + influence cards
 * in hand»), so every reading must carry the TARGET, the HAND and the PAYOUT —
 * never the target alone — and a seat already at its target reads a CALM zero.
 * Three moments of one journey, on one profile (the owner's budget: one e2e
 * per new mechanic):
 *
 *   PART 1 · THE VOTE (fixture `parliament-research-vote`): the face wears the
 *   discard-glyph quest; the panel reads ONE explained line — «up to 8 [card] ·
 *   5 in hand → +3», the win suffix «+1 · step 5» (target 9 at influence 3);
 *   the fullscreen says it in words («target 8 … 5 in hand — 3 to draw»).
 *
 *   PART 2 · THE SITTING (fixture `parliament-research-assembly`; red wins, so
 *   blue is paid exactly the vote's numbers): the take stands INSIDE the stage
 *   with three cards while the band explains the number (target 8, hand 5);
 *   B collects all three, the hand grows by EXACTLY three; the server records
 *   the target and the hand before and after; red — nine in hand at target 7 —
 *   recorded its zero as the rule working, and the RESULTS name it beside
 *   blue's +3.
 *
 *   PART 3 · THE ZERO (fixture `parliament-research-full`; blue at nine cards
 *   against its target of 8): the band's reward line reads «up to 8 · 9 in hand
 *   → no draw needed» — no strike, no amber, no chip in the air.
 *
 * Screens under screenshots/parliament-research/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-research', 'standard-1080');
const RESEARCH_ID = 'RDX_SCIENTISTS_JOINT_RESEARCH';
const RESEARCH_INSTANCE = `${RESEARCH_ID}#0`;
const RESEARCH_CLASS = /rdx-scientists-joint-research/;
const AT_TARGET_REASON = /Рука уже не меньше цели|Already at the target hand size/;
const NO_DRAW_NEEDED = /добор не нужен|no draw needed/i;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Reading = {effect: string | null, context: string | null, target: string | null, level: string | null, amount: string | null, skipped: string | null, none: boolean};

/** The readings a yield block prints, by effect and context — the target, the level and the payout the number stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    effect: el.closest<HTMLElement>('[data-yield-effect]')?.getAttribute('data-yield-effect') ?? null,
    context: el.getAttribute('data-yield-context'),
    target: el.getAttribute('data-yield-target'),
    level: el.querySelector<HTMLElement>('[data-yield-in="level"]')?.getAttribute('data-yield-level') ?? null,
    amount: el.getAttribute('data-yield-amount'),
    skipped: el.getAttribute('data-yield-skipped'),
    none: el.querySelector('[data-yield-none]') !== null,
  }));
}, scope) as Promise<Array<Reading>>;

/**
 * THE BAND ON THE REWARD BEAT, sampled on a task clock (`setInterval`, never rAF): the walk turns a quiet reward page
 * by itself (the soft gates), so a one-shot read after a poll for the stage can land on the results already.
 */
type BandSample = {readings: Array<Reading>, none: string, lost: number, amber: number, take: number};
async function armBandSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__bandSamples?: Array<unknown>};
    const samples: Array<unknown> = [];
    w.__bandSamples = samples;
    window.setInterval(() => {
      if (document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') !== 'reward') {
        return;
      }
      const band = document.querySelector<HTMLElement>('[data-parl-sit-yield]');
      if (band === null) {
        return;
      }
      samples.push({
        readings: Array.from(band.querySelectorAll<HTMLElement>('[data-yield-context]')).map((el) => ({
          effect: el.closest<HTMLElement>('[data-yield-effect]')?.getAttribute('data-yield-effect') ?? null,
          context: el.getAttribute('data-yield-context'),
          target: el.getAttribute('data-yield-target'),
          level: el.querySelector<HTMLElement>('[data-yield-in="level"]')?.getAttribute('data-yield-level') ?? null,
          amount: el.getAttribute('data-yield-amount'),
          skipped: el.getAttribute('data-yield-skipped'),
          none: el.querySelector('[data-yield-none]') !== null,
        })),
        none: (band.querySelector('[data-yield-none]')?.textContent ?? '').trim(),
        lost: band.querySelectorAll('.con-iyield__out--lost').length,
        amber: band.querySelectorAll('.con-iyield__reading--skipped').length,
        take: document.querySelectorAll('.con-extdraw').length,
      });
    }, 40);
  });
}
const bandSamples = (page: Page): Promise<Array<BandSample>> =>
  page.evaluate(() => (window as unknown as {__bandSamples?: Array<BandSample>}).__bandSamples ?? []);

type Outcome = {player: string, step: string, kind: string, amount?: number, drawn?: number, influence?: number, target?: number, total?: {before: number, after: number}, reason?: string};
type Wire = {
  thisPlayer: {color: string, cardsInHandNbr: number},
  game: {parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

test.describe('Joint Research · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the vote explains the number (target · hand · draw); the sitting takes exactly that many inside the stage and names the seat that needed none; a seat at its target reads a calm zero', async ({page, request}) => {
    test.setTimeout(600_000);

    // ════════════════ PART 1 · THE VOTE — one explained line, never the target alone ════════════════
    {
      await bootFixtureSeats(page, request, 'parliament-research-vote', {query: '&consoleProfile=auto'});
      await armLeakWitness(page);
      await openParliament(page);

      // ── THE FACE: its art (keyed by RX16), the Scientists' emblem, «[influence] + 6 [card]*», and the quest as the DISCARD glyph.
      const face = page.locator(`.con-parl__slot[data-instance="${RESEARCH_INSTANCE}"] .pcard`);
      await expect(face, 'Joint Research stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(RESEARCH_CLASS);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX16');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Scientists\' emblem').toContain('scientists');
      await expect(face.locator('.pcard__quest-graphic'), 'the quest as a graphic').toHaveCount(1);
      // The footnote is what the PHYSICAL card prints: the EVENT TAG with the count («2 × [event]») — never a
      // «red card» band, never a discard glyph (the yellow disc with the down arrow IS the event tag).
      const questTags = face.locator('.pcard__quest-graphic .pcard-ic--tag');
      const medallions = await questTags.count();
      expect(medallions, 'the event tag medallion (one with the count, or one per card)').toBeGreaterThanOrEqual(1);
      expect(await questTags.evaluateAll((els) => els.every((el) => getComputedStyle(el).backgroundImage.includes('event'))),
        'the EVENT tag, by its own asset').toBe(true);
      if (medallions === 1) {
        await expect(face.locator('.pcard__quest-graphic'), 'with the count').toContainText('2');
      } else {
        expect(medallions, 'two tags, one per card').toBe(2);
      }
      expect(await face.locator('.pcard__quest-graphic').evaluate((el) =>
        Array.from(el.querySelectorAll<HTMLElement>('*')).some((node) => getComputedStyle(node).backgroundImage.includes('card-discard')) ||
        Array.from(el.querySelectorAll('img')).some((node) => node.src.includes('card-discard'))),
      'never the discard glyph').toBe(false);
      await shoot(page, '01-face-quest');

      // ── THE VOTE MODE: «up to 8 [card] · 5 in hand → +3 · +1 if you win · step 5».
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      await expect(block, 'the level reading block').toHaveCount(1);
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        {effect: 'draw', context: 'estimate', target: '8', level: '5', amount: '3', skipped: null, none: false},
      ]);
      await expect(block.locator('[data-yield-in="target"]').first(), 'the TARGET is printed, never alone').toHaveText('8');
      await expect(block.locator('[data-yield-in="level"]').first(), 'the HAND beside it').toHaveText(/в руке 5|5 in hand/);
      await expect(block.locator('.con-iyield__out b').first(), 'the PAYOUT is the difference').toHaveText('+3');
      const suffix = block.locator('[data-parl-vote-suffix]');
      await expect(suffix, 'the win suffix: the target rises to 9 at step 5').toHaveCount(1);
      await expect(suffix).toHaveAttribute('data-parl-vote-suffix', '1');
      await expect(suffix).toHaveAttribute('data-suffix-step', '5');
      await expect(block.locator('.con-iyield__reading--forecast'), 'a forecast is never a plate on the panel').toHaveCount(0);
      await expect(block.locator('[data-yield-note]'), 'no note: the draw can land').toHaveCount(0);
      await expectParliamentFits(page, 'vote mode');
      await shoot(page, '02-vote-explained');

      // ── THE FULLSCREEN: the printed text alone — the three numbers are the panel's (texts 2026-10-23).
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(RESEARCH_CLASS);
      await expectDossierIsRules(page, 'research');
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules, 'the printed text').toContainText(/пока в руке не станет 6 карт|until you have 6 cards in hand/);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, '03-fullscreen-words');
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 15_000});
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    }

    // ════════════════ PART 2 · THE SITTING — the take inside the stage, exactly three cards, the zero seat named ════════════════
    {
      // The table stands ONE PASS before its sitting (the soft gates): the viewer's own pass carries the whole sitting.
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-research-assembly', {query: '&consoleProfile=auto'});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(before.thisPlayer.cardsInHandNbr, 'the fixture\'s hand').toBe(5);
      await enterSittingByPass(page, request, playerId);

      // ── THE TAKE stands INSIDE the stage's own zone with THREE cards — and the band explains the number.
      const take = page.locator('.con-extdraw');
      await expect(take, 'the take surface is on screen').toHaveCount(1, {timeout: 60_000});
      await expect(take).toHaveClass(/con-extdraw--embedded/);
      expect(await page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw').count(), 'in the stage\'s zone').toBe(1);
      await expect(page.locator('.con-extdraw .con-cards__slot'), '8 − 5 = three cards, withheld until taken').toHaveCount(3, {timeout: 20_000});
      await expect(page.locator('.con-extdraw__source .pcard').first(), 'the source is the resolution').toHaveClass(RESEARCH_CLASS);
      const bandYield = page.locator('[data-parl-sit-yield]');
      await expect(bandYield, 'the band reads the reward').toHaveCount(1, {timeout: 15_000});
      expect(await readingsIn(page, '[data-parl-sit-yield]'), 'the band names the cause of the number, not one «+3»').toEqual([
        {effect: 'draw', context: 'resolving', target: '8', level: '5', amount: '3', skipped: null, none: false},
      ]);
      expect((await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, 'not in the hand until taken').toBe(5);
      // The deal is a FLIGHT off the pile and the row re-solves its fit as the cards LAND: a measurement taken
      // mid-deal reads the row's pre-fit height (a 3 px spill, once). The claim is «the take pose fits once the
      // deal has landed» — so the fit is POLLED to its settled answer, never sampled at one instant.
      await expect.poll(() => page.locator('.con-extdraw .con-cards__slot .pcard').count(), {timeout: 20_000, message: 'every slot draws its face'}).toBe(3);
      await waitSittingAtRest(page, 30_000);
      await expect.poll(async () => {
        try {
          await expectParliamentFits(page, 'enactment take');
          return 'fits';
        } catch (e) {
          return String((e as Error).message).slice(0, 240);
        }
      }, {timeout: 20_000, message: 'the take pose fits once the deal has landed'}).toBe('fits');
      await shoot(page, '10-enact-take');

      // ── B «Забрать все»: the three cards reach the hand — exactly three, never the target's eight.
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-extdraw').count() === 0, {tries: 6, settleMs: 1800}),
        'B collects the whole take').toBe(true);
      await settle(page, {timeoutMs: 25_000});
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, {timeout: 20_000}).toBe(8);

      // ── THE RECORD is the server's: blue's target, hand before → after, amount; red's zero as the rule working.
      const wire = await wireOf(request, playerId);
      const outcomes = wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? [];
      const mine = outcomes.find((o) => o.player === wire.thisPlayer.color && o.step === 'draw');
      expect(mine).toMatchObject({kind: 'cards', amount: 3, drawn: 3, influence: 2, target: 8, total: {before: 5, after: 8}});
      const theirs = outcomes.find((o) => o.player !== wire.thisPlayer.color && o.step === 'draw');
      expect(theirs, 'red — nine in hand at target 7 — drew none, and the record says why').toMatchObject({kind: 'skipped', amount: 0, target: 7, total: {before: 9, after: 9}});
      expect(theirs?.reason).toBe('Already at the target hand size');

      // ── THE RESULTS: blue «+3 [card]», red's row names its zero — never «no influence», never a loss.
      await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
      await waitSittingAtRest(page, 30_000);
      const myRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${wire.thisPlayer.color}"]`);
      await expect(myRow).toHaveCount(1);
      await expect(myRow.locator('[data-sit-part-amount]').first()).toHaveText('+3');
      const redRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${theirs?.player}"]`);
      await expect(redRow, 'the seat that needed none has a row of its own').toHaveCount(1);
      await expect(redRow.locator('[data-sit-part="skipped"]'), '…and its part is the named zero').toHaveCount(1);
      await expect(redRow.locator('[data-sit-part-none]'), 'read calmly — the rule working, not «skipped»').toHaveText(NO_DRAW_NEEDED);
      await expect(redRow.locator('.con-sit__part-reason')).toHaveText(AT_TARGET_REASON);
      await expect(redRow, 'never a want of influence').not.toContainText(/Влияния нет|No influence|Пропущено|Skipped/);
      await settle(page, {timeoutMs: 30_000});
      await expectParliamentFits(page, 'results');
      await shoot(page, '12-results-none');
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    }

    // ════════════════ PART 3 · THE ZERO ON THE BAND — a seat at its target reads calmly, nothing flies ════════════════
    {
      // The table stands ONE PASS before its sitting (the soft gates): nine in hand at target 8 — nothing to take.
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-research-full', {query: '&consoleProfile=auto'});
      await armLeakWitness(page);
      expect((await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, 'nine in hand at target 8').toBe(9);
      await armBandSampler(page);
      await enterSittingByPass(page, request, playerId);
      // The band's reward line: «up to 8 · 9 in hand → no draw needed» — the calm zero, on the reward beat. The walk
      // turns a quiet reward page by itself, so the beat is read off the sampler, never one late look.
      await expect.poll(async () => (await bandSamples(page)).some((s) => s.readings.length > 0), {timeout: 60_000,
        message: 'the band read the reward beat'}).toBe(true);
      const onReward = (await bandSamples(page)).filter((s) => s.readings.length > 0);
      const settled = onReward[onReward.length - 1];
      expect(settled.readings).toEqual([
        {effect: 'draw', context: expect.stringMatching(/resolving|applied/), target: '8', level: '9', amount: '0', skipped: 'Already at the target hand size', none: true},
      ]);
      expect(settled.none, 'the result slot says it calmly').toMatch(NO_DRAW_NEEDED);
      expect(onReward.filter((s) => s.lost > 0), 'never a struck amount').toEqual([]);
      expect(onReward.filter((s) => s.amber > 0), 'never the forfeit\'s amber').toEqual([]);
      expect(onReward.filter((s) => s.take > 0), 'no take for a seat that needs none').toEqual([]);
      await shoot(page, '11-band-none');
      expect((await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, 'the hand did not move').toBe(9);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    }
  });
});
