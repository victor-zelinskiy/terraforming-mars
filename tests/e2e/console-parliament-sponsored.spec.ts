import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, pressUntil, settle} from './consoleStart';
import {
  armLeakWitness, closeSitting, closeSittingAs, enterSittingByPass, expectParliamentFits, openParliament, sittingStage, strandedReports,
  waitSittingAtRest,
} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * SPONSORED PROJECTS (Turmoil Redux, RX40) — the ONE e2e of the card: the first law that pays the seats' CARDS WITHOUT
 * A QUESTION, shown by the RECEIPT OF THE TABLE (`tableReceiptBeat` + `sittingDirector.beatReceipt`, the card-receive
 * director's fifth host). Two profiles (standard-1080 · tv4k):
 *
 *   PART 1 (`parliament-sponsored-assembly` — blue Arklight 4 · Fish 2 · Dirigibles 1 · Supercomputer 3 · Birds 0,
 *   influence 2 after the win; red Pets 1 at influence 0):
 *   ① the verdict's A → the draw's TAKE stands inside the stage with two cards (the intake, RX24's path);
 *   ② the take is collected, its surface LEAVES — and only then the receipt stands in the same zone: FOUR faces
 *      (Birds, at 0, is not one), never at the same time as the take;
 *   ③ a token per card, each born on the law's printed «?» cube and landing on ITS card's face in the receipt, in
 *      turn (the wave's ladder), the face's count ticking only once its own token has touched down; nothing over glass;
 *   ④ the results: blue's resources «on 4 cards»; server truth — hand +2, Arklight 5 · Fish 3 · Dirigibles 2 ·
 *      Supercomputer 4 · Birds 0; red's Pets 2 by its own payout.
 *   PART 2 (`parliament-sponsored-eight`): EIGHT receiving faces read in ONE row inside the pane — nothing cut, no scroll.
 *   PART 0 (`parliament-sponsored-vote` — the same table before blue's vote): the vote panel reads BOTH payouts —
 *   the draw and the cards it would feed (the holders' count) — inside the panel, before A.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF. Screens + the storyboard under
 * screenshots/parliament-sponsored/<profile>/ (the 4K storyboard is trusted on the GPU only — `TM_E2E_GPU=1`).
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-sponsored');
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;
const RECEIVERS = ['Arklight', 'Fish', 'Dirigibles', 'Supercomputer'];
const SPONSORED_INSTANCE = 'RDX_SCIENTISTS_SPONSORED_PROJECTS#0';

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Wire = {
  thisPlayer: {color: string, cardsInHandNbr: number, tableau: Array<{name: string, resources?: number}>},
  players: Array<{color: string, tableau?: Array<{name: string, resources?: number}>}>,
  game: {generation: number, parliament: {phase?: {step: string, outcomes?: Array<{player: string, step: string, kind: string, amount?: number, onto?: string, cards?: Array<{card: string}>}>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const resourcesOn = (tableau: ReadonlyArray<{name: string, resources?: number}> | undefined, card: string): number =>
  tableau?.find((c) => c.name === card)?.resources ?? -1;

type CastFrame = {wall: number, data: string};

async function recordFrames(page: Page): Promise<{frames: Array<CastFrame>, stop: () => Promise<void>}> {
  const frames: Array<CastFrame> = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (frame) => {
    frames.push({wall: (frame.metadata.timestamp ?? 0) * 1000, data: frame.data});
    if (frames.length > 900) {
      frames.splice(0, 300);
    }
    cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return {
    frames,
    stop: async () => {
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    },
  };
}

function writeFrameAt(frames: ReadonlyArray<CastFrame>, wall: number, preset: string, name: string): void {
  let best: CastFrame | undefined;
  for (const frame of frames) {
    if (best === undefined || Math.abs(frame.wall - wall) < Math.abs(best.wall - wall)) {
      best = frame;
    }
  }
  if (best === undefined || Math.abs(best.wall - wall) > 300) {
    console.log(`[sponsored ${preset}] no screencast frame near ${name}`);
    return;
  }
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${name}.jpg`), Buffer.from(best.data, 'base64'));
  console.log(`[sponsored ${preset}] ${name}: frame Δ${Math.round(best.wall - wall)} ms`);
}

type Sample = {t: number, wall: number, tick: boolean, receipt: boolean, phase: string, take: boolean, counts: Record<string, string>, chips: number, beat: string};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__rx40: Probe};
    w.__rx40 = {samples: []};
    const visible = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      let opacity = 1;
      for (let node: Element | null = el; node !== null && node !== document.body; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        opacity *= Number(cs.opacity);
      }
      const r = el.getBoundingClientRect();
      return opacity > 0.3 && r.width > 1 && r.height > 1;
    };
    const sample = (tick: boolean) => {
      const receipt = document.querySelector('[data-sit-receipt]');
      const counts: Record<string, string> = {};
      for (const card of Array.from(document.querySelectorAll<HTMLElement>('[data-sit-receipt] [data-receipt-card]'))) {
        counts[card.dataset.receiptCard ?? '?'] = card.dataset.receiptCount ?? '';
      }
      w.__rx40.samples.push({
        t: performance.now(),
        wall: Date.now(),
        tick,
        receipt: visible(receipt),
        phase: document.querySelector('[data-table-receipt]')?.getAttribute('data-receipt-phase') ?? '',
        take: visible(document.querySelector('.con-extdraw')),
        counts,
        chips: Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => visible(el)).length,
        // The director's own state on the section root — what the sitting is doing between the take and the receipt.
        beat: (() => {
          const root = document.querySelector('.con-parl');
          const intake = (window as unknown as {__conIntakeDiag?: () => {activeRuns: number, episodes: Array<{role: string, phase: string}>}}).__conIntakeDiag?.();
          const step = document.querySelector('[data-sit-zone-step]') === null ? '' : ' step';
          const runs = intake === undefined || intake.activeRuns === 0 ? '' : ` intake:${intake.activeRuns}[${intake.episodes.map((e) => `${e.role}:${e.phase}`).join(',')}]`;
          return `${root?.getAttribute('data-sitting-page') ?? ''}/${root?.getAttribute('data-sitting-motion') ?? ''}/${root?.getAttribute('data-sitting-beat') ?? ''}${step}${runs}`;
        })(),
      });
      if (w.__rx40.samples.length > 16000) {
        w.__rx40.samples.splice(0, 2000);
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ['style', 'class', 'data-receipt-phase', 'data-receipt-count']});
    window.setInterval(() => sample(true), 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__rx40: Probe}).__rx40);

test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__rx40?: Probe, __conReady?: () => unknown};
    return {samples: w.__rx40?.samples.slice(-16000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('sponsored-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('sponsored-probe', {path: file, contentType: 'application/json'});
  }
});

/** Bring the sitting to its take: the announce, the verdict's A (red over the API), the take standing in the stage. */
/** Boot the table ONE PASS before its sitting (the soft gates): red has passed, blue holds its action menu. */
async function toTheTake(page: Page, request: APIRequestContext, fixture: 'parliament-sponsored-assembly' | 'parliament-sponsored-eight', query: string): Promise<{playerId: string, red: string}> {
  const {playerId, seats} = await bootFixtureSeats(page, request, fixture, {query});
  const red = seats[1];
  await armLeakWitness(page);
  return {playerId, red};
}

for (const preset of PRESETS) {
  test.describe(`Sponsored Projects (RX40) · the receipt of the table · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test(`the vote panel reads both payouts before A — the draw and the cards it would feed (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'parliament-sponsored-vote', {query: preset.query});
      await armLeakWitness(page);
      await openParliament(page);
      await expect(page.locator(`.con-parl__slot[data-instance="${SPONSORED_INSTANCE}"] .pcard`), 'Sponsored Projects stands in the voting area').toHaveCount(1);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      await expect(block.locator('[data-yield-effect="draw"]'), 'the line of the draw').toHaveCount(1);
      await expect(block.locator('[data-yield-effect="resources"]'), 'the line of the cards — a payout that asks nobody').toHaveCount(1);
      // …and the cards it would feed, each with its change, and the points: Fish 2 → 3 moves its points by one
      // (Arklight 4 → 5 does not — a point per two animals).
      const holders = page.locator('[data-parl-vote-holders]');
      await expect(holders, 'the line of the holders').toHaveAttribute('data-parl-vote-holders-count', '4');
      await expect(holders).toHaveAttribute('data-parl-vote-holders-vp', '1');
      expect(await holders.locator('[data-parl-vote-holder]').evaluateAll((els) => els.map((e) => e.getAttribute('data-parl-vote-holder'))), 'in play order').toEqual(RECEIVERS);
      await expectParliamentFits(page, `${preset.id} vote`);
      await shoot(page, preset.id, '01-vote-panel');
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    });

    test(`the take first, then the receipt: four faces, a token per card from the law's «?» onto its own face, in turn; the results «on 4 cards» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(720_000);
      const {playerId, red} = await toTheTake(page, request, 'parliament-sponsored-assembly', preset.query);
      const before = await wireOf(request, playerId);
      expect(resourcesOn(before.thisPlayer.tableau, 'Fish'), 'Fish holds 2').toBe(2);
      expect(resourcesOn(before.thisPlayer.tableau, 'Birds'), 'Birds holds nothing').toBe(0);
      const hand = before.thisPlayer.cardsInHandNbr;

      await armProbe(page);
      const cast = await recordFrames(page);
      // The pass carries the whole sitting — up to the take of this seat.
      await enterSittingByPass(page, request, playerId);

      // ① THE TAKE stands INSIDE the stage's own zone — two cards (influence 2), withheld until taken.
      const take = page.locator('.con-extdraw');
      await expect(take, 'the take surface is on screen').toHaveCount(1, {timeout: 90_000});
      expect(await page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw').count(), 'in the stage\'s zone').toBe(1);
      await expect(page.locator('.con-extdraw .con-cards__slot'), 'two cards').toHaveCount(2, {timeout: 20_000});
      await waitSittingAtRest(page, 20_000).catch(() => undefined);
      await shoot(page, preset.id, '02-take-in-stage');
      await armTransferWitness(page);
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-extdraw').count() === 0, {tries: 6, settleMs: 1800}),
        'B collects the whole take').toBe(true);

      // ② THE RECEIPT stands in the same zone once the take has left — four faces, Birds (at 0) is not one.
      const receipt = page.locator('[data-sit-receipt]');
      await expect(receipt, 'the receipt of the table stands').toHaveCount(1, {timeout: 30_000});
      await expect(receipt.locator('[data-receipt-card]')).toHaveCount(4);
      expect(await receipt.locator('[data-receipt-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-receipt-card'))), 'the counted cards, in play order').toEqual(RECEIVERS);
      expect(await receipt.locator('[data-receipt-card="Fish"]').getAttribute('data-receipt-kind')).toBe('animal');
      expect(await receipt.locator('[data-receipt-card="Dirigibles"]').getAttribute('data-receipt-kind')).toBe('floater');
      expect(await receipt.locator('[data-receipt-card="Supercomputer"]').getAttribute('data-receipt-kind')).toBe('data');
      // The receipt leaves by itself once every token has landed.
      await expect(receipt, 'the receipt leaves when the wave has landed').toHaveCount(0, {timeout: 30_000});

      const probe = await readProbe(page);
      const ticks = probe.samples.filter((s) => s.tick);
      {
        let lastKey = '';
        const lines: Array<string> = [];
        ticks.forEach((s) => {
          const key = `${s.beat} rc:${s.receipt ? 1 : 0} ph:${s.phase} take:${s.take ? 1 : 0} chips:${s.chips} ${Object.entries(s.counts).map(([k, v]) => `${k}=${v}`).join(',')}`;
          if (key !== lastKey) {
            lines.push(`${Math.round(s.t)} ${key}`);
            lastKey = key;
          }
        });
        console.log(`[sponsored ${preset.id}] ${lines.join(' | ')}`);
      }
      // THE TAKE FIRST: never a sample with the receipt and the take both on screen.
      expect(probe.samples.filter((s) => s.receipt && s.take).length, 'the receipt never stands under the take').toBe(0);
      // …AND NO DEAD TIME after it: the receipt stands as soon as the take's cards are in the hand (the take's beats
      // once outlived their surface by the refusal grace — 1.5 s of an empty stage, PL-798).
      const enterAt = ticks.find((s) => s.phase === 'enter');
      const lastIntake = enterAt === undefined ? undefined : ticks.filter((s) => s.t < enterAt.t && s.beat.includes(' intake:')).pop();
      if (enterAt !== undefined && lastIntake !== undefined) {
        expect(enterAt.t - lastIntake.t, `the receipt stands right after the take's cards land (intake end ${Math.round(lastIntake.t)} → receipt ${Math.round(enterAt.t)})`).toBeLessThan(800);
      }
      const firstReceipt = ticks.findIndex((s) => s.receipt);
      expect(firstReceipt, 'the receipt was painted').toBeGreaterThanOrEqual(0);

      // ③ THE TOKENS: one per card, born on the law's «?» cube, landing on ITS card's face.
      const witness = await transferWitness(page);
      console.log(`[sponsored ${preset.id}] ${transferTrail(witness)}`);
      expect(endsOverGlass(witness), 'no end of a flight over glass').toEqual([]);
      const receiptLandings = witness.landings.filter((end) => end.under.startsWith('receipt:'));
      expect(receiptLandings.map((end) => end.under).sort(), 'a token landed on each receiving face').toEqual(RECEIVERS.map((c) => `receipt:${c}`).sort());
      const births = witness.births.filter((b) => receiptLandings.some((l) => l.id === b.id));
      expect(births.every((b) => b.under === 'law-wild' || b.under === 'hero'), `every token is born on the law's printed «?» (births: ${births.map((b) => b.under).join(', ')})`).toBe(true);
      expect(births.some((b) => b.under === 'law-wild'), 'born on the printed «?» itself').toBe(true);
      // IN TURN: the faces are reached in the ladder's order (the play order), the whole wave within ~1.5 s. The ORDER is
      // the claim, never ms-distinct stamps: the wave's 55 ms steps (`transferWaveDelayMs` at the functional pace) are
      // wall-clock delays, and a 4K software-raster frame on CI outlasts all of them — every token is then born in ONE
      // painted frame and lands in one (CI run 40255070349: 4385 · 4385 · 4386 ms), a stagger no frame could have shown.
      // Ties are what a starved frame makes; an inversion would be a wave out of turn.
      const touchOf = (card: string): number => {
        const end = receiptLandings.find((l) => l.under === `receipt:${card}`)!;
        return end.touched ?? end.t;
      };
      const ladder = RECEIVERS.map(touchOf);
      ladder.slice(1).forEach((t, i) => {
        expect(t, `${RECEIVERS[i + 1]} is reached no earlier than ${RECEIVERS[i]} (ladder ${ladder.map(Math.round).join(' · ')})`)
          .toBeGreaterThanOrEqual(ladder[i] - 5);
      });
      const touches = [...ladder].sort((a, b) => a - b);
      expect(touches[touches.length - 1] - touches[0], 'the wave lands within 1.5 s').toBeLessThan(1500);
      // THE COUNT TICKS ON ITS OWN TOUCHDOWN: a face shows its «after» only from its token's contact on — never before.
      const witnessT0 = await page.evaluate(() => (window as unknown as {__transferWitness?: {t0: number}}).__transferWitness?.t0 ?? 0);
      for (const card of RECEIVERS) {
        const shown = probe.samples.filter((s) => s.counts[card] !== undefined);
        const values = Array.from(new Set(shown.map((s) => s.counts[card])));
        expect(values.length, `${card}'s face ticked exactly once (${values.join(' → ')})`).toBe(2);
        const tickedAt = shown.find((s) => s.counts[card] === values[1])!.t;
        const landing = receiptLandings.find((end) => end.under === `receipt:${card}`)!;
        const touchedAt = witnessT0 + (landing.touched ?? landing.t);
        expect(tickedAt, `${card} ticks on its own token's touchdown, not before (tick ${Math.round(tickedAt)} · touch ${Math.round(touchedAt)})`).toBeGreaterThanOrEqual(touchedAt - 40);
      }

      // THE STORYBOARD (4K on the GPU): the receipt before the wave, the wave in the air, the read.
      const at = (pick: (s: Sample) => boolean) => ticks.find(pick);
      const enter = at((s) => s.receipt && (s.phase === 'impulse' || s.phase === 'present'));
      // The wave in the AIR: every token born, the first already well on its way (at two the second is still on the «?»).
      const air = at((s) => s.receipt && s.phase === 'pay' && s.chips >= RECEIVERS.length);
      const read = at((s) => s.receipt && s.phase === 'read');
      await cast.stop();
      for (const [sample, name] of [[enter, '03-receipt-before-wave'], [air, '04-receipt-wave'], [read, '04b-receipt-read']] as const) {
        if (sample !== undefined) {
          writeFrameAt(cast.frames, sample.wall, preset.id, name);
        }
      }

      // ④ THE RESULTS and the server's truth.
      await expect.poll(() => sittingStage(page), {timeout: 180_000, message: 'the walk reaches the results'}).toBe('results');
      await expect(page.locator('[data-sit-results-hidden]'), 'the results card revealed by its own beat').toHaveCount(0, {timeout: 30_000});
      await waitSittingAtRest(page, 20_000);
      const blue = before.thisPlayer.color;
      const blueRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${blue}"]`);
      await expect(blueRow.locator('[data-sit-part-each]'), 'blue: the resources «on 4 cards»').toHaveAttribute('data-sit-part-each-count', '4');
      await expectParliamentFits(page, `${preset.id} results`);
      await shoot(page, preset.id, '06-results');
      const end = await wireOf(request, playerId);
      expect(end.thisPlayer.cardsInHandNbr, 'the take: +2 cards').toBe(hand + 2);
      for (const [card, after] of [['Arklight', 5], ['Fish', 3], ['Dirigibles', 2], ['Supercomputer', 4], ['Birds', 0]] as const) {
        expect(resourcesOn(end.thisPlayer.tableau, card), `${card} after the law`).toBe(after);
      }
      const redWire = await wireOf(request, red);
      expect(resourcesOn(redWire.thisPlayer.tableau, 'Pets'), 'red\'s Pets: its own payout').toBe(2);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      await closeSitting(page, request, playerId);
      await closeSittingAs(request, red);
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    });

    test(`eight receiving faces read in ONE row inside the pane — nothing cut, nothing scrolled (${preset.id})`, async ({page, request}) => {
      test.setTimeout(480_000);
      const {playerId} = await toTheTake(page, request, 'parliament-sponsored-eight', preset.query);
      // The pass carries the whole sitting — up to the take of this seat.
      await enterSittingByPass(page, request, playerId);
      await expect(page.locator('.con-extdraw'), 'the take').toHaveCount(1, {timeout: 90_000});
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-extdraw').count() === 0, {tries: 6, settleMs: 1800}), 'taken').toBe(true);
      const receipt = page.locator('[data-sit-receipt]');
      await expect(receipt.locator('[data-receipt-card]'), 'eight faces').toHaveCount(8, {timeout: 30_000});
      // ONE ROW, inside the pane: every face's box within the pane's, all on one line.
      await expect.poll(async () => receipt.evaluate((pane) => {
        const box = pane.getBoundingClientRect();
        const faces = Array.from(pane.querySelectorAll('[data-receipt-card]')).map((el) => el.getBoundingClientRect());
        const inside = faces.every((r) => r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1);
        const oneRow = faces.every((r) => Math.abs(r.top - faces[0].top) < 2);
        return inside && oneRow ? 'fits' : `faces ${faces.map((r) => `${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`).join(' ')} in ${Math.round(box.left)},${Math.round(box.top)}-${Math.round(box.right)},${Math.round(box.bottom)}`;
      }), {timeout: 10_000, message: 'eight faces in one row inside the pane'}).toBe('fits');
      // EVERY FACE WITH ITS PICTURE: the art was warmed at the seed, so the faces paint it while the pane opens —
      // never a row of empty art windows over the payout (the first 1080 frame had three).
      const artFrom = Date.now();
      const warmAtMount = await receipt.locator('[data-receipt-card] .pcard__art--ready').count();
      await expect.poll(async () => receipt.evaluate((pane) => Array.from(pane.querySelectorAll<HTMLImageElement>('[data-receipt-card] .pcard__art img'))
        .filter((img) => img.complete && img.naturalWidth > 0).length), {timeout: 4_000, message: 'every receipt face paints its art'}).toBe(8);
      console.log(`[sponsored ${preset.id}] receipt art: ${warmAtMount}/8 warm at mount, all 8 painted ${Date.now() - artFrom} ms after the row fitted`);
      await shoot(page, preset.id, '05-receipt-eight');
      await expect(receipt, 'the receipt leaves').toHaveCount(0, {timeout: 30_000});
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    });
  });
}
