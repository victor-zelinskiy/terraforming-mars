import {test, expect, Page} from '@playwright/test';
import {
  createGameWithCards, fillPicks, openConsole, pickCards, playQueueCard, press,
  queueCards, stepKind, stepSubject, summaryVisible, waitPressable, waitQueueIdle,
} from './consoleStart';

/**
 * «ЭПАТАЖНЫЙ СПОНСОР» → «ДЕЛОВЫЕ КОНТАКТЫ» → the deck PICK it raises.
 *
 * THE FLOW IS ONE THING, AND IT ENDS WHERE IT ENDS. A project played through
 * the sponsor's play-from-hand step is part of that prelude's play, so
 * everything it produces belongs to the Game Start Workspace the player never
 * left — and the deployment's NEXT stage may not begin while any of it is still
 * owed.
 *
 * Two defects, one cause. The claim was placed on the DEEPEST host (the hand
 * step), and that step's whole purpose is the play: it unmounts the moment the
 * card lands, beats before the pick exists. Released there,
 *
 *  · the pick belonged to NOBODY and opened as a standalone «ДОБОР КАРТ» band
 *    over a start workspace that was still standing — a second root, a second
 *    breadcrumb, the causality gone;
 *  · and with no embedded step to see, the deployment felt free to advance:
 *    with the preludes otherwise finished the «ПЕРВОЕ ДЕЙСТВИЕ» stage stood up
 *    ON TOP of the four cards the player was choosing between, in its «wait for
 *    your turn» pose, with no way back to them (the reported bug).
 *
 * ⚠️ This needs the real thing. The interaction is a component LIFECYCLE one —
 * an unmount hook, a teleport target that does not exist yet, and a stage entry
 * predicate — spread across four files; no unit mount reproduces it. The pure
 * halves ARE unit-tested (`consolePlayOutcomeClaim.spec` for the re-home,
 * `startFirstAction.spec` for the sequence law); this pins that they add up on
 * a real board.
 */

function cfg(opts: {preludes: Array<string>, corps: Array<string>}) {
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
    // The three cards the story needs. `customPreludes` / `customCorporationsList`
    // are the only lists a create-game config actually forces (the `seed` is
    // ignored — see the tests rule), so Business Contacts is found by dealing.
    customCorporationsList: opts.corps,
    bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: opts.preludes,
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/** Where the player actually is — structural, never a title match. */
async function surfaces(page: Page) {
  return page.evaluate(() => {
    const pick = document.querySelector('.con-deckpick');
    return {
      /** The pick is on screen at all. */
      pickUp: pick !== null,
      /** …INSIDE the workspace's own zone, wearing the host's shell. */
      pickEmbedded: pick?.closest('.con-start__embed') !== null &&
        pick?.classList.contains('con-deckpick--embedded') === true,
      /** …and really painted, at a size a player can choose from. */
      pickCards: Array.from(document.querySelectorAll('[data-deckpick-slot]'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 60 && r.height > 90 && r.top < window.innerHeight && r.bottom > 0;
        }).length,
      /** ONE root, ONE breadcrumb — the whole rendered line. */
      heads: document.querySelectorAll('.con-wshead').length,
      crumb: (document.querySelector('.con-wshead__deep, .con-wshead')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
      /** The corporation's mandatory-move stage. */
      firstAction: document.querySelectorAll('.con-start__firstact').length,
      /** The play composer that produced all this. */
      composer: document.querySelectorAll('.con-composer--play').length,
      startUp: document.querySelectorAll('.con-start__frame').length,
    };
  });
}

test.describe('console start — a project played through «Эпатажный спонсор»', () => {
  test('its pick presents INSIDE the workspace, and no next stage starts over it', async ({page, request}) => {
    test.setTimeout(420_000);
    await page.setViewportSize({width: 1920, height: 1080});
    const playerId = await createGameWithCards(request, ['Business Contacts'], {
      config: cfg({
        preludes: ['Eccentric Sponsor', 'Metals Company', 'Supplier', 'Business Empire'],
        // A corporation that OWES a mandatory first action — that stage is
        // exactly what used to walk in on top of the pick.
        corps: ['Inventrix', 'Teractor'],
      }),
    });
    await openConsole(page, playerId);

    // ── the wizard: Inventrix + the sponsor + the card it will play ──
    await page.waitForSelector('.con-start__frame', {timeout: 45_000});
    for (let round = 0; round < 8 && !(await summaryVisible(page)); round++) {
      await waitPressable(page);
      await page.waitForTimeout(250);
      const kind = stepKind(await stepSubject(page));
      if (kind === 'corporation') {
        expect(await pickCards(page, ['Inventrix']), 'Inventrix was dealt and picked').toContain('Inventrix');
      } else if (kind === 'prelude') {
        expect(await pickCards(page, ['Eccentric Sponsor']), 'the sponsor was picked').toContain('Eccentric Sponsor');
        await fillPicks(page, 2);
      } else if (kind === 'project') {
        expect(await pickCards(page, ['Business Contacts'], 30), 'the 4→2 project was bought')
          .toContain('Business Contacts');
        await fillPicks(page, 4, 30);
      }
      await press(page, 'Period', 1600);
      for (let w = 0; w < 20 && !(await summaryVisible(page)) &&
           stepKind(await stepSubject(page)) === kind; w++) {
        await page.waitForTimeout(250);
      }
    }
    // НАЧАТЬ ПАРТИЮ — act → VERIFY → retry: the summary's own commit beat
    // absorbs a press by design, and one blind Enter left the run staring at a
    // wizard it had already finished.
    for (let i = 0; i < 8 && await summaryVisible(page); i++) {
      await press(page, 'Enter', 2500);
    }
    expect(await summaryVisible(page), 'the summary committed').toBeFalsy();
    await page.waitForTimeout(4000);

    // ── the deployment: the sponsor goes LAST, so that when its project's pick
    //    stands there is nothing else queued. That is the shape of the report:
    //    with the preludes otherwise finished, the ONLY thing left for the
    //    deployment to advance to is the corporation's mandatory first action —
    //    and the enumerated blockers (an empty queue, no hero, no reveal) all
    //    said «go». Playing the sponsor first would leave a prelude in the
    //    queue and block the stage for a reason this spec is not about.
    await page.waitForFunction(
      () => document.querySelectorAll('.con-start__queue [data-queue-slot]').length > 1,
      undefined, {timeout: 60_000});
    for (let round = 0; round < 4; round++) {
      await waitQueueIdle(page);
      const other = (await queueCards(page)).find((c) => c !== 'Eccentric Sponsor');
      if (other === undefined) {
        break;
      }
      await playQueueCard(page, other);
      await page.waitForTimeout(2500); // its own beat settles before the next read
    }
    await waitQueueIdle(page);
    expect(await queueCards(page), 'the sponsor is the only prelude left')
      .toEqual(['Eccentric Sponsor']);
    for (let i = 0; i < 14 && await page.locator('.con-hand').count() === 0; i++) {
      await press(page, 'Enter', 1800);
    }
    expect(await page.locator('.con-hand').count(), 'the sponsor raised its hand step').toBeGreaterThan(0);
    await page.waitForTimeout(1200);

    // …focus the 4→2 project and play it (composer → commit).
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    let landed = false;
    for (let i = 0; i < slots * 2 + 4 && !landed; i++) {
      landed = await page.evaluate(() =>
        document.querySelector('.con-hand__slot--selected[data-zoom-slot], .con-hand__slot--focused[data-zoom-slot]')
          ?.getAttribute('data-zoom-slot') ?? '') === 'Business Contacts';
      if (!landed) {
        await press(page, 'ArrowRight', 280);
      }
    }
    expect(landed, 'focused «Деловые контакты» in the embedded hand').toBeTruthy();
    await press(page, 'Enter', 1600); // the composer descends
    await press(page, 'Enter', 2500); // commit

    // ── THE CLAIM SURVIVES THE STEP THAT PLACED IT ──
    await expect(page.locator('.con-deckpick'), 'the pick came up')
      .toHaveCount(1, {timeout: 30_000});
    await page.waitForTimeout(2500); // the arrival settles
    const s = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-outcome-pick.png'});

    expect(s.startUp, 'the Game Start Workspace never left').toBe(1);
    expect(s.pickEmbedded, 'the pick is INSIDE the workspace zone, not a band of its own').toBeTruthy();
    expect(s.heads, 'one root, one breadcrumb — never a second «ДОБОР КАРТ» workspace').toBe(1);
    // The crumb GAINED a tail; the workspace's own root is still the root.
    expect(s.crumb, `crumb was «${s.crumb}»`).toContain('старт партии');
    expect(s.crumb, `crumb was «${s.crumb}»`).toContain('деловые контакты');
    expect(s.pickCards, 'all four turned-over cards are painted, choosable').toBe(4);
    // The composer that produced this let go — it used to stay mounted over
    // the very pick it had raised.
    expect(s.composer, 'the play composer handed the stage over').toBe(0);
    // …AND THE NEXT STAGE DID NOT START. This is the reported bug.
    expect(s.firstAction, 'the first-action stage may not stand over a live pick').toBe(0);

    // ── answering it hands the deployment back, and only THEN does the
    //    corporation's mandatory move get its stage ──
    await press(page, 'Enter', 700);
    await press(page, 'ArrowRight', 500);
    await press(page, 'Enter', 700);
    await press(page, 'Period', 2500); // RT — confirm the keep
    await expect(page.locator('.con-deckpick'), 'the pick resolved').toHaveCount(0, {timeout: 30_000});
    await expect(page.locator('.con-start__queue'), 'the deployment came back around it')
      .toBeVisible({timeout: 30_000});

    await expect(page.locator('.con-start__firstact'), 'the first action is the LAST stage, on its own')
      .toHaveCount(1, {timeout: 40_000});
    await page.waitForTimeout(1500);
    const end = await surfaces(page);
    await page.screenshot({path: 'screenshots/sponsor-outcome-first-action.png'});
    expect(end.pickUp, 'nothing of the previous stage is still on screen').toBeFalsy();
    // …and it arrives ACTIONABLE, not in the «wait for your turn» pose it wore
    // when it used to gatecrash somebody else's stage.
    await expect(page.locator('.con-start__firstact-cta')).toHaveCount(1);
  });
});
