import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {ActionPreview, ActionEffect} from '@/common/models/ActionPreviewModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {CardResource} from '@/common/CardResource';
import {
  actionWorkspaceRestorePlan,
  ActionRestoreInput,
  buildConsoleActionsModel,
  branchScopeForNode,
  cycleAvailability,
  cycleActivation,
  defaultCardActionsFilter,
  defaultRepeatFilter,
  packActionRows,
  arrangeGroupsForGrid,
  stepActionRows,
  ConsoleActionGroup,
} from '@/client/console/consoleCardActions';

function effect(direction: 'cost' | 'gain', icon: string, amount: number): ActionEffect {
  return {direction, icon, amount};
}

function node(cardName: string, i: number, text: string) {
  return {key: cardName + '#' + i, actionNode: undefined, renderRoot: undefined, text};
}

function entry(
  cardName: string,
  status: ActionStatus,
  nodeTexts: ReadonlyArray<string>,
  opts?: {reasons?: ReadonlyArray<UnplayableReason>, softReason?: UnplayableReason},
): ActionEntry {
  return {
    group: {
      key: cardName,
      cardName: cardName as CardName,
      isCorporation: false,
      isDisabled: false,
      nodes: nodeTexts.map((t, i) => node(cardName, i, t)),
    },
    cardName: cardName as CardName,
    isCorporation: false,
    state: {
      status,
      activatable: status === 'available',
      reasons: opts?.reasons ?? [],
      softReason: opts?.softReason,
    },
  };
}

function preview(cardName: string, branches: ActionPreview['branches']): ActionPreview {
  return {card: cardName as CardName, isCorporation: false, kind: 'declarative', branches};
}

const NO_PREVIEWS = new Map<CardName, ActionPreview>();
const NO_RESOURCES = new Map<CardName, {type: CardResource, count: number}>();

describe('consoleCardActions model', () => {
  it('builds one available tile for a single-branch action', () => {
    const entries = [entry('Solo', 'available', ['use'])];
    const previews = new Map<CardName, ActionPreview>([
      ['Solo' as CardName, preview('Solo', [
        {index: -1, title: 'use', available: true, renderKeys: [], effects: [effect('gain', 'megacredits', 3)], steps: []},
      ])],
    ]);
    const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, defaultCardActionsFilter());
    expect(model.groups).to.have.length(1);
    expect(model.groups[0].tiles).to.have.length(1);
    const tile = model.groups[0].tiles[0];
    expect(tile.status).to.eq('available');
    expect(tile.gainEffects).to.have.length(1);
    expect(model.totalTiles).to.eq(1);
    expect(model.availableTiles).to.eq(1);
  });

  it('refines a multi-branch card per VARIANT: one available, one blocked', () => {
    const entries = [entry('Catapult', 'available', ['plants', 'steel'])];
    const previews = new Map<CardName, ActionPreview>([
      ['Catapult' as CardName, preview('Catapult', [
        {index: 0, title: 'plants', available: true, renderKeys: [],
          effects: [effect('cost', 'plants', 1), effect('gain', 'megacredits', 7)], steps: []},
        {index: 1, title: 'steel', available: false, unavailableReason: 'Not enough steel', renderKeys: [],
          effects: [effect('cost', 'steel', 1), effect('gain', 'megacredits', 7)], steps: []},
      ])],
    ]);
    const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, defaultCardActionsFilter());
    // Both variants shown under the group; the card itself is "available".
    expect(model.groups).to.have.length(1);
    expect(model.groups[0].status).to.eq('available');
    const [t0, t1] = model.groups[0].tiles;
    expect(t0.status).to.eq('available');
    expect(t0.costEffects.map((e) => e.icon)).to.deep.eq(['plants']);
    expect(t1.status).to.eq('rules');
    expect(t1.reason?.message).to.eq('Not enough steel');
    // Counts are BY VARIANT: 2 total, 1 available, 1 unavailable.
    const avail = model.availabilityChips;
    expect(avail.find((c) => c.value === 'all')?.count).to.eq(2);
    expect(avail.find((c) => c.value === 'available')?.count).to.eq(1);
    expect(avail.find((c) => c.value === 'unavailable')?.count).to.eq(1);
    expect(model.availableTiles).to.eq(1);
  });

  it('the availability filter narrows a group to its matching variant(s)', () => {
    const entries = [entry('Catapult', 'available', ['plants', 'steel'])];
    const previews = new Map<CardName, ActionPreview>([
      ['Catapult' as CardName, preview('Catapult', [
        {index: 0, title: 'plants', available: true, renderKeys: [], effects: [], steps: []},
        {index: 1, title: 'steel', available: false, unavailableReason: 'x', renderKeys: [], effects: [], steps: []},
      ])],
    ]);
    const onlyAvail = buildConsoleActionsModel(entries, previews, NO_RESOURCES, {availability: 'available', activation: 'all'});
    expect(onlyAvail.groups).to.have.length(1);
    expect(onlyAvail.groups[0].tiles).to.have.length(1);
    expect(onlyAvail.groups[0].tiles[0].status).to.eq('available');

    const onlyUnavail = buildConsoleActionsModel(entries, previews, NO_RESOURCES, {availability: 'unavailable', activation: 'all'});
    expect(onlyUnavail.groups[0].tiles).to.have.length(1);
    expect(onlyUnavail.groups[0].tiles[0].status).to.eq('rules');
  });

  it('hides activated actions by default and shows them under the activation filter', () => {
    const entries = [
      entry('Fresh', 'available', ['use']),
      entry('Used', 'activated', ['use'], {softReason: {type: 'rule', message: 'used'}}),
    ];
    const dormant = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, defaultCardActionsFilter());
    expect(dormant.groups.map((g) => g.cardName)).to.deep.eq(['Fresh']);
    // Both dimensions are counted by variant, own-dimension excluded.
    expect(dormant.activationChips.find((c) => c.value === 'activated')?.count).to.eq(1);

    const activated = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'activated'});
    expect(activated.groups.map((g) => g.cardName)).to.deep.eq(['Used']);
  });

  it('sorts available groups before blocked groups (stable within a band)', () => {
    const entries = [
      entry('Blocked', 'rules', ['use'], {reasons: [{type: 'rule', message: 'no'}]}),
      entry('Ready', 'available', ['use']),
    ];
    const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'all'});
    expect(model.groups.map((g) => g.cardName)).to.deep.eq(['Ready', 'Blocked']);
  });

  it('carries the stored card-resource count onto the group', () => {
    const entries = [entry('Bacteria', 'available', ['add'])];
    const resources = new Map<CardName, {type: CardResource, count: number}>([
      ['Bacteria' as CardName, {type: 'Microbe' as CardResource, count: 3}],
    ]);
    const model = buildConsoleActionsModel(entries, NO_PREVIEWS, resources, defaultCardActionsFilter());
    expect(model.groups[0].cardResource).to.deep.eq({type: 'Microbe', count: 3});
  });

  it('produces a flat focus order over the visible tiles', () => {
    const entries = [entry('A', 'available', ['x', 'y']), entry('B', 'available', ['z'])];
    const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, defaultCardActionsFilter());
    expect(model.flatKeys).to.deep.eq(['A#0', 'A#1', 'B#0']);
  });

  it('cycles the two filter dimensions', () => {
    expect(cycleAvailability('all', 1)).to.eq('available');
    expect(cycleAvailability('all', -1)).to.eq('unavailable');
    expect(cycleActivation('dormant', 1)).to.eq('activated');
    expect(cycleActivation('dormant', -1)).to.eq('all');
  });

  // ── Iteration 2: formula COMPLETENESS (never a lossy simplification) ──────

  it('an amountResult amount step becomes a spend→result range pair and SUPPRESSES its static twin (Hi-Tech Lab)', () => {
    const entries = [entry('HiTech', 'available', ['use'])];
    const amountStep = {
      kind: 'input' as const,
      input: {
        type: 'amount', title: 'Select amount of energy to spend',
        min: 1, max: 2, maxByDefault: false, icon: 'energy',
        amountResult: {icon: 'cards', perUnit: 1, label: 'Cards drawn'},
      } as unknown as PlayerInputModel,
    };
    const previews = new Map<CardName, ActionPreview>([
      ['HiTech' as CardName, preview('HiTech', [
        {index: -1, title: '', available: true, renderKeys: [],
          effects: [{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}],
          steps: [amountStep]},
      ])],
    ]);
    const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, defaultCardActionsFilter());
    const tile = model.groups[0].tiles[0];
    // The energy cost is IN the formula — as a variable spend range.
    expect(tile.variableCost).to.deep.eq([{role: 'spend', icon: 'energy', min: 1, max: 2, unit: undefined}]);
    expect(tile.variableGain).to.deep.eq([{role: 'result', icon: 'cards', min: 1, max: 2}]);
    // The static "+1 cards" baseline is suppressed (no contradiction).
    expect(tile.gainEffects).to.have.length(0);
    expect(tile.hasChoices).to.eq(true);
  });

  it('a bare amount input yields a NEUTRAL choice chip (own cluster) and suppresses nothing', () => {
    const entries = [entry('Power', 'available', ['use'])];
    const previews = new Map<CardName, ActionPreview>([
      ['Power' as CardName, preview('Power', [
        {index: -1, title: '', available: true, renderKeys: [],
          effects: [effect('gain', 'megacredits', 1)],
          steps: [{kind: 'input', input: {type: 'amount', title: 't', min: 1, max: 5, maxByDefault: false, icon: 'energy'} as unknown as PlayerInputModel}]},
      ])],
    ]);
    const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, defaultCardActionsFilter());
    const tile = model.groups[0].tiles[0];
    // Direction unknown → NEVER placed on the spent/received side.
    expect(tile.variableChoice).to.deep.eq([{role: 'choice', icon: 'energy', min: 1, max: 5, unit: undefined}]);
    expect(tile.variableCost).to.have.length(0);
    expect(tile.variableGain).to.have.length(0);
    expect(tile.gainEffects.map((e) => e.icon)).to.deep.eq(['megacredits']); // kept
  });

  it('names non-amount pre-submit choices (card pick) on the tile', () => {
    const entries = [entry('SRR', 'available', ['double', 'link'])];
    const cardInput = {type: 'card', title: 'Select card', cards: [], min: 1, max: 1} as unknown as PlayerInputModel;
    const previews = new Map<CardName, ActionPreview>([
      ['SRR' as CardName, preview('SRR', [
        {index: 0, title: 'double', available: true, renderKeys: [], effects: [], steps: [], optionInput: cardInput},
        {index: 1, title: 'link', available: true, renderKeys: [], effects: [], steps: [], optionInput: cardInput},
      ])],
    ]);
    const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, defaultCardActionsFilter());
    for (const tile of model.groups[0].tiles) {
      expect(tile.choiceKinds).to.deep.eq(['card']);
      expect(tile.hasChoices).to.eq(true);
    }
  });

  // ── Iteration 2: per-VARIANT stats scope (desktop branchScope mirror) ─────

  it('branchScopeForNode splits mine vs sibling metric tokens per node', () => {
    const entries = [entry('Catapult', 'available', ['Spend 1 plant to gain 7 M€.', 'Spend 1 steel to gain 7 M€.'])];
    const branches = [
      {index: 0, title: 'Spend 1 plant to gain 7 M€.', available: true, renderKeys: [],
        effects: [effect('cost', 'plants', 1), effect('gain', 'megacredits', 7)], steps: []},
      {index: 1, title: 'Spend 1 steel to gain 7 M€.', available: true, renderKeys: [],
        effects: [effect('cost', 'steel', 1), effect('gain', 'megacredits', 7)], steps: []},
    ];
    const scope = branchScopeForNode(entries[0].group, branches, 0);
    expect(scope).to.not.eq(undefined);
    expect(scope?.mineTokens).to.include('plants');
    expect(scope?.siblingTokens).to.include('steel');
  });

  it('branchScopeForNode is undefined for a single-branch card and a combined node', () => {
    const single = entry('Solo', 'available', ['use']);
    expect(branchScopeForNode(single.group, [
      {index: -1, title: '', available: true, renderKeys: [], effects: [effect('gain', 'megacredits', 1)], steps: []},
    ], 0)).to.eq(undefined);

    // ONE render node mapping to ALL branches → no siblings → unscoped.
    const combined = entry('Combined', 'available', ['whole']);
    expect(branchScopeForNode(combined.group, [
      {index: 0, title: 'a', available: true, renderKeys: [], effects: [effect('gain', 'megacredits', 1)], steps: []},
      {index: 1, title: 'b', available: true, renderKeys: [], effects: [effect('gain', 'heat', 1)], steps: []},
    ], 0)).to.eq(undefined);
  });

  // ── REPEAT mode (ProjectInspection / Viron): candidates selectable, others
  //    visible with a reason, independent activation + availability dimensions. ──
  describe('repeat mode', () => {
    // Three actions: a CANDIDATE (used + selectable), a used-but-not-candidate
    // (canAct false now), and a not-used-this-gen action.
    const entries = [
      entry('Cand', 'activated', ['use']),
      entry('UsedBlocked', 'activated', ['use']),
      entry('Dormant', 'available', ['use']),
    ];
    const repeat = {candidates: new Set<CardName>(['Cand' as CardName]), used: new Set<CardName>(['Cand' as CardName, 'UsedBlocked' as CardName])};

    function tileFor(model: ReturnType<typeof buildConsoleActionsModel>, name: string) {
      return model.groups.flatMap((g) => g.tiles).find((t) => t.cardName === name);
    }

    it('a candidate is selectable (available); non-candidates are rules with honest reasons', () => {
      const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'all'}, repeat);
      const cand = tileFor(model, 'Cand');
      const usedBlocked = tileFor(model, 'UsedBlocked');
      const dormant = tileFor(model, 'Dormant');
      expect(cand?.status).to.eq('available');
      expect(cand?.usedThisGen).to.eq(true);
      expect(usedBlocked?.status).to.eq('rules');
      expect(usedBlocked?.usedThisGen).to.eq(true);
      expect(usedBlocked?.reason?.message).to.eq('This action cannot be repeated right now');
      expect(dormant?.status).to.eq('rules');
      expect(dormant?.usedThisGen).to.eq(false);
      expect(dormant?.reason?.message).to.eq('This action was not used this generation');
    });

    it('the default «Активированы + Все» filter keeps the NON-copyable action visible, with its reason', () => {
      const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, defaultRepeatFilter(), repeat);
      // Both actions used this generation are listed — the copyable one AND the
      // one that cannot be copied right now. Hiding the latter (the old
      // «Доступна» default) made the generation look shorter than it was and
      // left the player with no reason to read.
      expect(model.groups.map((g) => g.cardName).sort()).to.deep.eq(['Cand', 'UsedBlocked']);
      expect(tileFor(model, 'UsedBlocked')?.reason?.message).to.eq('This action cannot be repeated right now');
      // …and the copyable slice is still ONE press of the availability chip away.
      const copyable = buildConsoleActionsModel(
        entries, NO_PREVIEWS, NO_RESOURCES, {...defaultRepeatFilter(), availability: 'available'}, repeat);
      expect(copyable.groups.map((g) => g.cardName)).to.deep.eq(['Cand']);
    });

    it('a used-but-blocked action shows the CONCRETE preview reason, never the abstract fallback', () => {
      const previews = new Map<CardName, ActionPreview>([
        // UsedBlocked was used this gen but canAct is false NOW (no steel) — the
        // preview branch carries the concrete reason.
        ['UsedBlocked' as CardName, preview('UsedBlocked', [
          {index: -1, title: '', available: false, unavailableReason: 'Not enough steel', renderKeys: [], effects: [], steps: []},
        ])],
      ]);
      const model = buildConsoleActionsModel(entries, previews, NO_RESOURCES, {availability: 'all', activation: 'all'}, repeat);
      const usedBlocked = tileFor(model, 'UsedBlocked');
      expect(usedBlocked?.status).to.eq('rules');
      expect(usedBlocked?.reason?.message).to.eq('Not enough steel');
      expect(usedBlocked?.reason?.message).to.not.eq('This action cannot be repeated right now');
    });

    it('the activation dimension is INDEPENDENT of availability (a used candidate is BOTH)', () => {
      // «Активированы» (activation) is the used-this-gen set — Cand + UsedBlocked.
      const activated = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'activated'}, repeat);
      expect(activated.groups.map((g) => g.cardName).sort()).to.deep.eq(['Cand', 'UsedBlocked']);
      // «Доступна» (availability) is the selectable set — only Cand.
      const available = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'available', activation: 'all'}, repeat);
      expect(available.groups.map((g) => g.cardName)).to.deep.eq(['Cand']);
    });
  });

  describe('packActionRows / stepActionRows (the 2-column browse grid)', () => {
    /** A minimal group fixture — the packer reads only tiles[].key. */
    const group = (...keys: Array<string>) =>
      ({tiles: keys.map((key) => ({key}))}) as unknown as ConsoleActionGroup;

    it('packs consecutive SINGLE-action cards two abreast', () => {
      const rows = packActionRows([group('a'), group('b'), group('p1', 'p2'), group('c')]);
      expect(rows).to.deep.eq([['a', 'b'], ['p1', 'p2'], ['c']]);
    });

    it('a card is NEVER split: its «или» pair owns a full row, closing a half row', () => {
      const rows = packActionRows([group('a'), group('p1', 'p2'), group('b'), group('c')]);
      expect(rows).to.deep.eq([['a'], ['p1', 'p2'], ['b', 'c']]);
    });

    it('a 3+-variant card keeps its buttons together, two per row', () => {
      const rows = packActionRows([group('t1', 't2', 't3'), group('a')]);
      expect(rows).to.deep.eq([['t1', 't2'], ['t3'], ['a']]);
    });

    it('one column (handheld): one action button per row', () => {
      const rows = packActionRows([group('a'), group('b'), group('p1', 'p2')], 1);
      expect(rows).to.deep.eq([['a'], ['b'], ['p1'], ['p2']]);
    });

    it('arranges the grid so a wide card never strands a half row', () => {
      // [single, wide, single, single] would leave a hole after the first
      // single; the arranger pulls the nearest single of the SAME band in.
      const g = (keys: Array<string>, sortStatus: ActionStatus = 'available') =>
        ({tiles: keys.map((key) => ({key})), sortStatus}) as unknown as ConsoleActionGroup;
      const arranged = arrangeGroupsForGrid([g(['a']), g(['p1', 'p2']), g(['b']), g(['c'])]);
      expect(arranged.map((x) => x.tiles.map((t: any) => t.key).join('+')))
        .to.deep.eq(['a', 'b', 'p1+p2', 'c']);
      expect(packActionRows(arranged)).to.deep.eq([['a', 'b'], ['p1', 'p2'], ['c']]);
    });

    it('never pulls a filler ACROSS a status band (availability grouping wins)', () => {
      const g = (keys: Array<string>, sortStatus: ActionStatus) =>
        ({tiles: keys.map((key) => ({key})), sortStatus}) as unknown as ConsoleActionGroup;
      const arranged = arrangeGroupsForGrid([
        g(['a'], 'available'), g(['p1', 'p2'], 'available'), g(['x'], 'rules'),
      ]);
      // The only single left belongs to the BLOCKED band — the hole stays.
      expect(arranged.map((x) => x.tiles.map((t: any) => t.key).join('+')))
        .to.deep.eq(['a', 'p1+p2', 'x']);
    });

    it('steps left/right within a row, up/down across rows keeping the nearest column', () => {
      const rows = [['a', 'b'], ['p1', 'p2'], ['c']];
      expect(stepActionRows(rows, 'a', 'right')).to.eq('b');
      expect(stepActionRows(rows, 'b', 'down')).to.eq('p2'); // column kept
      expect(stepActionRows(rows, 'p2', 'down')).to.eq('c'); // clamped to the short row
      expect(stepActionRows(rows, 'c', 'up')).to.eq('p1');
      expect(stepActionRows(rows, 'a', 'left')).to.eq('a'); // the edge is felt
      expect(stepActionRows(rows, 'c', 'down')).to.eq('c');
    });
  });

  describe('the grid model', () => {
    it('marks the «или» JOINT on the card’s SECOND button (the shared edge)', () => {
      // Two single-action cards, then a two-variant card: the focus order is
      // [A, B, C1, C2]; inside card C the second button joins left.
      const entries = [
        entry('A', 'available', ['use']),
        entry('B', 'available', ['use']),
        entry('C', 'available', ['first', 'second']),
      ];
      const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'all'});
      expect(model.tiles.map((t) => t.key)).to.deep.eq(['A#0', 'B#0', 'C#0', 'C#1']);
      expect(model.tiles.map((t) => t.joinLeft)).to.deep.eq([false, false, false, true]);
      // Every tile is SELF-DESCRIBING (no group box carries this any more).
      expect(model.tiles.map((t) => t.variantTotal)).to.deep.eq([1, 1, 2, 2]);
    });

    it('sorts by the SERVER card status, so a late preview never re-orders the live grid', () => {
      const entries = [
        entry('Blocked', 'rules', ['use'], {reasons: [{type: 'rule', message: 'No steel'}]}),
        entry('Fine', 'available', ['first', 'second']),
      ];
      const order = () => buildConsoleActionsModel(
        entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'all', activation: 'all'}).tiles.map((t) => t.key);
      const before = order();
      // The preview lands and BLOCKS the second variant of the available card:
      // the tile's own status refines, but the grid order must not move.
      const previews = new Map<CardName, ActionPreview>([
        ['Fine' as CardName, preview('Fine', [
          {index: 0, title: '', available: true, renderKeys: [], effects: [], steps: []},
          {index: 1, title: '', available: false, unavailableReason: 'No microbes', renderKeys: [], effects: [], steps: []},
        ])],
      ]);
      const after = buildConsoleActionsModel(
        entries, previews, NO_RESOURCES, {availability: 'all', activation: 'all'}).tiles;
      expect(after.map((t) => t.key)).to.deep.eq(before);
      expect(after.find((t) => t.key === 'Fine#1')?.status).to.eq('rules');
    });
  });

  describe('actionWorkspaceRestorePlan (the mount-time re-seat decision)', () => {
    const DRAFT = {cardName: CardName.TITAN_FLOATING_LAUNCHPAD, nodeIndex: 1};
    /** A restore mid Pluto discard: the second-door chain is coming back. */
    const RESTORED_STEP: ActionRestoreInput = {
      repeat: false,
      collapsed: false,
      hostedColonies: true,
      draft: DRAFT,
      draftEntryExists: true,
      // The live claim at that moment is the COLONY RESOLUTION's — a foreign
      // host whose sourceCard is a colony name, not a card.
      claimHost: 'colonies',
      claimCard: 'Pluto',
      claimNodeIndex: 0,
      claimAdmitsDeckCheck: false,
    };

    it('re-seats the hosted colonies step from the surviving draft', () => {
      expect(actionWorkspaceRestorePlan(RESTORED_STEP)).to.deep.eq(
        {kind: 'seat-step', composer: DRAFT});
    });

    it('NEVER adopts a foreign host’s claim as a composer (the half-restored screen)', () => {
      // No hosted step, no draft — but the parked colony resolution's claim is
      // still live. The old bare «is anything claimed» check seated a composer
      // on cardName 'Pluto' here: one workspace's breadcrumb over another's body.
      expect(actionWorkspaceRestorePlan({
        ...RESTORED_STEP, hostedColonies: false, draft: undefined, draftEntryExists: false,
      })).to.deep.eq({kind: 'none'});
    });

    it('re-opens this workspace’s OWN committed outcome (host-scoped claim)', () => {
      expect(actionWorkspaceRestorePlan({
        ...RESTORED_STEP,
        hostedColonies: false, draft: undefined, draftEntryExists: false,
        claimHost: 'card-actions', claimCard: 'Inventors\' Guild', claimNodeIndex: 0,
      })).to.deep.eq({
        kind: 'seat-outcome',
        composer: {cardName: 'Inventors\' Guild', nodeIndex: 0},
        outcome: 'draw',
      });
      expect(actionWorkspaceRestorePlan({
        ...RESTORED_STEP,
        hostedColonies: false, draft: undefined, draftEntryExists: false,
        claimHost: 'card-actions', claimCard: 'Search For Life', claimAdmitsDeckCheck: true,
      })).to.have.property('outcome', 'deck-check');
    });

    it('a hand-open beside a park is a LOOK, never a resume (`collapsed`)', () => {
      // The wheel's fresh instance mounts with the flow still set aside: it
      // must adopt nothing — not the draft, not the claim, not the step.
      expect(actionWorkspaceRestorePlan({...RESTORED_STEP, collapsed: true}))
        .to.deep.eq({kind: 'none'});
      expect(actionWorkspaceRestorePlan({
        ...RESTORED_STEP,
        collapsed: true, hostedColonies: false,
        claimHost: 'card-actions', claimCard: 'Inventors\' Guild',
      })).to.deep.eq({kind: 'none'});
    });

    it('a repeat-pick instance adopts nothing', () => {
      expect(actionWorkspaceRestorePlan({...RESTORED_STEP, repeat: true}))
        .to.deep.eq({kind: 'none'});
    });

    it('folds honestly when the hosted step’s descent cannot be rebuilt', () => {
      // A reload dropped the module draft — a mixed surface is forbidden, so
      // the whole workspace folds and the mandatory gate re-announces.
      expect(actionWorkspaceRestorePlan({...RESTORED_STEP, draft: undefined, draftEntryExists: false}))
        .to.deep.eq({kind: 'fold-step'});
      // The draft survived but its card left the entries (server truth wins).
      expect(actionWorkspaceRestorePlan({...RESTORED_STEP, draftEntryExists: false}))
        .to.deep.eq({kind: 'fold-step'});
    });
  });
});
