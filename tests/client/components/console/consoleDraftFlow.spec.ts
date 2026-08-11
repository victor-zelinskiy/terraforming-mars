import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {
  betweenGenDraftLive, draftStageOf, draftPickInput, draftBuyInput, draftPacketKey,
  draftJourneyPhases, draftCrumb, draftCompactContext, draftFlowPresentation,
  requirementHeadsUp, observeDraftWorkspace, draftWorkspaceState, resetDraftWorkspace,
  beginDraftCompletion, markDraftCompletionFlightsDone, finishDraftCompletion,
  draftCompletionHolding, draftNeighbor,
} from '@/client/console/draft/consoleDraftFlow';
import {draftCommands} from '@/client/console/draft/consoleDraftUi';

/** A minimal PlayerViewModel for the pure flow derivations. */
function view(overrides: {
  phase?: Phase,
  generation?: number,
  draftVariant?: boolean,
  needsToResearch?: boolean,
  drafted?: Array<CardName>,
  waitingFor?: unknown,
} = {}): PlayerViewModel {
  return {
    id: 'p-test',
    game: {
      phase: overrides.phase ?? Phase.DRAFTING,
      generation: overrides.generation ?? 2,
      gameOptions: {draftVariant: overrides.draftVariant ?? true},
    },
    thisPlayer: {
      color: 'red',
      needsToResearch: overrides.needsToResearch ?? true,
      cardCost: 3,
    },
    players: [
      {color: 'red', name: 'Я'},
      {color: 'blue', name: 'Сосед'},
    ],
    draftedCards: (overrides.drafted ?? []).map((name) => ({name})),
    waitingFor: overrides.waitingFor,
  } as unknown as PlayerViewModel;
}

const MARKER = {
  draftType: 'standard' as const,
  direction: 'after' as const,
  givingTo: 'blue',
  takingFrom: 'blue',
  total: 4,
};

function pickPrompt(cards: Array<CardName>, opts: {optional?: boolean, total?: number} = {}) {
  return {
    type: 'card',
    cards: cards.map((name) => ({name})),
    min: 1, max: 1,
    optional: opts.optional,
    draftPrompt: {...MARKER, total: opts.total ?? MARKER.total},
  };
}

function buyPrompt(cards: Array<CardName>) {
  return {
    type: 'card',
    cards: cards.map((name) => ({name})),
    min: 0, max: cards.length,
    buyMode: true,
  };
}

describe('consoleDraftFlow', () => {
  afterEach(() => {
    resetDraftWorkspace();
  });

  it('classifies the stages structurally', () => {
    expect(draftStageOf(view({waitingFor: pickPrompt([CardName.FISH])}))).eq('pick');
    expect(draftStageOf(view({waitingFor: pickPrompt([CardName.FISH], {optional: true})}))).eq('wait');
    expect(draftStageOf(view({waitingFor: undefined}))).eq('wait');
    expect(draftStageOf(view({phase: Phase.RESEARCH, waitingFor: buyPrompt([CardName.FISH])}))).eq('buy');
    expect(draftStageOf(view({phase: Phase.RESEARCH, waitingFor: undefined}))).eq('idle');
  });

  it('pick/buy inputs are marker-scoped, never title-scoped', () => {
    expect(draftPickInput(view({waitingFor: pickPrompt([CardName.FISH])}))).is.not.undefined;
    expect(draftPickInput(view({waitingFor: pickPrompt([CardName.FISH], {optional: true})}))).is.undefined;
    expect(draftPickInput(view({waitingFor: {type: 'card', cards: [{name: CardName.FISH}]}}))).is.undefined;
    expect(draftBuyInput(view({phase: Phase.RESEARCH, waitingFor: buyPrompt([CardName.FISH])}))).is.not.undefined;
    expect(draftBuyInput(view({phase: Phase.DRAFTING, waitingFor: buyPrompt([CardName.FISH])}))).is.undefined;
  });

  it('the flow is alive only for the between-generations draft', () => {
    expect(betweenGenDraftLive(view({}))).is.true;
    expect(betweenGenDraftLive(view({draftVariant: false}))).is.false;
    // Generation 1 RESEARCH is the INITIAL CARDS selection — never this flow.
    expect(betweenGenDraftLive(view({phase: Phase.RESEARCH, generation: 1}))).is.false;
    expect(betweenGenDraftLive(view({phase: Phase.RESEARCH, needsToResearch: true}))).is.true;
    expect(betweenGenDraftLive(view({phase: Phase.RESEARCH, needsToResearch: false}))).is.false;
    expect(betweenGenDraftLive(view({phase: Phase.ACTION}))).is.false;
    expect(betweenGenDraftLive(view({phase: Phase.INITIALDRAFTING, generation: 1}))).is.false;
  });

  it('packet identity folds the card names (rounds reuse one prompt identity)', () => {
    const a = draftPacketKey(view({waitingFor: pickPrompt([CardName.FISH, CardName.CAPITAL])}));
    const b = draftPacketKey(view({waitingFor: pickPrompt([CardName.CAPITAL, CardName.FISH])}));
    const c = draftPacketKey(view({waitingFor: pickPrompt([CardName.FISH, CardName.DECOMPOSERS])}));
    expect(a).eq(b);
    expect(a).not.eq(c);
    expect(draftPacketKey(view({waitingFor: undefined}))).eq('');
  });

  it('the journey rail mirrors the REAL pick state', () => {
    const phases = draftJourneyPhases({total: 4, picked: 1, stage: 'pick', completion: 'none'});
    expect(phases).has.length(2);
    expect(phases[0].state).eq('current');
    expect(phases[0].items.map((i) => i.state)).deep.eq(['completed', 'current', 'locked', 'locked']);
    expect(phases[1].state).eq('locked');
    expect(phases[1].items[0].id).eq('ready');

    const waiting = draftJourneyPhases({total: 4, picked: 2, stage: 'wait', completion: 'none'});
    expect(waiting[0].state).eq('waiting');
    expect(waiting[0].items.filter((i) => i.state === 'current')).is.empty;

    const buy = draftJourneyPhases({total: 4, picked: 4, stage: 'buy', completion: 'none'});
    expect(buy[0].state).eq('completed');
    expect(buy[0].items.every((i) => i.state === 'completed')).is.true;
    expect(buy[1].state).eq('current');

    const done = draftJourneyPhases({total: 4, picked: 4, stage: 'idle', completion: 'done'});
    expect(done[1].state).eq('completed');
    expect(done[1].items[0].state).eq('completed');
  });

  it('the substep count follows the marker, never a hardcoded 4', () => {
    const five = draftJourneyPhases({total: 5, picked: 0, stage: 'pick', completion: 'none'});
    expect(five[0].items).has.length(5);
  });

  it('the crumb keeps stable context before the mutable stage', () => {
    expect(draftCrumb({stage: 'pick', inspecting: false, completion: 'none'}))
      .deep.eq({subject: 'Card selection', stage: '', committed: false});
    expect(draftCrumb({stage: 'wait', inspecting: false, completion: 'none'}))
      .deep.eq({subject: 'Card selection', stage: 'Handover', committed: true});
    expect(draftCrumb({stage: 'buy', inspecting: false, completion: 'none'}))
      .deep.eq({subject: 'Purchase', stage: '', committed: false});
    expect(draftCrumb({stage: 'buy', inspecting: true, completion: 'none'}))
      .deep.eq({subject: 'Drafted', stage: 'Inspection', committed: false});
    expect(draftCrumb({stage: 'idle', inspecting: false, completion: 'done'}).committed).is.true;
  });

  it('presentation: compact while inspecting, complete at the terminal', () => {
    expect(draftFlowPresentation({completion: 'none', inspecting: false})).eq('expanded');
    expect(draftFlowPresentation({completion: 'none', inspecting: true})).eq('compact');
    expect(draftFlowPresentation({completion: 'done', inspecting: false})).eq('complete');
    expect(draftCompactContext({total: 4, picked: 1, stage: 'pick', completion: 'none'}).ordinal).eq('01');
    expect(draftCompactContext({total: 4, picked: 4, stage: 'buy', completion: 'none'}).ordinal).eq('02');
  });

  it('the requirements heads-up drops the affordability line', () => {
    expect(requirementHeadsUp(undefined)).is.undefined;
    expect(requirementHeadsUp({name: CardName.FISH} as never)).is.undefined;
    const card = {
      name: CardName.FISH,
      unplayableReasons: [
        {type: 'megacredits', message: 'Need ${0} more M€', params: ['3']},
        {type: 'globalParameter', message: 'Requires ${0}°C', params: ['2']},
      ],
    } as never;
    expect(requirementHeadsUp(card)?.type).eq('globalParameter');
  });

  it('observeDraftWorkspace latches the marker and resets per generation', () => {
    const v1 = view({waitingFor: pickPrompt([CardName.FISH], {total: 4})});
    observeDraftWorkspace(view({phase: Phase.ACTION}), v1);
    expect(draftWorkspaceState.total).eq(4);
    expect(draftWorkspaceState.meta?.givingTo).eq('blue');
    expect(draftWorkspaceState.sawDraftStart).is.true;

    // A LOWER total never shrinks the latch inside one generation.
    observeDraftWorkspace(v1, view({waitingFor: pickPrompt([CardName.FISH], {total: 3})}));
    expect(draftWorkspaceState.total).eq(4);

    // The next generation starts clean.
    const v3 = view({generation: 3, waitingFor: pickPrompt([CardName.FISH], {total: 5})});
    observeDraftWorkspace(v1, v3);
    expect(draftWorkspaceState.total).eq(5);
    expect(draftWorkspaceState.generation).eq(3);

    // Out of the flow entirely → the latches clear.
    observeDraftWorkspace(v3, view({phase: Phase.ACTION, needsToResearch: false}));
    expect(draftWorkspaceState.total).eq(0);
    expect(draftWorkspaceState.meta).is.undefined;
  });

  it('hydration: a first view already mid-draft never claims a live entry', () => {
    observeDraftWorkspace(undefined, view({waitingFor: pickPrompt([CardName.FISH])}));
    expect(draftWorkspaceState.sawDraftStart).is.false;
  });

  it('completion beats extend the frame lifetime', () => {
    expect(draftCompletionHolding()).is.false;
    beginDraftCompletion();
    expect(draftCompletionHolding()).is.true;
    markDraftCompletionFlightsDone();
    expect(draftWorkspaceState.completion).eq('done');
    finishDraftCompletion();
    expect(draftCompletionHolding()).is.false;
  });

  it('resolves circle neighbors by color', () => {
    const v = view({});
    expect(draftNeighbor(v, 'blue' as never)?.name).eq('Сосед');
    expect(draftNeighbor(v, undefined)).is.undefined;
  });
});

describe('consoleDraftUi — the command contract', () => {
  const BASE = {
    beatActive: false,
    singlePick: true,
    focusedPicked: false,
    canPickFocused: true,
    setValid: false,
    hasCards: true,
    hasCollected: true,
    buyingNothing: false,
  };

  it('a beat swallows everything into Skip', () => {
    const cmds = draftCommands({...BASE, zone: 'pick', beatActive: true});
    expect(cmds).deep.eq([{control: 'confirm', label: 'Skip'}]);
  });

  it('the single pick: A takes, X inspects, LT opens the drafted cards', () => {
    const cmds = draftCommands({...BASE, zone: 'pick'});
    expect(cmds.map((c) => `${c.control}:${c.label}`)).deep.eq([
      'confirm:Take', 'secondary:Inspect', 'triggerL:Drafted', 'back:Minimize',
    ]);
  });

  it('a keep-2 round adds the RT commit', () => {
    const cmds = draftCommands({...BASE, zone: 'pick', singlePick: false, setValid: true});
    expect(cmds.some((c) => c.control === 'triggerR' && c.label === 'Confirm' && c.enabled === true)).is.true;
  });

  it('the wait offers only the drafted cards and the minimize', () => {
    const cmds = draftCommands({...BASE, zone: 'wait'});
    expect(cmds.map((c) => c.control)).deep.eq(['triggerL', 'back']);
  });

  it('the buy: toggle, inspect, RT with the honest Skip at zero picks', () => {
    const zero = draftCommands({...BASE, zone: 'buy', singlePick: false, setValid: true, buyingNothing: true});
    expect(zero.find((c) => c.control === 'triggerR')?.label).eq('Skip');
    const some = draftCommands({...BASE, zone: 'buy', singlePick: false, setValid: true, focusedPicked: true});
    expect(some.find((c) => c.control === 'confirm')?.label).eq('Deselect');
    expect(some.find((c) => c.control === 'triggerR')?.label).eq('Buy');
  });

  it('the inspect sub-stage is read-only: X and Back, nothing else', () => {
    const cmds = draftCommands({...BASE, zone: 'inspect'});
    expect(cmds.map((c) => c.control)).deep.eq(['secondary', 'back']);
    expect(cmds.find((c) => c.control === 'back')?.label).eq('Back');
  });

  it('the terminal beat asks nothing', () => {
    expect(draftCommands({...BASE, zone: 'done'})).is.empty;
  });
});
