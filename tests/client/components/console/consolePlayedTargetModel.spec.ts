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
  });
}

const LAYOUT: PlayedTargetLayout = {mode: 'split', perRow: 2};
const TABS: PlayedTargetLayout = {mode: 'tabs', perRow: 3};

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
