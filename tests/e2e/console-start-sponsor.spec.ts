import {test, expect, Page} from '@playwright/test';
import {press, stepKind, stepSubject, waitPressable, summaryVisible, fillPicks, pickCards} from './consoleStart';

/**
 * «ЭПАТАЖНЫЙ СПОНСОР» — the play-from-hand prelude, as a STEP of the Game
 * Start Workspace.
 *
 * What this probe defends: the server's `SelectProjectCardToPlay` (raised by
 * the `PlayProjectCard` deferred action) used to be classified
 * `projectCard/playFromHand` and opened as a SHELL SECTION — a second full
 * screen with its own «КАРТЫ В РУКЕ» crumb root, over a Game Start Workspace
 * that was still mounted underneath. The player fell out of the flow and the
 * causality («this project is being played BECAUSE of that prelude») was
 * unreadable. It is now hosted INSIDE the workspace: the same hand instance,
 * teleported, wearing the start shell.
 */

function cfg(opts: {preludes: Array<string>, corps?: Array<string>}) {
  return {
    players: [{name: 'Sponsor', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    customCorporationsList: opts.corps ?? ['CrediCor', 'Teractor'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    // FORCE the deal: the whole probe is about this one prelude.
    customPreludes: opts.preludes,
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/** Structural readout of where the player actually is. */
async function surfaces(page: Page) {
  return page.evaluate(() => {
    const vis = (sel: string): boolean => {
      const el = document.querySelector(sel);
      if (el === null) {
        return false;
      }
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.02;
    };
    const hand = document.querySelector('.con-hand');
    return {
      startUp: vis('.con-start'),
      handUp: hand !== null,
      /** The hand is INSIDE the start workspace's embed zone. */
      handEmbedded: hand !== null && hand.closest('.con-start__handstep') !== null,
      /** …and therefore wears the host's shell, not its own. */
      handOwnHead: document.querySelectorAll('.con-hand__head').length,
      headCount: document.querySelectorAll('.con-wshead').length,
      /** The whole rendered breadcrumb — the contract is what the player
       *  READS, not which span happens to carry each segment. */
      crumb: (document.querySelector('.con-wshead')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
      composerUp: vis('.con-composer--play'),
      composerEmbedded: document.querySelector('.con-composer--play')?.closest('.con-hand__stage') !== null,
      playedDock: vis('.con-splayed'),
      playedOverlay: vis('.con-played-overlay, .con-info__played'),
      legacyModal: document.querySelectorAll('.wf-modal, .waitingfor-modal').length,
      /** The floating ask-banner. It belongs to the MINIMIZED state only: over
       *  an open workspace it is a second title, and it used to land across
       *  the breadcrumb tail. */
      banner: (document.querySelector('.con-banner:not(.con-banner--events)')?.textContent ?? '').trim(),
      handCards: document.querySelectorAll('.con-hand__slot').length,
      playable: document.querySelectorAll('.con-hand__slot--playable').length,
      /** The card faces actually PAINTED (a rendered-but-invisible grid is
       *  the exact defect this probe was written for). */
      paintedCards: Array.from(document.querySelectorAll('.con-hand__slot'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 40 && r.height > 60 && r.top < window.innerHeight && r.bottom > 0;
        }).length,
      /** Deployment chrome that must be GONE while the hand owns the body. */
      journeyRail: document.querySelectorAll('.con-start__frame .con-jrail').length,
      startPlayed: document.querySelectorAll('.con-splayed').length,
      startQueue: document.querySelectorAll('.con-start__queue').length,
      /** The toolbar (counts + tag filters) sits ABOVE the cards, as on the
       *  normal hand screen — never floating in the middle of the body. */
      toolbarY: document.querySelector('.con-hand__toolbar')?.getBoundingClientRect().top ?? -1,
      firstCardY: document.querySelector('.con-hand__slot')?.getBoundingClientRect().top ?? -1,
      /** The player's own «Разыграно» — the normal play flow's destination. */
      tableauCards: document.querySelectorAll('[data-played-key]').length,
      /** Does the host zone exist at all, and where did the hand land? */
      zoneExists: document.querySelector('.con-start__handstep') !== null,
      handParent: (() => {
        const h = document.querySelector('.con-hand');
        return h?.parentElement === null || h?.parentElement === undefined ?
          'none' : `${h.parentElement.tagName}.${h.parentElement.className}`.slice(0, 60);
      })(),
      /** Why a card might not be painted — the diagnostic set. */
      diag: {
        transit: document.querySelector('.con-hand')?.classList.contains('con-hand--transit') ?? false,
        staged: document.querySelector('.con-hand')?.classList.contains('con-hand--staged') ?? false,
        flow: document.querySelector('.con-hand')?.getAttribute('data-flow') ?? '',
        rows: document.querySelectorAll('.con-hand__row').length,
        heldSlots: document.querySelectorAll('.con-hand__slot.con-deal-hold').length,
        gridH: Math.round(document.querySelector('.con-hand__grid')?.getBoundingClientRect().height ?? -1),
      },
      /** The embedded hand's browse toolbar (filters/counters) is VISIBLE. */
      toolbarShown: (() => {
        const el = document.querySelector('.con-hand__toolbar');
        if (el === null) {
          return false;
        }
        const st = getComputedStyle(el);
        return st.visibility !== 'hidden' && Number(st.opacity) > 0.05;
      })(),
      /** The hand dock's presence-contract state. */
      dockMounted: document.querySelector('.con-handdock') !== null,
      dockCompact: document.querySelector('.con-handdock')?.classList.contains('con-handdock--compact') ?? false,
      /** The dock's card backs do not overlap the embedded hand's status
       *  rail (the divergence this rework closes). */
      dockOverRail: (() => {
        const rail = document.querySelector('.con-hand__verdictbar, .con-hand__statusrail, .con-start__statusrail');
        if (rail === null) {
          return false;
        }
        const rr = rail.getBoundingClientRect();
        return Array.from(document.querySelectorAll('.con-handdock__card'))
          .some((c) => {
            const cr = c.getBoundingClientRect();
            const st = getComputedStyle(c);
            return st.visibility !== 'hidden' && cr.height > 4 &&
              cr.top < rr.bottom - 2 && cr.bottom > rr.top + 2 &&
              cr.left < rr.right && cr.right > rr.left;
          });
      })(),
      /** The board took the screen for a tile placement the project asked for.
       *  ⚠️ Match case-INSENSITIVELY: the kicker is uppercased by CSS
       *  (`text-transform`), so `textContent` carries the sentence case. */
      placementUp: vis('.con-context--placement, .con-place, [data-placement-panel]') ||
        (document.body.textContent ?? '').toLowerCase().includes('размещение тайла'),
      placementSource: (document.body.textContent ?? '').toLowerCase().includes('источник') ?
        'source-named' : '',
    };
  });
}

/** Walk the setup wizard and commit, landing in the deployment. */
async function reachDeployment(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  for (let round = 0; round < 8 && !(await summaryVisible(page)); round++) {
    await waitPressable(page);
    await page.waitForTimeout(250);
    const kind = stepKind(await stepSubject(page));
    if (kind === 'corporation') {
      await press(page, 'Enter', 600);
    } else if (kind === 'prelude') {
      // THE SUBJECT FIRST, filler second — a step with a pick LIMIT silently
      // refuses further picks, so filling first burns the limit on cards
      // nobody asked for (the driver's own documented trap).
      const got = await pickCards(page, ['Eccentric Sponsor']);
      expect(got, 'the sponsor was offered and picked').toContain('Eccentric Sponsor');
      await fillPicks(page, 2);
    } else if (kind === 'project') {
      // A few cards so the sponsor has something to spend its 25 M€ on.
      await fillPicks(page, 6, 30);
    }
    await press(page, 'Period', 1600);
    for (let w = 0; w < 20 && !(await summaryVisible(page)) &&
         stepKind(await stepSubject(page)) === kind; w++) {
      await page.waitForTimeout(250);
    }
  }
  expect(await summaryVisible(page), 'reached the summary').toBeTruthy();
  await press(page, 'Enter', 2500); // НАЧАТЬ ПАРТИЮ
  await page.waitForTimeout(4000);
}

/** Press A on the deployment queue until the sponsor's hand step opens. */
async function openSponsorHand(page: Page, maxPresses = 12): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    const s = await surfaces(page);
    if (s.handUp) {
      return true;
    }
    await press(page, 'Enter', 1800);
  }
  return (await surfaces(page)).handUp;
}

test.describe('console start — «Эпатажный спонсор» as a workspace step', () => {
  test('the hand opens INSIDE the Game Start Workspace, never as a second screen', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {
      data: cfg({preludes: ['Eccentric Sponsor', 'Metals Company', 'Supplier', 'Business Empire']}),
    });
    expect(created.ok()).toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await reachDeployment(page);

    const opened = await openSponsorHand(page);
    expect(opened, 'the sponsor raised its play-from-hand step').toBeTruthy();
    await page.waitForTimeout(1200);
    const s = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-1-hand-step.png'});

    // ① ONE ROOT: the workspace is still up and the hand is INSIDE it.
    expect(s.startUp, 'the Game Start Workspace is still on screen').toBeTruthy();
    expect(s.handEmbedded, 'the hand is teleported into the workspace embed zone').toBeTruthy();
    // ② ONE SHELL: no second header, no own hand head, no legacy modal.
    expect(s.handOwnHead, 'the hand drew its own workspace header').toBe(0);
    expect(s.headCount, 'exactly one workspace header on screen').toBe(1);
    expect(s.legacyModal, 'a legacy prompt modal appeared').toBe(0);
    // ③ THE CRUMB states the workspace, the CAUSE and the stage — and never
    // the hand's own root («КАРТЫ В РУКЕ» as a ROOT would mean the player left
    // the start; as a STAGE it means they went deeper inside it).
    expect(s.crumb, `crumb was «${s.crumb}»`).toContain('старт партии');
    expect(s.crumb, `crumb was «${s.crumb}»`).toContain('спонсор');
    // ④ A REAL hand, actually PAINTED — not a rendered-but-empty grid.
    expect(s.handCards, 'the real hand is on screen').toBeGreaterThan(0);
    expect(s.paintedCards, 'the hand cards are actually drawn').toBeGreaterThan(0);
    expect(s.playable, 'the discount makes cards playable').toBeGreaterThan(0);
    // …and the toolbar sits ABOVE them, as on any hand screen.
    expect(s.toolbarY, 'the toolbar is above the cards').toBeLessThan(s.firstCardY);
    // ⑤ THE DEPLOYMENT DISSOLVED: no stage chips naming «ПРОЛОГИ» over a hand
    // screen, no queue, no compact shelf, and certainly no full tableau.
    expect(s.banner, 'no floating ask-banner over an OPEN workspace').toBe('');
    // THE DOCK PRESENCE CONTRACT: mounted, in its compact pose (a workspace
    // owns the screen), and its backs never overlap the status rail.
    expect(s.dockMounted, 'the hand dock is never hidden by a screen').toBeTruthy();
    expect(s.dockCompact, 'the dock stepped into its compact pose').toBeTruthy();
    expect(s.dockOverRail, 'no dock card overlaps the status rail').toBeFalsy();
    // …and the browse toolbar IS visible while browsing (it only hides for
    // the configure stage).
    expect(s.toolbarShown, 'filters visible on the browse layer').toBeTruthy();
    expect(s.journeyRail, 'the startup journey rail is gone').toBe(0);
    expect(s.startQueue, 'the deployment queue is gone').toBe(0);
    expect(s.startPlayed, 'the compact played shelf is gone').toBe(0);
    expect(s.playedOverlay, 'the full played overlay must not open').toBeFalsy();
  });

  /**
   * THE STEP SURVIVES BEING PUT DOWN AND PICKED UP — twice over:
   *  · B (свернуть) then A (вернуться): the hand comes back WITH ITS CARDS.
   *    The restore re-runs the dock→grid opening, and if that episode cannot
   *    complete it leaves `holdSlots` armed — every card stays invisible while
   *    the counter still says «КАРТЫ 10/13», which is what the player saw.
   *  · a RELOAD mid-step: the workspace's lifetime hold is module state that a
   *    reload wipes, so the claim must rest on SERVER truth (the prelude
   *    phase) — otherwise the very same prompt re-opens the standalone hand
   *    and the player is thrown out of a flow they never left.
   */
  test('the step survives minimize→restore and a reload, with its cards', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {
      data: cfg({preludes: ['Eccentric Sponsor', 'Metals Company', 'Supplier', 'Business Empire']}),
    });
    expect(created.ok()).toBeTruthy();
    const {players} = await created.json();
    const playerId = players[0].id;
    await page.goto(`/player?id=${playerId}&console=1`);
    await reachDeployment(page);
    expect(await openSponsorHand(page), 'the hand step opened').toBeTruthy();
    await page.waitForTimeout(1200);
    const opened = await surfaces(page);
    expect(opened.paintedCards, 'cards painted on first open').toBeGreaterThan(0);

    // ── B → the whole workspace minimizes (the deferred card offers the way
    //    back); A → it comes back, WITH its cards. ──
    await press(page, 'Escape', 1600);
    const away = await surfaces(page);
    expect(away.handEmbedded, 'the hand step is put down').toBeFalsy();
    await press(page, 'Enter', 2600);
    await page.waitForTimeout(1800);
    const back = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-4-restored.png'});
    expect(back.handEmbedded,
      `the hand came back OUTSIDE the workspace — zone=${back.zoneExists} ` +
      `parent=${back.handParent} diag=${JSON.stringify(back.diag)}`).toBeTruthy();
    expect(back.paintedCards,
      `cards vanished on restore (diag ${JSON.stringify(back.diag)})`).toBeGreaterThan(0);
    expect(back.toolbarShown, 'the browse toolbar came back too').toBeTruthy();

    // ── PARK, GO SOMEWHERE ELSE, COME BACK. The reported bug: parking is what
    //    the player does IN ORDER to go and look at something, so a parked flow
    //    that a lateral move destroys makes «свернуть» mean «закрыть». Here the
    //    player minimizes, opens the colonies from the RT wheel, closes them,
    //    and A must land back on their own unfinished card play — never on the
    //    deployment behind it. ──
    await press(page, 'Escape', 1600);
    await press(page, 'Period', 900); // RT — the action categories
    await press(page, 'ArrowRight', 700); // «Торговля»
    await press(page, 'Enter', 1600);
    await press(page, 'Escape', 1400); // …and back out of the colonies
    await press(page, 'Enter', 2600); // A on the board-home restore card
    await page.waitForTimeout(1800);
    const afterDetour = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-4b-after-detour.png'});
    expect(afterDetour.handEmbedded,
      `a detour destroyed the parked step — diag=${JSON.stringify(afterDetour.diag)}`).toBeTruthy();
    expect(afterDetour.paintedCards,
      'the cards came back with it').toBeGreaterThan(0);

    // ── a RELOAD mid-step: the same step, still inside the workspace. ──
    await page.reload();
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
    await page.waitForTimeout(6000);
    const reloaded = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-5-reloaded.png'});
    expect(reloaded.handUp, 'the hand step is up after the reload').toBeTruthy();
    expect(reloaded.handEmbedded,
      'the reload dropped the player into the STANDALONE hand').toBeTruthy();
    expect(reloaded.handOwnHead, 'no second header after the reload').toBe(0);
    expect(reloaded.paintedCards,
      `cards vanished after the reload (diag ${JSON.stringify(reloaded.diag)})`).toBeGreaterThan(0);
  });

  /**
   * THE WHOLE FLOW. The project is played through the NORMAL play machinery
   * (the composer descends into the hand's own stage zone, the commit runs the
   * ordinary played-hero landing), and when it is done the player is back in
   * the Game Start Workspace — with the project lying in the «Разыграно» they
   * can see.
   */
  test('the project plays through the normal flow and the workspace comes back with it', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {
      // TWO preludes to resolve: the sponsor is NOT last, so the workspace
      // must genuinely come back and offer the remaining one.
      data: cfg({preludes: ['Eccentric Sponsor', 'Metals Company', 'Supplier', 'Business Empire']}),
    });
    expect(created.ok()).toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await reachDeployment(page);
    expect(await openSponsorHand(page), 'the hand step opened').toBeTruthy();
    await page.waitForTimeout(1200);

    const before = await surfaces(page);
    expect(before.playable).toBeGreaterThan(0);

    // A on the focused (playable) card → the composer DESCENDS into the hand's
    // own stage zone: the same premium entry as a normal play, not a modal.
    await press(page, 'Enter', 1800);
    const setup = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-2-card-play.png'});
    expect(setup.composerUp, 'the play composer is up').toBeTruthy();
    expect(setup.composerEmbedded, 'the composer descended INSIDE the hand').toBeTruthy();
    expect(setup.startUp, 'the Game Start Workspace still owns the screen').toBeTruthy();
    expect(setup.headCount, 'still exactly one header').toBe(1);
    // Browse-layer chrome hides past the descent (contract rule 5): the tag
    // filters belong to browsing, not to configuring a play.
    expect(setup.toolbarShown, 'the filters/toolbar hid for the configure stage').toBeFalsy();

    // A again → commit. The card leaves the hand, flies the ordinary hero arc
    // and lands in «Разыграно»; the workspace comes back around it.
    await press(page, 'Enter', 2500);
    await page.waitForTimeout(6000);
    const after = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-3-back-in-startup.png'});

    expect(after.legacyModal, 'no legacy modal at any point').toBe(0);
    // THE PROJECT WAS REALLY PLAYED — through the ordinary machinery, so it is
    // on the tableau whichever branch the continuation took.
    expect(after.tableauCards, 'the project joined the played cards')
      .toBeGreaterThan(before.tableauCards);
    // CONTINUATION IS CONDITIONAL, never hardcoded. Either the effect resolved
    // outright and the deployment is back with the project lying in its
    // compact «Разыграно», or the project asked for a board placement and the
    // field legitimately owns the screen (the workspace is pending behind it —
    // it has not been closed, it has yielded). Both are correct; «always
    // return to the start screen» and «always close after a tile» are the two
    // things that would be wrong.
    if (after.placementUp) {
      expect(after.placementSource.toLowerCase(), 'the placement names its source card')
        .not.toBe('');
    } else {
      expect(after.startUp, 'the workspace came back').toBeTruthy();
      expect(after.startPlayed, 'the compact «Разыграно» returned').toBeGreaterThan(0);
      // THE COMPACT POSE STILL WORKS. A workspace owns the screen, so the dock
      // must be compact — this is the exact regression the intake accent's
      // bounded lease exists for: the accent used to read flags that could
      // stick, and one stuck flag disabled the compact pose for the REST OF
      // THE GAME (it survived the whole sponsor flow and never came back).
      expect(after.dockMounted, 'the dock is still there').toBeTruthy();
      expect(after.dockCompact,
        'the compact pose died somewhere in the flow (a leaked intake accent)').toBeTruthy();
    }
  });
});
