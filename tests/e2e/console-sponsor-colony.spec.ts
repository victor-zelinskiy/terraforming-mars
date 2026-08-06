import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fillPicks, focusedCard, pickCards, press, stepKind, stepSubject, summaryVisible,
  waitForBoardHome, waitPressable,
} from './consoleStart';

/**
 * DOUBLE-NESTED CONTINUATION — the iteration-2 acceptance flow:
 *
 *   Start Game Workspace
 *   → «Эпатажный спонсор» (prelude)
 *   → embedded HAND (the sponsor's play-from-hand step)
 *   → embedded CARD PLAY (Trading Colony — «Place a colony»)
 *   → the project COMMITS and docks
 *   → embedded COLONY WORKSPACE (three teleports deep: start ⊃ hand ⊃ colonies)
 *   → the BUILD FOCUS STAGE (A selects, A confirms — nothing commits on the
 *     overview any more)
 *   → the cube physically lands, the grant resolves
 *   → the START continues (never BEFORE the colony is placed).
 *
 * The parent-isolation half of the acceptance rides the same run: no startup
 * journey markers over the colonies, no false «ожидаем других игроков»
 * banner, ONE workspace header, ONE status rail, the fleets on the right.
 */

const OUT = path.resolve('screenshots', 'sponsor-colony');

function cfg(seed: number) {
  return {
    players: [{name: 'Nested', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    // Corps WITHOUT a first action — the deployment stays a plain queue.
    customCorporationsList: ['CrediCor', 'Teractor'],
    bannedCards: [], includedCards: [],
    // Four colony tiles exactly → no solo setup-removal step in the way.
    customColoniesList: ['Luna', 'Triton', 'Callisto', 'Ceres'],
    customPreludes: ['Eccentric Sponsor', 'Metals Company', 'Supplier', 'Business Empire'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The structural readout the acceptance asserts on. */
async function surfaces(page: Page) {
  return page.evaluate(() => {
    const vis = (sel: string): boolean => {
      const el = document.querySelector<HTMLElement>(sel);
      return el !== null && el.checkVisibility({opacityProperty: true, visibilityProperty: true});
    };
    const colonies = document.querySelector('.con-colonies');
    const fleets = document.querySelector<HTMLElement>('.con-colonies__fleetbar');
    const fleetsHost = fleets?.closest<HTMLElement>('.con-colonies__toolbar, .con-wshead');
    return {
      startUp: vis('.con-start'),
      coloniesUp: colonies !== null,
      /** start ⊃ hand ⊃ colonies — the teleport chain, structurally. */
      tripleNested: document.querySelector('.con-start .con-hand .con-colonies') !== null,
      focusUp: vis('.con-colfocus'),
      destRing: document.querySelectorAll('.con-colfocus__berth--dest').length,
      // Parent isolation:
      journeyRails: document.querySelectorAll('.con-start .con-jrail').length,
      awaitPanel: document.querySelectorAll('.con-start__await').length,
      headCount: document.querySelectorAll('.con-wshead').length,
      railCount: document.querySelectorAll('.con-colonies__rail').length,
      crumb: (document.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase(),
      banner: (document.querySelector('.con-banner:not(.con-banner--events)')?.textContent ?? '').trim().toLowerCase(),
      // Fleet placement: the bar hugs the RIGHT edge of its host row.
      fleetsRightGap: fleets !== null && fleetsHost !== null && fleetsHost !== undefined ?
        Math.round(fleetsHost.getBoundingClientRect().right - fleets.getBoundingClientRect().right) : -1,
      queueUp: vis('.con-start__queuecol') || document.querySelectorAll('.con-start [data-queue-slot]').length > 0,
      cubeFlying: document.querySelectorAll('.con-colonybuild__cube').length,
      stageCubes: document.querySelectorAll('.con-colfocus__berth-seat .player-cube').length,
      legacyModal: document.querySelectorAll('.wf-modal, .waitingfor-modal').length,
      /** The central ask banner must not repaint over the host's crumb: an
       *  embedded step IS the surface the prompt is answered on. */
      askBanner: document.querySelectorAll('.con-banner:not(.con-banner--events)').length,
      /** The command bar must name what the buttons DO on the screen the
       *  player is looking at — never the host's own browse verbs. */
      footer: (document.querySelector('.con-footer')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
      /** The expanded track's cells must not bleed into each other (the
       *  glyph's fixed 32px sprite in a zero-width wrapper did exactly that). */
      trackOverlap: (() => {
        const cells = Array.from(document.querySelectorAll<HTMLElement>('.con-colfocus__xcell'));
        let worst = 0;
        for (let i = 1; i < cells.length; i++) {
          const prev = cells[i - 1].getBoundingClientRect();
          const cur = cells[i].getBoundingClientRect();
          worst = Math.max(worst, Math.round(prev.right - cur.left));
          const glyph = cells[i].querySelector<HTMLElement>('.con-colfocus__xcell-glyph');
          if (glyph !== null) {
            const g = glyph.getBoundingClientRect();
            worst = Math.max(worst, Math.round(cur.left - g.left), Math.round(g.right - cur.right));
          }
        }
        return worst;
      })(),
    };
  });
}

/** Wizard → summary → begin, buying EXACTLY Trading Colony (a 1-card hand —
 *  the sponsor can only play it). */
async function walkWizard(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  for (let round = 0; round < 8 && !(await summaryVisible(page)); round++) {
    await waitPressable(page);
    await page.waitForTimeout(250);
    const kind = stepKind(await stepSubject(page));
    if (kind === 'corporation') {
      await press(page, 'Enter', 600);
    } else if (kind === 'prelude') {
      const got = await pickCards(page, ['Eccentric Sponsor']);
      expect(got, 'the sponsor was offered and picked').toContain('Eccentric Sponsor');
      await fillPicks(page, 2);
    } else if (kind === 'project') {
      const got = await pickCards(page, ['Trading Colony'], 30);
      expect(got, 'Trading Colony was dealt and picked').toContain('Trading Colony');
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

test.describe('console colonies · double-nested continuation (sponsor → card → colonies)', () => {
  test('the colony workspace opens INSIDE the card-play step; the start continues only after the build', async ({page, request}) => {
    test.setTimeout(420_000);

    // A deal that offers Trading Colony among the wizard's projects.
    let playerId = '';
    for (let attempt = 0; attempt < 40 && playerId === ''; attempt++) {
      const created = await request.post('/api/creategame', {data: cfg(0.29 + attempt * 0.013)});
      expect(created.ok()).toBeTruthy();
      const {players} = await created.json();
      const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
      const dealt = (pv.waitingFor?.options ?? [])
        .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
      if (dealt.includes('Trading Colony') && dealt.includes('Eccentric Sponsor')) {
        playerId = players[0].id;
      }
    }
    expect(playerId, 'a deal containing Trading Colony + Eccentric Sponsor').not.toBe('');

    await page.goto(`/player?id=${playerId}&console=1`);
    await walkWizard(page);

    // ── Deployment: play the queue until the SPONSOR opens its hand step. ──
    for (let i = 0; i < 12 && !(await page.locator('.con-hand').count() > 0); i++) {
      await press(page, 'Enter', 1800);
    }
    expect(await page.locator('.con-start .con-hand').count(), 'the sponsor hand opened INSIDE the start').toBeGreaterThan(0);
    await shoot(page, '01-sponsor-hand');

    // ── Play Trading Colony (the only card): A opens the composer, A plays. ──
    const played = (await focusedCard(page)) ?? '';
    expect(played, 'the one-card hand focuses Trading Colony').toContain('Trading Colony');
    await press(page, 'Enter', 1800); // → the embedded play composer
    // A = Разыграть (the sponsor discount covers it). Act → verify → retry:
    // the descend/entry motion can swallow a single press, so keep pressing
    // until the play actually commits (the colonies step is what follows).
    for (let i = 0; i < 6 && await page.locator('.con-colonies').count() === 0; i++) {
      await press(page, 'Enter', 2400);
    }

    // ── THE ACCEPTANCE MOMENT: the COLONY WORKSPACE opens as the NEXT
    //    continuation step — three teleports deep — and the START does NOT
    //    come back first. ──
    await page.waitForSelector('.con-colonies', {timeout: 30_000});
    await page.waitForTimeout(1200); // entry settles
    let s = await surfaces(page);
    await shoot(page, '02-embedded-colonies');
    expect(s.tripleNested, 'start ⊃ hand ⊃ colonies (the teleport chain)').toBeTruthy();
    expect(s.queueUp, 'the deployment queue must NOT be back yet').toBeFalsy();
    expect(s.journeyRails, 'no startup journey markers over the colonies').toBe(0);
    expect(s.awaitPanel, 'no false «ожидаем других игроков» panel').toBe(0);
    expect(s.banner.includes('ожида'), 'no waiting banner during an active choice').toBeFalsy();
    expect(s.headCount, 'ONE workspace header').toBe(1);
    expect(s.railCount, 'ONE status rail').toBe(1);
    expect(s.crumb.includes('колони'), 'the crumb names the colonies step').toBeTruthy();
    expect(s.fleetsRightGap, 'the fleet dock hugs the right edge').toBeLessThanOrEqual(24);
    expect(s.legacyModal, 'no legacy modal anywhere in the chain').toBe(0);
    expect(s.askBanner, 'no ask banner over the step that answers the prompt').toBe(0);
    // The overview NEVER commits (iteration 2): A enters the build focus.
    expect(s.footer.includes('к строительству'), `the bar names the descend verb — got «${s.footer}»`).toBeTruthy();
    expect(s.footer.includes('разыграть'), 'the host hand\'s browse verb must not leak into the colony step').toBeFalsy();

    // ── BUILD through the FOCUS STAGE: A descends (destination ringed),
    //    A confirms, the cube physically lands in the big berth. ──
    await press(page, 'Enter', 1600);
    await page.waitForSelector('.con-colfocus', {timeout: 10_000});
    s = await surfaces(page);
    expect(s.destRing, 'the destination berth is ringed').toBe(1);
    expect(s.trackOverlap, 'the expanded track cells / glyphs must not bleed into each other')
      .toBeLessThanOrEqual(1);
    await shoot(page, '03-build-focus');
    await page.keyboard.press('Enter'); // confirm the build
    await page.waitForSelector('.con-colonybuild__cube', {timeout: 12_000});
    await shoot(page, '04-cube-flying');
    // While the cube flies the START must still be parked away.
    s = await surfaces(page);
    expect(s.queueUp, 'the start stays away until the colony action completes').toBeFalsy();
    await page.waitForSelector('.con-colonybuild__cube', {state: 'detached', timeout: 20_000});
    await page.waitForTimeout(1200);
    await shoot(page, '05-cube-seated');

    // ── CONTINUATION: only NOW the start's deployment returns and the rest
    //    of the preludes play out to the live board. ──
    for (let i = 0; i < 20 && !(await surfaces(page)).queueUp && !(await surfaces(page)).startUp; i++) {
      await page.waitForTimeout(600);
    }
    expect((await surfaces(page)).coloniesUp, 'the colonies step folded back to its parent').toBeFalsy();
    await shoot(page, '06-start-continues');
    await waitForBoardHome(page);
    await shoot(page, '07-board-home');
  });
});
