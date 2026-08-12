import {test, expect, Page} from '@playwright/test';
import {
  bootWithCards, openCardActions, openActionFocus, press,
} from './consoleStart';
import {
  LAUNCHPAD, TRADE_CORP, PROFILES, cardTradeConfig, floaters, playLaunchpad,
  focusTradeVariantTile, openColoniesSection, fleetGeometry, expectFleetParity, FleetGeo,
} from './cardTradeDoor';

/**
 * THE TRADE'S SECOND DOOR — «Летающая платформа» → «Выбрать колонию».
 *
 * The two entry points must be ONE action, differing only in entry context,
 * header and what B means before the commit. This drives the CARD door and
 * asserts exactly the things that make it one:
 *
 *   · the press COMMITS NOTHING — the floater is still on the card and the
 *     server was never asked; that is what makes B a real way back;
 *   · the breadcrumb keeps the origin, and it is the ONLY trace of it;
 *   · the working zone and the fleet dock land exactly where «Колонии» puts
 *     them — the header is the only thing that differs;
 *   · the fee is the card's own path, alone: the others are not choices here,
 *     so they are not shown;
 *   · B walks back one logical level at a time, and the variant survives.
 *
 * The COMMIT itself is guarded server-side (`TitanFloatingLaunchPad.spec` — one
 * trader, one `colony.trade`, the action marked used in the same call), and the
 * resolution after it is the standard trade's, which has its own e2e. Re-driving
 * those here would only re-measure somebody else's contract.
 */

/** The shared boot recipe (cardTradeDoor.ts) — one door, two specs. */
const CFG = cardTradeConfig();
const CORP = TRADE_CORP;

type Readout = {
  crumbSubject: string,
  crumbStage: string,
  crumbCommitted: boolean,
  cta: string,
  colonyGridUp: boolean,
  focusUp: boolean,
  payRows: ReadonlyArray<{title: string, chosen: boolean, off: boolean, locked: boolean, focused: boolean, reason: string}>,
  paySummary: ReadonlyArray<{iconW: number, text: string}>,
  /** Any second «источник» card / banner the header is supposed to make unnecessary. */
  sourceExtras: number,
  fleetsInHeader: boolean,
  toolbarUp: boolean,
  variantChipUp: boolean,
  zoneW: number,
  frameW: number,
  /** The workspace header's own height. It may re-tier ONCE, at the STEP
   *  boundary (the colonies bring their dock row with them — the same height
   *  their own standalone header carries); it may never move BETWEEN the
   *  step's internal stages. */
  headH: number,
  /** The crumb subject intersects the root's letters — never acceptable. */
  crumbOverlap: boolean,
};

async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => {
    const head = document.querySelector('.con-cardactions__head');
    const text = (root: Element | null, sel: string): string =>
      (root?.querySelector(sel) as HTMLElement | null)?.innerText.trim() ?? '';
    return {
      crumbSubject: text(head, '.con-wshead__subject'),
      crumbStage: text(head, '.con-wshead__step'),
      crumbCommitted: head?.querySelector('.con-wshead__step--committed') !== null,
      cta: text(document, '.con-composer__cta-label'),
      colonyGridUp: document.querySelector('.con-colonies__grid') !== null,
      focusUp: document.querySelector('.con-colfocus') !== null,
      payRows: Array.from(document.querySelectorAll('.con-colfocus__payrow')).map((r) => ({
        title: (r.querySelector('.con-colfocus__payrow-title') as HTMLElement | null)?.innerText.trim() ?? '',
        chosen: r.classList.contains('con-colfocus__payrow--chosen'),
        off: r.classList.contains('con-colfocus__payrow--off'),
        locked: r.classList.contains('con-colfocus__payrow--locked'),
        focused: r.classList.contains('con-colfocus__payrow--focused'),
        reason: (r.querySelector('.con-colfocus__payrow-reason') as HTMLElement | null)?.innerText.trim() ?? '',
      })),
      paySummary: Array.from(document.querySelectorAll('.con-colfocus__rsec--pay .con-colfocus__rrow')).map((r) => {
        const icon = r.querySelector('i');
        return {
          iconW: icon === null ? 0 : Math.round(icon.getBoundingClientRect().width),
          text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
        };
      }),
      // The rule the request states outright: no extra source card, no banner,
      // no duplicate chip naming the card — the crumb is the whole trace.
      sourceExtras: document.querySelectorAll(
        '.con-colonies [data-ptsel-source], .con-colfocus [data-ptsel-source], .con-task__source').length,
      // The FLEET DOCK berths in the host's header (the same right edge it
      // occupies when the player walks in through «Колонии»); a dock floating
      // in the content area is both the wrong place AND a row of grid height.
      fleetsInHeader: document.querySelector('[data-colony-fleet-berth] .con-colfleet, ' +
        '[data-colony-fleet-berth] > *') !== null,
      toolbarUp: document.querySelector('.con-colonies__toolbar') !== null,
      variantChipUp: document.querySelector('.con-cardactions__stat--variant') !== null,
      // The working zone — the number that decides «did I arrive at the same
      // screen». Compared against the frame it stands in, because the frame is
      // the same one the standalone section fills.
      zoneW: Math.round((document.querySelector('.con-colonies__scroll') as HTMLElement | null)
        ?.getBoundingClientRect().width ?? 0),
      frameW: Math.round((document.querySelector('.con-cardactions__frame') as HTMLElement | null)
        ?.getBoundingClientRect().width ?? 0),
      headH: Math.round((head as HTMLElement | null)?.getBoundingClientRect().height ?? 0),
      // The crumb SUBJECT painting over the ROOT («ДЕЙСТВИЯ КАРТЛЕТАЮЩАЯ…») —
      // the shrunk-identity overflow a full header line (dock + chips) once
      // produced. The anchor never loses a letter; the aux zone absorbs.
      crumbOverlap: (() => {
        const root = head?.querySelector('.con-wshead__root')?.getBoundingClientRect();
        const subj = head?.querySelector('.con-wshead__subject')?.getBoundingClientRect();
        return root !== undefined && subj !== undefined && subj.width > 0 && subj.left < root.right - 1;
      })(),
    };
  });
}

for (const profile of PROFILES) {
  test.describe(`console — the card-action trade door · ${profile.tag}`, () => {
    // The console is a 1920-logical design on a 4K TV; Playwright's default
    // 1280×720 resolves to the HANDHELD profile, which is a different
    // layout contract entirely.
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('A walks into the colonies committing nothing, the fee is pinned, B walks back out', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await bootWithCards(page, request, {
        config: CFG,
        cards: [LAUNCHPAD],
        corporation: CORP,
        query: profile.query,
      });

      await playLaunchpad(page);
      const before = await floaters(request, playerId);
      expect(before, 'the card carries the floaters its play put there').toBeGreaterThan(0);

      // ⓪ THE PARITY BASELINE — the fleet dock as «Колонии» renders it: same
      //    run, same players, same profile, so the later comparison is exact.
      await openColoniesSection(page);
      const standaloneFleets: FleetGeo | null = await fleetGeometry(page);
      expect(standaloneFleets, 'the standalone dock must be measurable').not.toBeNull();
      await press(page, 'Escape', 1400);

      await openCardActions(page);
      await focusTradeVariantTile(page);
      await openActionFocus(page);

      // ① THE BUTTON IS A NAVIGATION. «Подтвердить выполнение» would promise a
      //    commit that does not happen here — and used to, which is why the
      //    floater was gone before the colony was even asked for.
      const setup = await readout(page);
      expect(setup.cta.toLowerCase(), 'the CTA names where it goes').toContain('колони');
      expect(setup.crumbCommitted, 'nothing is committed yet, so the stage stays pre-commit').toBe(false);

      // ② A → the colony grid, INSIDE the card-actions workspace.
      await press(page, 'Enter', 2000);
      const picking = await readout(page);
      expect(picking.colonyGridUp, 'the colony selection stands').toBe(true);
      expect(picking.crumbSubject.toUpperCase(), 'the card is still the crumb SUBJECT')
        .toContain('ЛЕТАЮЩАЯ');
      expect(picking.crumbStage.toUpperCase(), 'and the tail is the step').toContain('КОЛОНИ');
      expect(picking.sourceExtras, 'the header is the only trace — no second source card').toBe(0);
      expect(await floaters(request, playerId), 'nothing was spent to get here').toBe(before);

      // ②b VISUAL PARITY — the player must read «I am in the colonies, I just
      //    came from somewhere else». The working zone therefore fills the SAME
      //    frame it fills through «Колонии» (a composer width cap once took ~28 %
      //    of it, and the colony fit is height-bound, so the tiles shrank with
      //    it), and the FLEET DOCK berths on the header's right edge instead of
      //    floating in the content — where it also stole a row of grid height.
      expect(picking.zoneW / picking.frameW, 'the colony zone fills the frame, as it does standalone')
        .toBeGreaterThan(0.94);
      expect(picking.fleetsInHeader, 'the fleet dock berths in the header').toBe(true);
      expect(picking.toolbarUp, 'and nothing is left floating in the content').toBe(false);
      expect(picking.variantChipUp, 'the variant chip yielded the tail to the step').toBe(false);
      // FULL GEOMETRY PARITY with the «Колонии» entry measured above: the same
      // chips at the same size on ONE horizontal line, hugging the same right
      // edge — the berth is a real cell of the header's trailing zone, never
      // the crumb-tail's zero-width absolute box (which stacked the chips
      // vertically: the one visual divergence on the one screen whose whole
      // point is «я попал туда же»).
      expectFleetParity(await fleetGeometry(page), standaloneFleets);
      // The dock joining the line must never squeeze the identity under the
      // crumb (the nowrap anchor has no clip — a shrunk box paints the subject
      // straight over its letters).
      expect(picking.crumbOverlap, 'the crumb subject painted over the workspace name').toBe(false);

      // ③ A → the colony's focus stage, with the fee already decided.
      await press(page, 'Enter', 2600);
      const onColony = await readout(page);
      expect(onColony.focusUp, 'the focus stage opened').toBe(true);
      expect(onColony.crumbStage, 'the colony folds into the tail beside its stage').toContain('·');
      // The header re-tiers only at the STEP boundary — never between the
      // step's own stages (selection → focus is a crumb-tail word change).
      expect(Math.abs(onColony.headH - picking.headH),
        `the header moved between the step's stages (${picking.headH} → ${onColony.headH})`)
        .toBeLessThanOrEqual(2);
      expect(onColony.crumbOverlap, 'the crumb subject painted over the workspace name').toBe(false);
      // The fee is FIXED by the entry, so it is not a list: a card action walked
      // in through this path and cannot switch. The other paths are not dimmed —
      // they are GONE, because a menu whose every other item refuses the press
      // is not information, it is furniture.
      expect(onColony.payRows, 'exactly one payment path, and it is the card\'s own').toHaveLength(1);
      expect(onColony.payRows[0].locked).toBe(true);
      expect(onColony.payRows[0].chosen).toBe(true);
      expect(onColony.payRows[0].focused, 'a fixed fee is not a cursor stop').toBe(false);

      // ④ «ОПЛАТА» speaks the same premium grammar as a resource fee.
      expect(onColony.paySummary.length, 'the fee is summarized').toBeGreaterThan(0);
      const fee = onColony.paySummary[0];
      expect(fee.iconW, 'the fee row carries a REAL icon, not a 0×0 element').toBeGreaterThan(4);
      expect(fee.text, 'and a before → after, like every other payment').toContain('→');

      // ⑤ Pressing around changes nothing — the lock is a rule, not a look.
      await press(page, 'ArrowDown', 700);
      await press(page, 'Enter', 900);
      const afterPoke = await readout(page);
      expect(afterPoke.payRows.filter((r) => r.chosen).map((r) => r.title),
        'the pinned fee is still the chosen one').toEqual(onColony.payRows.map((r) => r.title));

      // ⑥ B from the focus → back to the colony selection.
      await press(page, 'Escape', 2000);
      const backToGrid = await readout(page);
      expect(backToGrid.focusUp, 'the focus folded').toBe(false);
      expect(backToGrid.colonyGridUp, 'and the selection is back').toBe(true);

      // ⑦ B from the selection → back to the card's variant, still chosen.
      await press(page, 'Escape', 2000);
      const backToCard = await readout(page);
      expect(backToCard.colonyGridUp, 'the colony step is gone').toBe(false);
      expect(backToCard.crumbSubject.toUpperCase(), 'the card is still the subject')
        .toContain('ЛЕТАЮЩАЯ');
      expect(backToCard.cta.toLowerCase(), 'and the trade variant survived the trip')
        .toContain('колони');
      // …and the berth handed itself back: the fleets left, the variant returned.
      expect(backToCard.variantChipUp, 'the variant chip is back in the berth').toBe(true);
      expect(backToCard.fleetsInHeader, 'and the fleet dock left with the step').toBe(false);
      expect(await floaters(request, playerId), 'and the floater was never spent').toBe(before);
    });
  });
}
