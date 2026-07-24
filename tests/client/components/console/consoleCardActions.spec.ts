import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {ActionPreview, ActionEffect} from '@/common/models/ActionPreviewModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {CardResource} from '@/common/CardResource';
import {
  buildConsoleActionsModel,
  branchScopeForNode,
  cycleAvailability,
  cycleActivation,
  defaultCardActionsFilter,
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

    it('the default «Активированы + Доступна» filter shows ONLY the copyable candidate', () => {
      const model = buildConsoleActionsModel(entries, NO_PREVIEWS, NO_RESOURCES, {availability: 'available', activation: 'activated'}, repeat);
      expect(model.groups.map((g) => g.cardName)).to.deep.eq(['Cand']);
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
});
