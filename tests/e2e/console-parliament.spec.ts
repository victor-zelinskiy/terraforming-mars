import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, closeZoomViewer, crumbText, fetchPlayerModel, focusCard, openCardActions, openQuickWheel, openZoomViewer, press,
  pressUntil, reloadConsole, settle, visibleSurfaces, walkFocusUntil,
} from './consoleStart';

/**
 * THE MARS PARLIAMENT (Turmoil Redux) — the reworked workspace
 * (docs/TURMOIL_REDUX_PARLIAMENT_V2.md), on three compositions
 * (1080 · TV 4K · Steam Deck):
 *
 *   the wheel's «ПАРЛАМЕНТ» slot opens the workspace · the GOVERNMENT reads
 *   who rules and why (the starting rule / the enacted resolution) as the
 *   ruling party's PLAQUE (seal, state, printed formula), the chairman quest
 *   as its own block (condition · progress · reward) · the VOTING AREA puts a
 *   TALLY under every card (delegates, the leader, yours, the tie rule) and a
 *   FOCUS RAIL under them (what the next delegate changes) · the PARTIES as
 *   six plaques in one row (3 × 2 on the Deck), one LINE under the row for
 *   a used / blocked action · the AGENDA as LEVELS · A on a resolution opens
 *   the VOTE stage · A commits (the server's own menu option, byte-identical)
 *   and the delegate lands · X inspects. Rule prose lives in the inspector.
 *
 * Every composition asserts that nothing READ is cut and no block spills out
 * of its tier (`expectFits`) — on the start table, a crowded five-seat table
 * (ties between resolutions and players, a neutral majority, several effects,
 * a used and a blocked party action), the chairman seat's mandatory pick
 * (collapse → restore → take) and the results of a political phase.
 * Also the screenshot source (screenshots/parliament/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'parliament');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  profileQuery: string;
  /** The full journey runs once (1080); the others prove composition. */
  journey: boolean;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto', journey: true},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv', journey: false},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld', journey: false},
];

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const parliament = (page: Page) => page.locator('.con-parl');
const slots = (page: Page) => page.locator('.con-parl__slot');
const stage = (page: Page) => page.locator('.con-parl__stage');
const voteStep = (page: Page) => page.locator('.con-parl__vote.con-parl__vote--up');

/** Open the Parliament from the wheel (RT → down). */
async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

/**
 * Nothing of the workspace may stick out of the viewport (no scroll, no crop),
 * no block may spill out of its own tier, and no READING text may be cut: the
 * party states, the tally, the focus rail's consequences, the quest reward,
 * the party detail — each is laid out whole on every profile.
 */
async function expectFits(page: Page, preset: Preset): Promise<void> {
  const problems = await page.evaluate(() => {
    const root = document.querySelector('.con-parl');
    if (root === null) {
      return ['no root'];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const visible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__slot-empty, .con-parl__tally, .con-parl__seats, .con-parl__seat, .con-parl__party, .con-parl__pline, .con-parl__quest, .con-parl__agenda, .con-parl__stage, ' +
      '.con-parl__info, .con-parl__info-block, .con-parl__fact';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(blocks))) {
      if (!visible(el)) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`off-screen ${name(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      // A block's own content stays inside it (a tally taller than its cell
      // once spilled over the header).
      if (el.scrollHeight > el.clientHeight + 2 && !el.classList.contains('con-parl__stage')) {
        out.push(`spills ${name(el)} ${el.scrollHeight}>${el.clientHeight}`);
      }
      for (const child of Array.from(el.children) as Array<HTMLElement>) {
        const c = child.getBoundingClientRect();
        if (c.height > 0 && (c.top < r.top - 2 || c.bottom > r.bottom + 2) && getComputedStyle(child).position !== 'absolute') {
          out.push(`outside ${name(el)} › ${name(child)} ${Math.round(c.top)}..${Math.round(c.bottom)} vs ${Math.round(r.top)}..${Math.round(r.bottom)}`);
        }
      }
    }
    const reading = '.con-pseal__name, .con-pseal__state-text, .con-parl__tally-row, .con-parl__fact-key, .con-parl__fact-val, ' +
      '.con-parl__quest-reward, .con-parl__quest-text, .con-parl__pline-text, .con-parl__slot-win, .con-parl__kicker, .con-parl__seat-name, .con-parl__seat-key, .con-parl__ruler-name, ' +
      '.con-parl__txn-row, .con-parl__info-src-text, .con-parl__info-name, .con-parl__slot-party, .con-parl__slot-empty-reason';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(reading))) {
      if (!visible(el)) {
        continue;
      }
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`cut ${name(el)}: ${(el.textContent ?? '').trim().slice(0, 48)}`);
      }
      // Clipped by an ancestor tier (the tier's overflow hides it) — vertically,
      // and along the one-line focus rail, horizontally too.
      const tier = el.closest<HTMLElement>('.con-parl__pline, .con-parl__gov, .con-parl__stage, .con-parl__party, .con-parl__slot, .con-parl__slot-empty, .con-parl__seats, .con-parl__info');
      if (tier !== null) {
        const t = tier.getBoundingClientRect();
        const e = el.getBoundingClientRect();
        if (e.bottom > t.bottom + 2 || e.top < t.top - 2 || e.right > t.right + 1) {
          out.push(`clipped ${name(el)} in ${name(tier)}: ${(el.textContent ?? '').trim().slice(0, 48)}`);
        }
      }
    }
    return out;
  });
  expect(problems, `${preset.id}: every parliament block fits, nothing read is cut`).toEqual([]);
}

/** The «ИЛИ» play whose plant branch the ruling Greens answer (+1 M€ production). */
const OR_CARD = 'Artificial Photosynthesis';

const composer = (page: Page) => page.locator('.con-composer--play');

/** Open the Information workspace (Y), acknowledging whatever cinematic stands. */
async function openInfo(page: Page): Promise<void> {
  const infoRoot = page.locator('.con-info');
  for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
    if (i > 0) {
      await press(page, 'Enter', 700);
      await press(page, 'Escape', 500);
    }
    await press(page, 'KeyY', 1100);
  }
  await expect(infoRoot, `the info workspace must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toHaveCount(1);
}

/** Walk the summary ring onto the effects zone and open the explorer (positive witness, never a memorised key sequence). */
async function openInfoEffects(page: Page): Promise<void> {
  const focused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
  for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
    if (await focused() > 0) {
      break;
    }
    await press(page, move, 300);
  }
  expect(await focused(), 'the ring must reach the effects zone').toBeGreaterThan(0);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}),
    'A on the effects zone must open the explorer').toBeTruthy();
}

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/** Leave the composer and the hand — back to the board home. */
async function closeToBoard(page: Page): Promise<void> {
  expect(await pressUntil(page, 'Escape', async () => await composer(page).count() === 0, {tries: 4, settleMs: 900}),
    'B must fold the composer').toBeTruthy();
  expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 900}),
    'B must leave the hand').toBeTruthy();
  await settle(page);
}

async function parliamentModel(request: APIRequestContext, playerId: string) {
  const model = await fetchPlayerModel(request, playerId) as unknown as {
    game: {parliament: {slots: Array<{party: string, totalVotes: number, viewerVotes: number, votes: Array<{owner: string}>}>, rulingParty: string, players: Array<{color: string, lobby: boolean, reserve: number}>}},
    thisPlayer: {color: string},
  };
  return model;
}

for (const preset of PRESETS) {
  test.describe(`parliament · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the workspace opens from the wheel and the browse layer fits (${preset.id})`, async ({page, request}) => {
      // The 1080 journey walks five surfaces (vote · inspector · Information ·
      // composer + R3 · journal) — the default 30 s is a single surface's budget.
      test.setTimeout(preset.journey ? 300_000 : 120_000);
      const playerId = await bootFixture(page, request, 'parliament', {query: preset.profileQuery});
      await openParliament(page);
      expect((await crumbText(page)).toUpperCase()).toContain('ПАРЛАМЕНТ');
      await expect(slots(page)).toHaveCount(3);
      // Three parties, three resolutions, the ruling party in the head chip.
      const before = await parliamentModel(request, playerId);
      expect(before.game.parliament.slots.length).toBe(3);
      expect(before.game.parliament.rulingParty).toBe('Greens');
      await expectFits(page, preset);
      // WHO RULES AND WHAT IT GIVES: the Greens by the STARTING RULE (not by a
      // resolution nobody enacted) on their PLAQUE, their printed formula as a
      // GRAPHIC, the quest with its reward, and a tally under every card.
      const gov = page.locator('[data-parl-gov]');
      await expect(gov).toContainText(/Стартовое правило/i);
      await expect(gov.locator('.con-parl__ruler .con-pformula__mech')).toHaveCount(1);
      await expect(gov.locator('[data-parl-gov-empty]'), 'no resolution enacted yet: an honest empty seat').toHaveCount(1);
      await expect(page.locator('.con-wshead [data-parl-seats] .con-parl__seat[data-parl-seat]'), 'the delegates zone on the head line — one group per player').toHaveCount(2);
      await expect(page.locator('.con-parl__body [data-parl-seats]'), 'no ledger row in the body').toHaveCount(0);
      await expect(page.locator('[data-parl-quest] .con-parl__quest-reward')).toContainText(/Председательство/);
      await expect(page.locator('[data-parl-tally]')).toHaveCount(3);
      await expect(page.locator('.con-parl__party')).toHaveCount(6);
      await shoot(page, preset, '01-browse');

      if (!preset.journey) {
        // Composition: the vote step (the card carried, the forecast beside
        // it), the party plaque (the Greens' reason is the starting rule), the inspector.
        await press(page, 'ArrowRight', 500);
        await expectFits(page, preset);
        await shoot(page, preset, '02-focus');
        await press(page, 'Enter', 1200);
        await expect(voteStep(page)).toHaveCount(1);
        await settle(page, {timeoutMs: 8_000});
        await expect(page.locator('[data-parl-vote-forecast] .con-parl__fact')).not.toHaveCount(0);
        await expectFits(page, preset);
        await shoot(page, preset, '03-vote-step');
        expect(await pressUntil(page, 'Escape', async () => await voteStep(page).count() === 0, {tries: 3, settleMs: 900})).toBeTruthy();
        await settle(page, {timeoutMs: 8_000});
        const zone = () => parliament(page).getAttribute('data-zone');
        expect(await pressUntil(page, 'ArrowLeft', async () => await zone() === 'government', {tries: 3, settleMs: 300})).toBeTruthy();
        await press(page, 'ArrowDown', 500); // → the parties, on the ruling party
        // «ПРАВИТ» alone (glossary §3, registry R-03): the government block beside the tile names the basis.
        await expect(page.locator('.con-parl__party[data-party="Greens"] .con-pseal__state'), 'the plaque states that the Greens rule').toContainText(/правит/i);
        await expectFits(page, preset);
        await shoot(page, preset, '04-party-focus');
        await settle(page, {timeoutMs: 10_000});
        await openZoomViewer(page);
        await expect(page.locator('.con-zoom-rules').first()).toBeVisible({timeout: 10_000});
        await expect(page.locator('body'), 'no lore placeholder over a party face').not.toContainText(/Архивная запись отсутствует/);
        await shoot(page, preset, '05-inspect-party');
        await closeZoomViewer(page);
        return;
      }

      // ── THE VOTE. Slot 1 carries red's delegate; blue votes there with the
      //    free lobby delegate: the ribbon grows, the lobby empties, and the
      //    flow LEAVES the workspace (a finished flow never folds back).
      const target = before.game.parliament.slots[0];
      const me = before.thisPlayer.color;
      const meBefore = before.game.parliament.players.find((p) => p.color === me);
      expect(meBefore?.lobby, 'the free delegate waits in the lobby').toBe(true);
      await press(page, 'Enter', 1200);
      await expect(voteStep(page)).toHaveCount(1);
      await settle(page, {timeoutMs: 8_000});
      expect((await crumbText(page)).toUpperCase()).toContain('ГОЛОС');
      await expect(page.locator('[data-parl-vote-forecast] .con-parl__fact')).not.toHaveCount(0);
      await shoot(page, preset, '02-vote-step');
      await press(page, 'Enter', 900);
      await expect.poll(async () => (await parliamentModel(request, playerId)).game.parliament.slots[0].viewerVotes,
        {timeout: 20_000, message: 'the delegate landed on slot 1'}).toBe(target.viewerVotes + 1);
      const after = await parliamentModel(request, playerId);
      expect(after.game.parliament.slots[0].totalVotes).toBe(target.totalVotes + 1);
      expect(after.game.parliament.players.find((p) => p.color === me)?.lobby, 'the lobby delegate was spent').toBe(false);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset, '03-after-vote');

      // ── THE INSPECTOR. Back in the Parliament, X over the focused resolution
      //    opens the fullscreen face with the three rule blocks.
      await openParliament(page);
      // The landed delegate is part of the card's composition: the ribbon and
      // the tally read the new count, and the viewer's lead on slot 1.
      await expect(slots(page).nth(0)).toHaveAttribute('data-votes', String(target.totalVotes + 1));
      // The inspector of a resolution lives INSIDE the mode (X on the selected
      // card); the voting area itself offers no X.
      await press(page, 'Enter', 1400);
      await expect(voteStep(page), 'the mode opens for reading').toHaveCount(1);
      await settle(page, {timeoutMs: 8_000});
      await openZoomViewer(page);
      const panel = page.locator('.con-zoom-rules').first();
      await expect(panel).toBeVisible({timeout: 10_000});
      await expect(page.locator('body'), 'no lore placeholder over a resolution face').not.toContainText(/Архивная запись отсутствует/);
      await shoot(page, preset, '04-inspect-resolution');
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 8_000});
      expect(await pressUntil(page, 'Escape', async () => await voteStep(page).count() === 0, {tries: 3, settleMs: 1100}), 'B folds the mode').toBeTruthy();
      await settle(page, {timeoutMs: 8_000});

      // ── THE PARTY DOSSIER: down to the parties row, X over a party.
      await press(page, 'ArrowDown', 500);
      await openZoomViewer(page);
      await shoot(page, preset, '05-inspect-party');
      await closeZoomViewer(page);
      expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900}),
        'B leaves the Parliament').toBeTruthy();
      await settle(page);

      // ── THE INFORMATION WORKSPACE, «ЭФФЕКТЫ»: the viewer's party effects
      //    (the ruling Greens + the second slot's party, held by two
      //    delegates) stand in their own strip over the effects explorer —
      //    full citizens of the effects framework, with the reason each one
      //    is held.
      await openInfo(page);
      await openInfoEffects(page);
      const strip = page.locator('.con-pfx');
      const byDelegates = before.game.parliament.slots[1].party;
      expect(byDelegates, 'the fixture\'s second slot is another party than the ruling one').not.toBe('Greens');
      await expect(strip, 'the party effects strip stands in the effects route').toHaveCount(1);
      await expect(strip.locator('.con-pfx__item[data-party="Greens"]'), 'the ruling Greens').toHaveCount(1);
      await expect(strip.locator(`.con-pfx__item[data-party="${byDelegates}"]`), `${byDelegates}, held by two delegates`).toHaveCount(1);
      await shoot(page, preset, '06-info-effects');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-info').count() === 0, {tries: 5, settleMs: 900}),
        'B leaves the Information workspace').toBeTruthy();
      await settle(page);

      // ── THE FORECAST (R3): the «ИЛИ» play's plant branch carries the
      //    Greens' «⚡ сработает» note (+1 M€ production), the R3 layer lists
      //    the party fact like any table reactor's.
      await openPlayComposer(page, OR_CARD);
      const notes = page.locator('.con-composer__variant [data-forecast-vfx]');
      await expect(notes, 'the plant branch carries the Greens note').not.toHaveCount(0);
      await expect(notes.first(), 'the note reads «⚡ сработает +1» (the M€ is an icon, never text)').toContainText(/\+1/);
      await shoot(page, preset, '07-forecast-or');
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-composer__fxlayer').count() > 0, {tries: 3, settleMs: 1100}),
        'R3 must open the «Эффекты» layer').toBeTruthy();
      await expect(page.locator('.con-composer__fxlayer [data-forecast-group]')).not.toHaveCount(0);
      await shoot(page, preset, '08-forecast-layer');
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-composer__fxlayer').count() === 0, {tries: 3, settleMs: 1100}),
        'R3 folds the layer back').toBeTruthy();
      await closeToBoard(page);

      // ── THE JOURNAL: the vote is a journal line whose resolution renders as
      //    a NAMED chip (the RESOLUTION log token), never a bare id.
      await press(page, 'KeyR', 1200);
      const journal = page.locator('.con-journal');
      await expect(journal, 'the journal opens').toBeVisible({timeout: 10_000});
      await expect(journal.locator('.journal-token--resolution').first(), 'the vote line names the resolution as a chip').toBeVisible();
      await expect(journal, 'never a bare resolution id').not.toContainText(/RDX_/);
      await shoot(page, preset, '09-journal');
      await press(page, 'Escape', 800);
    });

    test(`a crowded Parliament reads at a glance: ties, a neutral majority, several effects, used and blocked actions (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const playerId = await bootFixture(page, request, 'parliament-dense', {query: preset.profileQuery});
      await openParliament(page);
      // Generation 2: the first political phase played LIVE as the sitting (Э3) — nothing replays on the open.
      await expect(stage(page), 'no results scene').toHaveCount(0);
      await expectFits(page, preset);
      await shoot(page, preset, '20-dense-open');
      await settle(page, {timeoutMs: 10_000});

      const model = await fetchPlayerModel(request, playerId) as unknown as {game: {parliament: {slots: Array<{totalVotes: number, isWinning: boolean}>}}};
      const [s1, s2] = model.game.parliament.slots;
      expect(s1.totalVotes, 'V1 and V2 hold as many delegates').toBe(s2.totalVotes);
      expect(s1.isWinning, 'the tie goes to the slot closest to the government').toBe(true);
      // WHICH RESOLUTION WINS NOW — on the card itself (the WHY of a tie is the inspector's).
      const v1 = slots(page).nth(0);
      await expect(v1).toHaveClass(/con-parl__slot--winning/);
      await expect(v1.locator('.con-parl__slot-win')).toHaveCount(1);
      await expect(v1.locator('[data-parl-leader] .player-cube'), 'who personally leads it').toHaveCount(1);
      // A crowded ribbon folds into per-owner stacks.
      await expect(v1.locator('.con-parl__vote-stack')).not.toHaveCount(0);
      // No vote is possible — the mode still opens for READING; its confirm names why, and A on it says so once.
      await press(page, 'Enter', 1400);
      await expect(voteStep(page)).toHaveCount(1);
      await settle(page, {timeoutMs: 8_000});
      await expect(page.locator('.con-parl__cta--blocked')).toHaveCount(1);
      await press(page, 'Enter', 800);
      await expect(page.locator('.con-notice')).toBeVisible();
      // X on the selected card: the resolution scene — its party on the left,
      // its own rules on the right, and the FOOTER states where the card
      // stands (up for the vote) and the viewer's access to the party effect.
      // No paragraph of political rules in the inspector any more.
      await openZoomViewer(page);
      await expect(page.locator('.con-rstatus[data-lifecycle="vote"]'), 'the standing chip: up for the vote').toHaveCount(1);
      await expect(page.locator('.con-rstatus')).toContainText(/НА ГОЛОСОВАНИИ/i);
      await expect(page.locator('.card-zoom-aside .con-rinspect-aside'), 'the party column stands beside the card').toHaveCount(1);
      await expect(page.locator('.card-zoom-side .con-zoom-rules'), 'the resolution\'s own rules stand on the right').toHaveCount(1);
      await expect(page.locator('dialog.con-zoom'), 'no tie prose in the inspector').not.toContainText(/ближайш/i);
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 8_000});
      expect(await pressUntil(page, 'Escape', async () => await voteStep(page).count() === 0, {tries: 3, settleMs: 1100}), 'B folds the mode').toBeTruthy();
      await settle(page, {timeoutMs: 8_000});
      // The enacted resolution, the ruling party, the quest race and the
      // chairman in ONE area.
      await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard')).toHaveCount(1);
      await expect(page.locator('[data-parl-quest-progress] .con-parl__quest-row')).toHaveCount(5);
      await expect(page.locator('[data-parl-chair]')).toHaveCount(1);
      await expectFits(page, preset);
      await shoot(page, preset, '21-dense-browse');

      // The parties: several effects held at once, the action used this generation.
      await press(page, 'ArrowDown', 500);
      expect(await page.locator('.con-parl__party--held').count(), 'several party effects at once').toBeGreaterThanOrEqual(3);
      await expect(page.locator('.con-parl__party[data-action-state="used"]')).toHaveCount(1);
      await expectFits(page, preset);
      await shoot(page, preset, '22-dense-parties');
      // Every party's detail fits, whatever its formula's width: walk all six.
      const partyFocused = () => page.evaluate(() => document.querySelector('.con-parl__party--focus')?.getAttribute('data-party') ?? '');
      const seen = new Set<string>();
      for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']) {
        await press(page, key, 300);
        seen.add(await partyFocused());
        await expectFits(page, preset);
      }
      expect([...seen].filter((p) => p !== ''), 'the walk visited every party').toHaveLength(6);

      // The action menu lists the viewer's party actions with the menu's own
      // states — and never a tile for a party the viewer has no access to.
      expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
      await settle(page);
      await openCardActions(page);
      await expect(page.locator('.con-cardactions__tile[data-action-party="Unity"]'), 'no tile for a party action without access').toHaveCount(0);
      await expect(page.locator('.con-cardactions__tile--rules[data-action-party]'), 'a blocked party action carries its reason').not.toHaveCount(0);
      const focusedTile = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-party') ?? '');
      await walkFocusUntil(page, async () => await focusedTile() === 'Industrialists', focusedTile, 12);
      await shoot(page, preset, '23-dense-action-menu');
    });

    test(`the chairman seat: a mandatory pick that collapses to the board and comes back (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const playerId = await bootFixture(page, request, 'parliament-seat', {query: preset.profileQuery, landing: 'prompt'});
      // On the viewer's own turn the pick takes the screen: the Parliament on its seat stage.
      await expect(stage(page)).toHaveAttribute('data-parl-stage', 'seat', {timeout: 20_000});
      expect((await crumbText(page)).toUpperCase()).toContain('КРЕСЛО');
      // The quest reads as finished, with its winner, while the pick stands.
      await expect(page.locator('[data-parl-quest]')).toHaveClass(/con-parl__quest--done/);
      await expect(page.locator('.con-parl__slot--candidate, .con-parl__slot--target')).not.toHaveCount(0);
      await expectFits(page, preset);
      await shoot(page, preset, '30-seat-stage');
      // B cannot unmake a mandatory pick: it COLLAPSES to the board, the pick stays owed.
      expect(await pressUntil(page, 'Escape', async () => !await parliament(page).isVisible(), {tries: 3, settleMs: 1000}),
        'B collapses the Parliament').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset, '31-seat-collapsed');
      // A on the board brings the same stage back.
      expect(await pressUntil(page, 'Enter', async () => await parliament(page).isVisible() && await stage(page).getAttribute('data-parl-stage', {timeout: 1_000}) === 'seat',
        {tries: 3, settleMs: 1500}), 'A restores the seat stage').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      // RELOAD mid-pick: the server still owes the seat; the stage comes back around it.
      await reloadConsole(page);
      // On the viewer's own turn the mandatory pick is never gated: the Parliament stands back up on its seat stage by itself.
      await expect(stage(page)).toHaveAttribute('data-parl-stage', 'seat', {timeout: 30_000});
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset, '31b-seat-after-reload');
      // Take the delegate from the focused candidate.
      await press(page, 'Enter', 1500);
      await expect.poll(async () => {
        const m = await fetchPlayerModel(request, playerId) as unknown as {game: {parliament: {chairman?: string}}, thisPlayer: {color: string}};
        return m.game.parliament.chairman === m.thisPlayer.color;
      }, {timeout: 20_000, message: 'the viewer holds the chairman seat'}).toBe(true);
      await settle(page, {timeoutMs: 15_000});
      await shoot(page, preset, '32-seat-taken');
    });

    if (preset.journey) {
      test(`the previous generation's results are the OVERVIEW's standing objects — never a replayed scene (${preset.id})`, async ({page, request}) => {
        test.setTimeout(180_000);
        // Generation 2 has just begun: the first political phase ran LIVE as the sitting (Э3 retired the results
        // scene that used to replay on the first open — a scene on `mounted()` with a device memory). What the
        // phase produced stands on the overview: the enacted card in the government, blue's marker on Agenda
        // step 1, the area the refresh dealt — and a reload replays nothing.
        const playerId = await bootFixture(page, request, 'parliament-recap', {query: preset.profileQuery});
        await openParliament(page);
        await expect(stage(page), 'no results scene').toHaveCount(0);
        expect((await crumbText(page)).toUpperCase(), 'the overview names itself').toContain('ОБЗОР');
        await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard')).toHaveCount(1);
        await expect(page.locator('.con-parl__step[data-step="1"] .player-cube')).not.toHaveCount(0);
        const dealt = (await parliamentModel(request, playerId)).game.parliament.slots.length;
        expect(dealt, 'the refresh dealt a fresh area').toBeGreaterThan(0);
        await expect(slots(page)).toHaveCount(dealt);
        await expect(page.locator('[data-parl-gov]')).toContainText(/Принятая резолюция/i);
        await expect(page.locator('.con-parl__flight'), 'nothing is in the air on a plain open').toHaveCount(0);
        await expectFits(page, preset);
        await shoot(page, preset, '10-after-phase');
        await reloadConsole(page);
        await openParliament(page);
        await expect(stage(page), 'a reload replays nothing').toHaveCount(0);
        await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard')).toHaveCount(1);
      });
    }
  });
}
