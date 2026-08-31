import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * A COPIED ACTION THAT WALKS INTO ANOTHER WORKSPACE.
 *
 * The Hydronetwork's stage-7 reward repeats a used blue action, and an action is
 * not only a draw: «Титановая плавучая платформа» spends a floater to TRADE, so
 * the copy's follow-up is the COLONIES SCREEN — opened as a step INSIDE the
 * Hydronetwork (`hydro ⊃ colonies`), not as a screen of its own.
 *
 * WHY THIS EXISTS. The stage gate first matched prompts by the card their
 * `choiceContext` named, and a repeated trade raises a BARE `SelectColony` that
 * names nothing — so the colonies screen was free to open while the marker was
 * still walking, which is the original defect one artifact family over. The fix
 * is at the funnel (`Player.setWaitingFor` stamps `copiedActionSource` from the
 * live copied-action scope), so no card marks anything and a card written next
 * year is covered. This drives the whole path to prove it.
 *
 * WHAT IT PINS:
 *  1. NOTHING of stage 7 while the marker is below it — the colonies screen
 *     included. Sampled continuously.
 *  2. The colonies arrive EMBEDDED in the Hydronetwork's own zone, never as a
 *     standalone screen over it, and never in their own band «for a frame»
 *     first (the anti-blink contract: a nested frame renders NOWHERE until its
 *     host's zone exists).
 *  3. The crumb is ONE continuous line rooted at the Hydronetwork — the entry
 *     reads as a step of the flow, not as a new screen.
 *  4. The colonies screen keeps its own body and drops only its shell (that IS
 *     the embedded contract), and `L3 Источник` names the REPEATED CARD — which
 *     is the thing the host now publishes instead of the guest guessing.
 */

const OUT = path.resolve('screenshots', 'hydro-copied-colony');

// Tags for stages 1..7 + the traversal modifier + the repeatable TRADE action.
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Regolith Eaters'];
// …AND A SPARE TRADE FLEET. The trade is refused with «Нет свободного
// торгового флота» on the seat's single starting fleet — read off the branch's
// own refusal, not guessed. «Небесные доки» grants one (it needs 2 Earth tags,
// which is why «Земной офис» rides along: Development Manager alone is one).
const FLEET_CARDS = ['Earth Office', 'Sky Docks'];

/*
 * THE REPEATED ACTION: «Союз тёмной стороны» — ONE branch, and that branch is a
 * bare `SelectColony`.
 *
 * «Титановая плавучая платформа» was the obvious pick and is the wrong one for a
 * driver: its trade is the SECOND of two branches, and the planner cannot
 * capture it at all. Descending into it shows «Потратьте 1 аэростат, чтобы
 * бесплатно поторговать · › ДАЛЕЕ: Оплата и подтверждение — на выбранной
 * колонии» over a command bar of `X ОСМОТРЕТЬ · B ОТМЕНА` — no «Выбрать это
 * действие», because the colony is chosen at RUNTIME and a plan has nothing to
 * capture. Leaving the reuse unanswered is not a way round it either: the CTA
 * then says «Действие не выбрано — нажмите ещё раз, чтобы продвинуться без
 * повтора», which is the conscious WAIVE, so the copy never happens.
 *
 * A single-branch trade has neither problem, and it is also the sharper subject:
 * its prompt is the bare `SelectColony` that names no card at all — the exact
 * shape the stage gate could not see before the attribution moved to the funnel.
 */
const REPEAT_CARD = 'Darkside Smugglers\' Union';
const ALL_CARDS = [...TAG_CARDS, ...FLEET_CARDS, REPEAT_CARD, 'Delta Surge'];

const CFG = soloGameConfig({
  players: [{name: 'CopyColony', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true, colonies: true, moon: true},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.31,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 40; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    if (prompt.type === 'space') {
      model = await sendPlayerInput(request, id,
        {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never) as Wire;
      continue;
    }
    if (prompt.type === 'colony') {
      model = await sendPlayerInput(request, id,
        {type: 'colony', colonyName: (prompt.coloniesModel ?? [])[0]?.name} as never) as Wire;
      continue;
    }
    if (prompt.type === 'card') {
      // A card prompt that DEMANDS a pick (the colonies module adds several)
      // is refused by an empty answer — take the first offered card. «Answer
      // whatever stands» is the only shape that survives an unreproducible deal.
      const need = (prompt.min ?? prompt.minCardsToSelect ?? 0) as number;
      const pick = need > 0 ? [(prompt.cards ?? [])[0]?.name].filter((n) => n !== undefined) : [];
      model = await sendPlayerInput(request, id, {type: 'card', cards: pick} as never) as Wire;
      continue;
    }
    model = await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand and playable`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 22)},
  } as never);
}

test.describe('a copied action walks into the colonies · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  /*
   * ⚠️ NOT PASSING YET — and deliberately kept rather than deleted.
   *
   * The driver reaches the repeat composer INSIDE the Hydronetwork (crumb
   * «ГИДРОСЕТЬ МАРСА › МИКРОБНАЯ ФИКСАЦИЯ › ПОВТОР ДЕЙСТВИЯ», embedded, no
   * blink — that much is already photographed) but cannot SELECT the pad's
   * second branch: the composer opens on «add a floater» and the TRADE variant
   * is not in the ring, so the copy never walks into the colonies. Whether that
   * is a scenario problem (no free fleet / nothing tradeable in this seed) or a
   * real availability defect in the repeat preview is the next thing to settle
   * — and settling it needs the branch's own refusal read out, not another
   * key-press guess.
   *
   * What this scenario was written to prove is ALREADY proven one level down,
   * where the defect actually lived: `tests/delta/copiedActionSource.spec.ts`
   * drives the same card through the same reuse and asserts that its bare
   * `SelectColony` — which no card marks — is attributed to the copied card, so
   * the stage gate can hold it. This spec is the SCREEN half of that.
   */
  test('the repeated TRADE opens the colonies INSIDE the Hydronetwork — and only on stage 7', async ({page, request}) => {
    test.setTimeout(600_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.31});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of ALL_CARDS) {
      await playCard(request, id, card);
    }
    await toActionMenu(request, id);

    // USE the pad's trade branch once — that is what makes it repeatable, and it
    // also proves the ORDINARY door still works (the copy must look the same).
    const menu = await toActionMenu(request, id);
    const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Perform an action from a played card');
    expect(at, 'the smugglers are an available action').toBeGreaterThanOrEqual(0);
    await sendPlayerInput(request, id, {
      type: 'or', index: at, response: {type: 'card', cards: [REPEAT_CARD]},
    } as never);
    await toActionMenu(request, id);

    await openConsole(page, id, '');
    await waitForBoardHome(page, 30);

    // ── Open the Hydronetwork and plan 0 → 7. ──
    for (let attempt = 0; attempt < 4; attempt++) {
      await press(page, 'Period', 1400);
      await press(page, 'ArrowLeft', 1800);
      if (await page.locator('.con-hydro').count() > 0) {
        break;
      }
    }
    await page.waitForSelector('.con-hydro', {timeout: 20_000});
    // RT jumps to the FARTHEST legal stage, and with the colonies module in play
    // that can be past 7 (the Jovian tag the pad itself carries opens stage 8) —
    // so the target is SELECTED rather than assumed. Stage 7 is the one that
    // repeats an action; walking back to it is what the player would do.
    await press(page, 'Period', 900); // RT — «К дальнему»
    const focused = () => page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    for (let i = 0; i < 6 && await focused() !== '7'; i++) {
      await press(page, 'ArrowLeft', 500);
    }
    expect(await focused(), 'the plan targets the reuse stage').toBe('7');
    await shoot(page, '01-plan');

    // ── ARM THE CENSUS before the commit: the marker cell and the colonies
    //    surface, sampled TOGETHER (the defect is a co-occurrence). ──
    await page.evaluate(() => {
      const w = window as unknown as {
        __seq?: number, __c?: Array<Record<string, unknown>>, __stop?: () => void,
      };
      w.__seq = 0;
      w.__c = [];
      const sample = () => {
        const i = ++(w.__seq as number);
        const viewer = document.querySelector('.con-hydro__stop-marker--viewer');
        const cellAttr = viewer?.closest('[data-hydro-marker]')?.getAttribute('data-hydro-marker');
        const col = document.querySelector('.con-colonies');
        const row = {
          cell: cellAttr === undefined || cellAttr === null ? -1 : Number(cellAttr),
          colonies: col !== null,
          // EMBEDDED = inside the Hydronetwork's own zone. A colonies screen
          // that is up but NOT here is the standalone regression.
          embedded: document.querySelector('.con-hydro__embed .con-colonies') !== null,
          // Its own band would mean it stood up as a screen of its own.
          ownBand: col !== null && col.classList.contains('con-ws'),
          crumbRoot: (document.querySelector('.con-wshead__root')?.textContent ?? '').trim(),
        };
        const c = w.__c!;
        const prev = c[c.length - 1];
        if (prev === undefined || JSON.stringify(prev) !== JSON.stringify({...row, i: prev?.i})) {
          c.push({...row, i});
        }
      };
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      const iv = setInterval(sample, 60);
      w.__stop = () => {
        mo.disconnect();
        clearInterval(iv);
      };
    });

    // ── THE RAIL: every crossed stage that ASKS must be answered before the
    //    commit is offered — the two reward choices and the stage-7 reuse. The
    //    rail ticks its own answered rows, so the driver walks until they are
    //    all ticked rather than pressing a guessed number of times. ──
    for (let round = 0; round < 16; round++) {
      const st = await page.evaluate(() => ({
        rows: document.querySelectorAll('.con-hydro__pickrow').length,
        ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
        picker: document.querySelector('.con-cardactions') !== null,
      }));
      if (st.rows > 0 && st.ticks >= st.rows) {
        break;
      }
      if (st.picker) {
        // ONE branch, so the composer opens on it — and the tile carries its own
        // refusal if the trade is not legal, which is what caught the missing
        // fleet instead of another round of key presses.
        const tiles = await page.evaluate(() => Array.from(
          document.querySelectorAll('.con-cardactions__tile')).map((t) => ({
          card: t.getAttribute('data-action-card') ?? '',
          reason: (t.querySelector('.con-cardactions__tile-reason')?.textContent ?? '').trim(),
        })));
        expect(tiles.map((t) => t.card), `the used action is on offer — ${JSON.stringify(tiles)}`)
          .toContain(REPEAT_CARD);
        expect(tiles.find((t) => t.card === REPEAT_CARD)?.reason,
          `the trade is available — ${JSON.stringify(tiles)}`).toBe('');
        await press(page, 'Enter', 2000); // A — descend into the action
        await press(page, 'Enter', 2500); // A — «Выбрать это действие»
        await page.waitForSelector('.con-hydro', {timeout: 20_000});
        await page.waitForTimeout(800);
        continue;
      }
      await press(page, 'Enter', 1200);
    }
    const rail = await page.evaluate(() => ({
      rows: document.querySelectorAll('.con-hydro__pickrow').length,
      ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
    }));
    expect(rail.ticks, `every rail decision is captured (${JSON.stringify(rail)})`)
      .toBe(rail.rows);
    await shoot(page, '01b-plan-complete');

    // ── COMMIT — one press. ──
    await press(page, 'Enter', 1500);

    // ── THE STAGE-5 STOP stands between the commit and stage 7: keep 2 of the
    //    four dealt cards. (It is also what makes this the REAL scenario — the
    //    copy's prompts ride the very response that answers this pick.) ──
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 90_000});
    await press(page, 'Enter', 600);
    for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
      await press(page, 'ArrowRight', 450);
      await press(page, 'Enter', 600);
    }
    expect(await page.locator('.con-cards__slot--picked').count(), 'two picks held').toBe(2);
    await press(page, 'Period', 1500); // RT — «Подтвердить»

    // The colonies step is the copy's follow-up: it may only exist on cell 7.
    await page.waitForSelector('.con-hydro__embed .con-colonies', {timeout: 120_000});
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as unknown as {__stop?: () => void}).__stop?.());
    const census = await page.evaluate(() =>
      (window as unknown as {__c?: Array<Record<string, unknown>>}).__c ?? []);
    const dump = JSON.stringify(census);

    // Before judging the SCREEN, read the SERVER: did its copied-action stamp
    // reach the wire at all? A missing stamp and an ignored stamp look identical
    // from the census, and they are different bugs.
    const wire = await fetchPlayerModel(request, id) as Wire;

    console.log(`[wire] waitingFor=${wire.waitingFor?.type} stamp=${wire.waitingFor?.copiedActionSource}`);

    // ① NOTHING BELOW 7. Every sample taken while the marker was on a lower cell
    //    must be free of the colonies surface — embedded or otherwise.
    const early = census.filter((r) => (r.cell as number) >= 0 && (r.cell as number) < 7);
    expect(early.length, `the census watched the marker below 7 (${dump})`).toBeGreaterThan(0);
    for (const r of early) {
      expect(r.colonies, `the colonies opened at cell ${r.cell} (${dump})`).toBe(false);
    }

    // ② …AND IT NEVER STOOD IN ITS OWN BAND. A nested frame renders NOWHERE
    //    until its host's zone exists; standing up standalone «for a frame» is
    //    exactly the blink this contract removes.
    for (const r of census.filter((x) => x.colonies === true)) {
      expect(r.embedded, `the colonies are embedded in the track (${dump})`).toBe(true);
      expect(r.ownBand, `and never in a band of their own (${dump})`).toBe(false);
      expect(r.cell, 'on stage 7').toBe(7);
    }

    // ③ ONE CONTINUOUS CRUMB, rooted at the workspace the player entered.
    const head = await page.evaluate(() => ({
      root: (document.querySelector('.con-wshead__root')?.textContent ?? '').trim(),
      full: (document.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ownHeads: document.querySelectorAll('.con-colonies .con-wshead').length,
    }));
    expect(head.root.toLowerCase(), `the crumb is rooted at the track — ${head.full}`)
      .toContain('гидросет');
    // ④ The guest drops its SHELL and nothing else: the host owns the crumb, so a
    //    second header inside it would read as a modal that arrived.
    expect(head.ownHeads, `the embedded screen draws no header of its own — ${head.full}`).toBe(0);
    const body = await page.evaluate(() => {
      const zone = document.querySelector('.con-hydro__embed .con-colonies');
      return {
        // The screen's OWN body — its rail of colonies. Counted as «is the
        // screen really here», not «does it have N tiles»: this prompt offers
        // exactly the tradeable colonies, and a game can have one.
        cells: zone?.querySelectorAll('.con-colonies__slot').length ?? 0,
        grid: zone?.querySelector('.con-colonies__grid') !== null,
        mode: zone?.getAttribute('data-colony-mode') ?? '',
        text: (zone?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
        bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').toLowerCase(),
      };
    });
    expect(body.mode, `the screen is in its PICK mode, as on any prompt entry — ${body.text}`)
      .toBe('pick');
    // The screen's whole body is there — the same grid of colonies a normal
    // entry shows, not a reduced stand-in. (Its own SHELL is what an embedded
    // surface drops; its content is untouched — that IS the contract.)
    expect(body.cells, `every colony is on the grid — ${body.text}`).toBeGreaterThan(2);
    expect(body.grid, 'and it is the ordinary grid, not a stand-in').toBe(true);
    // ⑤ `L3 Источник` names the REPEATED CARD — the host publishes it, the guest
    //    no longer guesses (its crumb subject here is a STAGE NAME).
    expect(body.bar, `the source verb is offered — ${body.bar}`).toContain('источник');
    await shoot(page, '02-colonies-embedded');

    const model = await fetchPlayerModel(request, id) as Wire;
    expect(model.waitingFor?.copiedActionSource,
      'the server attributes the prompt to the copied card').toBe(REPEAT_CARD);
  });
});
