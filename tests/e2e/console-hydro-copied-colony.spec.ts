import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';
import {LAUNCHPAD, focusTradeVariantTile} from './cardTradeDoor';

/**
 * A COPIED ACTION THAT WALKS INTO ANOTHER WORKSPACE — «Летающая платформа».
 *
 * The Hydronetwork's stage-7 reward repeats a used blue action, and an action
 * is not only a draw: the launch-pad spends a floater to TRADE, so the copy's
 * follow-up is the COLONIES SCREEN — opened as a step INSIDE the Hydronetwork
 * (`hydro ⊃ colonies`), not as a screen of its own.
 *
 * WHY THIS EXISTS, twice over.
 *
 * ① THE ATTRIBUTION. The stage gate first matched prompts by the card their
 *    `choiceContext` named, and a repeated trade raises a BARE `SelectColony`
 *    that names nothing — so the colonies screen was free to open while the
 *    marker was still walking. The fix is at the funnel
 *    (`Player.setWaitingFor` stamps `copiedActionSource` from the live copied
 *    action scope), so no card marks anything.
 *
 * ② THE DEAD END. The trade branch is a DOOR: activated normally its confirm
 *    hands the player to a colony and the real commit is there. PLANNED as a
 *    repeat it led nowhere — the composer asked `waitingFor` for a trade that
 *    cannot exist yet, took the honest «нет» as a refusal of its own commit,
 *    and offered a command bar of «X ОСМОТРЕТЬ · B ОТМЕНА». A plan does not
 *    walk through doors: it captures the card and the BRANCH and stops, and the
 *    server (which already parks a repeat's responses) raises the colony pick
 *    as the copy's own follow-up. See `consoleActionComposer.ts` §
 *    RUNTIME-NAVIGATION STEPS.
 *
 * WHAT IT PINS:
 *  1. The repeat PLAN can be confirmed — the CTA is the plan's own verb, ready,
 *     with the trade variant chosen. (② above.)
 *  2. NOTHING of stage 7 while the marker is below it — the colonies screen
 *     included. Sampled continuously.
 *  3. The colonies TAKE THE SCENE — their own band, the track not drawn behind
 *     them. A whole colony screen squeezed into the room left under the track
 *     was two fit engines fighting in one box; nesting is not a layout problem,
 *     it is a HEADER statement.
 *  4. …and they spend that scene (the grid, not a strip beside an instrument).
 *  5. The crumb is ONE continuous line rooted at the Hydronetwork — drawn by
 *     the GUEST's own header, because no host chrome is left on screen.
 *  6. …AND THE TRADE RETURNS HOME. Answering the colony hands the screen back
 *     to the Hydronetwork — the flow that copied the action is the flow that
 *     finishes it.
 */

const OUT = path.resolve('screenshots', 'hydro-copied-colony');

// Tags for stages 1..7: building+power / earth / space / science / plant /
// microbe. The launch-pad carries the Jovian tag on top of them.
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Regolith Eaters'];
const ALL_CARDS = [...TAG_CARDS, LAUNCHPAD, 'Delta Surge'];

const CFG = soloGameConfig({
  players: [{name: 'CopyColony', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true, colonies: true},
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
  return {...NO_PAYMENT, megacredits: amount};
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

/**
 * USE the launch-pad's FLOATER branch — what makes the card repeatable.
 *
 * Deliberately NOT its trade branch: the seat starts with one trade fleet, and
 * spending it here would refuse the very variant this spec is about with a
 * perfectly honest «Нет свободного торгового флота». One floater more, one
 * generation-action spent, the fleet untouched.
 */
async function useLaunchpadFloater(request: APIRequestContext, id: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Perform an action from a played card');
  expect(at, 'the launch-pad is an available action').toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, id, {
    type: 'or', index: at, response: {type: 'card', cards: [LAUNCHPAD]},
  } as never);
  // Branch 1 of the card's own OrOptions — «положить аэростат на юпитерианскую
  // карту». (Branch 0 is the trade; the card file pins that order.)
  const model = await sendPlayerInput(request, id,
    {type: 'or', index: 1, response: {type: 'option'}} as never) as Wire;
  // …and the floater's destination, if it was asked for at all.
  if ((model.waitingFor as Wire | undefined)?.type === 'card') {
    await sendPlayerInput(request, id, {type: 'card', cards: [LAUNCHPAD]} as never);
  }
  await toActionMenu(request, id);
}

test.describe('a copied action walks into the colonies · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('the repeated TRADE opens the colonies INSIDE the Hydronetwork — and only on stage 7', async ({page, request}) => {
    test.setTimeout(900_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.31});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of ALL_CARDS) {
      await playCard(request, id, card);
    }
    await useLaunchpadFloater(request, id);

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
    for (let i = 0; i < 8 && await focused() !== '7'; i++) {
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
          // A NESTED FULL SCREEN GETS THE SCENE, never a slot under the track:
          // squeezed into the Hydronetwork's zone it was a whole colony screen
          // beneath an instrument it has nothing to do with, two fit engines in
          // one box. `embedded` is now the REGRESSION.
          embedded: document.querySelector('.con-hydro__embed .con-colonies') !== null,
          ownBand: col !== null && col.classList.contains('con-ws'),
          // …and the host stops being DRAWN while it does — mounted, mid-flow,
          // its BOX intact (that is the point: `visibility`, never `display`,
          // so the returning layout has nothing to re-solve), simply not on
          // screen. The nesting is stated in the header instead.
          hydroShown: (() => {
            const el = document.querySelector('.con-hydro');
            return el !== null && getComputedStyle(el).visibility !== 'hidden' ? 1 : 0;
          })(),
        };
        const c = w.__c;
        if (c === undefined) {
          return;
        }
        const prev = c[c.length - 1];
        if (prev === undefined || JSON.stringify(prev) !== JSON.stringify({...row, i: prev.i})) {
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
    //    commit is offered — the reward choices and the stage-7 reuse. The rail
    //    ticks its own answered rows, so the driver walks until they are all
    //    ticked rather than pressing a guessed number of times. ──
    let planShot = false;
    for (let round = 0; round < 20; round++) {
      const st = await page.evaluate(() => ({
        rows: document.querySelectorAll('.con-hydro__pickrow').length,
        ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
        picker: document.querySelector('.con-cardactions') !== null,
        composer: document.querySelector('.con-composer') !== null,
      }));
      if (st.rows > 0 && st.ticks >= st.rows) {
        break;
      }
      if (st.picker && !st.composer) {
        // EACH PRINTED ACTION ROW IS ITS OWN TILE. The launch-pad draws two —
        // «положить аэростат» and «потратить аэростат ради бесплатной торговли»
        // — so the trade is reached by choosing the right TILE, exactly as the
        // ordinary door does (`cardTradeDoor.focusTradeVariantTile`).
        const tiles = await page.evaluate(() => Array.from(
          document.querySelectorAll('.con-cardactions__tile')).map((t) => ({
          card: t.getAttribute('data-action-card') ?? '',
          reason: (t.querySelector('.con-cardactions__tile-reason')?.textContent ?? '').trim(),
        })));
        expect(tiles.map((t) => t.card), `the used action is on offer — ${JSON.stringify(tiles)}`)
          .toContain(LAUNCHPAD);
        await focusTradeVariantTile(page);
        await press(page, 'Enter', 2200); // A — descend into the trade variant
        continue;
      }
      if (st.composer) {
        // ── ② THE REGRESSION, read off the screen the player sees. ──
        const cta = await page.evaluate(() => {
          const el = document.querySelector('.con-composer__cta');
          return {
            label: (el?.querySelector('.con-composer__cta-label')?.textContent ?? '').trim(),
            ready: el?.classList.contains('con-composer__cta--ready') ?? false,
            held: el?.classList.contains('con-composer__cta--held') ?? false,
            disabled: el?.getAttribute('aria-disabled') ?? '',
            nav: Array.from(document.querySelectorAll('.con-composer__branch'))
              .map((b) => b.getAttribute('data-branch-nav') ?? '-'),
            body: (document.querySelector('.con-composer')?.textContent ?? '')
              .replace(/\s+/g, ' ').trim().slice(0, 260),
            bar: (document.querySelector('.con-cmdbar')?.textContent ?? '')
              .replace(/\s+/g, ' ').trim(),
          };
        });
        if (!planShot) {
          await shoot(page, '02-repeat-plan-composer');
          planShot = true;
        }
        // The plan's own verb — never «Выбрать колонию»: there is no colony to
        // choose yet, and saying so was the dead end.
        expect(cta.label.toLowerCase(), `the CTA is the PLAN's verb — ${cta.body}`)
          .not.toContain('колони');
        expect(cta.held, `the commit is not withheld — ${cta.body}`).toBe(false);
        expect(cta.disabled, `…and it is pressable — bar «${cta.bar}»`).toBe('false');
        expect(cta.bar.toLowerCase(), 'the bar offers the confirm').toMatch(/подтверд|выбрать/);
        await press(page, 'Enter', 2500); // A — «Выбрать это действие»
        await page.waitForSelector('.con-hydro', {timeout: 20_000});
        await page.waitForTimeout(900);
        continue;
      }
      await press(page, 'Enter', 1200);
    }
    const rail = await page.evaluate(() => ({
      rows: document.querySelectorAll('.con-hydro__pickrow').length,
      ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
      text: (document.querySelector('.con-hydro__rail')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }));
    expect(rail.ticks, `every rail decision is captured (${JSON.stringify(rail)})`)
      .toBe(rail.rows);
    await shoot(page, '03-plan-complete');

    // ── COMMIT — one press. ──
    await press(page, 'Enter', 1500);

    // ── THE STAGE-5 STOP stands between the commit and stage 7: keep 2 of the
    //    four dealt cards. (It is also what makes this the REAL scenario — the
    //    copy's prompts ride the very response that answers this pick.) ──
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 120_000});
    await press(page, 'Enter', 600);
    for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
      await press(page, 'ArrowRight', 450);
      await press(page, 'Enter', 600);
    }
    expect(await page.locator('.con-cards__slot--picked').count(), 'two picks held').toBe(2);
    await press(page, 'Period', 1500); // RT — «Подтвердить»

    // The colonies step is the copy's follow-up: it may only exist on cell 7.
    await page.waitForSelector('.con-colonies', {timeout: 180_000});
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

    // ② …AND WHEN IT DID, IT TOOK THE SCENE. Its own band, never a slot inside
    //    the track's zone, and the track is not drawn behind it.
    const withColonies = census.filter((x) => x.colonies === true);
    for (const r of withColonies) {
      expect(r.embedded, `the colonies are NOT squeezed into the track zone (${dump})`).toBe(false);
      expect(r.ownBand, `they stand in their own band (${dump})`).toBe(true);
      expect(r.cell, 'on stage 7').toBe(7);
    }
    // …and the track handed the scene over. ⚠️ ONE sample of tolerance, named:
    // the guest's mount and the host's hide are two DOM writes of the SAME Vue
    // flush, so a MutationObserver — which samples mutations, not PAINTS — can
    // legitimately catch the state between them. The eye never can. What the
    // assertion is really about is the STEADY state, so the last word wins and
    // a lingering track fails.
    const bothDrawn = withColonies.filter((r) => r.hydroShown !== 0).length;
    expect(bothDrawn, `the track lingers over the guest (${dump})`).toBeLessThanOrEqual(1);
    expect(withColonies[withColonies.length - 1]?.hydroShown,
      `and the scene is the guest's once it settles (${dump})`).toBe(0);

    // (The host's own box UNDER the guest is deliberately not asserted here: a
    //  surface that is not being drawn is not a meaningful measurement, and the
    //  claim that matters — «it comes back whole» — is measured on the RETURN,
    //  below, where the crop was actually reported.)

    // DIAGNOSTIC: the host's own box and the chain it hangs off, stated where
    // the probe can see it (a crop is always a disagreement about layout).
    const hostDiag = await page.evaluate(() => {
      const el = document.querySelector('.con-hydro') as HTMLElement | null;
      if (el === null) {
        return 'no host';
      }
      const chain: Array<Record<string, unknown>> = [];
      let node: HTMLElement | null = el;
      for (let i = 0; i < 4 && node !== null; i++) {
        const cs = getComputedStyle(node);
        const r = node.getBoundingClientRect();
        chain.push({
          cls: node.className.toString().slice(0, 48),
          display: cs.display, visibility: cs.visibility, position: cs.position,
          flex: cs.flex, w: Math.round(r.width), h: Math.round(r.height),
          x: Math.round(r.left), transform: cs.transform.slice(0, 40),
        });
        node = node.parentElement;
      }
      return chain;
    });
    console.log(`[hostDiag] ${JSON.stringify(hostDiag)}`);

    // ③ ONE CONTINUOUS CRUMB, rooted at the workspace the player entered.
    const head = await page.evaluate(() => ({
      root: (document.querySelector('.con-wshead__root')?.textContent ?? '').trim(),
      full: (document.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ownHeads: document.querySelectorAll('.con-colonies .con-wshead').length,
    }));
    expect(head.root.toLowerCase(), `the crumb is rooted at the track — ${head.full}`)
      .toContain('гидросет');
    // …and it only ever GAINS a tail: the stage the flow is on is named, so the
    // line reads as one flow going deeper rather than a screen that arrived.
    expect(head.full.toLowerCase(), `the crumb names the step — ${head.full}`)
      .toMatch(/колон|торг/);
    // ④ …AND IT IS THE GUEST'S OWN HEADER THAT CARRIES THE NESTING. With the
    //    scene handed over there is no host chrome left on screen, so the one
    //    header standing has to be the colonies' — rooted at the flow above.
    expect(head.ownHeads, `the screen draws the flow's header — ${head.full}`).toBe(1);
    const body = await page.evaluate(() => {
      const zone = document.querySelector('.con-colonies');
      const zr = zone?.getBoundingClientRect();
      return {
        // The screen's OWN body — its rail of colonies. Counted as «is the
        // screen really here», not «does it have N tiles».
        cells: zone?.querySelectorAll('.con-colonies__slot').length ?? 0,
        grid: zone?.querySelector('.con-colonies__grid') !== null,
        mode: zone?.getAttribute('data-colony-mode') ?? '',
        text: (zone?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
        bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').toLowerCase(),
        // ④b THE WHOLE SCENE: the guest spends the band it now owns.
        fill: zr !== undefined && window.innerHeight > 0 ?
          Math.round((zr.height / window.innerHeight) * 100) : -1,
      };
    });
    expect(body.mode, `the screen is in its PICK mode, as on any prompt entry — ${body.text}`)
      .toBe('pick');
    expect(body.cells, `every colony is on the grid — ${body.text}`).toBeGreaterThan(2);
    expect(body.grid, 'and it is the ordinary grid, not a stand-in').toBe(true);
    expect(body.fill, `the guest spends the whole scene (${body.fill}% of the viewport)`).toBeGreaterThan(70);
    // ⑤ `L3 Источник` names the REPEATED CARD — the host publishes it, the guest
    //    no longer guesses (its crumb subject here is a STAGE NAME).
    expect(body.bar, `the source verb is offered — ${body.bar}`).toContain('источник');
    await shoot(page, '04-colonies-embedded');

    expect(wire.waitingFor?.copiedActionSource,
      'the server attributes the prompt to the copied card').toBe(LAUNCHPAD);

    // ── ⑤b «THE PARK ALREADY OWNS THIS WORKSPACE.» Set the step aside (B =
    //     «свернуть») and ask the WHEEL for the Hydronetwork again. You cannot
    //     be inside the same workspace twice, so that press can only mean
    //     «верни меня туда». Two things make it work, and BOTH are needed
    //     because they cover different halves of the same failure: the door
    //     routes through the park while the park is still there
    //     (`parkOwnsFlow`), and a frame that ends up fresh anyway REFUSES to
    //     adopt a flow record it did not make (`ownedByThisFrame`) instead of
    //     rendering it — which used to be a sealed screen: a committed
    //     workspace with no content, «Ⓐ Выполняется» as its only verb and B
    //     dead by phase, recoverable only by reloading. ──
    await press(page, 'Escape', 2200); // B — свернуть
    await page.waitForTimeout(900);
    expect(await page.locator('.con-colonies').count(), 'the step is set aside').toBe(0);
    for (let attempt = 0; attempt < 4; attempt++) {
      await press(page, 'Period', 1400);
      await press(page, 'ArrowLeft', 1800);
      if (await page.locator('.con-colonies, .con-hydro').count() > 0) {
        break;
      }
    }
    await page.waitForTimeout(1200);
    const reopened = await page.evaluate(() => ({
      colonies: document.querySelector('.con-colonies') !== null,
      hydro: document.querySelector('.con-hydro') !== null,
      // The sealed screen's signature: a committed track with an empty scene
      // and a bar offering nothing but the absorbed beat.
      bar: (document.querySelector('.con-cmdbar')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
    }));
    await shoot(page, '05-back-through-the-park');
    // EITHER the decision itself is back (the park answered), OR the track is
    // standing usable — never the sealed committed screen. The one thing that
    // may not happen is a workspace whose only verb is the absorbed beat.
    expect(reopened.bar, `no sealed screen — ${JSON.stringify(reopened)}`)
      .not.toMatch(/^[^a-zа-я]*гидросеть марса\s*a?выполняется$/);
    expect(reopened.colonies || reopened.hydro,
      `something answerable is on screen — ${JSON.stringify(reopened)}`).toBe(true);
    if (!reopened.colonies) {
      // A fresh track, then: it must be a WORKING one — its own verbs, not a
      // frozen commit. Walk back to the decision through the board card.
      expect(reopened.bar, `the fresh track is usable — ${JSON.stringify(reopened)}`)
        .toMatch(/этап|дальн|свернуть|назад|закрыть/);
      await press(page, 'Escape', 1800);
      await press(page, 'Enter', 2600); // A on the board-home restore card
      await page.waitForTimeout(1500);
    }
    await page.waitForSelector('.con-colonies', {timeout: 60_000});

    // ── ⑥ THE RETURN. Answer the colony — the focus stage, then its confirm.
    //    The step is over, but the FLOW is not: the Hydronetwork owns what
    //    happens next (the resume, the stage's own reward wave, the result
    //    read) and it must have the screen back to do it. «The step ended» is
    //    not «the flow ended», and a one-shot read taken after both have
    //    happened cannot tell those apart — so the return is SAMPLED. ──
    await page.evaluate(() => {
      const w = window as unknown as {
        __r?: Array<Record<string, unknown>>, __rstop?: () => void,
      };
      w.__r = [];
      const sample = () => {
        const el = document.querySelector('.con-hydro');
        const row = {
          // SHOWN, not merely mounted: the host keeps its box under the guest
          // (`visibility`, never `display`), so «is the track back» is a
          // question about paint.
          hydro: el !== null && getComputedStyle(el).visibility !== 'hidden',
          colonies: document.querySelector('.con-colonies') !== null,
          // The traversal's own payoff read — «Укрепление завершено».
          result: document.querySelector('.con-hydro__layer--result') !== null,
          // …and the honest ending of a finished flow: the board. ⚠️ The bar's
          // caps are a `text-transform`, so its DOM text is «Журнал» — an
          // uppercase match here reads as «the flow never ended».
          board: (document.querySelector('.con-cmdbar')?.textContent ?? '')
            .toLowerCase().includes('журнал'),
          root: (document.querySelector('.con-wshead__root')?.textContent ?? '').trim(),
        };
        const c = w.__r;
        if (c === undefined) {
          return;
        }
        const prev = c[c.length - 1];
        if (prev === undefined || JSON.stringify(prev) !== JSON.stringify(row)) {
          c.push(row);
        }
      };
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      const iv = setInterval(sample, 60);
      w.__rstop = () => {
        mo.disconnect();
        clearInterval(iv);
      };
    });
    await press(page, 'Enter', 2600); // A — the colony's focus stage
    await shoot(page, '05b-colony-focus');
    await press(page, 'Enter', 3000); // A — the trade's own single confirm
    // …AND THE TRADE PAYS OUT INSIDE THE SAME FRAME. «Титановая шахта» arrives
    // as a card to TAKE, still under the Hydronetwork's crumb — the step is not
    // over until its own reward is in the player's hand, and a driver that
    // waited for the guest to detach without answering that would be waiting on
    // a screen it had left standing.
    for (let i = 0; i < 30; i++) {
      const gone = await page.locator('.con-colonies').count() === 0;
      if (gone) {
        break;
      }
      const takeable = await page.evaluate(() =>
        (document.querySelector('.con-cmdbar')?.textContent ?? '').toUpperCase().includes('ВЗЯТЬ'));
      await press(page, takeable ? 'Enter' : 'Escape', takeable ? 1600 : 1200);
    }
    await page.waitForSelector('.con-colonies', {state: 'detached', timeout: 120_000});
    // Let the flow finish on its own — the resume, the wave, the result, the
    // conclusion. Bounded: what is asserted is what was SEEN, never a timeout.
    for (let i = 0; i < 40; i++) {
      const done = await page.evaluate(() => (window as unknown as {
        __r?: Array<Record<string, unknown>> }).__r?.some((r) => r.board === true) ?? false);
      if (done) {
        break;
      }
      await page.waitForTimeout(1000);
    }
    await page.evaluate(() => (window as unknown as {__rstop?: () => void}).__rstop?.());
    const back = await page.evaluate(() =>
      (window as unknown as {__r?: Array<Record<string, unknown>>}).__r ?? []);
    const rdump = JSON.stringify(back);
    await shoot(page, '06-after-the-trade');

    // …AND IT CAME BACK WHOLE. The crop was a layout theft, so the evidence is
    // the box: the track's rail spans the band it always did.
    const backBox = await page.evaluate(() => {
      const el = document.querySelector('.con-hydro__rail');
      const r = el?.getBoundingClientRect();
      return r === undefined ? -1 : {w: Math.round(r.width), x: Math.round(r.left)};
    });
    if (typeof backBox !== 'number') {
      expect(backBox.w, `the track came back whole (${JSON.stringify(backBox)})`)
        .toBeGreaterThan(Math.round(1920 * 0.7));
      expect(backBox.x, `and at its own left edge (${JSON.stringify(backBox)})`)
        .toBeLessThan(Math.round(1920 * 0.25));
    }

    // THE TRACK TAKES THE SCREEN BACK AND FINISHES ITS OWN FLOW. The return is
    // not «the guest vanished»: the Hydronetwork is shown again and plays its
    // own payoff read — «Укрепление завершено» — which is the whole reason the
    // step belonged to it rather than opening over it. (The guest's own leave
    // legitimately overlaps that: it is a fixed band dissolving above a host
    // that never moved, which is the point of the fixed band.)
    const returned = back.filter((r) => r.hydro === true);
    expect(returned.length, `the Hydronetwork got the screen back — ${rdump}`).toBeGreaterThan(0);
    for (const r of returned) {
      expect(String(r.root).toLowerCase(), `and it is still the same flow — ${rdump}`)
        .toContain('гидросет');
    }
    expect(returned.some((r) => r.result === true),
      `the track played its own result after the trade — ${rdump}`).toBe(true);
    // …AND ONLY THEN LEFT. A finished flow LEAVES (it never folds back to its
    // own browse layer), so the honest last state is the board.
    expect(back.some((r) => r.board === true), `the finished flow left — ${rdump}`).toBe(true);
    const last = back[back.length - 1];
    expect(last?.colonies, `nothing of the guest outlived it — ${rdump}`).toBe(false);
    expect(last?.hydro, 'and neither did the workspace').toBe(false);
    const after = await fetchPlayerModel(request, id) as Wire;
    console.log(`[wire·after] waitingFor=${after.waitingFor?.type} title=${titleOf(after.waitingFor as Wire)}`);
    console.log(`[return] ${rdump}`);
  });
});
