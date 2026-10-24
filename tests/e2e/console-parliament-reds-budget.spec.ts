import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, pressUntil, settle} from './consoleStart';
import {
  armLeakWitness, closeSitting, enterSittingByPass, expectParliamentFits, openParliament, sittingStage, strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * REDS BUDGET (Turmoil Redux, RX39) — the ONE e2e of the card: the last budget assembled from shipped parts (the levy of
 * RX15, a two-tag count) and the second DEED a law hands the seats — a STEP OF THE CAREER for everyone, MarsBot's
 * included (decisions D3 + D11). Two profiles (standard-1080 · tv4k), one journey each:
 *
 *   PART 1 · THE VOTE (`parliament-reds-budget-vote`): the face prints the step as the CAREER INSIGNIA; the panel reads
 *   the levy at the head of the money's plate, the breakdown by the two printed tags (the asteroid lies face down), the
 *   NET at its tail (−10 + 4 = −6), the CAREER as a row of its own — blue's next node «② · +1 TR» and the win's two —
 *   and the ledger's bot chip carrying the STEP alone.
 *
 *   PART 2 · THE SITTING (`parliament-reds-budget-bot`, a NEUTRAL winner — no winner's step, so each marker walks the
 *   law's step alone; blue first):
 *   ① the levy's «−10» leaves the rail and only then the «+4» comes back — the money before the Career;
 *   ② the law's printed insignia answers (the impulse), and only then blue's marker leaves 1 for 2 — the TR token flies
 *   off the step to the rail and the rating ticks on its touchdown;
 *   ③ then — never at the same time — the bot's marker 6 → 7, the band naming its «+1 M€» instead of a card;
 *   ④ the results: three parts for blue (levy · payout · step), ONE for the bot (its step).
 *   Server truth: blue's TR +1, M€ 15 − 10 + 4 = 9; Agenda 2 and 7; the bot's M€ +1 and nothing else.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; the frame claims are made on the TASK samples only.
 * Screens and the storyboard under screenshots/parliament-reds-budget/<profile>/ (the 4K storyboard is trusted on the
 * GPU only — `TM_E2E_GPU=1`).
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-reds-budget');
const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;
const BUDGET_ID = 'RDX_REDS_REDS_BUDGET';
const BUDGET_INSTANCE = `${BUDGET_ID}#0`;
const BUDGET_CLASS = /rdx-reds-reds-budget/;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Outcome = {player: string, step: string, part?: string, kind: string, amount?: number, owed?: number, count?: number, influence?: number,
  reason?: string, before?: number, after?: number, tr?: number, megacredits?: number, walk?: {from: number, to: number, steps: Array<{to: number, bonus?: string}>}};
type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number},
  players: Array<{color: string, megacredits: number, terraformRating: number, isMarsBot?: boolean}>,
  game: {generation: number, parliament: {players: Array<{color: string, agenda: number}>, phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const outcomesOf = (wire: Wire): Array<Outcome> => wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? [];
const agendaOf = (wire: Wire, color: string): number => wire.game.parliament.players.find((p) => p.color === color)?.agenda ?? -1;

type CastFrame = {wall: number, data: string};

/** A CDP screencast — a frame of a short scene is picked AFTER the fact, at the moment the probe named (never chased from Node). */
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

/** Write the recorded frame nearest a moment the probe named. */
function writeFrameAt(frames: ReadonlyArray<CastFrame>, wall: number, preset: string, name: string): boolean {
  let best: CastFrame | undefined;
  for (const frame of frames) {
    if (best === undefined || Math.abs(frame.wall - wall) < Math.abs(best.wall - wall)) {
      best = frame;
    }
  }
  if (best === undefined || Math.abs(best.wall - wall) > 300) {
    return false;
  }
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${name}.jpg`), Buffer.from(best.data, 'base64'));
  // The frame's distance from the probe's moment — a short beat (the impulse) is honest only within a few frames.
  console.log(`[reds ${preset}] ${name}: frame Δ${Math.round(best.wall - wall)} ms`);
  return true;
}

type Chip = {id: string, x: number, y: number, dir: string, amt: string, rating: boolean};
type Sample = {
  t: number,
  wall: number,
  /** A TASK sample (setInterval) — the only kind a claim about painted frames is made on. */
  tick: boolean,
  stage: string,
  /** The law's walk now playing: whose, and its phase (`impulse` · `walk` · `landed`) — the band's own witness. */
  careerSeat: string, careerPhase: string,
  /** The step each seat's REAL cube is drawn on (visible, not hidden under the proxy); -1 = none drawn. */
  blueStep: number, botStep: number,
  /** The walk's proxy is in flight. */
  proxy: boolean,
  /** The insignia on the carried card is mid-impulse (a transform on it). */
  insignia: boolean,
  /** The insignia's painted width (0 = none) — the storyboard takes the impulse's frame at its widest. */
  insW: number,
  chips: Array<Chip>,
  tr: string, mc: string,
  /** The band's bonus chip of the step (`tr` · `card` · `megacredits`) — the bot's «+1 M€» reads here. */
  bandBonus: string,
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page, colors: {blue: string, bot: string}): Promise<void> {
  await page.evaluate((c) => {
    const w = window as unknown as {__rx39: Probe};
    w.__rx39 = {samples: []};
    const visible = (el: HTMLElement | null): boolean => {
      if (el === null) {
        return false;
      }
      let opacity = 1;
      for (let node: HTMLElement | null = el; node !== null && node !== document.body; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        opacity *= Number(cs.opacity);
      }
      const r = el.getBoundingClientRect();
      return opacity > 0.5 && r.width > 1 && r.height > 1;
    };
    const stepOf = (color: string): number => {
      for (let step = 0; step <= 12; step++) {
        const cube = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${color}"]`);
        if (cube !== null && !cube.classList.contains('con-parl__agenda-cube--hidden') && visible(cube)) {
          return step;
        }
      }
      return -1;
    };
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = (tick: boolean) => {
      const band = document.querySelector<HTMLElement>('[data-parl-band-zone]');
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        return {id: `${el.dataset.transferId ?? '?'}`, x: r.left + r.width / 2, y: r.top + r.height / 2, dir: el.dataset.transferDirection ?? 'gain',
          amt: el.textContent?.trim() ?? '', rating: el.querySelector('.resource_icon--rating') !== null};
      });
      const insignia = document.querySelector<HTMLElement>('[data-parl-sit-hero] .pcard-ic[style*="agenda-step"], [data-parl-gov-carry] .pcard-ic[style*="agenda-step"]');
      w.__rx39.samples.push({
        t: performance.now(),
        wall: Date.now(),
        tick,
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        careerSeat: band?.getAttribute('data-parl-career-seat') ?? '',
        careerPhase: band?.getAttribute('data-parl-career-phase') ?? '',
        blueStep: stepOf(c.blue),
        botStep: stepOf(c.bot),
        proxy: visible(document.querySelector<HTMLElement>('.con-parl__flight--agenda')),
        insignia: insignia !== null && insignia.style.transform !== '' && insignia.style.transform !== 'none',
        insW: insignia === null ? 0 : insignia.getBoundingClientRect().width,
        chips,
        tr: text(document.querySelector('.con-res .con-score__value--tr')),
        mc: (text(document.querySelector('.con-res__row--megacredits .con-res__digits')).match(/^-?\d+/) ?? [''])[0],
        bandBonus: Array.from(document.querySelectorAll('[data-parl-band-chip="agenda"] [data-parl-band-bonus]')).map((el) => el.getAttribute('data-parl-band-bonus') ?? '?').join(','),
      });
      if (w.__rx39.samples.length > 14000) {
        w.__rx39.samples.splice(0, 2000);
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-parl-career-phase', 'data-parl-career-seat']});
    window.setInterval(() => sample(true), 16);
  }, colors);
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__rx39: Probe}).__rx39);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__rx39?: Probe, __conReady?: () => unknown};
    return {samples: w.__rx39?.samples.slice(-14000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('reds-budget-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('reds-budget-probe', {path: file, contentType: 'application/json'});
  }
});

function tracksOf(samples: ReadonlyArray<Sample>): Array<Array<{i: number, c: Chip}>> {
  const tracks = new Map<string, Array<{i: number, c: Chip}>>();
  samples.forEach((s, i) => {
    for (const c of s.chips) {
      const track = tracks.get(c.id) ?? [];
      track.push({i, c});
      tracks.set(c.id, track);
    }
  });
  return Array.from(tracks.values());
}

/** The LANDING sample of a chip: the first sample from which it stays AT REST where it ends. */
function landingIndex(track: ReadonlyArray<{i: number, c: Chip}>, slack = 1): number {
  const end = track[track.length - 1].c;
  let rest = track.length - 1;
  while (rest > 0 && Math.hypot(track[rest - 1].c.x - end.x, track[rest - 1].c.y - end.y) <= slack) {
    rest--;
  }
  return track[rest].i;
}

for (const preset of PRESETS) {
  test.describe(`Reds Budget (RX39) · a step of the Career for every seat, the bot's included · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test(`the vote reads the net, the two tags and blue's next node; the sitting pays the money first, then walks blue's marker after the insignia, then the bot's — in turn (${preset.id})`, async ({page, request}) => {
      test.setTimeout(720_000);

      // ════════════════ PART 1 · THE VOTE ════════════════
      {
        await bootFixtureSeats(page, request, 'parliament-reds-budget-vote', {query: preset.query});
        await armLeakWitness(page);
        await openParliament(page);
        const face = page.locator(`.con-parl__slot[data-instance="${BUDGET_INSTANCE}"] .pcard`);
        await expect(face, 'Reds Budget stands in the voting area').toHaveCount(1);
        await expect(face).toHaveClass(BUDGET_CLASS);
        expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX39');
        await expect(face.locator('.pcard__mech .pcard-mi--mc').first(), 'the negative is printed INSIDE the tile').toHaveText('−10');
        await expect(face.locator('.pcard__mech .pcard-ic[style*="agenda-step"]'), 'the step is the CAREER INSIGNIA, never a star').toHaveCount(1);
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
        await settle(page, {timeoutMs: 15_000});
        const block = page.locator('[data-parl-vote-yield]');
        await expect(block, 'the levy + tag count → M€ block').toHaveCount(1);
        await expect(block.locator('[data-yield-levy]'), 'the levy at the HEAD of the money\'s plate').toHaveAttribute('data-yield-levy-paid', '10');
        await expect(block.locator('[data-yield-in="tag:space"]').first(), 'the breakdown by tag: space (the asteroid face down)').toHaveText('2');
        await expect(block.locator('[data-yield-in="tag:mars"]').first(), '…and Mars').toHaveText('1');
        await expect(block.locator('[data-yield-net-line]'), 'the NET at the tail: −10 + 4 = −6').toHaveAttribute('data-yield-net-amount', '-6');
        // THE CAREER — its own row, never in the net: blue's next node (② · +1 TR) and the win's two steps.
        const career = page.locator('[data-parl-vote-career]');
        await expect(career, 'the Career row').toHaveCount(1);
        await expect(career).toHaveAttribute('data-agenda-next', '2');
        await expect(career).toHaveAttribute('data-agenda-gift', 'tr');
        await expect(career).toHaveAttribute('data-agenda-win-steps', '2');
        await expect(career.locator('.career-step-glyph'), 'the row leads with the insignia').toHaveCount(1);
        // THE LEDGER: blue's chip (the net, then the step) and the BOT's — the step alone.
        const ledger = page.locator('[data-parl-vote-ledger-row]');
        await expect(ledger, 'the ledger of outcomes').toHaveCount(1);
        const botChip = ledger.locator('[data-ledger-seat]:not([data-ledger-you])');
        await expect(botChip, 'the bot\'s chip stands').toHaveCount(1);
        await expect(botChip.locator('[data-ledger-part]'), 'the step alone — never a payout').toHaveCount(1);
        await expect(botChip.locator('[data-ledger-part="career"]')).toHaveCount(1);
        await expect(ledger.locator('[data-ledger-you] [data-ledger-part="career"]'), 'blue\'s chip carries the step too').toHaveCount(1);
        await expectParliamentFits(page, `${preset.id} vote`);
        await shoot(page, preset.id, '01-vote-net-career-bot');
        await shoot(page, preset.id, '02-face-insignia');
        expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      }

      // ════════════════ PART 2 · THE SITTING ════════════════
      // The table stands ONE PASS before its sitting (the soft gates): the bot has passed, blue holds its action menu.
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-reds-budget-bot', {query: preset.query});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      const bot = before.players.find((p) => p.color !== blue)!;
      expect(agendaOf(before, blue), 'blue on Agenda 1').toBe(1);
      expect(agendaOf(before, bot.color), 'the bot on Agenda 6').toBe(6);

      // ── THE PASS — the whole chain runs by itself (nothing asks; the bot is never asked).
      await armProbe(page, {blue, bot: bot.color});
      const cast = await recordFrames(page);
      await enterSittingByPass(page, request, playerId);

      // ── THE RECORDS, in the seat order: blue's levy · payout · step, then the bot's step alone.
      await expect.poll(async () => outcomesOf(await wireOf(request, playerId)).filter((o) => o.kind !== 'reaction')
        .map((o) => `${o.player === blue ? 'blue' : 'bot'}:${o.step}`).join(','), {timeout: 60_000, message: 'the enactment is recorded'})
        .toBe('blue:levy,blue:megacredits,blue:agenda,bot:agenda');
      const records = outcomesOf(await wireOf(request, playerId)).filter((o) => o.kind !== 'reaction');
      expect(records[0]).toMatchObject({kind: 'stock', amount: -10, owed: 10, before: 15, after: 5});
      expect(records[1]).toMatchObject({kind: 'stock', amount: 4, count: 3, influence: 1, before: 5, after: 9});
      expect(records[2]).toMatchObject({kind: 'agenda', walk: {from: 1, to: 2, steps: [{to: 2, bonus: 'tr'}]}, tr: 1});
      expect(records[3]).toMatchObject({kind: 'agenda', walk: {from: 6, to: 7, steps: [{to: 7, bonus: 'card'}]}, megacredits: 1});

      // ── THE WALK reaches the results by itself (the reward's wave, the Career beat, the renewal).
      await expect.poll(() => sittingStage(page), {timeout: 180_000, message: 'the walk reaches the results'}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      await cast.stop();
      const probe = await readProbe(page);
      const ticks = probe.samples.filter((s) => s.tick);
      {
        let lastKey = '';
        const lines: Array<string> = [];
        ticks.forEach((s) => {
          const key = `${s.stage} seat:${s.careerSeat} ph:${s.careerPhase} b:${s.blueStep} r:${s.botStep} px:${s.proxy ? 1 : 0} ins:${s.insignia ? 1 : 0} tr:${s.tr} mc:${s.mc} bb:${s.bandBonus}`;
          if (key !== lastKey) {
            lines.push(`${Math.round(s.t)} ${key}`);
            lastKey = key;
          }
        });
        console.log(`[reds ${preset.id}] ${lines.join(' | ')}`);
      }
      const at = (pick: (s: Sample) => boolean, from = 0) => ticks.findIndex((s, i) => i >= from && pick(s));

      // ① THE MONEY FIRST: «−10» leaves the rail, only then «+4» comes back.
      const loss = tracksOf(probe.samples).find((tr) => tr[0].c.dir === 'loss' && tr[0].c.amt.includes('10'));
      const gain = tracksOf(probe.samples).find((tr) => tr[0].c.dir !== 'loss' && tr[0].c.amt.includes('+4'));
      expect(loss, `the levy's «−10» flew (chips: ${tracksOf(probe.samples).map((tr) => `${tr[0].c.dir}:${tr[0].c.amt}`).join(' · ')})`).toBeDefined();
      expect(gain, 'the payout\'s «+4» flew').toBeDefined();
      expect(gain![0].i, 'the payout left the card only once the levy had landed — in turn').toBeGreaterThan(landingIndex(loss!));

      // ② BLUE'S STEP: the impulse first, the marker 1 → 2 after it, the TR token off the step after the landing.
      const blueImpulse = at((s) => s.careerSeat === blue && s.careerPhase === 'impulse');
      expect(blueImpulse, 'the law\'s insignia answered before blue\'s marker left').toBeGreaterThanOrEqual(0);
      expect(blueImpulse > 0 && ticks[blueImpulse - 1].blueStep, 'blue\'s marker is HELD on its old step until the impulse (the walk owes it)').toBe(1);
      const blueOnTwo = at((s) => s.blueStep === 2);
      expect(blueOnTwo, 'blue\'s marker lands on 2').toBeGreaterThan(blueImpulse);
      expect(ticks.slice(0, blueImpulse).some((s) => s.blueStep === 2), 'never on 2 before the impulse').toBe(false);
      const blueWalk = at((s) => s.careerSeat === blue && s.careerPhase === 'walk');
      expect(blueWalk, 'the walk starts after the impulse').toBeGreaterThan(blueImpulse);
      const rating = tracksOf(probe.samples).find((tr) => tr[0].c.rating);
      expect(rating, 'the step\'s TR token flew off the track to the rail').toBeDefined();
      const ratingBirth = rating![0].i;
      const blueOnTwoSample = probe.samples.indexOf(ticks[blueOnTwo]);
      expect(ratingBirth, 'the TR token is born only once the marker has LOCKED on 2').toBeGreaterThanOrEqual(blueOnTwoSample - 2);
      const trBefore = ticks[blueImpulse].tr;
      const trAfter = ticks[ticks.length - 1].tr;
      expect(Number(trAfter), 'the rating ticked by one').toBe(Number(trBefore) + 1);
      const impulseSample = probe.samples.indexOf(ticks[blueImpulse]);
      const tickedAt = probe.samples.findIndex((s, i) => i > impulseSample && s.tr === trAfter);
      expect(tickedAt, 'the rating ticks only once its token has flown, never before it').toBeGreaterThan(ratingBirth);

      // ③ THE BOT'S STEP: after blue's walk has landed — never two markers at once — with «+1 M€» named in the band.
      const blueLanded = at((s) => s.careerSeat === blue && s.careerPhase === 'landed');
      const botImpulse = at((s) => s.careerSeat === bot.color && s.careerPhase === 'impulse');
      expect(botImpulse, 'the bot\'s step is played').toBeGreaterThanOrEqual(0);
      expect(botImpulse, 'the bot\'s step starts after blue\'s landed').toBeGreaterThan(blueLanded);
      const botOnSeven = at((s) => s.botStep === 7);
      expect(botOnSeven, 'the bot\'s marker lands on 7 after its impulse').toBeGreaterThan(botImpulse);
      expect(ticks.slice(0, botImpulse).some((s) => s.botStep === 7), 'never on 7 before its impulse').toBe(false);
      expect(ticks.some((s) => s.careerSeat === bot.color && s.bandBonus.includes('megacredits')), 'the band names the bot\'s «+1 M€» instead of a card').toBe(true);
      // THE STORYBOARD: the insignia's impulse at its PEAK (half the impulse in), each marker MID-GLIDE (halfway between
      // the proxy's birth — the lead still lights its segment there — and the landing), blue on 2 with the TR token.
      const nearest = (t: number) => ticks.reduce((best, s, i) => Math.abs(s.t - t) < Math.abs(ticks[best].t - t) ? i : best, 0);
      const midway = (from: number, to: number) => from < 0 || to < 0 ? -1 : nearest((ticks[from].t + ticks[to].t) / 2);
      const blueAir = midway(at((s) => s.careerSeat === blue && s.proxy, blueWalk), blueOnTwo);
      const botAir = midway(at((s) => s.careerSeat === bot.color && s.proxy, botImpulse), botOnSeven);
      const impulsePeak = ticks.reduce((best, s, i) => s.careerSeat === blue && s.careerPhase === 'impulse' && s.insW > ticks[best].insW ? i : best, blueImpulse);
      console.log(`[reds ${preset.id}] the insignia: ${Math.round(ticks[Math.max(0, blueImpulse - 1)].insW)} px at rest → ${Math.round(ticks[impulsePeak].insW)} px at the impulse's peak`);
      const frames: Array<[number, string]> = [[impulsePeak, '03a-insignia-impulse'], [blueAir, '03b-blue-marker-in-the-air'],
        [blueOnTwo + 3, '03c-blue-on-2-tr-token'], [botAir, '04a-bot-marker-in-the-air'], [botOnSeven + 3, '04b-bot-on-7-megacredits']];
      for (const [index, name] of frames) {
        if (index >= 0 && index < ticks.length && !writeFrameAt(cast.frames, ticks[index].wall, preset.id, name)) {
          console.log(`[reds ${preset.id}] no screencast frame near ${name}`);
        }
      }

      // ④ THE RESULTS: three parts for blue, ONE for the bot.
      await expect(page.locator('[data-sit-results-hidden]'), 'the results card revealed by its own beat').toHaveCount(0, {timeout: 30_000});
      await waitSittingAtRest(page, 20_000);
      const blueRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${blue}"]`);
      await expect(blueRow.locator('[data-sit-part]'), 'blue: levy · payout · step').toHaveCount(3);
      await expect(blueRow.locator('[data-sit-part-walk]')).toHaveAttribute('data-sit-part-walk-to', '2');
      await expect(blueRow.locator('[data-sit-part-tr]'), 'the step\'s TR').toHaveCount(1);
      const botRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${bot.color}"]`);
      await expect(botRow.locator('[data-sit-part]'), 'the bot: its step — nothing else').toHaveCount(1);
      await expect(botRow.locator('[data-sit-part-walk]')).toHaveAttribute('data-sit-part-walk-to', '7');
      await expect(botRow.locator('[data-sit-part-megacredits]'), 'the bot\'s card step read as 1 M€').toHaveText('+1');
      await expectParliamentFits(page, `${preset.id} results`);
      await shoot(page, preset.id, '06-results');

      // ── SERVER TRUTH.
      const end = await wireOf(request, playerId);
      expect(end.thisPlayer.terraformRating, 'blue: +1 TR from the step').toBe(before.thisPlayer.terraformRating + 1);
      expect(end.thisPlayer.megacredits, 'blue: 15 − 10 + 4').toBe(9);
      expect(agendaOf(end, blue)).toBe(2);
      expect(agendaOf(end, bot.color)).toBe(7);
      expect(end.players.find((p) => p.color === bot.color)?.megacredits, 'the bot: never levied, never paid — the card step\'s 1 M€ alone').toBe(bot.megacredits + 1);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      await closeSitting(page, request, playerId);
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    });
  });
}
