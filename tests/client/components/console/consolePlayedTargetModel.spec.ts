import {expect} from 'chai';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {
  buildPlayedTargetModel,
  planPlayedTargetLayout,
  playedTargetSections,
  playedTargetShowsCategoryRails,
  stepPlayedTargetFocus,
  stepPlayedTargetOwner,
  reseatPlayedTargetFocus,
  findPlayedTargetFocus,
  playedTargetAt,
  planPlayedTargetSizing,
  stepPlayedTargetFocusAt,
  playedTargetQuickImpacts,
  playedTargetShowsOwnerTargetCount,
  playedTargetShowsResource,
  PLAYED_TARGET_RAIL_IMPACT_CAP,
  PLAYED_TARGET_FOCUS_SCALE,
  PlayedTargetCell,
  PlayedTargetPreviewSection,
  playedTargetResultOf,
  playedTargetResultLive,
  togglePlayedTargetPick,
  playedTargetPicksValid,
  prunePlayedTargetPicks,
  PlayedTargetOwner,
  PlayedTargetLayout,
} from '@/client/console/played/consolePlayedTargetModel';
import {playChoiceMode} from '@/client/console/consolePlayCardComposer';

const card = (name: string): CardModel => ({name} as CardModel);

const TYPES: Record<string, CardType> = {
  'Tectonic Stress Power': CardType.AUTOMATED,
  'Mars Hydro Turbines': CardType.ACTIVE,
  'Nuclear Zone': CardType.EVENT,
  'Predators': CardType.ACTIVE,
  'Ecoline': CardType.CORPORATION,
};

function build(opts: {
  candidates: ReadonlyArray<string>,
  admin?: ReadonlyArray<string>,
  victor?: ReadonlyArray<string>,
  bot?: ReadonlyArray<string>,
  resourceContext?: (name: CardName, model: CardModel) => {icon: string, count: number, showZero?: boolean} | undefined,
}) {
  return buildPlayedTargetModel({
    candidates: opts.candidates.map(card),
    players: [
      {name: 'admin', color: 'red', tableau: (opts.admin ?? []).map((n) => ({name: n}))},
      {name: 'victor', color: 'blue', tableau: (opts.victor ?? []).map((n) => ({name: n}))},
      {name: 'Bot', color: 'green', tableau: (opts.bot ?? []).map((n) => ({name: n}))},
    ],
    viewerColor: 'red',
    ask: 'Choose a building card',
    typeOf: (n) => TYPES[n],
    preview: (n) => [{key: 'copy', title: 'Will be copied', entity: 'target', impacts: [{label: n}]}],
    resourceContext: opts.resourceContext,
  });
}

const LAYOUT: PlayedTargetLayout = {mode: 'split', perRow: 2};
const TABS: PlayedTargetLayout = {mode: 'tabs', perRow: 3};

/** A measured candidate box, the way the component publishes it. */
const cell = (ownerId: string, index: number, left: number, top: number): PlayedTargetCell =>
  ({ownerId, index, left, top, width: 200, height: 290});

describe('consolePlayedTargetModel — the embedded played-card target step', () => {
  describe('the model', () => {
    /**
     * THE CORE PROMISE: the step costs what the CHOICES cost, never what the
     * table costs. A player with a big tableau and two legal targets must
     * build a two-candidate model — that is what keeps this from being a
     * second «Разыграно».
     */
    it('carries ONLY the eligible candidates, never the tableau', () => {
      const m = build({
        candidates: ['Mars Hydro Turbines'],
        admin: ['Mars Hydro Turbines', 'Nuclear Zone', 'Ecoline', 'Tectonic Stress Power'],
      });
      expect(m.owners).to.have.length(1);
      expect(m.owners[0].candidates.map((c) => c.cardName)).to.deep.eq(['Mars Hydro Turbines']);
      // …while still telling the truth about how big that table really is.
      expect(m.owners[0].totalPlayed).to.eq(4);
      expect(m.contract.targetCount).to.eq(1);
    });

    /**
     * An owner with no eligible card is not an empty group and not a disabled
     * tab — they are ABSENT. That is why the component needs no knowledge that
     * a bot's tableau is usually off-limits.
     */
    it('omits owners with no candidates entirely (no empty groups, no dead tabs)', () => {
      const m = build({
        candidates: ['Mars Hydro Turbines', 'Tectonic Stress Power'],
        admin: ['Mars Hydro Turbines'],
        victor: ['Tectonic Stress Power'],
        bot: ['Nuclear Zone', 'Ecoline'],
      });
      expect(m.owners.map((o) => o.name)).to.deep.eq(['victor', 'admin']);
      expect(m.contract.ownerCount).to.eq(2);
    });

    it('puts OPPONENTS first and the viewer last — a self-target is deliberate', () => {
      const m = build({
        candidates: ['Mars Hydro Turbines', 'Tectonic Stress Power'],
        admin: ['Mars Hydro Turbines'],
        victor: ['Tectonic Stress Power'],
      });
      expect(m.owners[0].self).to.eq(false);
      expect(m.owners[1].self).to.eq(true);
      expect(m.contract.selfAllowed).to.eq(true);
      expect(m.contract.opponentsInvolved).to.eq(true);
    });

    it('keeps the PHYSICAL anchor and the injected preview on every candidate', () => {
      const m = build({candidates: ['Mars Hydro Turbines'], admin: ['Mars Hydro Turbines']});
      const c = m.owners[0].candidates[0];
      expect(c.slotKey).to.eq('Mars Hydro Turbines');
      expect(c.ownerId).to.eq('red');
      expect(c.preview[0].title).to.eq('Will be copied');
    });

    it('drops a candidate no tableau claims — this surface is ABOUT origin', () => {
      const m = build({candidates: ['Ghost Card'], admin: ['Mars Hydro Turbines']});
      expect(m.owners).to.have.length(0);
      expect(m.contract.targetCount).to.eq(0);
    });
  });

  describe('categories', () => {
    it('emits only categories that HAVE candidates, in tableau order', () => {
      const m = build({
        candidates: ['Tectonic Stress Power', 'Mars Hydro Turbines'],
        admin: ['Tectonic Stress Power', 'Mars Hydro Turbines'],
      });
      const sections = playedTargetSections(m.owners[0]);
      expect(sections.map((s) => s.category)).to.deep.eq(['active', 'automated']);
      expect(sections.every((s) => s.candidates.length > 0)).to.eq(true);
    });

    /** One block → the rail would repeat what the contract and the cards
     *  already say, and spend the surface's scarcest dimension doing it. */
    it('suppresses the category rail when there is only ONE block', () => {
      const one = build({candidates: ['Mars Hydro Turbines'], admin: ['Mars Hydro Turbines']});
      expect(playedTargetShowsCategoryRails(playedTargetSections(one.owners[0]))).to.eq(false);
      const two = build({
        candidates: ['Tectonic Stress Power', 'Mars Hydro Turbines'],
        admin: ['Tectonic Stress Power', 'Mars Hydro Turbines'],
      });
      expect(playedTargetShowsCategoryRails(playedTargetSections(two.owners[0]))).to.eq(true);
    });
  });

  describe('owner presentation', () => {
    const owners = (a: number, b: number): ReadonlyArray<PlayedTargetOwner> => [
      {id: 'blue', name: 'victor', color: 'blue', self: false, totalPlayed: 9, candidates: new Array(a).fill(0).map((_x, i) => ({cardName: `A${i}` as CardName, category: 'active', ownerId: 'blue', slotKey: `A${i}`, preview: [], model: card(`A${i}`)}))},
      {id: 'red', name: 'admin', color: 'red', self: true, totalPlayed: 4, candidates: new Array(b).fill(0).map((_x, i) => ({cardName: `B${i}` as CardName, category: 'active', ownerId: 'red', slotKey: `B${i}`, preview: [], model: card(`B${i}`)}))},
    ];

    it('splits TWO owners when the band genuinely affords two readable columns', () => {
      expect(planPlayedTargetLayout({owners: owners(2, 2), availW: 1400, ui: 1, handheld: false}).mode).to.eq('split');
    });

    /** The Deck's band has no width to halve — tabs, always. */
    it('never splits on the Deck', () => {
      expect(planPlayedTargetLayout({owners: owners(2, 2), availW: 1400, ui: 1, handheld: true}).mode).to.eq('tabs');
    });

    it('never splits for one owner or for more than two', () => {
      expect(planPlayedTargetLayout({owners: owners(3, 0).slice(0, 1), availW: 1600, ui: 1, handheld: false}).mode).to.eq('tabs');
      const three = [...owners(2, 2), {id: 'green', name: 'Bot', color: 'green', self: false, totalPlayed: 3, candidates: owners(1, 0)[0].candidates}];
      expect(planPlayedTargetLayout({owners: three, availW: 1600, ui: 1, handheld: false}).mode).to.eq('tabs');
    });

    /**
     * The decision is a SPACE BUDGET, not a count check: two owners on a
     * narrow band, or two owners with too many candidates each, produce two
     * cramped grids — worse than one comfortable group.
     */
    it('falls back to tabs when splitting would shrink the cards', () => {
      expect(planPlayedTargetLayout({owners: owners(2, 2), availW: 420, ui: 1, handheld: false}).mode).to.eq('tabs');
      expect(planPlayedTargetLayout({owners: owners(8, 8), availW: 1600, ui: 1, handheld: false}).mode).to.eq('tabs');
    });

    it('is deterministic for a given model + viewport', () => {
      const a = planPlayedTargetLayout({owners: owners(2, 2), availW: 1400, ui: 1, handheld: false});
      const b = planPlayedTargetLayout({owners: owners(2, 2), availW: 1400, ui: 1, handheld: false});
      expect(a).to.deep.eq(b);
    });
  });

  describe('navigation', () => {
    const m = build({
      candidates: ['Tectonic Stress Power', 'Mars Hydro Turbines', 'Predators'],
      admin: ['Mars Hydro Turbines', 'Predators'],
      victor: ['Tectonic Stress Power'],
    });
    const owners = m.owners; // [victor(1), admin(2)]

    it('moves inside an owner group and holds at its edges', () => {
      const start = {ownerId: 'red', index: 0};
      expect(stepPlayedTargetFocus(start, 'right', owners, TABS).index).to.eq(1);
      expect(stepPlayedTargetFocus({ownerId: 'red', index: 1}, 'right', owners, TABS).index).to.eq(1);
      expect(stepPlayedTargetFocus(start, 'left', owners, TABS)).to.deep.eq(start);
    });

    /** In SPLIT the groups are spatial neighbours, so the cursor crosses the
     *  gap horizontally — never an index-based teleport. */
    it('crosses between owner groups in SPLIT mode, and never in TABS', () => {
      const leftEdge = {ownerId: 'blue', index: 0};
      expect(stepPlayedTargetFocus(leftEdge, 'right', owners, LAYOUT).ownerId).to.eq('red');
      expect(stepPlayedTargetFocus(leftEdge, 'right', owners, TABS).ownerId).to.eq('blue');
      const back = stepPlayedTargetFocus({ownerId: 'red', index: 0}, 'left', owners, LAYOUT);
      expect(back.ownerId).to.eq('blue');
    });

    it('LB/RB cycles owners in tabbed mode, wrapping both ways', () => {
      expect(stepPlayedTargetOwner('blue', 1, owners)).to.eq('red');
      expect(stepPlayedTargetOwner('red', 1, owners)).to.eq('blue');
      expect(stepPlayedTargetOwner('blue', -1, owners)).to.eq('red');
    });

    it('finds and reads a candidate by name (the «restore my target» path)', () => {
      const focus = findPlayedTargetFocus('Predators', owners);
      expect(focus).to.not.eq(undefined);
      expect(playedTargetAt(focus, owners)?.cardName).to.eq('Predators');
      expect(findPlayedTargetFocus('Nuclear Zone', owners)).to.eq(undefined);
    });
  });

  describe('stale state', () => {
    const m = build({candidates: ['Mars Hydro Turbines'], admin: ['Mars Hydro Turbines']});
    const result = playedTargetResultOf(m.owners[0].candidates[0], m.owners, 'v1');

    it('the result carries the physical origin, not just a name', () => {
      expect(result.slotKey).to.eq('Mars Hydro Turbines');
      expect(result.ownerName).to.eq('admin');
      expect(result.self).to.eq(true);
      expect(result.category).to.eq('active');
      expect(result.preview).to.have.length(1);
    });

    /** A target that disappeared, or a game state that moved, must never be
     *  silently confirmable. */
    it('a remembered target dies with its game-state version OR with its card', () => {
      expect(playedTargetResultLive(result, m.owners, 'v1')).to.eq(true);
      expect(playedTargetResultLive(result, m.owners, 'v2')).to.eq(false);
      const without = build({candidates: ['Predators'], admin: ['Predators']});
      expect(playedTargetResultLive(result, without.owners, 'v1')).to.eq(false);
    });

    it('re-seats a focus onto the nearest surviving candidate', () => {
      const shrunk = build({candidates: ['Mars Hydro Turbines'], admin: ['Mars Hydro Turbines']});
      const reseated = reseatPlayedTargetFocus({ownerId: 'red', index: 7}, shrunk.owners);
      expect(reseated).to.deep.eq({ownerId: 'red', index: 0});
      expect(reseatPlayedTargetFocus({ownerId: 'gone', index: 3}, shrunk.owners)?.ownerId).to.eq('red');
      expect(reseatPlayedTargetFocus({ownerId: 'red', index: 0}, [])).to.eq(undefined);
    });
  });

  /**
   * ONE derivation behind the focus rail, the answered summary and (through the
   * host's fold) the Result. Three UI places computing "what does this card
   * give me" three times is how a screen ends up saying the same thing in three
   * slightly different ways — which is exactly what the rail did.
   */
  describe('quick impacts — the ONE-LINE reading', () => {
    const sections: ReadonlyArray<PlayedTargetPreviewSection> = [
      {key: 'copy', title: 'Will be copied', entity: 'player',
        impacts: [{label: 'Titanium production', icon: 'titanium', amount: 1}]},
      {key: 'src', title: '', entity: 'source', impacts: [], note: 'The source card stays unchanged'},
      {key: 'res', title: 'Target card', entity: 'target',
        impacts: [{label: 'Resources on this card', from: 4, to: 3}]},
    ];

    /** The rail is one line. A section TITLE next to the very chip that states
     *  the fact, plus a note restating it in prose, is three readings of one
     *  thing — so the flattening drops both by construction. */
    it('drops section titles and notes, and keeps WHAT the change happens to', () => {
      const quick = playedTargetQuickImpacts(sections);
      expect(quick.map((i) => i.label))
        .to.deep.eq(['Titanium production', 'Resources on this card']);
      expect(quick.map((i) => i.entity)).to.deep.eq(['player', 'target']);
      expect(quick.every((i) => !('title' in i) && !('note' in i))).to.eq(true);
    });

    /** A note-only section (the «источник не изменится» clarifier) contributes
     *  nothing to a line whose job is the delta. */
    it('emits nothing for a section that carries no impact', () => {
      expect(playedTargetQuickImpacts([sections[1]])).to.have.length(0);
      expect(playedTargetQuickImpacts([])).to.have.length(0);
    });

    it('keeps both delta shapes intact — before→after and a bare amount', () => {
      const quick = playedTargetQuickImpacts(sections);
      expect(quick[0].amount).to.eq(1);
      expect(quick[1].from).to.eq(4);
      expect(quick[1].to).to.eq(3);
    });

    /** Keys are stable and unique so the rail can re-render on a focus move
     *  without remounting chips (a remount is a blink at 4K). */
    it('gives every impact a stable unique key', () => {
      const keys = playedTargetQuickImpacts(sections).map((i) => i.key);
      expect(new Set(keys).size).to.eq(keys.length);
      expect(playedTargetQuickImpacts(sections).map((i) => i.key)).to.deep.eq(keys);
    });

    it('the rail cap is a real bound the host can honour', () => {
      expect(PLAYED_TARGET_RAIL_IMPACT_CAP).to.be.greaterThan(0);
    });
  });

  /**
   * THE GOLD «0». Every candidate used to wear its `model.resources`, so
   * Industrial Robots' building cards each showed a zero that is true, has no
   * bearing on the choice, and reads as a cost.
   */
  describe('resource overlays — context-driven, never inferred', () => {
    it('carries NO resource context unless the host supplies one', () => {
      const m = build({candidates: ['Mars Hydro Turbines'], admin: ['Mars Hydro Turbines']});
      expect(m.owners[0].candidates[0].resourceContext).to.eq(undefined);
      expect(playedTargetShowsResource(undefined)).to.eq(false);
    });

    it('shows an explicit context, and hides a zero unless it was asked for', () => {
      expect(playedTargetShowsResource({icon: 'animals', count: 4})).to.eq(true);
      expect(playedTargetShowsResource({icon: 'animals', count: 0})).to.eq(false);
      expect(playedTargetShowsResource({icon: 'animals', count: 0, showZero: true})).to.eq(true);
    });

    it('passes the host\'s context through onto the candidate', () => {
      const m = build({
        candidates: ['Predators'], admin: ['Predators'],
        resourceContext: () => ({icon: 'animals', count: 4}),
      });
      expect(m.owners[0].candidates[0].resourceContext).to.deep.eq({icon: 'animals', count: 4});
    });
  });

  /**
   * «Доступных целей: 2», «ДОСТУПНО 2» and «АКТИВНЫЕ 1 · АВТОМАТИЧЕСКИЕ 1» were
   * three statements of one count, each read as if it might mean something the
   * others did not.
   */
  describe('count suppression', () => {
    it('drops the owner bar\'s eligible count when there is only ONE owner', () => {
      const one = build({candidates: ['Mars Hydro Turbines'], admin: ['Mars Hydro Turbines']});
      expect(playedTargetShowsOwnerTargetCount(one.owners)).to.eq(false);
    });

    /** With several owners the number stops repeating the total and starts
     *  answering «where are they» — so it comes back. */
    it('brings it back when the count answers a question the total cannot', () => {
      const two = build({
        candidates: ['Mars Hydro Turbines', 'Tectonic Stress Power'],
        admin: ['Mars Hydro Turbines'],
        victor: ['Tectonic Stress Power'],
      });
      expect(playedTargetShowsOwnerTargetCount(two.owners)).to.eq(true);
    });
  });

  /**
   * SIZE IS A MEASUREMENT, NOT A PROFILE CONSTANT. The first cut drew a
   * two-card choice at the size a ten-card choice needs, because the zoom came
   * from a per-profile CSS ladder.
   */
  describe('sizing — the surface is spent on the cards that exist', () => {
    const owner = (n: number, cats: ReadonlyArray<string> = ['active']): PlayedTargetOwner => ({
      id: 'red', name: 'admin', color: 'red', self: true, totalPlayed: 12,
      candidates: new Array(n).fill(0).map((_x, i) => ({
        cardName: `C${i}` as CardName,
        category: cats[i % cats.length] as PlayedTargetOwner['candidates'][number]['category'],
        ownerId: 'red', slotKey: `C${i}`, preview: [], model: card(`C${i}`),
      })),
    });
    const plan = (o: PlayedTargetOwner, availW = 1600, availH = 800) =>
      planPlayedTargetSizing({owners: [o], mode: 'tabs', availW, availH, ui: 1, handheld: false});

    it('gives FEWER candidates BIGGER cards — the whole point', () => {
      const two = plan(owner(2)).cardZoom;
      const eight = plan(owner(8)).cardZoom;
      expect(two).to.be.greaterThan(eight);
    });

    /** A single target on a 4K band is a confident card, not a stamp adrift in
     *  empty space. */
    it('sizes a lone candidate up to the ceiling', () => {
      expect(plan(owner(1)).cardZoom).to.be.closeTo(1, 0.03);
    });

    /** A candidate never out-sizes the SOURCE card (`1.24·ui`): the source is
     *  the subject of the screen, not a rival. */
    it('never exceeds the ceiling, however much room there is', () => {
      expect(plan(owner(2), 6000, 4000).cardZoom).to.be.at.most(1);
    });

    /** Two categories and a wide band: the blocks stand side by side, which is
     *  the arrangement that spends the width the complaint was about. */
    it('stands category blocks SIDE BY SIDE when that buys bigger cards', () => {
      const s = plan(owner(2, ['active', 'automated']));
      expect(s.sectionFlow).to.eq('columns');
      expect(s.sectionColumns).to.eq(2);
    });

    it('stacks them when there is only one block to lay out', () => {
      expect(plan(owner(2, ['active'])).sectionFlow).to.eq('rows');
      expect(plan(owner(2, ['active'])).sectionColumns).to.eq(1);
    });

    /** A narrow band cannot halve: stacking keeps the cards readable, and a
     *  readable stacked card beats a cramped column pair. */
    it('falls back to stacked blocks on a band too narrow to halve', () => {
      const s = plan(owner(2, ['active', 'automated']), 300, 900);
      expect(s.sectionFlow).to.eq('rows');
    });

    /** A tab switch that re-sized the cards would be a layout jump — so the
     *  size is solved against EVERY owner, not just the visible one. */
    it('sizes tabs against the busiest owner so switching never resizes', () => {
      const quiet: PlayedTargetOwner = {...owner(1), id: 'blue', name: 'victor', color: 'blue', self: false};
      const busy = owner(9);
      const both = planPlayedTargetSizing({owners: [quiet, busy], mode: 'tabs', availW: 1600, availH: 800, ui: 1, handheld: false});
      const busyAlone = plan(busy);
      expect(both.cardZoom).to.be.closeTo(busyAlone.cardZoom, 0.001);
    });

    it('scales the whole ladder with the TV rem factor', () => {
      const at1 = planPlayedTargetSizing({owners: [owner(2)], mode: 'tabs', availW: 1600, availH: 800, ui: 1, handheld: false});
      const at2 = planPlayedTargetSizing({owners: [owner(2)], mode: 'tabs', availW: 3200, availH: 1600, ui: 2, handheld: false});
      expect(at2.cardZoom).to.be.greaterThan(at1.cardZoom);
    });

    /** The Deck's ceiling is its own — its band has neither the width nor the
     *  viewing distance for a couch-sized face. */
    it('keeps the Deck under its own ceiling', () => {
      const s = planPlayedTargetSizing({owners: [owner(2)], mode: 'tabs', availW: 900, availH: 420, ui: 1, handheld: true});
      expect(s.cardZoom).to.be.at.most(0.6);
    });

    /**
     * The gap is the LARGER of a readable minimum and the focused card's own
     * clearance, so a ring can never grow over its neighbour at any size. At
     * today's deliberately tiny emphasis the minimum wins every time — the
     * clearance term is what keeps that true if the emphasis is ever raised,
     * rather than turning into a silent overlap nobody re-checked.
     */
    it('always clears the focused card\'s overhang, at every size and scale', () => {
      for (const ui of [1, 2]) {
        for (const n of [1, 2, 4, 9]) {
          const s = planPlayedTargetSizing({
            owners: [owner(n)], mode: 'tabs', availW: 1600 * ui, availH: 800 * ui, ui, handheld: false,
          });
          const overhang = 320 * s.cardZoom * (PLAYED_TARGET_FOCUS_SCALE - 1) / 2;
          expect(s.gapPx, `n=${n} ui=${ui}`).to.be.at.least(overhang);
          expect(s.gapPx, `n=${n} ui=${ui}`).to.be.at.least(11 * ui);
        }
      }
    });

    /** Honest failure: it says the zone must scroll rather than shrinking the
     *  cards past legibility. */
    it('reports overflow instead of shrinking past the floor', () => {
      const s = planPlayedTargetSizing({owners: [owner(40)], mode: 'tabs', availW: 300, availH: 200, ui: 1, handheld: false});
      expect(s.overflows).to.eq(true);
      expect(s.cardZoom).to.be.at.least(0.3);
    });

    it('is deterministic for a given model + box', () => {
      expect(plan(owner(3))).to.deep.eq(plan(owner(3)));
    });

    it('answers safely for an empty model', () => {
      const s = planPlayedTargetSizing({owners: [], mode: 'tabs', availW: 1600, availH: 800, ui: 1, handheld: false});
      expect(s.perRow).to.eq(1);
      expect(s.overflows).to.eq(false);
    });
  });

  /**
   * THE REPORTED DEFECT. Two candidates in two category blocks sit one ABOVE
   * the other, but the index walk assumed one uniform grid with `perRow: 3` —
   * so Down did nothing and Right moved between cards the player sees stacked.
   * Direction is now resolved against the measured boxes.
   */
  describe('geometry navigation — by where the cards ARE', () => {
    /** ACTIVE over AUTOMATED, one card each: the exact reported layout. */
    const stacked: ReadonlyArray<PlayedTargetCell> = [cell('red', 0, 100, 100), cell('red', 1, 100, 460)];

    it('moves DOWN and UP through a vertical layout (the reported bug)', () => {
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'down', stacked))
        .to.deep.eq({ownerId: 'red', index: 1});
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 1}, 'up', stacked))
        .to.deep.eq({ownerId: 'red', index: 0});
    });

    /** …and Left/Right do NOTHING there, because nothing lies that way. An
     *  edge holds; it never wraps and never teleports to an array neighbour. */
    it('holds Left/Right when the layout is vertical', () => {
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'right', stacked)).to.eq(undefined);
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'left', stacked)).to.eq(undefined);
    });

    /** The same model laid out horizontally navigates horizontally — with no
     *  change anywhere but the rects. That is what "geometry-aware" buys. */
    it('moves LEFT and RIGHT through a horizontal layout', () => {
      const side: ReadonlyArray<PlayedTargetCell> = [cell('red', 0, 100, 100), cell('red', 1, 400, 100)];
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'right', side))
        .to.deep.eq({ownerId: 'red', index: 1});
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 1}, 'left', side))
        .to.deep.eq({ownerId: 'red', index: 0});
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'down', side)).to.eq(undefined);
    });

    /** Category blocks side by side: crossing between them is a horizontal
     *  move, and the row it lands on is the one the eye is already on. */
    it('crosses between CATEGORY blocks by geometry', () => {
      const cols: ReadonlyArray<PlayedTargetCell> = [
        cell('red', 0, 100, 100), cell('red', 1, 100, 420), // «Активные» column
        cell('red', 2, 500, 100), cell('red', 3, 500, 420), // «Автоматические»
      ];
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 1}, 'right', cols))
        .to.deep.eq({ownerId: 'red', index: 3});
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 3}, 'left', cols))
        .to.deep.eq({ownerId: 'red', index: 1});
    });

    /** SPLIT owners are spatial neighbours, so the cursor crosses the gap the
     *  way the eye does — never by array order. */
    it('crosses between SPLIT owner groups by geometry, symmetrically', () => {
      const split: ReadonlyArray<PlayedTargetCell> = [
        cell('blue', 0, 100, 100), cell('blue', 1, 340, 100),
        cell('red', 0, 900, 100),
      ];
      expect(stepPlayedTargetFocusAt({ownerId: 'blue', index: 1}, 'right', split))
        .to.deep.eq({ownerId: 'red', index: 0});
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'left', split))
        .to.deep.eq({ownerId: 'blue', index: 1});
    });

    /** In TABS only one group is on screen, so its cells are the only ones
     *  published — the horizontal edges hold and LB/RB stay the ONLY owner
     *  axis. No second, silent way to change tab. */
    it('cannot leave the visible owner in tabbed mode', () => {
      const oneTab: ReadonlyArray<PlayedTargetCell> = [cell('red', 0, 100, 100), cell('red', 1, 400, 100)];
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 1}, 'right', oneTab)).to.eq(undefined);
    });

    /**
     * A wrapped grid's LAST ROW is short. Down from a column that has nothing
     * directly beneath it reaches the nearest card of the row below rather than
     * stranding the cursor — a short last row must stay reachable from every
     * column above it. What it never does is slide sideways WITHIN a row.
     */
    it('reaches a short last row from any column above it', () => {
      const ragged: ReadonlyArray<PlayedTargetCell> = [
        cell('red', 0, 100, 100), cell('red', 1, 340, 100), cell('red', 2, 580, 100),
        cell('red', 3, 100, 420),
      ];
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'down', ragged))
        .to.deep.eq({ownerId: 'red', index: 3});
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 2}, 'down', ragged))
        .to.deep.eq({ownerId: 'red', index: 3});
      // …and the row below is the FLOOR: there is nothing under it.
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 3}, 'down', ragged)).to.eq(undefined);
    });

    /** No geometry, or a focus the map does not know → the caller must fall
     *  back to the index walk rather than moving somewhere arbitrary. */
    it('declines when it has nothing to answer with', () => {
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'down', [])).to.eq(undefined);
      expect(stepPlayedTargetFocusAt({ownerId: 'gone', index: 0}, 'down', stacked)).to.eq(undefined);
      expect(stepPlayedTargetFocusAt({ownerId: 'red', index: 0}, 'down', [cell('red', 0, 100, 100)]))
        .to.eq(undefined);
    });
  });
});

describe('playChoiceMode — routing a played-card target to the embedded step', () => {
  const choice = (cards: ReadonlyArray<string>, max = 1): any => ({
    id: 's0', scope: 'step', index: 0, kind: 'card',
    input: {type: 'card', cards: cards.map((n) => ({name: n})), max, min: 1},
  });
  const set = (...n: ReadonlyArray<string>) => new Set<string>(n);

  /** The case this migration exists for: candidates on the table, but not all
   *  on the viewer's own — it used to fall through to a generic text list. */
  it('routes a MIXED-owner played-card pick to the embedded step', () => {
    const mode = playChoiceMode(
      choice(['Mine', 'Theirs']), set(), set('Mine'), set('Mine', 'Theirs'));
    expect(mode).to.eq('playedTarget');
  });

  /**
   * THE REGRESSION THIS ORDERING FIXES. «Промышленные роботы»
   * (RoboticWorkforce) duplicates the production of one of the player's OWN
   * buildings — so an own-table-first check sent the flagship case straight
   * back to the old lift-out-of-the-tableau surface and the new step never
   * appeared. The boundary is the CAPABILITY (one card vs many), not the owner.
   */
  it('routes an OWN-table SINGLE pick to the embedded step too', () => {
    const mode = playChoiceMode(
      choice(['Mine']), set(), set('Mine'), set('Mine', 'Theirs'));
    expect(mode).to.eq('playedTarget');
  });

  /**
   * THE MIGRATION IS COMPLETE FOR CARD PLAY: with multi hosted inside the
   * embedded step, NO shape of this flow reaches the old lift-out-of-the-
   * tableau surface any more. `tableauPick` survives only for the blue-action
   * composer, which shares this vocabulary and has not migrated yet.
   */
  it('leaves NO card-play shape on the old tableau surface — single OR multi', () => {
    const played = set('Mine', 'Mine2');
    expect(playChoiceMode(choice(['Mine']), set(), set('Mine'), played)).to.eq('playedTarget');
    expect(playChoiceMode(choice(['Mine', 'Mine2'], 2), set(), set('Mine', 'Mine2'), played)).to.eq('playedTarget');
    // …and the branch is only reachable when the caller supplies no played
    // universe at all (the un-migrated blue-action path).
    expect(playChoiceMode(choice(['Mine', 'Mine2'], 2), set(), set('Mine', 'Mine2'))).to.eq('tableauPick');
  });

  it('never claims a hand pick, and never candidates it cannot place', () => {
    expect(playChoiceMode(choice(['InHand']), set('InHand'), set(), set('InHand'))).to.eq('handPick');
    // A candidate on nobody's table (an SRR-hosted card) has no physical
    // origin to show, and this surface is ABOUT origin — the honest follow-up.
    expect(playChoiceMode(choice(['Mine', 'Hosted'], 3), set(), set('Mine'), set('Mine'))).to.eq('followup');
  });

  /** Without the played-name universe the classifier must behave exactly as
   *  before — the argument is additive, never a behaviour change for callers
   *  that do not pass it. */
  it('is inert for callers that do not supply the played universe', () => {
    expect(playChoiceMode(choice(['Mine', 'Theirs']), set(), set('Mine'))).to.eq('inline');
  });
});

describe('multi selection — the server\'s merged up-to-N ask', () => {
  /**
   * The merged ask (Astra Mechanica's «return up to 2 events») is ONE question
   * the server sends with one title and one `min`. It is hosted inside the step
   * rather than split into rows, because splitting would invent a sequence the
   * rules do not have. Cards that genuinely ARE several asks (Cyberia's two
   * copy steps) already arrive as separate steps and get a zone each.
   */
  it('toggles picks and respects the cap', () => {
    let picked: ReadonlyArray<string> = [];
    picked = togglePlayedTargetPick(picked, 'A', 2);
    picked = togglePlayedTargetPick(picked, 'B', 2);
    expect(picked).to.deep.eq(['A', 'B']);
    // At the cap a third add is a NO-OP that returns the same list, so the
    // caller can tell «blocked» from «picked» and say so.
    const blocked = togglePlayedTargetPick(picked, 'C', 2);
    expect(blocked).to.eq(picked);
    // …and de-selecting always works, whatever the cap.
    expect(togglePlayedTargetPick(picked, 'A', 2)).to.deep.eq(['B']);
  });

  it('validates against min/max — never submits a half-built selection', () => {
    expect(playedTargetPicksValid({mode: 'multi', min: 1, max: 2, picked: []})).to.eq(false);
    expect(playedTargetPicksValid({mode: 'multi', min: 1, max: 2, picked: ['A']})).to.eq(true);
    // Astra's `min: 0` — returning nothing is a legal choice, so RT stays live.
    expect(playedTargetPicksValid({mode: 'multi', min: 0, max: 2, picked: []})).to.eq(true);
    // A single ask has nothing to validate: A chooses and the step closes.
    expect(playedTargetPicksValid({mode: 'single'})).to.eq(true);
  });

  it('prunes picks whose cards left the table (the realtime path)', () => {
    const m = build({candidates: ['Mars Hydro Turbines'], admin: ['Mars Hydro Turbines']});
    expect(prunePlayedTargetPicks(['Mars Hydro Turbines', 'Gone'], m.owners)).to.deep.eq(['Mars Hydro Turbines']);
    expect(prunePlayedTargetPicks(['Gone'], m.owners)).to.deep.eq([]);
  });

  /** MULTI now lives in the embedded step too, so card play has no shape left
   *  that needs the old lift-out-of-the-tableau surface. */
  it('routes a MULTI played-card pick to the embedded step as well', () => {
    const c: any = {
      id: 's0', scope: 'step', index: 0, kind: 'card',
      input: {type: 'card', cards: [{name: 'Mine'}, {name: 'Mine2'}], max: 2, min: 0},
    };
    expect(playChoiceMode(c, new Set(), new Set(['Mine', 'Mine2']), new Set(['Mine', 'Mine2'])))
      .to.eq('playedTarget');
  });
});
