import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame} from './consoleStart';

/**
 * Console-native · ARCADIAN COMMUNITIES, the two halves of one card.
 *
 * 1. THE CLAIM LANDS. Placing a community puts a player CUBE on an empty cell
 *    and nothing else — no tile, no placement bonus. Every placement entrance
 *    in the client was keyed on a TILE appearing (`shouldHoldForTilePlacement`,
 *    the console hero's `verifyPlacement`, the cathedral overlay-marker hold),
 *    so a colour-only diff matched none of them and the cube simply POPPED in.
 *    It must now play the premium `pc-place` drop — and, because a claim
 *    collects NOTHING, the cell's printed bonus icons must stay exactly where
 *    they are (no lift, no proxy, no counter movement).
 *
 * 2. THE ACTION BUTTON DRAWS ITSELF. The corp box carries a real `ce.action()`,
 *    but a stale `ACTION_OVERRIDES` entry kept forcing the text-only branch —
 *    «Действия карт» rendered an EMPTY canvas with one clipped sentence bleeding
 *    across it. The tile must render the printed graphic (CardRenderEffectBox),
 *    not the prose fallback.
 */

const OUT_DIR = path.resolve('screenshots', 'console-community-marker');

/** A deterministic solo game whose only dealable corp is Arcadian Communities. */
function newGameConfig() {
  return {
    players: [{name: 'ClaimTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: true, venus: false, colonies: false,
      // No preludes: the start wizard stays short (corp → buy → start).
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 1,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: ['Arcadian Communities'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
    automa: undefined,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/**
 * Record the landing while it happens. The drop class lives for ~1 s, so a
 * poll can legitimately miss it — an observer cannot. Also watches for the
 * tile hero's printed-bonus PROXIES, which must never appear for a claim.
 */
async function watchCubeLanding(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = {dropped: [] as Array<string>, bonusProxies: 0};
    (window as unknown as {__claimProbe: typeof probe}).__claimProbe = probe;
    const scan = () => {
      document.querySelectorAll('.player-cube.board-owner-cube.player-cube--animate-in').forEach((el) => {
        const id = el.closest('.board-space')?.getAttribute('data_space_id') ?? '';
        if (id !== '' && !probe.dropped.includes(id)) {
          probe.dropped.push(id);
        }
      });
      probe.bonusProxies += document.querySelectorAll('.con-tileplace__bonus').length;
    };
    scan();
    new MutationObserver(scan).observe(document.body,
      {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
  });
}

async function claimProbe(page: Page): Promise<{dropped: Array<string>, bonusProxies: number}> {
  return page.evaluate(() =>
    (window as unknown as {__claimProbe: {dropped: Array<string>, bonusProxies: number}}).__claimProbe);
}

/** Every printed placement-bonus icon still on the board (a claim eats none). */
async function boardBonusIcons(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('.board-space .board-space-bonus').length);
}

/** The cell the console board cursor is on (`con-cell-sel`). */
async function focusedSpaceId(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.querySelector('.con-cell-sel')?.getAttribute('data_space_id') ?? '');
}

test.describe('console · Arcadian Communities', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the community cube LANDS, and the action button draws its own graphic', async ({page, request}) => {
    test.setTimeout(240_000);

    // ── The pregame (the SHARED driver — it is setup, never the subject).
    //    ANSWERED over the API and stopped at the START RELEASE, so what
    //    stands when the console opens is exactly this spec's subject: the
    //    corporation's mandatory first action.
    const playerId = await bootIntoGame(page, request, {
      config: newGameConfig(),
      corporation: 'Arcadian Communities',
      until: 'startRelease',
    });

    // ── The corporation's MANDATORY first action: place a community. It is
    //    the Game Start Workspace's own «ПЕРВОЕ ДЕЙСТВИЕ» stage now — the
    //    seated corp + the briefing + one CTA; no modal, no announce plate.
    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    expect(await page.locator('.con-composer--corpfirst').count(),
      'the retired standalone modal must not appear in the start flow').toBe(0);
    await page.waitForTimeout(1200);
    await shoot(page, '01-first-action-stage');
    await key(page, 'Enter', 2500);

    // The board takes over for the claim (a marker pick — no tile).
    const panel = page.locator('.con-context');
    await expect.poll(async () => (await panel.innerText().catch(() => '')).length > 0,
      {timeout: 30_000}).toBeTruthy();
    await expect.poll(async () =>
      page.evaluate(() => document.querySelectorAll('.board-space--available, .con-board__space--available').length),
    {timeout: 30_000}).toBeGreaterThan(0);
    const waiting = await (await request.get(`/api/player?id=${playerId}`)).json() as {waitingFor?: {type?: string}};
    expect(waiting.waitingFor?.type, 'the server really is waiting for a space').toBe('space');
    await shoot(page, '02-claim-placement-open');

    // …and it must not PROMISE what the claim never grants. The prompt declares
    // `placementEffect: 'marker'`; the panel used to default to a tile
    // placement and offer «ВЫ ПОЛУЧИТЕ · Бонус клетки +2» on a bonus cell.
    const cellsWithBonus = await page.evaluate(() => Array.from(
      document.querySelectorAll('.board-space--available, .con-board__space--available'))
      .filter((el) => el.querySelectorAll('.board-space-bonus').length > 0)
      .map((el) => el.getAttribute('data_space_id') ?? '')
      .filter((id) => id !== ''));
    expect(cellsWithBonus.length, 'a legal cell with a printed bonus to hover').toBeGreaterThan(0);
    for (let i = 0; i < 24 && !cellsWithBonus.includes(await focusedSpaceId(page)); i++) {
      await key(page, ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'][i % 4], 320);
    }
    expect(cellsWithBonus, 'the cursor reached a cell with a printed bonus').toContain(await focusedSpaceId(page));
    await page.waitForTimeout(900); // the cell preview is fetched per cell
    await shoot(page, '02b-bonus-cell-panel');
    const preview = await panel.innerText();
    expect(preview, 'a claim must not promise the cell bonus').not.toContain('Бонус клетки');
    // …and the panel must not announce a TILE for a prompt that places a marker
    // (the kicker is CSS-uppercased — compare case-insensitively).
    const shout = preview.toUpperCase();
    expect(shout, 'the kicker names what actually lands').not.toContain('РАЗМЕЩЕНИЕ ТАЙЛА');
    expect(shout).toContain('РАЗМЕЩЕНИЕ МАРКЕРА');
    // …down to the "no consequences" line, which must not describe a tile that
    // never lands either.
    expect(shout).not.toContain('КРОМЕ РАЗМЕЩЕНИЯ ТАЙЛА');

    // ── 1 · THE LANDING ───────────────────────────────────────────────────
    const bonusesBefore = await boardBonusIcons(page);
    await watchCubeLanding(page);
    for (let i = 0; i < 3 && (await claimProbe(page)).dropped.length === 0; i++) {
      await key(page, 'Enter', 2600);
    }
    const probe = await claimProbe(page);
    await shoot(page, '03-cube-landed');

    expect(probe.dropped.length,
      'the claimed cube must play the premium drop, not appear at rest').toBeGreaterThan(0);
    // …on a cell that has NO tile: this is a marker, not a build.
    const claimed = probe.dropped[0];
    const cell = await page.evaluate((id) => {
      const el = document.querySelector(`.board-space[data_space_id="${id}"]`);
      return {
        cube: el?.querySelectorAll('.player-cube.board-owner-cube').length ?? 0,
        tile: el?.querySelectorAll('.board-space-tile[class*="board-space-tile--"]').length ?? 0,
        bonuses: el?.querySelectorAll('.board-space-bonus').length ?? 0,
        held: el?.querySelector('.board-space-bonuses')?.classList.contains('con-deal-hold') ?? false,
      };
    }, claimed);
    expect(cell.cube, 'the claimed cell carries the owner cube').toBeGreaterThan(0);
    expect(cell.tile, 'a claim places NO tile').toBe(0);
    // …and it collected nothing: the printed icons were never lifted, blanked
    // or handed to a resource chip.
    expect(probe.bonusProxies, 'a claim must not lift the cell\'s printed bonuses').toBe(0);
    expect(cell.held, 'the claimed cell\'s printed icons stay visible').toBeFalsy();
    expect(await boardBonusIcons(page), 'no printed bonus left the board').toBe(bonusesBefore);

    // ── 2 · THE ACTION BUTTON ─────────────────────────────────────────────
    const turnChip = page.locator('.con-status', {hasText: 'ДЕЙСТВИЕ'});
    await expect(turnChip).toHaveCount(1, {timeout: 30_000});
    await page.waitForTimeout(2500);

    const actions = page.locator('.con-cardactions');
    for (let tries = 0; tries < 4 && await actions.count() === 0; tries++) {
      await key(page, 'Period', 700);
      await key(page, 'ArrowUp', 1200);
    }
    await expect(actions).toHaveCount(1, {timeout: 15_000});
    await page.waitForTimeout(1500);
    await shoot(page, '04-card-actions');

    const canvas = page.locator('.con-cardactions__tile .con-cardactions__graphic');
    await expect(canvas).toHaveCount(1);
    expect(await canvas.locator('.card-effect-box').count(),
      'the action tile must draw its PRINTED graphic (a card-effect-box)').toBeGreaterThan(0);
    expect(await canvas.locator('.con-cardactions__graphic-text').count(),
      '…and not fall back to the prose branch').toBe(0);
    // The graphic is really the ACTION half of the corp box (the community
    // cube + «*»), never the sibling EFFECT ("place a tile on a marked area").
    expect(await canvas.locator('.card-effect-box-item [class*="community"]').count(),
      'the community token is drawn').toBeGreaterThan(0);
  });
});
