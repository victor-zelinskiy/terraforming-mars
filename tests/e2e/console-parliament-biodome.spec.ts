import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, commitFocusedSpace, crumbText, fetchPlayerModel, openMandatoryAnnounce, openQuickWheel,
  openZoomViewer, placeTile, placementState, press, pressUntil, settle, waitForBoardHome, walkToSpace,
} from './consoleStart';
import {answerGateAs, turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * BIODOME CONTEST (Turmoil Redux, RX03) — «plants for everyone by influence +
 * the winner's own greenery with every consequence», end to end at the
 * console's real surface, on the three display profiles:
 *
 *   · the FACE: its own 3:2 art (RX03), the Greens' tree emblem, «2 [plants] /
 *     [influence]» and the greenery-with-oxygen symbol with the winner star,
 *     the two-greeneries quest;
 *   · the VOTE: the viewer's plants — «1 → +2» now, «2 → +4» if they win (the
 *     Agenda step first) — and, apart from everyone's numbers, the WINNER's
 *     block: «if you win» · greenery · oxygen 5 → 6 % · +2 TR; the fullscreen
 *     footer reads the same, the rules column the effect, the winner's part
 *     with its TR rule and the quest;
 *   · the ENACTMENT: the winner's greenery is an HONEST MANDATORY PROMPT (the
 *     plate names the resolution), A starts the STANDARD placement whose
 *     dossier names the resolution as its source and counts the Redux TR
 *     (tile + oxygen + the 8 % temperature step) and the Greens' M€; L3 opens
 *     the resolution with its FIXED recipient; the commit lands the tile, the
 *     0 °C ocean follows as its own placement, the other seat's plants land
 *     and the generation moves on — server truth checked at every step;
 *   · OXYGEN AT ITS MAXIMUM: the tile still lands for +1 TR, oxygen stays;
 *   · the RESULTS: the card moves into the government, the viewer's plants fly
 *     as ONE stock chip, the lines name the plants (with the influence) and the
 *     greenery (with its oxygen step); the enacted card's inspector reads the
 *     RECORD for each seat.
 *
 * Fixtures: `parliament-biodome-vote`, `parliament-biodome-enact` (blue's
 * placement stands, oxygen 7 %, temperature −2 °C), `parliament-biodome-maxed`
 * (oxygen 14 %), `parliament-biodome-recap` (generation 2, red won). Screens
 * under screenshots/parliament-biodome/<preset>/; `PARL_VIDEO=1` records.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-biodome');
const VIDEO = process.env.PARL_VIDEO === '1';
if (VIDEO) {
  test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});
}

const BIODOME_ID = 'RDX_GREENS_BIODOME_CONTEST';
const BIODOME_INSTANCE = `${BIODOME_ID}#0`;
const BIODOME_CLASS = /rdx-greens-biodome-contest/;
/** SpaceBonus.DRAW_CARD. */
const DRAW_CARD_BONUS = 3;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  // A recording run takes no stills: a screenshot pauses the screencast and leaves grey frames in the video.
  if (VIDEO) {
    return;
  }
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const parliament = (page: Page) => page.locator('.con-parl');

/** Open the Parliament from the wheel (RT → down). */
async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

type Outcome = {player: string, step: string, part?: string, kind: string, amount?: number, influence?: number, before?: number, after?: number, space?: string, stock?: string,
  parameter?: {id: string, before: number, after: number}, reason?: string};
type Wire = {
  thisPlayer: {color: string, plants: number, terraformRating: number, megacredits: number, cardsInHandNbr: number},
  game: {
    generation: number, phase: string, oxygenLevel: number, temperature: number, oceans: number,
    spaces: Array<{id: string, bonus: Array<number>, tileType?: number, color?: string}>,
    parliament: {enacted?: {resolution: string}, phase?: {step: string, pending?: {player: string, key: string, input?: string}, outcomes?: Array<Outcome>},
      lastPhase?: {outcomes?: Array<Outcome>}},
  },
  waitingFor?: {type?: string, spaces?: Array<string>, placementContext?: {source?: {kind: string, resolution?: string, name?: string}}},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** The readings a yield block prints, by context. */
const yieldReadings = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
  }));
}, scope);

/** The winner block's reading — every attribute a surface states. */
const winnerReading = (page: Page, scope: string) => page.evaluate((sel) => {
  const el = document.querySelector<HTMLElement>(`${sel}`);
  if (el === null) {
    return undefined;
  }
  return {
    context: el.getAttribute('data-winner-context'),
    tile: el.getAttribute('data-winner-tile'),
    recipient: el.getAttribute('data-winner-recipient'),
    before: el.getAttribute('data-winner-before'),
    after: el.getAttribute('data-winner-after'),
    tr: el.getAttribute('data-winner-tr'),
    skipped: el.getAttribute('data-winner-skipped'),
    caption: (el.querySelector('[data-winner-caption]')?.textContent ?? '').trim(),
    note: (el.querySelector('[data-winner-note]')?.textContent ?? '').trim(),
  };
}, scope);

/** Nothing of the workspace sticks out of the viewport and no block spills. */
async function expectFits(page: Page, label: string, rootSelector = '.con-parl'): Promise<void> {
  const problems = await page.evaluate((rootSel) => {
    const root = document.querySelector(rootSel);
    if (root === null) {
      return ['no root'];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__info, .con-parl__info-block, .con-parl__info-own, .con-parl__stage, .con-iyield, .con-iyield__reading, .con-wreward, .con-parl__recap-item, .con-zoom__bar';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(blocks))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`off-screen ${name(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') {
        out.push(`clipped-x ${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
      }
      if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY !== 'visible') {
        out.push(`clipped-y ${name(el)} ${el.scrollHeight}>${el.clientHeight}`);
      }
    }
    // The winner block's own parts never spill out of its plate, and its info block never cuts it.
    for (const plate of Array.from(root.querySelectorAll<HTMLElement>('.con-wreward'))) {
      const box = plate.getBoundingClientRect();
      for (const part of Array.from(plate.querySelectorAll<HTMLElement>('.con-wreward__head, .con-wreward__body, .con-wreward__note'))) {
        const r = part.getBoundingClientRect();
        if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1 || r.bottom > box.bottom + 1)) {
          out.push(`spill ${name(part)} ${Math.round(r.left)}..${Math.round(r.right)}/${Math.round(r.bottom)} outside ${Math.round(box.left)}..${Math.round(box.right)}/${Math.round(box.bottom)}`);
        }
      }
      const own = plate.closest('.con-parl__info-own-body, .con-zoom__bar');
      if (own !== null) {
        const o = own.getBoundingClientRect();
        if (box.bottom > o.bottom + 1 || box.right > o.right + 1) {
          out.push(`cut ${name(plate)} ${Math.round(box.right)},${Math.round(box.bottom)} outside ${name(own)} ${Math.round(o.right)},${Math.round(o.bottom)}`);
        }
      }
    }
    return out;
  }, rootSelector);
  expect(problems, `${label}: layout problems`).toEqual([]);
}

/** The mandatory plate reads WHOLE: no ellipsized line, inside the viewport. */
async function expectPlateReadsWhole(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const plate = document.querySelector<HTMLElement>('.con-mandatory');
    if (plate === null) {
      return ['no plate'];
    }
    const out: Array<string> = [];
    const r = plate.getBoundingClientRect();
    if (r.left < -1 || r.right > window.innerWidth + 1) {
      out.push(`off-screen plate ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    for (const el of Array.from(plate.querySelectorAll<HTMLElement>('.con-mandatory__kicker, .con-mandatory__ask, .con-mandatory__src-name'))) {
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`cut ${el.className} ${el.scrollWidth}>${el.clientWidth} «${el.textContent?.trim()}»`);
      }
    }
    return out;
  });
  expect(problems, `${label}: the plate does not read whole`).toEqual([]);
}

/** The dossier rows as the player reads them: label, value, the breakdown terms. */
const dossierRows = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-context .con-dossier-row')).map((row) => ({
  label: (row.querySelector('.con-dossier-row__title')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  value: (row.querySelector('.con-dossier-row__val')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  why: Array.from(row.querySelectorAll('.con-dossier-row__why-term')).map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim()),
  note: (row.querySelector('.con-dossier-row__note')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
})));

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

for (const preset of PRESETS) {
  test.describe(`Biodome Contest · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the face, the plants reading and the winner's own block in the vote and the fullscreen (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await page.addInitScript(() => window.localStorage.setItem('tm_console_card_numbers', '1'));
      await bootFixture(page, request, 'parliament-biodome-vote', {query: preset.query});
      await openParliament(page);

      // ── THE FACE: the art keyed by the code, the stamp (opted in), the Greens' emblem, the quest graphic.
      const face = page.locator(`.con-parl__slot[data-instance="${BIODOME_INSTANCE}"] .pcard`);
      await expect(face, 'Biodome Contest stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(/pcard--resolution-art/);
      await expect(face.locator('.pcard__code')).toHaveText('RX03');
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX03');
      await expect(face.locator('.pcard__party-emblem')).toHaveCount(1);
      await expect(face.locator('.pcard__quest-graphic')).toHaveCount(1);
      await shoot(page, preset.id, '01-overview');

      // ── THE VOTE MODE: the plants readings and, apart from them, the winner's block.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      // ONE NUMBER: influence 1 → +2 now; the winner's step (influence 2 → +4) rides it as «+2 if you win · step 3».
      expect(await yieldReadings(page, '[data-parl-vote-yield]'), 'the one reading').toEqual([
        {context: 'estimate', influence: '1', amount: '2'},
      ]);
      await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]'), 'the win\'s difference as a suffix').toHaveAttribute('data-parl-vote-suffix', '2');
      // The winner's tile is CONDITIONAL — the inspector's chip and its «for you» row, never a block on the panel.
      await expect(page.locator('[data-parl-vote-winner]'), 'no winner block on the panel').toHaveCount(0);
      await expectFits(page, `${preset.id} vote mode`);
      await shoot(page, preset.id, '02-vote-reading');

      // ── THE FULLSCREEN INSPECTOR: the same readings in the footer; the rules in words.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first()).toHaveClass(BIODOME_CLASS);
      expect((await yieldReadings(page, 'dialog.con-zoom[open] [data-zoom-yield]')).map((r) => r.amount)).toEqual(['2', '4']);
      expect(await winnerReading(page, 'dialog.con-zoom[open] [data-zoom-winner]')).toMatchObject({context: 'conditional', before: '5', after: '6', tr: '2'});
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules).toContainText(/Получите по 2 растения за каждое влияние|Gain 2 plants for every point of your influence/);
      await expect(rules).toContainText(/Бесплатно разместите озеленение|Place a greenery tile for free/);
      await expect(rules).toContainText(/1 РТ за сам тайл|1 TR for the tile itself/);
      await expect(rules).toContainText(/Разместите 2 озеленения|Place 2 greeneries/);
      // FOR YOU: the winner's reading in words — on the Deck the footer has no room for the chip, so this row is it.
      await expect(rules).toContainText(/Если победите: кислород 5 → 6 %; РТ \+2 \(за тайл \+1, за кислород \+1\)|If you win: oxygen 5 → 6 %; TR \+2 \(for the tile \+1, for oxygen \+1\)/);
      await expectFits(page, `${preset.id} fullscreen`, 'dialog.con-zoom[open]');
      await shoot(page, preset.id, '03-fullscreen');
      await closeZoomViewer(page);
    });

    test(`the enactment: the announced placement with its source, the Redux TR and the Greens in the dossier, the cascade, the other seat (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-biodome-enact', {query: preset.query, landing: 'prompt'});
      const before = await wireOf(request, playerId);
      expect(before.game.phase, 'the political phase stands').toBe('parliament');
      expect(before.waitingFor?.type, 'the winner\'s greenery is asked').toBe('space');
      expect(before.waitingFor?.placementContext?.source).toMatchObject({kind: 'resolution', resolution: BIODOME_ID});
      // The winner's own plants landed FIRST (influence 2 → +4), before the greenery is asked.
      const winnerPlants = before.game.parliament.phase?.outcomes?.find((o) => o.step === 'plants');
      expect(winnerPlants).toMatchObject({player: before.thisPlayer.color, part: 'effect', kind: 'stock', amount: 4, influence: 2});
      expect(winnerPlants!.after! - winnerPlants!.before!).toBe(4);
      expect(before.thisPlayer.plants, 'the supply holds exactly the recorded result').toBe(winnerPlants!.after);
      expect(before.game.parliament.phase?.outcomes, 'nothing else yet').toHaveLength(1);
      // The OTHER seat reads who is placing and what kind of answer.
      const red = seats[1];
      const redBefore = await wireOf(request, red);
      expect(redBefore.game.parliament.phase?.pending).toEqual({player: before.thisPlayer.color, key: 'greenery', input: 'space'});
      const redPlantsBefore = redBefore.thisPlayer.plants;

      // ── AN HONEST MANDATORY PROMPT FIRST: the plate names the resolution; the board stays calm until A.
      const plate = page.locator('.con-mandatory');
      // ONE announce per generation (Э3, law 1): the sitting's plate; the winner's placement is a STEP of
      // the reward stage (the stack yields to the board), never a plate of its own.
      await expect(plate, 'the sitting is announced on the board home').toHaveCount(1, {timeout: 30_000});
      await expect(plate.locator('.con-mandatory__kicker')).toHaveText(/Парламент|Parliament/i);
      expect(await placementState(page), 'no placement before the press').toBe('none');
      await expectPlateReadsWhole(page, `${preset.id} greenery plate`);
      await shoot(page, preset.id, '04-greenery-announce');
      expect(await openMandatoryAnnounce(page), 'A on the plate starts the placement').toBe(true);
      await expect.poll(async () => await placementState(page), {timeout: 30_000, message: 'the winner\'s greenery placement stands'}).not.toBe('none');
      await settle(page, {timeoutMs: 20_000});

      // ── THE DOSSIER names the resolution as the source and counts the whole Redux reward of the cell.
      const dossier = page.locator('.con-context');
      await expect(dossier.locator('.con-src__plate-name, .con-src__card'), 'the placement\'s source is the resolution').toHaveCount(1);
      // A legal cell with a CARD bonus — the lowest row's (the shared serpentine sweeps the rows below the
      // first ones in full; a top-row cell can sit past the lane's turn).
      const target = before.game.spaces
        .filter((s) => (before.waitingFor?.spaces ?? []).includes(s.id) && s.bonus.includes(DRAW_CARD_BONUS))
        .sort((a, b) => Number(b.id) - Number(a.id))[0];
      expect(target, 'a legal cell with a card bonus').toBeDefined();
      await walkToSpace(page, target!.id);
      await settle(page, {timeoutMs: 15_000});
      await expect.poll(async () => (await dossierRows(page)).some((r) => r.why.some((w) => /Тайл озеленения\s*\+1|Greenery tile\s*\+1/.test(w))), {
        timeout: 15_000, message: 'the TR row breaks down the greenery tile\'s own TR',
      }).toBe(true);
      const rows = await dossierRows(page);
      const tr = rows.find((r) => r.why.some((w) => /Тайл озеленения|Greenery tile/.test(w)));
      expect(tr?.why.length, `tile + oxygen + the 8 % temperature step (${JSON.stringify(rows)})`).toBe(3);
      const greens = rows.find((r) => /Зелёные|Greens/.test(r.label));
      expect(greens?.value, `the Greens pay 2 M€ per TR step (${JSON.stringify(rows)})`).toContain('6');
      await shoot(page, preset.id, '05-greenery-dossier');

      // ── L3 = THE SOURCE: the resolution's inspector with the FIXED recipient; closing it leaves the placement standing.
      await openZoomViewer(page, 'KeyC');
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]'), 'L3 opens the RESOLUTION inspector').toHaveCount(1);
      await expect(page.locator('dialog.con-zoom[open] .card-zoom-stage .pcard').first()).toHaveClass(BIODOME_CLASS);
      const pending = await winnerReading(page, 'dialog.con-zoom[open] [data-zoom-winner]');
      expect(pending).toMatchObject({context: 'pending', recipient: before.thisPlayer.color, before: '7', after: '8', tr: '3'});
      expect(pending?.caption).toMatch(/Размещаете вы|You place it/);
      await shoot(page, preset.id, '06-source-inspector');
      await closeZoomViewer(page);
      await expect.poll(async () => await placementState(page), {timeout: 10_000, message: 'inspection does not cancel the placement'}).not.toBe('none');
      expect((await wireOf(request, playerId)).waitingFor?.type).toBe('space');
      // ── B on a MANDATORY placement (the existing contract): nothing is skipped — the notice says so, the placement stands.
      if (await placementState(page) === 'locked') {
        await press(page, 'Escape', 600);
      }
      await press(page, 'Escape', 700);
      await expect(page.locator('.con-notice'), 'B names the mandatory placement').toHaveText(/Это размещение обязательно|This placement is mandatory/);
      expect(await placementState(page), 'B does not skip the reward').not.toBe('none');
      expect((await wireOf(request, playerId)).waitingFor?.placementContext?.source).toMatchObject({kind: 'resolution', resolution: BIODOME_ID});

      // ── THE COMMIT: the greenery lands on the card cell; the 0 °C ocean follows as its own placement.
      await walkToSpace(page, target!.id);
      expect(await commitFocusedSpace(page), 'the greenery is placed through the standard two-press flow').toBe(true);
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type, {timeout: 60_000, message: 'the ocean from the temperature step is asked'}).toBe('space');
      const mid = await wireOf(request, playerId);
      const tile = mid.game.spaces.find((s) => s.id === target!.id);
      expect(tile?.color, 'the greenery is blue\'s').toBe(before.thisPlayer.color);
      expect(mid.game.oxygenLevel).toBe(8);
      expect(mid.game.temperature).toBe(0);
      expect(mid.thisPlayer.plants, 'no plants spent').toBe(before.thisPlayer.plants);
      expect(mid.thisPlayer.cardsInHandNbr, 'the cell\'s card bonus').toBe(before.thisPlayer.cardsInHandNbr + 1);
      expect(mid.thisPlayer.terraformRating, 'tile + oxygen + temperature').toBe(before.thisPlayer.terraformRating + 3);
      expect(mid.thisPlayer.megacredits, 'the Greens: 2 M€ per TR step').toBe(before.thisPlayer.megacredits + 6);
      expect(mid.game.parliament.phase?.outcomes?.find((o) => o.step === 'greenery')).toMatchObject({kind: 'greenery', part: 'winner', space: target!.id, parameter: {id: 'oxygen', before: 7, after: 8}});
      // The cell's CARD lifts off the tile first («received card · source: cell bonus») — the shared board-bonus
      // reveal; the follow-up ocean waits for it (prompt admission), so the card is taken before the ocean lives.
      await expect.poll(async () => await page.locator('dialog.con-zoom[open]').count(), {timeout: 30_000, message: 'the cell\'s card is presented'}).toBe(1);
      await shoot(page, preset.id, '07a-cell-card-bonus');
      expect(await pressUntil(page, 'Enter', async () => await placementState(page) !== 'none', {tries: 6, settleMs: 1500}), 'take the card → the ocean placement').toBe(true);
      await expect.poll(async () => await placementState(page), {timeout: 45_000, message: 'the ocean placement stands'}).not.toBe('none');
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '07-ocean-followup');
      expect(await placeTile(page), 'the ocean is placed').toBe(true);

      // ── RED is paid by ITS influence (step 5 = 3 → 6 plants); the phase finishes and generation 2 begins.
      // Э1/Э3: the phase ends through the ADJOURN gate — the sitting comes back to the viewer (renewal → closing),
      // A on the closing answers the viewer's gate, the other seat answers over the API.
      await expect(parliament(page), 'the sitting is back after the board').toHaveCount(1, {timeout: 60_000});
      await waitSittingAtRest(page, 30_000);
      expect(await turnTo(page, 'closing'), 'the closing page').toBe(true);
      await press(page, 'Enter', 1200);
      await answerGateAs(request, seats[1], 'adjourn');
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
      const after = await wireOf(request, playerId);
      expect(after.game.oceans).toBe(1);
      expect(after.thisPlayer.terraformRating, 'tile + oxygen + temperature + ocean').toBe(before.thisPlayer.terraformRating + 4);
      const redAfter = await wireOf(request, red);
      expect(redAfter.thisPlayer.plants, 'red: + 6 by its own influence 3').toBe(redPlantsBefore + 6);
      const outcomes = after.game.parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.map((o) => `${o.player}:${o.step}:${o.kind}:${o.amount ?? ''}`).sort()).toEqual([
        `${after.thisPlayer.color}:greenery:greenery:`,
        // Э1: the ruling party's answer is a RECORD too (the Greens: 2 M€ per TR step — the greenery's four steps).
        `${after.thisPlayer.color}:greenery:reaction:8`,
        `${after.thisPlayer.color}:plants:stock:4`,
        `${redAfter.thisPlayer.color}:plants:stock:6`,
      ].sort());
      await waitForBoardHome(page);
      await shoot(page, preset.id, '08-after');
    });

    test(`oxygen at its maximum: the tile still lands for its own TR, oxygen stays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-biodome-maxed', {query: preset.query, landing: 'prompt'});
      const before = await wireOf(request, playerId);
      expect(before.game.oxygenLevel).toBe(14);
      expect(await openMandatoryAnnounce(page), 'A on the plate starts the placement').toBe(true);
      await expect.poll(async () => await placementState(page), {timeout: 30_000}).not.toBe('none');
      await settle(page, {timeoutMs: 20_000});
      const rows = await dossierRows(page);
      expect(rows.some((r) => /Кислород|Oxygen/.test(r.label)), `no oxygen step at the maximum (${JSON.stringify(rows)})`).toBe(false);
      expect(rows.some((r) => /РТ|TR/.test(r.label) && /Тайл озеленения|Greenery tile/.test(r.note + r.why.join(' ') + r.label)) ||
        rows.some((r) => /РТ|TR/.test(r.label)), `the tile's own TR stands (${JSON.stringify(rows)})`).toBe(true);
      await openZoomViewer(page, 'KeyC');
      const maxed = await winnerReading(page, 'dialog.con-zoom[open] [data-zoom-winner]');
      expect(maxed).toMatchObject({context: 'pending', before: '14', after: '14', tr: '1'});
      expect(maxed?.note).toMatch(/Кислород на максимуме|Oxygen is at its maximum/);
      await shoot(page, preset.id, '09-maxed-source');
      await closeZoomViewer(page);
      await expect.poll(async () => await placementState(page), {timeout: 10_000}).not.toBe('none');
      await shoot(page, preset.id, '09b-maxed-dossier');
      expect(await placeTile(page), 'the greenery is placed').toBe(true);
      // Э1/Э3: the phase ends through the ADJOURN gate — the sitting comes back to the viewer (renewal → closing),
      // A on the closing answers the viewer's gate, the other seat answers over the API.
      await expect(parliament(page), 'the sitting is back after the board').toHaveCount(1, {timeout: 60_000});
      await waitSittingAtRest(page, 30_000);
      expect(await turnTo(page, 'closing'), 'the closing page').toBe(true);
      await press(page, 'Enter', 1200);
      await answerGateAs(request, seats[1], 'adjourn');
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
      const after = await wireOf(request, playerId);
      expect(after.game.oxygenLevel).toBe(14);
      expect(after.thisPlayer.terraformRating, 'only the tile\'s own TR').toBe(before.thisPlayer.terraformRating + 1);
      const greenery = after.game.parliament.lastPhase?.outcomes?.find((o) => o.step === 'greenery');
      expect(greenery?.parameter).toEqual({id: 'oxygen', before: 14, after: 14});
    });

    test(`after the phase: the enacted contest stands in the government, the recorded plants and the greenery are the table's — the live beats are the sitting's (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-biodome-recap', {query: preset.query});
      const wire = await wireOf(request, playerId);
      expect(wire.game.parliament.enacted?.resolution).toBe(BIODOME_ID);
      const mine = wire.game.parliament.lastPhase?.outcomes?.filter((o) => o.player === wire.thisPlayer.color) ?? [];
      const redPlants = mine.find((o) => o.step === 'plants');
      expect(redPlants, 'red was paid 6 plants').toMatchObject({kind: 'stock', amount: 6, influence: 3});
      const bluePlants = wire.game.parliament.lastPhase?.outcomes?.find((o) => o.player !== wire.thisPlayer.color && o.step === 'plants');
      expect(bluePlants, 'blue was paid 2 plants').toMatchObject({kind: 'stock', amount: 2, influence: 1});
      expect(mine.find((o) => o.step === 'greenery'), 'red placed the greenery').toMatchObject({kind: 'greenery', parameter: {id: 'oxygen', before: 5, after: 6}});
      // Э3 retired the results scene: the phase plays LIVE as the sitting — the plants fly as one stock chip in
      // the reward wave and the greenery lands through the board (asserted in
      // `console-parliament-sitting-reward.spec.ts` for RX03 and photographed by the gallery: 21 · 22 · 27 · 27b).
      // After the phase the Parliament opens on the OVERVIEW with the law already standing.
      await openParliament(page);
      await expect(page.locator('.con-parl__stage[data-parl-stage="recap"]'), 'no results scene').toHaveCount(0);
      await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard'), 'the contest stands in the government').toHaveClass(BIODOME_CLASS);
      expect((await crumbText(page)).toUpperCase(), 'the overview names itself').toContain('ОБЗОР');
      await expectFits(page, `${preset.id} after the phase`);
      await shoot(page, preset.id, '20-after-phase');
    });
  });
}
