import {test, expect, Page} from '@playwright/test';
import {press, summaryVisible, walkToSummary, fillPicks, pickCards} from './consoleStart';

/**
 * «КОРПОРАТИВНЫЕ АРХИВЫ» — the DRAW & SELECT flow, as a step of the Game Start
 * Workspace.
 *
 * What this probe defends. The prompt the prelude raises («посмотри 7 верхних
 * карт колоды, оставь 2») is a bare `SelectCard` on the wire — indistinguishable
 * from «point at a card in someone's tableau» — so the console classified it as
 * `cardSelect/target` and served it with the GENERIC CARD BROWSER: seven cards
 * appeared out of nothing inside the prelude workspace's narrow embed column,
 * overflowing it; the crumb read «ЦЕЛЬ НА КАРТЕ» (nothing was being targeted);
 * the start scene kept the pad, so the bar advertised «A РАЗЫГРАТЬ» over cards
 * the player could not pick; and the deck never moved.
 *
 * The contract now:
 *   · the SERVER marks the prompt (`deckPickPrompt`) — never a title match;
 *   · it is served by its OWN surface (`.con-deckpick`), EMBEDDED in the start
 *     workspace's zone beside the source card, never as a second screen;
 *   · the crumb names the CARD and advances only in its tail;
 *   · that surface owns the pad, so the seven cards are actually pickable;
 *   · confirming sends the picks to the HAND DOCK and only then clears the rest;
 *   · the workspace comes back around «Корпоративные архивы», which then
 *     finishes its ordinary play into «РАЗЫГРАНО».
 */

function cfg(opts: {preludes: Array<string>}) {
  return {
    players: [{name: 'Archivist', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: true, venus: false, colonies: false,
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
    customCorporationsList: ['CrediCor', 'Teractor'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    // FORCE the deal: the whole probe is about this one prelude.
    customPreludes: opts.preludes,
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/** Structural readout of the flow — never a title match, never a screenshot diff. */
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
    const pick = document.querySelector('.con-deckpick');
    const slots = Array.from(document.querySelectorAll('.con-deckpick__slot'));
    return {
      startUp: vis('.con-start'),
      pickUp: pick !== null,
      /** …INSIDE the start workspace's own zone, never a band of its own. */
      pickEmbedded: pick !== null && pick.closest('.con-start__embed') !== null,
      /** …and therefore wearing the host's shell: no second breadcrumb. */
      headCount: document.querySelectorAll('.con-wshead').length,
      crumb: (document.querySelector('.con-wshead')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
      /** The generic card browser must never appear for this prompt. */
      taskHost: document.querySelectorAll('.con-task-host').length,
      legacyModal: document.querySelectorAll('.wf-modal, .waitingfor-modal, .mandatory-input-modal').length,
      cards: slots.length,
      /** PAINTED, not merely rendered — the defect this replaces was a row
       *  that existed but overflowed its column and was clipped away. */
      painted: slots.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 60 &&
          r.top >= -1 && r.bottom <= window.innerHeight + 1;
      }).length,
      picked: document.querySelectorAll('.con-deckpick__slot.con-cards__slot--picked').length,
      /** The SOURCE card presides over the draw in the workspace's own seat. */
      sourceSeat: vis('.con-start__embedsource'),
      /** The deck the cards must physically come from. */
      deckPile: document.querySelector('.con-deckstack__pile') !== null,
      /** The dock is never hidden, and it is the picks' destination. */
      dockMounted: document.querySelector('.con-handdock') !== null,
      dockCards: document.querySelectorAll('[data-hand-dock-card]').length,
      /** …in its COMPACT pose while a decision owns the screen, and OUT of it
       *  while cards are physically arriving (the intake accent lease). */
      dockCompact: document.querySelector('.con-handdock')?.classList.contains('con-handdock--compact') ?? false,
      /** No native scrollbar may ever appear inside a console surface. */
      overflowing: slots.some((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > window.innerHeight + 2 || r.top < -2;
      }),
      /** The deployment's own queue/played chrome — the flow's way back. */
      startQueue: document.querySelectorAll('.con-start__queue').length,
      /**
       * «РАЗЫГРАНО» belongs to the DEPLOYMENT, so it yields the stage while a
       * step stands inside the workspace — receded, never unmounted (its stack
       * identities and the hero target it registers must survive), and back at
       * full strength before the source card's continuation flight aims at it.
       */
      dockShelf: (() => {
        const el = document.querySelector('.con-start__played');
        if (el === null) {
          return {mounted: false, opacity: 1};
        }
        return {mounted: true, opacity: Number(getComputedStyle(el).opacity)};
      })(),
      /**
       * A card in «РАЗЫГРАНО» painted at less than full strength. The shelf
       * blanks a slot behind `awayCard` while its card is out in the step's
       * source seat — legitimate DURING the step, a bug once the step is over:
       * a settle that never reached the line clearing `embedSourceShown` left
       * the family showing nothing but its peek strip.
       */
      shelfBlanked: Array.from(document.querySelectorAll('.con-start__played [data-zoom-slot]'))
        .filter((el) => Number(getComputedStyle(el).opacity) < 0.5).length,
      /** The source seat — must be GONE once the card has flown home. */
      sourceSeatUp: document.querySelector('.con-start__embedsource') !== null,
      /**
       * A start-dock card is IN THE AIR. The seat may only empty by FLIGHT —
       * the return is the second half of the play the player already watched
       * begin, so a seat that simply blanks while the shelf simply fills is a
       * teleport, and it reads as one. (It shipped: the return measured the
       * PAINTED FACE inside the shelf's landing slot, and a family whose only
       * card is the one out on loan paints nothing — so the flight was silently
       * skipped for the first prelude of every category.)
       */
      reseating: document.querySelectorAll('.con-startdock-proxy').length,
      /**
       * …and THE SEAT IS VISIBLY LETTING GO. This is the discriminator, because
       * `.con-startdock-proxy` alone is not one — every other start flight
       * spawns those too, so a probe that only asks «was any card ever in the
       * air» passes over the bug it was written for.
       *
       * `--departing` is set at the top of the settle and only cleared at
       * TOUCHDOWN, so in a healthy return it is on screen for the whole flight.
       * On the broken path the settle found no landing element, fell through
       * and cleared everything in the SAME synchronous block — Vue never got a
       * frame to render this class at all. Present ⇒ the card flew.
       */
      sourceSeatDeparting: document.querySelector('.con-start__embedsource--departing') !== null,
      /**
       * A family on the shelf that holds cards but paints NO open top face.
       * The top card being out on loan to the source seat used to blank the
       * slot, leaving the 31 px depth strip as the only thing rendered — which
       * reads, correctly, as a clipped card, because the only thing painted WAS
       * a crop. The card underneath is promoted while its neighbour is away.
       */
      shelfStripOnly: Array.from(document.querySelectorAll('.con-splayed__fam'))
        .filter((fam) => {
          const count = Number((fam.querySelector('.con-splayed__cap-count')?.textContent ?? '0').trim());
          if (count <= 0) {
            return false;
          }
          // A family whose ONLY card is the one out on loan legitimately shows
          // its prepared place — there is nothing on the pile right now. The
          // defect is a family that paints depth STRIPS and no open face: the
          // only thing rendered is then a 31 px crop.
          if (fam.querySelectorAll('.con-splayed__strip').length === 0) {
            return false;
          }
          const face = fam.querySelector('.con-splayed__top .con-splayed__face');
          return face === null || Number(getComputedStyle(face).opacity) < 0.5;
        }).length,
      /** The source card's slot is HELD while its fullscreen is open — one
       *  visual owner, never two copies of the same card on screen. */
      zoomOpen: document.querySelector('dialog.con-zoom[open]') !== null,
      /**
       * THE VIEWER OWNS THE SCREEN — the app's own marker, and the only honest
       * «may I press something else yet». The dialog's `open` attribute goes
       * first and the CLOSE FLIGHT keeps absorbing every intent after it (by
       * design: the card is mid-air, `handleZoomIntent` swallows while
       * `zoomClosing`), so a probe that waits a duration and then presses is
       * betting on the dive finishing in time. It lost that bet intermittently,
       * and the lost press looked exactly like «RT does not confirm».
       */
      zoomOwning: document.body.classList.contains('con-zoom-open'),
      seatHeld: (() => {
        const seat = document.querySelector('[data-embed-source-slot]');
        if (seat === null) {
          return false;
        }
        const lifted = seat.querySelector('.con-zoom-hold') !== null ||
          seat.classList.contains('con-zoom-hold');
        return lifted || Number(getComputedStyle(seat).opacity) < 0.5;
      })(),
      /**
       * THE COMPOSITION. A seven-card reveal must read as a placed GROUP, not
       * as a strip: the shape the layout SOLVED (4 + 3) is the shape on screen,
       * cards big enough to read, and the last row centred under the one above.
       *
       * Clustered by proximity rather than bucketed by a rounded top: the
       * focused card is lifted and scaled, so it starts ~10 px above its own
       * row and any fixed bucket splits it into a row of one.
       */
      rowShape: (() => {
        const cs = slots
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {c: r.top + r.height / 2, h: r.height};
          })
          .sort((a, b) => a.c - b.c);
        const out: Array<number> = [];
        let cur = 0;
        cs.forEach((v, i) => {
          if (i > 0 && v.c - cs[i - 1].c > v.h * 0.5) {
            out.push(cur);
            cur = 0;
          }
          cur++;
        });
        if (cur > 0) {
          out.push(cur);
        }
        return out;
      })(),
      /** The FOCUSED slot's width — the biggest thing on the stage. */
      cardW: Math.round(slots[0]?.getBoundingClientRect().width ?? 0),
      /** The TV rem factor, so every size threshold below can ride it. */
      ui: parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--con-ui-scale')) || 1,
      /**
       * ⚠️ THE CHECK THAT WOULD HAVE CAUGHT THE 4K BUG. Everything above asks
       * the VIEWPORT, and the viewport was never the thing doing the clipping:
       * the row solved a 4 + 3 shape, `flex-wrap` broke it as 3 + 3 + 1 over a
       * 0.06 px rounding disagreement, and the extra row was cropped by the
       * ROW'S OWN box — top and bottom, entirely inside a 4K screen with room
       * to spare. So ask the row: does anything stick out of it, and does it
       * have scrollable overflow at all.
       */
      clippedByRow: (() => {
        const row = document.querySelector('.con-deckpick__row');
        if (row === null) {
          return 0;
        }
        const rr = row.getBoundingClientRect();
        return slots.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top < rr.top - 1 || r.bottom > rr.bottom + 1 ||
            r.left < rr.left - 1 || r.right > rr.right + 1;
        }).length;
      })(),
      rowScroll: (() => {
        const row = document.querySelector('.con-deckpick__row');
        if (row === null) {
          return 0;
        }
        return Math.round(Math.max(
          row.scrollHeight - row.clientHeight, row.scrollWidth - row.clientWidth));
      })(),
      /**
       * DOES ANY REVEALED CARD TOUCH THE SOURCE SEAT? It must be impossible —
       * not «hidden behind a z-index», not «only when unfocused». The seat is
       * reserved out of the row's width on both sides, so the two never occupy
       * the same space in any phase.
       */
      sourceClash: (() => {
        const seat = document.querySelector('[data-embed-source-slot]');
        if (seat === null) {
          return 0;
        }
        const sr = seat.getBoundingClientRect();
        return slots.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < sr.right && r.right > sr.left && r.top < sr.bottom && r.bottom > sr.top;
        }).length;
      })(),
      /** How much of the deployment row the step actually got. */
      stageH: Math.round(document.querySelector('.con-deckpick__frame')?.getBoundingClientRect().height ?? 0),
      played: Array.from(document.querySelectorAll('.con-start__played [data-played-key]'))
        .map((el) => el.getAttribute('data-played-key')),
      handCount: (document.querySelector('.con-handdock')?.textContent ?? '').trim(),
      flow: pick?.getAttribute('data-flow') ?? '',
      /** The bottom command bar's live contract. */
      bar: (document.querySelector('.con-cmdbar, .con-commandbar')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
    };
  });
}

/**
 * Walk the setup wizard and commit, landing in the deployment.
 *
 * THROUGH THE SHARED DRIVER, never a local copy of it. This spec used to walk
 * the wizard itself and then assert it had reached the summary — and on a 4K
 * viewport it hadn't: an advance press lands on the just-arrived summary and
 * submits it with the same A that nudges past a cinematic, so the next thing on
 * screen is already the DEPLOYMENT. `walkToSummary` has known that for a long
 * time and treats it as an ordinary outcome; the copy called it a failure and
 * aborted a run whose game had started perfectly. The setup is never the
 * subject — a start-flow change is adapted in `consoleStart.ts`, not here.
 */
async function reachDeployment(page: Page): Promise<void> {
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'prelude') {
        const got = await pickCards(p, ['Corporate Archives']);
        expect(got, 'the archives were offered and picked').toContain('Corporate Archives');
        await fillPicks(p, 2);
      } else if (kind === 'project') {
        await fillPicks(p, 4, 30);
      }
    },
  });
  if (await summaryVisible(page)) {
    await press(page, 'Enter', 2500); // НАЧАТЬ ПАРТИЮ
  }
  await page.waitForTimeout(4000);
}

/**
 * Wait for a STATE, never for a duration.
 *
 * A fixed `waitForTimeout` before a read is a claim about how fast the machine
 * is, and this spec made one: it sampled the dock's receiving pose exactly
 * 1200 ms after the confirm. That held at 1920 and missed at 3840 — the pose
 * opens when the FLIGHT starts, and the flight starts when the server answers,
 * so the instant is a property of the machine and not of the contract. Waiting
 * for the transition also proves strictly more than the sample did: that it
 * happened at all, rather than that it happened to be true once.
 */
async function waitUntil(
  page: Page,
  pred: (s: Awaited<ReturnType<typeof surfaces>>) => boolean,
  budgetMs = 8000,
): Promise<boolean> {
  const until = Date.now() + budgetMs;
  for (;;) {
    if (pred(await surfaces(page))) {
      return true;
    }
    if (Date.now() >= until) {
      return false;
    }
    await page.waitForTimeout(150);
  }
}

/** Press A on the deployment queue until the draw & select surface stands. */
async function openDeckPick(page: Page, maxPresses = 14): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    if ((await surfaces(page)).pickUp) {
      return true;
    }
    await press(page, 'Enter', 2200);
  }
  return (await surfaces(page)).pickUp;
}

/**
 * Wait for the DEAL to finish. The surface mounts before its cards have left
 * the deck, and it deliberately swallows the pad until they have landed — a
 * press accepted mid-flight would select a card that is not there yet. So the
 * probe waits for the flow's own readiness signal rather than for a duration.
 */
async function waitPickable(page: Page, budgetMs = 12_000): Promise<boolean> {
  const until = Date.now() + budgetMs;
  while (Date.now() < until) {
    if ((await surfaces(page)).flow === 'choosing') {
      return true;
    }
    await page.waitForTimeout(200);
  }
  return (await surfaces(page)).flow === 'choosing';
}

/**
 * The composition is PROFILE WORK, so it is probed per profile.
 *
 * The 4K row is not the 1080p row scaled up — the rem factor doubles, the seat
 * reserve doubles with it, and the band's aspect changes what shape wins. The
 * seven-card stage shipped correct at 1920 and broken at 3840 for exactly that
 * reason, and this spec only ran at 1920, so nothing failed. A geometry claim
 * that is only asserted at one resolution is a claim about one resolution.
 */
const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console — «посмотри N карт колоды, оставь K» · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the draw & select surface stands INSIDE the start workspace and answers the pick', async ({page, request}) => {
      test.setTimeout(420_000);
      const created = await request.post('/api/creategame', {
        data: cfg({preludes: ['Corporate Archives', 'Metals Company', 'Supplier', 'Business Empire']}),
      });
      expect(created.ok(), 'game created').toBeTruthy();
      const game = await created.json();
      const id = game.players[0].id;

      await page.goto(`/player?id=${id}&console=1${profile.query}`);
      await reachDeployment(page);

      const opened = await openDeckPick(page);
      expect(opened, `the surface opened — ${JSON.stringify(await surfaces(page))}`).toBeTruthy();
      const dealt = await waitPickable(page);
      const at = await surfaces(page);
      expect(dealt, `the deal finished and the pad opened — ${JSON.stringify(at)}`).toBeTruthy();
      await page.screenshot({path: `test-results/deckpick-${profile.tag}-01-dealt.png`});

      // ── 1. IT IS A STEP OF THE WORKSPACE, not a screen of its own ────────
      expect(at.startUp, 'the start workspace is still the screen').toBeTruthy();
      expect(at.pickEmbedded, 'the surface renders inside the start embed zone').toBeTruthy();
      expect(at.headCount, 'exactly ONE breadcrumb — the host\'s').toBe(1);
      expect(at.taskHost, 'the generic card browser never serves this prompt').toBe(0);
      expect(at.legacyModal, 'no desktop fallback modal').toBe(0);

      // ── 2. THE CRUMB NAMES THE CARD ─────────────────────────────────────
      expect(at.crumb, `crumb names the source card — «${at.crumb}»`)
        .toContain('корпоративные архивы');
      expect(at.sourceSeat, 'the source card presides over the draw').toBeTruthy();

      // ── 3. SEVEN CARDS, ALL READABLE ────────────────────────────────────
      expect(at.cards, 'all seven revealed cards are on the stage').toBe(7);
      expect(at.painted, `every card is painted inside the viewport — ${JSON.stringify(at)}`).toBe(7);
      expect(at.overflowing, 'no card is clipped by the viewport').toBeFalsy();
      expect(at.deckPile, 'the deck they came from is on screen').toBeTruthy();
      expect(at.dockMounted, 'the hand dock is never hidden').toBeTruthy();
      expect(at.dockCompact, 'the dock steps back into its compact pose while the pick owns the screen').toBeTruthy();

      // ── THE COMPOSITION ─────────────────────────────────────────────────
      // Seven cards are a GROUP, not a strip: the band's height is used, the
      // cards are big enough to read at a couch distance, and the source seat
      // has a safe zone the group can never reach into.
      // ⚠️ THE SOLVED SHAPE IS THE SHAPE ON SCREEN. Not «more than one row» —
      // 3 + 3 + 1 also satisfies that, and 3 + 3 + 1 is exactly what shipped:
      // `flex-wrap` broke a 4 + 3 line over 0.06 px of `toFixed` rounding and
      // the orphaned third row was cropped by the row's own box, inside a 4K
      // screen with a third of its height unused. The shape is the assertion.
      expect(at.rowShape, `seven cards are the composition the layout solved — ${JSON.stringify(at)}`)
        .toEqual([4, 3]);
      expect(at.clippedByRow,
        `no card is cut off by the stage row — ${JSON.stringify(at)}`).toBe(0);
      expect(at.rowScroll,
        `the stage row has nothing to scroll to — ${at.rowScroll}px`).toBe(0);
      expect(at.cardW, `the cards are large — ${at.cardW}px at ui ${at.ui}`)
        .toBeGreaterThan(180 * at.ui);
      expect(at.sourceClash, 'no revealed card ever overlaps the source seat').toBe(0);
      // The shelf yields the stage, but what it still paints must be honest: a
      // family that holds cards shows an open top face, never a lone crop.
      expect(at.shelfStripOnly, `no shelf family is reduced to a crop — ${JSON.stringify(at)}`).toBe(0);
      // …and «РАЗЫГРАНО» has YIELDED THE STAGE — kept in the DOM (its stacks and
      // the hero target it registers must survive), but out of the way, so the
      // step gets the whole deployment row rather than its top third.
      expect(at.dockShelf.mounted, 'the played shelf is never unmounted').toBeTruthy();
      expect(at.dockShelf.opacity, `the played shelf receded — ${JSON.stringify(at.dockShelf)}`)
        .toBeLessThan(0.05);
      expect(at.stageH, `the step took the whole row — ${at.stageH}px`).toBeGreaterThan(600);

      // ── 4. THE PAD IS THE SURFACE'S — the cards are actually pickable ────
      const dockBefore = at.dockCards;
      await press(page, 'Enter', 400); // A on the focused card
      await press(page, 'ArrowRight', 300);
      await press(page, 'Enter', 400);
      const chosen = await surfaces(page);
      expect(chosen.picked, `two cards are selected — ${JSON.stringify(chosen)}`).toBe(2);
      // …and the separation survives the focus emphasis, which is the state the
      // layout has to reserve room for rather than the one it is measured in.
      expect(chosen.sourceClash, 'a focused card still never reaches the source seat').toBe(0);
      await page.screenshot({path: `test-results/deckpick-${profile.tag}-02-picked.png`});

      // ── 4b. L3 INSPECTS THE SOURCE — by LIFTING it, never by copying it ──
      // The viewer used to rise out of nowhere (a TEXTUAL entrance) because the
      // shared origin resolver only knew the card-actions composer's hero column,
      // so the seat kept its card and the player saw two of the same card at once.
      await press(page, 'KeyC', 1400);
      const zoomed = await surfaces(page);
      expect(zoomed.zoomOpen, `L3 opens the source fullscreen — ${JSON.stringify(zoomed)}`).toBeTruthy();
      expect(zoomed.seatHeld, 'the seat is empty while its card is in the viewer').toBeTruthy();
      await press(page, 'Escape', 400);
      // …and the card FLIES BACK to its seat. Until it has, the viewer still
      // owns input on purpose, so the probe waits for the app to say so rather
      // than for a number.
      const viewerGone = await waitUntil(page, (s) => !s.zoomOwning && !s.zoomOpen, 15_000);
      expect(viewerGone,
        `the source card returned to its seat and gave input back — ${JSON.stringify(await surfaces(page))}`)
        .toBeTruthy();
      await page.waitForTimeout(300);

      // ── 5. CONFIRM → the picks reach the DOCK, then the rest clears ──────
      await press(page, 'Period', 400); // RT = «Подтвердить»
      expect(await waitUntil(page, (s) => s.flow !== 'choosing', 5000),
        `RT committed the pick — ${JSON.stringify(await surfaces(page))}`).toBeTruthy();
      // The dock comes OUT of its compact pose to receive them — the accent of
      // receiving, and the pose those flights measure their landing rects in.
      // Awaited, not sampled: it opens when the FLIGHT starts, and the flight
      // starts when the server answers.
      const dockOpened = await waitUntil(page, (s) => !s.dockCompact);
      await page.screenshot({path: `test-results/deckpick-${profile.tag}-03-sending.png`});
      expect(dockOpened,
        `the dock opens up to receive the picks — ${JSON.stringify(await surfaces(page))}`)
        .toBeTruthy();
      const landed = await waitUntil(page, (s) => s.dockCards >= dockBefore + 2, 9000);
      const after = await surfaces(page);
      expect(landed, `the two kept cards are physically in the dock — ${JSON.stringify(after)}`)
        .toBeTruthy();

      // ── 6. …and the workspace comes back around its source card ─────────
      // ⚠️ THE SEAT MAY ONLY EMPTY BY FLIGHT. Sampled densely rather than
      // asserted at the end, because the end state of a teleport and of a
      // flight are identical — «the card is on the shelf» was the old
      // assertion, and it stayed true throughout the bug (the shelf's landing
      // slot carries the away card's identity the whole time it is on loan).
      let sawSourceFlight = false;
      const returned = await waitUntil(page, (s) => {
        sawSourceFlight = sawSourceFlight || s.sourceSeatDeparting;
        return !s.pickUp && !s.sourceSeatUp && s.played.includes('Corporate Archives');
      }, 12_000);
      await page.waitForTimeout(800); // let the shelf's own settle finish
      await page.screenshot({path: `test-results/deckpick-${profile.tag}-04-returned.png`});
      const back = await surfaces(page);
      expect(returned, `the flow came back around its source card — ${JSON.stringify(back)}`)
        .toBeTruthy();
      expect(sawSourceFlight,
        'the source card FLEW home — the seat never simply blanked into the shelf')
        .toBeTruthy();
      expect(back.pickUp, 'the draw & select step is gone').toBeFalsy();
      expect(back.startUp, 'the start workspace never left').toBeTruthy();
      expect(back.played, `«Корпоративные архивы» finished its ordinary play — ${JSON.stringify(back)}`)
        .toContain('Corporate Archives');
      // …which it could only do because the shelf came back FIRST: the card's
      // continuation flight measures a slot inside it.
      expect(back.dockShelf.opacity, 'the played shelf is back at full strength').toBeGreaterThan(0.9);
      expect(back.shelfBlanked, `no card is left blanked on the shelf — ${JSON.stringify(back)}`).toBe(0);
      expect(back.sourceSeatUp, 'the source seat is gone once its card flew home').toBeFalsy();
    });
  });
}

/**
 * The CHOREOGRAPHY probe stays at one resolution on purpose: what it watches is
 * an ORDER OF EVENTS (the shelf yields, the card flies home, the scene lets go),
 * and an order does not change with the rem factor — while the run costs a full
 * deployment played to its last prelude.
 */
test.describe('console — «посмотри N карт колоды, оставь K» · the return', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  /**
   * THE LAST PRELUDE. `deploymentSettled` used to go true the moment the claim
   * released — a beat BEFORE the source card leaves its seat for «РАЗЫГРАНО» —
   * so on the last prelude the scene dissolved straight to the board and the
   * card's own play animation never ran. The same early release is what left
   * the shelf holding a blanked slot behind an `awayCard` nobody cleared, so
   * this one probe covers both reports.
   */
  test('the LAST prelude still plays its card home before the scene lets go', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {
      // Exactly two on offer, so the archives are necessarily one of the two
      // played — and the run below plays every prelude, ending on the last.
      data: cfg({preludes: ['Corporate Archives', 'Metals Company']}),
    });
    expect(created.ok(), 'game created').toBeTruthy();
    const game = await created.json();

    await page.goto(`/player?id=${game.players[0].id}&console=1`);
    await reachDeployment(page);

    // Play everything the deployment offers, answering the archives' pick when
    // it comes up — and WATCH the shelf the whole way. The contract is about a
    // moment, not an end state: the card must be seen ON the shelf, painted,
    // while the workspace is still standing. (Asserting after the scene has
    // released proves nothing — the shelf has gone with it.)
    let sawHomeInWorkspace = false;
    let sawBlanked = false;
    let sawSourceFlight = false;
    const watch = async () => {
      const s = await surfaces(page);
      sawSourceFlight = sawSourceFlight || s.sourceSeatDeparting;
      if (s.startUp && s.dockShelf.mounted) {
        if (s.played.includes('Corporate Archives') && s.shelfBlanked === 0 && !s.pickUp) {
          sawHomeInWorkspace = true;
        }
        if (s.shelfBlanked > 0 && !s.pickUp && !s.sourceSeatUp) {
          sawBlanked = true; // a blanked slot with nothing out on loan
        }
      }
      return s;
    };

    for (let round = 0; round < 24; round++) {
      const at = await watch();
      if (at.pickUp) {
        if (await waitPickable(page)) {
          await press(page, 'Enter', 400);
          await press(page, 'ArrowRight', 300);
          await press(page, 'Enter', 400);
          await press(page, 'Period', 1500); // RT — confirm the keep
        }
        // Sample densely through the whole return: this is the window the
        // scene used to skip straight past.
        for (let f = 0; f < 30; f++) {
          await watch();
          await page.waitForTimeout(250);
        }
        continue;
      }
      if (!at.startUp) {
        break; // the scene released — the deployment is over
      }
      await press(page, 'Enter', 1400);
      await watch();
    }
    await page.screenshot({path: 'test-results/deckpick-05-last.png'});

    expect(sawHomeInWorkspace,
      '«Корпоративные архивы» visibly reached «РАЗЫГРАНО» while the workspace still stood')
      .toBeTruthy();
    expect(sawBlanked, 'the shelf never held a blanked slot with nothing out on loan').toBeFalsy();
    expect(sawSourceFlight,
      'the source card FLEW home — the seat never simply blanked into the shelf')
      .toBeTruthy();
    expect((await surfaces(page)).sourceSeatUp, 'no orphaned source seat survives').toBeFalsy();
  });
});
