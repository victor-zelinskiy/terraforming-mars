import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, commitFocusedSpace, crumbText, fetchPlayerModel, openConsole, placementState, press, pressUntil, settle, walkToSpace,
} from './consoleStart';
import {
  armLeakWitness, closeSitting, enterSittingByPass, expectParliamentFits, hotVerb, openParliament, parliament, parliamentWire, sittingStage,
  sittingStep, strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * MARS FIRST BUDGET (Turmoil Redux, RX38) — the ONE e2e of the card: the sixth budget assembled from shipped parts
 * (the levy of RX15, a two-tag count), the tile grant's SECOND variant (a city for EVERY seat by the usual rules,
 * clockwise from the first player) and the first grant MarsBot takes a seat of (decision D11 — the tile, never the
 * money). Two profiles (standard-1080 · tv4k), one journey each:
 *
 *   PART 1 · THE VOTE (`parliament-marsfirst-budget-vote`): the panel reads the levy at the head of the money's
 *   plate, the breakdown by the two printed tags («[building] 2 + [Mars] 1 + [influence] 0»), the NET at its tail,
 *   the CITY as a row of its own — «any legal space», no star, no line — with Mars First's answer beside it
 *   (+1 steel · +1 card), and the ledger's bot chip carrying the TILE alone.
 *
 *   PART 2 · THE SITTING (`parliament-marsfirst-budget-bot`, blue first, blue wins):
 *   ① the levy's «−12» leaves the rail and only then the «+4» comes back — the money before the city;
 *   ② the city: the board opens on blue's own question, the dossier of a cell with a printed bonus names the
 *   bonus and the ruling party's answer; the landing; +1 steel and a card for blue;
 *   ③ the bot's city lands on the board blue SEES — after blue's own landing, never in the same frame — on the
 *   cell its rule names (the one beside all three greeneries);
 *   ④ the results: four parts for blue (levy · payout · city · the party's steel), ONE for the bot (its city).
 *   Server truth: one city each, blue's money −12 + 4 (+ the cell's own payout), the bot's money untouched.
 *
 *   PART 3 · THE BOT FIRST (`parliament-marsfirst-budget-botfirst`, PL-764): the bot's city is placed by the law in the
 *   very response that asks blue for its own. The sitting plays blue's money first, then STEPS ASIDE for the bot's city
 *   (the world beat) — the remote landing flies on the board blue sees, blue's own placement stays shut behind its door
 *   the whole time — and comes back for blue's door «К полю». Never a landing degraded by a long read at the door.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF. Screens under screenshots/parliament-marsfirst-budget/<profile>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-marsfirst-budget');
const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;
const BUDGET_ID = 'RDX_MARS_MARS_FIRST_BUDGET';
const BUDGET_INSTANCE = `${BUDGET_ID}#0`;
const BUDGET_CLASS = /rdx-mars-mars-first-budget/;
/** TileType (`common/TileType`). */
const GREENERY = 0;
const CITY = 2;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Outcome = {player: string, step: string, part?: string, kind: string, amount?: number, owed?: number, count?: number, influence?: number, space?: string,
  stackHeight?: number, reason?: string, party?: string, stock?: string, before?: number, after?: number};
type WireSpace = {id: string, x: number, y: number, spaceType: string, bonus: Array<number>, tileType?: number, color?: string};
type Wire = {
  thisPlayer: {color: string, megacredits: number, steel: number, citiesCount: number, cardsInHandNbr: number},
  players: Array<{color: string, megacredits: number, citiesCount: number, isMarsBot?: boolean}>,
  game: {generation: number, phase: string, spaces: Array<WireSpace>,
    parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
  waitingFor?: {type?: string, spaces?: Array<string>, placementType?: string, placementContext?: {source?: {kind: string, resolution?: string}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const outcomesOf = (wire: Wire): Array<Outcome> => wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? [];

/** The board's own geometry, read off the DOM: every cell's centre — two cells are neighbours when their centres are one hex apart. */
async function neighboursOf(page: Page, ids: ReadonlyArray<string>): Promise<Record<string, Array<string>>> {
  return await page.evaluate((wanted) => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>('.board-space[data_space_id]')).map((el) => {
      const r = el.getBoundingClientRect();
      return {id: el.getAttribute('data_space_id') ?? '', x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width};
    }).filter((c) => c.w > 2);
    const out: Record<string, Array<string>> = {};
    for (const id of wanted) {
      const me = cells.find((c) => c.id === id);
      if (me === undefined) {
        out[id] = [];
        continue;
      }
      out[id] = cells.filter((c) => c.id !== id && Math.hypot(c.x - me.x, c.y - me.y) < me.w * 1.25).map((c) => c.id);
    }
    return out;
  }, [...ids]);
}

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
  return true;
}

type Chip = {id: string, x: number, y: number, dir: string, amt: string};
type Sample = {
  t: number,
  /** WALL clock, so a sample can be matched against a screencast frame's own timestamp. */
  wall: number,
  stage: string, step: string, chips: Array<Chip>, mc: string, steel: string,
  /** A remote tile stage proxy is in the air (another seat's tile landing on this screen). */
  remote: boolean,
  /** The bot's cell already PAINTS a city (a class of the real cell — the moment the city is on the board). */
  botCity: boolean, blueCity: boolean, placing: string, band: string,
  /** A received-cards reveal / the deck-draw scene stands over the board. */
  reveal: boolean, deckdraw: boolean, parl: boolean,
  /** Diagnostics of the bot's cell: its tile element's classes and effective opacity. */
  botCell: string,
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page, cells: {bot: string, blue: string}): Promise<void> {
  await page.evaluate((c) => {
    const w = window as unknown as {__mfbProbe: Probe};
    w.__mfbProbe = {samples: []};
    // PAINTED, not merely present: a held cell keeps its tile element (art suppressed) until the remote proxy lands,
    // so the witness reads the hold's class, the opacity chain and the visibility of the tile it finds.
    const cityOn = (id: string) => {
      const cell = document.querySelector<HTMLElement>(`.board-space[data_space_id="${id}"]`);
      const tile = cell?.querySelector<HTMLElement>('[class*="board-space-tile--city"]') ?? null;
      // A cell HELD for a remote landing keeps the committed tile under `--placement-cleared` (its art suppressed).
      if (cell === null || tile === null || tile.classList.contains('board-space-tile--placement-cleared')) {
        return false;
      }
      let opacity = 1;
      for (let el: HTMLElement | null = tile; el !== null && el !== document.body; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        opacity *= Number(cs.opacity);
      }
      const r = tile.getBoundingClientRect();
      return opacity > 0.5 && r.width > 2 && r.height > 2;
    };
    const sample = () => {
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        return {id: `${el.dataset.transferId ?? '?'}`, x: r.left + r.width / 2, y: r.top + r.height / 2, dir: el.dataset.transferDirection ?? 'gain', amt: el.textContent?.trim() ?? ''};
      });
      const digits = (row: string) => ((document.querySelector(`.con-res__row--${row} .con-res__digits`)?.textContent?.trim() ?? '').match(/^-?\d+/) ?? [''])[0];
      w.__mfbProbe.samples.push({
        t: performance.now(),
        wall: Date.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        step: document.querySelector('.con-sit')?.getAttribute('data-sit-step') ?? '',
        chips,
        mc: digits('megacredits'),
        steel: digits('steel'),
        remote: document.querySelector('.con-tileplace__tile--remote') !== null,
        botCity: cityOn(c.bot),
        blueCity: cityOn(c.blue),
        placing: document.querySelector('.con-board--placing') !== null ? 'placing' : '',
        band: (document.querySelector('.con-band__line')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
        botCell: (() => {
          const cell = document.querySelector<HTMLElement>(`.board-space[data_space_id="${c.bot}"]`);
          const tile = cell?.querySelector<HTMLElement>('[class*="board-space-tile"]') ?? null;
          if (tile === null) {
            return 'none';
          }
          let op = 1;
          for (let el: HTMLElement | null = tile; el !== null && el !== document.body; el = el.parentElement) {
            op *= Number(getComputedStyle(el).opacity);
          }
          return `${tile.className.replace(/\s+/g, '.')} op:${op.toFixed(2)}`;
        })(),
        reveal: document.querySelector('.con-reveal') !== null,
        deckdraw: document.querySelector('.con-deckdraw') !== null,
        parl: document.querySelector('.con-parl') !== null,
      });
      if (w.__mfbProbe.samples.length > 12000) {
        w.__mfbProbe.samples.splice(0, 2000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step']});
    window.setInterval(sample, 16);
  }, cells);
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__mfbProbe: Probe}).__mfbProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__mfbProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__mfbProbe?.samples.slice(-12000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('marsfirst-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('marsfirst-probe', {path: file, contentType: 'application/json'});
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

/** The LANDING frame of a chip: the first sample from which it stays AT REST where it ends. */
function landingIndex(track: ReadonlyArray<{i: number, c: Chip}>, slack = 1): number {
  const end = track[track.length - 1].c;
  let rest = track.length - 1;
  while (rest > 0 && Math.hypot(track[rest - 1].c.x - end.x, track[rest - 1].c.y - end.y) <= slack) {
    rest--;
  }
  return track[rest].i;
}

for (const preset of PRESETS) {
  test.describe(`Mars First Budget (RX38) · the city for every seat, the bot's included · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test(`the vote reads the net, the two tags, the city with the party's answer and the bot's tile; the sitting pays the money first, then blue's city, then the bot's — every beat in turn (${preset.id})`, async ({page, request}) => {
      test.setTimeout(720_000);

      // ════════════════ PART 1 · THE VOTE ════════════════
      {
        await bootFixtureSeats(page, request, 'parliament-marsfirst-budget-vote', {query: preset.query});
        await armLeakWitness(page);
        await openParliament(page);
        const face = page.locator(`.con-parl__slot[data-instance="${BUDGET_INSTANCE}"] .pcard`);
        await expect(face, 'Mars First Budget stands in the voting area').toHaveCount(1);
        await expect(face).toHaveClass(BUDGET_CLASS);
        expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX38');
        await expect(face.locator('.pcard__mech .pcard-mi--mc').first(), 'the negative is printed INSIDE the tile').toHaveText('−12');
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
        await settle(page, {timeoutMs: 15_000});
        const block = page.locator('[data-parl-vote-yield]');
        await expect(block, 'the levy + tag count → M€ block').toHaveCount(1);
        const levy = block.locator('[data-yield-levy]');
        await expect(levy, 'the levy at the HEAD of the money\'s plate').toHaveCount(1);
        await expect(levy).toHaveAttribute('data-yield-levy-paid', '12');
        await expect(block.locator('[data-yield-in="tag:building"]').first(), 'the breakdown by tag: building').toHaveText('2');
        await expect(block.locator('[data-yield-in="tag:mars"]').first(), '…and Mars').toHaveText('1');
        await expect(block.locator('[data-yield-net-line]'), 'the NET at the tail: −12 + 3 = −9').toHaveAttribute('data-yield-net-amount', '-9');
        // THE CITY — its own row, never in the net: any legal space, no star, no line; Mars First's answer beside it.
        const grant = page.locator('[data-parl-vote-grant]');
        await expect(grant, 'the city row').toHaveCount(1);
        const grantRoot = grant.locator('[data-tile-grant]').or(page.locator('[data-parl-vote-grant][data-tile-grant]'));
        await expect(grantRoot.first()).toHaveAttribute('data-grant-placement', 'any-legal');
        await expect(grantRoot.first()).toHaveAttribute('data-grant-eligibility', 'everyone');
        await expect(page.locator('[data-parl-vote-grant] .con-tgrant__tile--base'), 'no city to stack on').toHaveCount(0);
        await expect(page.locator('[data-parl-vote-grant] [data-grant-answer]'), 'Mars First\'s answer beside the city').toHaveAttribute('data-grant-answer-party', 'Mars First');
        // THE LEDGER: blue's chip (the net, then the tile) and the BOT's — the tile alone.
        const ledger = page.locator('[data-parl-vote-ledger-row]');
        await expect(ledger, 'the ledger of outcomes').toHaveCount(1);
        const botChip = ledger.locator('[data-ledger-seat]:not([data-ledger-you])');
        await expect(botChip, 'the bot\'s chip stands').toHaveCount(1);
        await expect(botChip.locator('[data-ledger-part]'), 'the tile alone — never a payout').toHaveCount(1);
        await expect(botChip.locator('[data-ledger-part="tile"]')).toHaveCount(1);
        await expect(ledger.locator('[data-ledger-you] [data-ledger-part="tile"]'), 'blue\'s chip carries the city too').toHaveCount(1);
        await expectParliamentFits(page, `${preset.id} vote`);
        await shoot(page, preset.id, '01-vote-net-city-answer-bot');
        expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      }

      // ════════════════ PART 2 · THE SITTING ════════════════
      // The table stands ONE PASS before its sitting (the soft gates): the bot has passed, blue holds its action menu.
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-marsfirst-budget-bot', {query: preset.query});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      const bot = before.players.find((p) => p.color !== blue)!;
      // THE BOARD AS IT STANDS: the bot's site is the one cell beside all three nobody's greeneries; blue's cell is a
      // free cell with a printed bonus, nowhere near the bot's site and beside no ocean cell (an honest, legible payout).
      const greeneries = before.game.spaces.filter((s) => s.tileType === GREENERY && s.color === undefined).map((s) => s.id);
      expect(greeneries, 'the fixture\'s three greeneries').toHaveLength(3);
      const free = before.game.spaces.filter((s) => s.spaceType === 'land' && s.tileType === undefined).map((s) => s.id);
      const near = await neighboursOf(page, [...free, ...greeneries]);
      const site = free.find((id) => greeneries.every((g) => near[g]?.includes(id)));
      expect(site, 'the bot\'s site — the cell beside all three greeneries').toBeDefined();
      const oceans = new Set(before.game.spaces.filter((s) => s.spaceType === 'ocean').map((s) => s.id));
      // A cell whose printed bonus asks nothing (titanium · steel · plants · heat — SpaceBonus 0 · 1 · 2 · 4), steel first.
      const plain = (id: string) => {
        const space = before.game.spaces.find((s) => s.id === id)!;
        return space.bonus.length > 0 && space.bonus.every((b) => [0, 1, 2, 4].includes(b)) && id !== site && !(near[site!] ?? []).includes(id) &&
          !(near[id] ?? []).some((n) => oceans.has(n) || n === site || (near[site!] ?? []).includes(n));
      };
      const blueCell = free.find((id) => plain(id) && before.game.spaces.find((s) => s.id === id)!.bonus.includes(1)) ?? free.find(plain);
      expect(blueCell, 'a bonus cell for blue, away from the bot\'s site').toBeDefined();
      const bonus = before.game.spaces.find((s) => s.id === blueCell)!.bonus;

      // ── THE PASS — the effects run by themselves (the bot is never asked).
      await armProbe(page, {bot: site!, blue: blueCell!});
      await enterSittingByPass(page, request, playerId);
      await shoot(page, preset.id, '02-sitting-up');

      // ── ① THE MONEY FIRST: −12, then +4 (building 2 + Mars 1 + influence 1) — recorded before the city is asked.
      await expect.poll(async () => {
        const mine = outcomesOf(await wireOf(request, playerId)).filter((o) => o.player === blue);
        return mine.map((o) => o.step).join(',');
      }, {timeout: 60_000, message: 'blue\'s levy and payout are recorded'}).toBe('levy,megacredits');
      const money = outcomesOf(await wireOf(request, playerId)).filter((o) => o.player === blue);
      expect(money[0]).toMatchObject({kind: 'stock', amount: -12, owed: 12, before: 20, after: 8});
      expect(money[1]).toMatchObject({kind: 'stock', amount: 4, count: 3, influence: 1, before: 8, after: 12});
      expect(outcomesOf(await wireOf(request, playerId)).filter((o) => o.player === bot.color), 'the bot waits for its place in the order').toEqual([]);

      // ── ② THE CITY: blue's own question — a door on the reward page or the board straight away; either way the board ends live.
      await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type, {timeout: 60_000, message: 'blue\'s city is asked'}).toBe('space');
      const ask = (await wireOf(request, playerId)).waitingFor!;
      expect(ask.placementType).toBe('city');
      expect(ask.placementContext?.source).toMatchObject({kind: 'resolution', resolution: BUDGET_ID});
      expect(ask.spaces, 'the cells of the ordinary rules').toContain(blueCell);
      // The walk plays first (Agenda · support · enactment · the reward's wave) — the money's chips are read once
      // the UI stands at the city, never on the server's clock.
      // (the server's POSITION reads «placement» from the enactment on — the DOOR is the reward page's, after the wave)
      await expect.poll(async () => (await sittingStage(page) === 'reward' && await sittingStep(page) === 'placement' &&
        /К полю|Onto the board/i.test(await hotVerb(page))) || await placementState(page) !== 'none', {timeout: 120_000,
        message: 'the city\'s door (or the board) stands'}).toBe(true);
      let probe = await readProbe(page);
      const loss = tracksOf(probe.samples).find((tr) => tr[0].c.dir === 'loss' && tr[0].c.amt.includes('12'));
      const gain = tracksOf(probe.samples).find((tr) => tr[0].c.dir !== 'loss' && tr[0].c.amt.includes('+4'));
      expect(loss, `the levy's «−12» flew (chips: ${tracksOf(probe.samples).map((tr) => `${tr[0].c.dir}:${tr[0].c.amt}`).join(' · ')})`).toBeDefined();
      expect(gain, 'the payout\'s «+4» flew').toBeDefined();
      expect(gain![0].i, 'the payout left the card only once the levy had landed — in turn').toBeGreaterThan(landingIndex(loss!));
      if (await placementState(page) === 'none') {
        await settle(page, {timeoutMs: 20_000});
        expect(await hotVerb(page), 'the door\'s verb').toMatch(/К полю|Onto the board/i);
        expect((await crumbText(page)).toUpperCase()).toMatch(/РАЗМЕЩЕНИЕ|PLACEMENT/);
        await shoot(page, preset.id, '03-door');
        await press(page, 'Enter', 800);
      }
      await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the board is live'}).not.toBe('none');
      await settle(page, {timeoutMs: 20_000});
      await walkToSpace(page, blueCell!);
      await settle(page, {timeoutMs: 15_000});
      // THE DOSSIER of a bonus cell names what the cell pays and the RULING PARTY's answer (Mars First rules since the enactment).
      const dossier = async () => (await page.locator('.con-context').innerText().catch(() => '')).replace(/\s+/g, ' ');
      await expect.poll(dossier, {timeout: 15_000, message: 'the dossier names Mars First\'s answer'}).toMatch(/Марс вперёд|Mars First/i);
      await shoot(page, preset.id, '04-city-dossier');
      const steel = (await wireOf(request, playerId)).thisPlayer.steel;
      const hand = (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr;
      const blueLandingAt = (await readProbe(page)).samples.length;
      const cast = await recordFrames(page);
      expect(await commitFocusedSpace(page), 'the city is placed through the standard two-press flow').toBe(true);

      // ── The landing; Mars First's card arrives as the reveal scene — A takes it.
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.citiesCount, {timeout: 30_000}).toBe(1);
      const mid = await wireOf(request, playerId);
      const printedSteel = bonus.filter((b) => b === 1).length; // SpaceBonus.STEEL = 1
      expect(mid.thisPlayer.steel, 'the printed steel + the ruling Mars First\'s one').toBe(steel + printedSteel + 1);
      const revealSlots = page.locator('.con-reveal [data-zoom-slot]');
      await expect.poll(async () => await revealSlots.count(), {timeout: 40_000, message: 'the party\'s card is presented'}).toBeGreaterThan(0);
      await shoot(page, preset.id, '05-party-card');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal').count() === 0, {tries: 6, settleMs: 1500}), 'take the card').toBe(true);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, {timeout: 30_000}).toBe(hand + 1);

      // ── ③ THE BOT'S CITY: on the cell its rule names, recorded AFTER blue's, and LANDING on the board blue sees.
      const afterBlue = await wireOf(request, playerId);
      const records = outcomesOf(afterBlue).filter((o) => o.kind !== 'reaction');
      expect(records.map((o) => `${o.player === blue ? 'blue' : 'bot'}:${o.step}`), 'blue\'s three parts, then the bot\'s city').toEqual(
        ['blue:levy', 'blue:megacredits', 'blue:city', 'bot:city']);
      expect(records[3]).toMatchObject({kind: 'city', part: 'effect', space: site});
      expect(afterBlue.game.spaces.find((s) => s.id === site)?.tileType, 'a city on the bot\'s site').toBe(CITY);
      // The bot's city PAINTS on the board blue sees (any sample since blue's commit — the sitting may already be back).
      await expect.poll(async () => (await readProbe(page)).samples.some((s, i) => i >= blueLandingAt && s.botCity), {
        timeout: 60_000, message: 'the bot\'s city paints on the board blue sees',
      }).toBe(true);
      probe = await readProbe(page);
      const from = (i0: number, pick: (s: Sample) => boolean) => probe.samples.findIndex((s, i) => i >= i0 && pick(s));
      const blueAt = from(blueLandingAt, (s) => s.blueCity);
      const botAt = from(blueLandingAt, (s) => s.botCity);
      const remoteAt = from(blueLandingAt, (s) => s.remote);
      const awayAt = from(blueLandingAt, (s) => !s.parl);
      const backAt = awayAt < 0 ? -1 : from(awayAt, (s) => s.parl);
      {
        let lastKey = '';
        const lines: Array<string> = [];
        probe.samples.slice(Math.max(0, blueLandingAt), botAt + 200).forEach((s) => {
          const key = `blue:${s.blueCity ? 1 : 0} bot:${s.botCity ? 1 : 0} remote:${s.remote ? 1 : 0} reveal:${s.reveal ? 1 : 0} deck:${s.deckdraw ? 1 : 0} parl:${s.parl ? 1 : 0} cell:${s.botCell}`;
          if (key !== lastKey) {
            lines.push(`${Math.round(s.t)} ${key}`);
            lastKey = key;
          }
        });
        console.log(`[marsfirst ${preset.id}] ${lines.join(' | ')}`);
      }
      expect(blueAt, 'blue\'s city painted').toBeGreaterThanOrEqual(0);
      expect(botAt, 'the bot\'s city painted after blue\'s — never in the same frame').toBeGreaterThan(blueAt);
      // NEVER ONE FRAME: the remote proxy flies BEFORE the bot's cell paints its city (the cell is held until the touchdown).
      expect(remoteAt, 'the bot\'s city flew in through the remote landing stage').toBeGreaterThanOrEqual(0);
      expect(remoteAt, 'the proxy flew before the cell painted').toBeLessThanOrEqual(botAt);
      // IN TURN: the bot's flight never shares the screen with blue's own card arriving (the deal, the reveal)…
      expect(probe.samples.slice(blueLandingAt).filter((s) => s.remote && (s.deckdraw || s.reveal)).length,
        'the bot\'s city never flies under blue\'s card from the ruling party').toBe(0);
      // …and lands on the board the sitting stepped aside for — the sitting comes back only after it.
      expect(backAt < 0 || backAt > botAt, `the sitting came back only once the bot's city had landed (back ${backAt}, bot ${botAt})`).toBe(true);
      // THE STORYBOARD of the two cities, picked after the fact at the moments the probe named: blue's city down, the
      // party's card coming off the deck, the bot's city in the air (the cell still held), the bot's city down.
      await cast.stop();
      const deckAt = from(blueAt, (s) => s.deckdraw);
      const midFlight = Math.min(botAt - 1, remoteAt + Math.max(1, Math.floor((botAt - remoteAt) / 2)));
      const frames: Array<[number, string]> = [[blueAt, '05a-blue-city-landed'], [deckAt, '05b-party-card-dealt'],
        [midFlight, '05c-bot-city-in-the-air'], [Math.min(probe.samples.length - 1, botAt + 2), '05d-bot-city-landed']];
      for (const [index, name] of frames) {
        if (index >= 0) {
          expect(writeFrameAt(cast.frames, probe.samples[index].wall, preset.id, name), `a frame of ${name}`).toBe(true);
        }
      }
      await shoot(page, preset.id, '06-after-bot-city');

      // ── ④ THE RESULTS: four parts for blue, ONE for the bot.
      await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
      await expect.poll(() => sittingStage(page), {timeout: 120_000, message: 'the walk reaches the results'}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      await expect(page.locator('[data-sit-results-hidden]'), 'the results card revealed by its own beat').toHaveCount(0, {timeout: 30_000});
      await waitSittingAtRest(page, 20_000);
      const blueRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${blue}"]`);
      await expect(blueRow.locator('[data-sit-part]'), 'blue: levy · payout · city · the party\'s steel').toHaveCount(4);
      await expect(blueRow.locator('[data-sit-part="city"]')).toHaveCount(1);
      const botRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${bot.color}"]`);
      await expect(botRow.locator('[data-sit-part]'), 'the bot: its city — nothing else').toHaveCount(1);
      await expect(botRow.locator('[data-sit-part="city"]')).toHaveCount(1);
      await expectParliamentFits(page, `${preset.id} results`);
      await shoot(page, preset.id, '07-results');

      // ── SERVER TRUTH: one city each; blue's money −12 + 4 (+ what its cell paid); the bot's money untouched.
      const end = await wireOf(request, playerId);
      expect(end.thisPlayer.citiesCount).toBe(1);
      expect(end.players.find((p) => p.color === bot.color)?.citiesCount, 'the bot\'s one city').toBe(1);
      expect(end.thisPlayer.megacredits, 'blue: 20 − 12 + 4 — the cell paid no money').toBe(12);
      expect(end.players.find((p) => p.color === bot.color)?.megacredits, 'the bot: never levied, never paid, no Failed Action').toBe(bot.megacredits);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      await closeSitting(page, request, playerId);
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    });

    test(`PL-764 · the bot FIRST: the sitting steps aside for the bot's city BEFORE blue's door, and blue's tile waits behind it (${preset.id})`, async ({page, request}) => {
      test.setTimeout(600_000);
      // The load door lists the seats in GENERATION order — the bot first here — so the viewer is found, never assumed.
      const {seats} = await bootFixtureSeats(page, request, 'parliament-marsfirst-budget-botfirst', {query: preset.query});
      const seatWires = await Promise.all(seats.map(async (id) => ({id, wire: await wireOf(request, id)})));
      const playerId = seatWires.find((s) => s.wire.players.find((p) => p.color === s.wire.thisPlayer.color)?.isMarsBot !== true)!.id;
      if (playerId !== seats[0]) {
        await openConsole(page, playerId, preset.query);
        await settle(page, {timeoutMs: 20_000});
      }
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      const bot = before.players.find((p) => p.color !== blue)!;
      const greeneries = before.game.spaces.filter((s) => s.tileType === GREENERY && s.color === undefined).map((s) => s.id);
      expect(greeneries, 'the fixture\'s three greeneries').toHaveLength(3);
      const free = before.game.spaces.filter((s) => s.spaceType === 'land' && s.tileType === undefined).map((s) => s.id);
      const near = await neighboursOf(page, [...free, ...greeneries]);
      const site = free.find((id) => greeneries.every((g) => near[g]?.includes(id)));
      expect(site, 'the bot\'s site — the cell beside all three greeneries').toBeDefined();

      // ── THE PASS: the law runs — the bot's city FIRST (its place in the order), then blue is asked for its own.
      await armProbe(page, {bot: site!, blue: '__none__'});
      const cast = await recordFrames(page);
      await enterSittingByPass(page, request, playerId);
      await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type, {timeout: 60_000, message: 'blue\'s city is asked'}).toBe('space');
      const asked = await wireOf(request, playerId);
      const order = outcomesOf(asked).filter((o) => o.kind !== 'reaction').map((o) => `${o.player === blue ? 'blue' : 'bot'}:${o.step}`);
      // The seat loop walks the order: the bot's whole part (its city) first, then blue's money — all before blue is asked.
      // The SCREEN reads the printed order — the money (everyone's), then the cities clockwise: blue's wave, then the
      // bot's city, then blue's door.
      expect(order, 'the bot\'s city, then blue\'s money — recorded before blue is asked').toEqual(['bot:city', 'blue:levy', 'blue:megacredits']);
      expect(outcomesOf(asked).find((o) => o.player === bot.color)).toMatchObject({kind: 'city', part: 'effect', space: site});

      // ── THE WORLD BEAT: the bot's city paints on the board the sitting stepped aside for…
      await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.botCity), {
        timeout: 120_000, message: 'the bot\'s city paints on the board blue sees',
      }).toBe(true);
      // …and the sitting comes back for blue's own door.
      await expect.poll(async () => await sittingStage(page) === 'reward' && await sittingStep(page) === 'placement' &&
        /К полю|Onto the board/i.test(await hotVerb(page)), {timeout: 90_000, message: 'the sitting is back on blue\'s door'}).toBe(true);
      await cast.stop();
      const probe = await readProbe(page);
      const from = (i0: number, pick: (s: Sample) => boolean) => probe.samples.findIndex((s, i) => i >= i0 && pick(s));
      const botAt = from(0, (s) => s.botCity);
      const remoteAt = from(0, (s) => s.remote);
      // «Away» is counted from the sitting's rise — the samples before the pass are the board home, not a step aside.
      const upAt = from(0, (s) => s.parl);
      const awayAt = upAt < 0 ? -1 : from(upAt, (s) => !s.parl);
      const backAt = awayAt < 0 ? -1 : from(awayAt, (s) => s.parl);
      {
        let lastKey = '';
        const lines: Array<string> = [];
        probe.samples.forEach((s) => {
          const key = `stage:${s.stage}/${s.step} bot:${s.botCity ? 1 : 0} remote:${s.remote ? 1 : 0} placing:${s.placing || '-'} parl:${s.parl ? 1 : 0}`;
          if (key !== lastKey) {
            lines.push(`${Math.round(s.t)} ${key}`);
            lastKey = key;
          }
        });
        console.log(`[marsfirst botfirst ${preset.id}] ${lines.join(' | ')}`);
      }
      // THE MONEY FIRST: blue's −12 and +4 have landed before the sitting steps aside (the seat's own wave, then the world).
      const loss = tracksOf(probe.samples).find((tr) => tr[0].c.dir === 'loss' && tr[0].c.amt.includes('12'));
      const gain = tracksOf(probe.samples).find((tr) => tr[0].c.dir !== 'loss' && tr[0].c.amt.includes('+4'));
      expect(loss, 'the levy\'s «−12» flew').toBeDefined();
      expect(gain, 'the payout\'s «+4» flew').toBeDefined();
      expect(awayAt, 'the sitting stepped aside for the bot\'s city').toBeGreaterThan(landingIndex(gain!));
      // THE BOT'S CITY FLIES on the board in view — the proxy before the cell paints, both while the sitting is away.
      expect(remoteAt, 'the bot\'s city flew in through the remote landing stage').toBeGreaterThan(awayAt);
      expect(remoteAt, 'the proxy flew before the cell painted').toBeLessThanOrEqual(botAt);
      expect(backAt, `the sitting came back only once the bot's city had landed (back ${backAt}, bot ${botAt})`).toBeGreaterThan(botAt);
      // BLUE'S DOOR STAYED SHUT while the sitting was away: its placement never went live under the bot's landing.
      expect(probe.samples.slice(0, backAt).filter((s) => s.placing !== '').length, 'blue\'s placement never live before the door').toBe(0);
      const midFlight = Math.min(botAt - 1, remoteAt + Math.max(1, Math.floor((botAt - remoteAt) / 2)));
      for (const [index, name] of [[awayAt, '08a-botfirst-aside'], [midFlight, '08b-botfirst-bot-city-in-the-air'],
        [botAt + 2, '08c-botfirst-bot-city-landed'], [backAt + 2, '08d-botfirst-back-at-the-door']] as Array<[number, string]>) {
        // The storyboard is EVIDENCE, not the claim (the probe above is): a screencast under load may skip a moment.
        if (!writeFrameAt(cast.frames, probe.samples[Math.min(index, probe.samples.length - 1)].wall, preset.id, name)) {
          console.log(`[marsfirst botfirst ${preset.id}] no screencast frame near ${name}`);
        }
      }
      await settle(page, {timeoutMs: 20_000});
      expect((await crumbText(page)).toUpperCase()).toMatch(/РАЗМЕЩЕНИЕ|PLACEMENT/);
      await shoot(page, preset.id, '08e-botfirst-door');

      // ── BLUE'S CITY through its own door, then the results: blue four parts, the bot ONE.
      await press(page, 'Enter', 800);
      await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the board is live'}).not.toBe('none');
      await settle(page, {timeoutMs: 20_000});
      const ask = (await wireOf(request, playerId)).waitingFor!;
      const legal = (ask.spaces ?? []).filter((id) => id !== site && !(near[site!] ?? []).includes(id));
      const quiet = legal.find((id) => {
        const space = asked.game.spaces.find((s) => s.id === id);
        return space !== undefined && space.bonus.every((b) => [0, 1, 2, 4].includes(b));
      }) ?? legal[0];
      expect(quiet, 'a legal cell for blue').toBeDefined();
      await walkToSpace(page, quiet!);
      await settle(page, {timeoutMs: 15_000});
      expect(await commitFocusedSpace(page), 'blue\'s city is placed through the standard two-press flow').toBe(true);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.citiesCount, {timeout: 30_000}).toBe(1);
      const revealSlots = page.locator('.con-reveal [data-zoom-slot]');
      await expect.poll(async () => await revealSlots.count(), {timeout: 40_000, message: 'the party\'s card is presented'}).toBeGreaterThan(0);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal').count() === 0, {tries: 6, settleMs: 1500}), 'take the card').toBe(true);
      await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
      await expect.poll(() => sittingStage(page), {timeout: 120_000, message: 'the walk reaches the results'}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      await expect(page.locator('[data-sit-results-hidden]'), 'the results card revealed by its own beat').toHaveCount(0, {timeout: 30_000});
      const blueRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${blue}"]`);
      await expect(blueRow.locator('[data-sit-part]'), 'blue: levy · payout · city · the party\'s steel').toHaveCount(4);
      const botRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${bot.color}"]`);
      await expect(botRow.locator('[data-sit-part]'), 'the bot: its city — nothing else').toHaveCount(1);
      await shoot(page, preset.id, '08f-botfirst-results');
      const end = await wireOf(request, playerId);
      expect(end.players.find((p) => p.color === bot.color)?.citiesCount, 'the bot\'s one city').toBe(1);
      expect(end.players.find((p) => p.color === bot.color)?.megacredits, 'the bot: never levied, never paid').toBe(bot.megacredits);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      await closeSitting(page, request, playerId);
    });
  });
}
