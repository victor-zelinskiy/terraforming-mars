import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, fetchPlayerModel, openCardActions, openConsole, press, sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * THE TRIPLE NEST — the deepest workspace composition this console can reach,
 * live (2 players), and the guard of the same-kind NESTING law:
 *
 *   ДЕЙСТВИЯ КАРТ (Dutch Mountains' composer)
 *     ⊃ hydro (the stage-reward pick, seated on stage 7)
 *       ⊃ repeat-pick (the stage-7 «повтори действие» browser)
 *         ⊃ Modular Floodgates' composer (repeat mode)
 *           ⊃ hydro AGAIN (the NESTED blockade target pick)
 *
 * Before the nesting law this chain COLLAPSED at the last door: the blockade
 * pick's `hydro` push was treated as a re-entry — the reward pick's frame
 * overwritten, the repeat-pick frame truncated, its bridge cancelled under a
 * live composer (the 2026-09-06 report). Now the inner pick stacks as a
 * `nested` instrument, the outer role's drafts are suspended and restored,
 * and the whole composition commits as ONE atomic batch: DM pays 3 energy,
 * claims stage 7, the copied MF deploys the blockade at the target chosen
 * PRE-commit — B reversible at every level on the way.
 *
 * Setup is API (the road is never the subject): P1 seats 6 tag cards, walks
 * the track to 7 (the landing's own repeat answered with MF variant A — which
 * also marks MF used this generation and stores its steel), plays DM; P2
 * passes and waits at position 0 — the blockade's one legal target.
 *
 * Screenshots → `screenshots/triple-nest-blockade/`.
 */

const OUT = path.resolve('screenshots', 'triple-nest-blockade');
const MF = 'Modular Floodgates';
const DM = 'Dutch Mountains';
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Tardigrades'];
const ALL_CARDS = [...TAG_CARDS, MF, DM];

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

function payMc(amount: number): Wire {
  return {...NO_PAYMENT, megacredits: amount};
}

async function waitPrompt(request: APIRequestContext, id: string, want: (p: Wire | undefined) => boolean, label: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 90; i++) {
    if (want(model.waitingFor as Wire | undefined)) {
      return model as Wire;
    }
    await new Promise((r) => setTimeout(r, 500));
    model = await fetchPlayerModel(request, id) as Wire;
  }
  expect(false, `${label}: never arrived (last: ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

const isActionMenu = (p: Wire | undefined) =>
  p !== undefined && p.type === 'or' && /Take your (first|next) action/.test(titleOf(p));

async function answerInitialCards(request: APIRequestContext, id: string, buys: ReadonlyArray<string>): Promise<void> {
  const model = await waitPrompt(request, id, (p) => p?.type === 'initialCards', 'initial cards');
  const wf = model.waitingFor as Wire;
  const CALM = ['ThorGate', 'Teractor', 'PhoboLog', 'Mining Guild', 'Saturn Systems', 'Interplanetary Cinematics', 'Ecoline'];
  const corpOffer = ((wf.options?.[0]?.cards ?? []) as Array<Wire>).map((c) => String(c.name));
  const corp = CALM.find((c) => corpOffer.includes(c));
  expect(corp, `a calm corporation among ${corpOffer.join(', ')}`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'initialCards',
    responses: [
      {type: 'card', cards: [corp]},
      {type: 'card', cards: [...buys]},
    ],
  } as never);
}

async function drainPregame(request: APIRequestContext, id: string, until: 'menu' | 'idle'): Promise<void> {
  let idlePolls = 0;
  for (let i = 0; i < 80; i++) {
    const model = await fetchPlayerModel(request, id) as Wire;
    const p = model.waitingFor as Wire | undefined;
    if (p === undefined) {
      idlePolls++;
      if (until === 'idle' && idlePolls >= 3) {
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    idlePolls = 0;
    if (isActionMenu(p)) {
      expect(until, `an action menu arrived for the ${until}-bound player`).toBe('menu');
      return;
    }
    if (p.type === 'card') {
      await sendPlayerInput(request, id, {type: 'card', cards: [String((p.cards ?? [])[0]?.name ?? '')]} as never);
    } else if (p.type === 'payment') {
      await sendPlayerInput(request, id, {type: 'payment', payment: payMc(Number(p.amount ?? 0))} as never);
    } else if (p.type === 'option') {
      await sendPlayerInput(request, id, {type: 'option'} as never);
    } else if (p.type === 'or') {
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never);
    } else {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  expect(false, `pregame drain stalled for ${id} (${until})`).toBeTruthy();
}

function menuIndex(menu: Wire, match: (o: Wire) => boolean, label: string): number {
  const at = (menu.options ?? []).findIndex(match);
  expect(at, `${label} is offered (got: ${(menu.options ?? []).map((o: Wire) => titleOf(o)).join(' | ')})`).toBeGreaterThanOrEqual(0);
  return at;
}

async function onMenu(request: APIRequestContext, id: string, pick: (menu: Wire) => Wire): Promise<Wire> {
  const model = await waitPrompt(request, id, isActionMenu, 'action menu');
  return await sendPlayerInput(request, id, pick(model.waitingFor as Wire) as never) as Wire;
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  await onMenu(request, id, (menu) => {
    const at = menuIndex(menu, (o) => titleOf(o) === 'Play project card', 'play project card');
    const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
    expect(offered, `${card} is in hand`).toBeDefined();
    return {type: 'or', index: at, response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 25)}};
  });
}

async function passTurn(request: APIRequestContext, id: string): Promise<void> {
  await onMenu(request, id, (menu) =>
    ({type: 'or', index: menuIndex(menu, (o) => /Pass/.test(titleOf(o)), 'pass'), response: {type: 'option'}}));
}

async function serverState(request: APIRequestContext, id: string): Promise<{energy: number, position: number, mfStored: number, blockade: Wire | undefined}> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const p = model.thisPlayer ?? {};
  const card = ((p.tableau ?? []) as Array<Wire>).find((c) => c.name === MF);
  return {
    energy: Number(p.energy ?? 0),
    position: Number(p.deltaProject?.position ?? 0),
    mfStored: Number(card?.resources ?? 0),
    blockade: p.deltaProject?.blockade as Wire | undefined,
  };
}

/** Every reveal the API seeding queued (Research's draw) — taken before the
 *  drive starts (the stage-bound spec's proven pattern, incl. the headless
 *  single-card viewer). */
async function drainReveals(page: Page): Promise<void> {
  const revealUp = async () => await page.locator('.con-reveal').count() > 0 ||
    await page.locator('dialog.con-zoom').count() > 0;
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < 12 && await revealUp(); i++) {
      await press(page, 'Enter', 800);
    }
    await page.waitForTimeout(2000);
    if (!await revealUp()) {
      return;
    }
  }
  expect(await revealUp(), 'every seeded reveal was taken').toBe(false);
}

test.describe('The triple nest (DM → stage-7 repeat → MF → nested blockade pick) · fhd', () => {
  test.setTimeout(600_000);
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the nested pick takes the scene, the outer flow survives, and ONE atomic batch commits the whole chain', async ({page, request}) => {
    // ── create until P1's deal offers EVERY seeded card ──
    let p1 = '';
    let p2 = '';
    let lastDeal: Array<string> = [];
    for (let attempt = 0; attempt < 60 && p1 === ''; attempt++) {
      const cfg = soloGameConfig({
        players: [
          {name: 'Nester', color: 'red', beginner: false, handicap: 0, first: true},
          {name: 'Rival', color: 'blue', beginner: false, handicap: 0, first: false},
        ],
        expansions: {deltaProject: true},
        customProjectCards: ALL_CARDS,
        customCorporationsList: ['ThorGate', 'CrediCor'],
        seed: 0.29 + attempt * 0.011,
      });
      const created = await request.post('/api/creategame', {data: cfg});
      expect(created.ok(), 'create-game accepted').toBeTruthy();
      const {players} = await created.json() as {players: Array<{id: string}>};
      const [a, b] = players;
      const pv = await (await request.get(`/api/player?id=${a.id}`)).json() as Wire;
      lastDeal = ((pv.waitingFor?.options ?? []) as Array<Wire>)
        .flatMap((o) => ((o.cards ?? []) as Array<Wire>).map((c) => String(c.name)));
      if (ALL_CARDS.every((c) => lastDeal.includes(c))) {
        p1 = a.id;
        p2 = b.id;
      }
    }
    expect(lastDeal, 'a deal offering the whole seed to P1').toEqual(expect.arrayContaining([...ALL_CARDS]));

    await answerInitialCards(request, p1, ALL_CARDS);
    await answerInitialCards(request, p2, []);
    await Promise.all([
      drainPregame(request, p1, 'menu'),
      drainPregame(request, p2, 'idle'),
    ]);

    // ── Gen 1 over the API. P1's first two actions hand the turn to P2, who
    //    passes — P1 then acts alone for the rest of the generation. ──
    await playCard(request, p1, TAG_CARDS[0]);
    await playCard(request, p1, TAG_CARDS[1]);
    await passTurn(request, p2);
    for (const card of TAG_CARDS.slice(2)) {
      await playCard(request, p1, card);
    }
    await playCard(request, p1, MF);
    // MF variant A (the lone live variant collapses): +1 steel ON the card,
    // and — decisively — MF is now USED THIS GENERATION, the stage-7 pool.
    await onMenu(request, p1, (menu) => {
      const at = menuIndex(menu, (o) => titleOf(o) === 'Perform an action from a played card', 'the blue-action door');
      return {type: 'or', index: at, response: {type: 'card', cards: [MF]}};
    });
    // The track walk 0 → 7. The landing's own repeat ask is answered with MF
    // (variant A again — steel becomes 2, the deploy stays affordable).
    {
      let model = await onMenu(request, p1, (menu) =>
        ({type: 'or', index: menuIndex(menu, (o) => titleOf(o) === 'Advance on the Hydronetwork track', 'the advance'), response: {type: 'option'}}));
      expect((model.waitingFor as Wire)?.type).toBe('deltaProject');
      model = await sendPlayerInput(request, p1, {type: 'deltaProject', amount: 7} as never) as Wire;
      expect((model.waitingFor as Wire)?.type, 'the stage-7 landing asks its repeat').toBe('card');
      model = await sendPlayerInput(request, p1, {type: 'card', cards: [MF]} as never) as Wire;
      expect((model.waitingFor as Wire)?.type, 'MF offers its two variants').toBe('or');
      await sendPlayerInput(request, p1, {type: 'or', index: 0, response: {type: 'option'}} as never);
    }
    await playCard(request, p1, DM);
    await waitPrompt(request, p1, isActionMenu, 'P1 back on the menu');
    const before = await serverState(request, p1);
    expect(before.position, 'the requirement seat: position 7').toBe(7);
    expect(before.mfStored, 'two modules stored').toBe(2);

    // ── The CONSOLE drive — the whole composition, one screen at a time. ──
    await openConsole(page, p1, '');
    await page.waitForSelector('.con-reveal, dialog.con-zoom', {timeout: 30_000}).catch(() => { /* maybe drained */ });
    await drainReveals(page);
    await waitForBoardHome(page, 40);

    await openCardActions(page);
    // Walk the browse grid to Dutch Mountains (structural identity). The grid
    // is TWO columns and every ring clamps at a wall, so the walk is a
    // serpentine over both axes — a one-way walk parks against the column's
    // end and presses A on whatever it was already sitting on.
    const focusedSource = () => page.locator('.con-cardactions .con-cardactions__detail-cardwrap').first()
      .getAttribute('data-zoom-slot').then((v) => v ?? '').catch(() => '');
    const WALK: ReadonlyArray<string> = [
      ...Array(10).fill('ArrowDown'), 'ArrowRight',
      ...Array(10).fill('ArrowDown'), ...Array(10).fill('ArrowUp'),
      'ArrowLeft', ...Array(10).fill('ArrowUp'),
    ];
    for (const dir of WALK) {
      if (await focusedSource() === DM) {
        break;
      }
      await press(page, dir, 300);
    }
    expect(await focusedSource(), 'Dutch Mountains focused').toBe(DM);
    const dmStage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
    for (let i = 0; i < 4 && await dmStage.count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(dmStage, 'the DM composer').toHaveCount(1, {timeout: 8000});

    // ── Level 1: the stage-reward pick — seated on the FARTHEST claimable
    //    stage, which is 7 itself. ──
    for (let i = 0; i < 4 && await page.locator('.con-hydro').count() === 0; i++) {
      await press(page, 'Enter', 1400);
    }
    await page.waitForSelector('.con-hydro__layer--rewardpick', {timeout: 10_000});
    expect(await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? ''),
    'seated on stage 7').toBe('7');
    await shoot(page, '01-reward-pick-stage7');

    // ── Level 2: A on the unanswered «повтори действие» ask → the repeat
    //    browser stands over the reward pick (dossier left, MF's variant
    //    tiles right). ⚠️ Every locator here is `:visible` — the HIDDEN
    //    source instance's tiles come FIRST in the DOM, and a bare
    //    first-match wait dies on them with the real browser on screen. ──
    await press(page, 'Enter', 2200);
    await expect(page.locator('.con-cardactions__tile:visible').first(), 'the repeat browser stands')
      .toBeVisible({timeout: 15_000});
    await shoot(page, '02-repeat-browser');
    // Walk to the DEPLOY variant (2 / 2) — the VISIBLE detail chip.
    const focusedVariant = () => page.locator('.con-cardactions__detail-variant:visible').first()
      .textContent().then((t) => (t ?? '').replace(/\s+/g, ' ').trim()).catch(() => '');
    for (let i = 0; i < 8 && !(await focusedVariant()).includes('2 / 2'); i++) {
      await press(page, 'ArrowRight', 400);
    }
    expect(await focusedVariant(), 'the deploy variant focused in the repeat browser').toContain('2 / 2');

    // ── Level 3: «Выбрать» → MF's composer (repeat mode) → its blockade row
    //    opens the NESTED hydro pick. ──
    const mfStage = page.locator('.con-cardactions__stagewrap .con-composer--stage:visible');
    for (let i = 0; i < 4 && await mfStage.count() === 0; i++) {
      await press(page, 'Enter', 1400);
    }
    for (let i = 0; i < 10 && await page.locator('.con-hydro__layer--blockpick').count() === 0; i++) {
      const missingFocused = await page.locator('.con-composer__row--focused.con-composer__row--missing:visible').count();
      if (missingFocused > 0) {
        await press(page, 'Enter', 1300);
      } else {
        await press(page, 'ArrowDown', 300);
      }
    }
    await page.waitForSelector('.con-hydro__layer--blockpick', {timeout: 12_000});

    // ── THE CLAIM OF THIS SPEC: the nested instrument owns the scene and the
    //    outer flow is UNDAMAGED underneath. Before the nesting law this very
    //    frame was where the stack collapsed. ──
    const sceneRead = await page.evaluate(() => {
      const visible = (el: Element | null): boolean => {
        if (el === null) {
          return false;
        }
        const cs = getComputedStyle(el as HTMLElement);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
      };
      return {
        blockpick: visible(document.querySelector('.con-hydro__layer--blockpick')),
        browsersDrawn: Array.from(document.querySelectorAll('.con-cardactions'))
          .filter((el) => visible(el)).length,
        ghostGate: document.querySelector('.con-hydro__gate--ghost') !== null,
      };
    });
    expect(sceneRead.blockpick, 'the nested target pick is DRAWN').toBe(true);
    expect(sceneRead.browsersDrawn, 'no ДЕЙСТВИЯ КАРТ surface paints over the nested pick').toBe(0);
    expect(sceneRead.ghostGate, 'the ghost gate stands in front of the candidate').toBe(true);
    await shoot(page, '03-nested-blockade-pick');

    // ── Resolve UP the chain: target → MF composer → «Выбрать это действие»
    //    → the reward pick, ask answered. Every return is the SUSPENDED outer
    //    role coming back — the collapse used to make each of these a dead
    //    frame. ──
    await press(page, 'Enter', 1800); // A on the (focused) legal candidate — Rival
    await page.waitForSelector('.con-hydro__layer--blockpick', {state: 'detached', timeout: 10_000});
    await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage:visible').first(),
      'the MF composer came back painted').toBeVisible({timeout: 8000});
    expect(await page.evaluate(() => document.body.textContent ?? ''), 'the summary names the target')
      .toContain('Rival');
    await shoot(page, '04-composed-target');

    await press(page, 'Enter', 2200); // «Выбрать это действие» → resolve the repeat
    await page.waitForSelector('.con-hydro__layer--rewardpick', {timeout: 12_000});
    await expect(page.locator('.con-hydro__ctazone .con-hydro__bonus-tick'),
      'the reward pick returned with its ask ANSWERED — the suspended role restored').toHaveCount(1, {timeout: 8000});
    await shoot(page, '05-reward-pick-answered');

    // ── Resolve the reward pick → the DM composer, then the ONE commit. ──
    await press(page, 'Enter', 2000);
    await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 10_000});
    await expect(dmStage, 'the DM composer came back with the claim composed').toHaveCount(1, {timeout: 8000});
    await shoot(page, '06-dm-composed');
    for (let i = 0; i < 5; i++) {
      await press(page, 'Enter', 2000);
      if (await page.locator('.con-cardactions').count() === 0) {
        break;
      }
      // A landed on the stage-reward row («Изменить выбор») and re-opened the
      // pick — close it (the prior draft is kept) and step off the row.
      if (await page.locator('.con-hydro').count() > 0) {
        await press(page, 'Escape', 1800);
        await press(page, 'ArrowDown', 500);
      }
    }

    // ── The server agrees: one atomic batch did the WHOLE composition. ──
    await expect.poll(async () => (await serverState(request, p2)).blockade?.by,
      {timeout: 25_000, message: 'the blockade lands on the rival'}).toBe('red');
    const after = await serverState(request, p1);
    expect(after.energy, 'DM paid its 3 energy').toBe(before.energy - 3);
    expect(after.mfStored, 'one module physically became the blockade').toBe(1);
    expect(after.position, 'a reward-only claim never moves the marker').toBe(7);
    await shoot(page, '07-after');
  });
});
