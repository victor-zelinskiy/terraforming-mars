import {expect} from 'chai';
import {taskFor, taskServedByHost, isNativelyHandled, taskMinimizable, followUpStepStage, promptOutranksStartScene, NATIVE_KINDS, NATIVE_COMPOSITE_KINDS, SCENE_KINDS, SECTION_SERVED_KINDS, SHELL_SECTION_KINDS, ConsoleTask, TaskKind} from '@/client/console/consoleTaskRouter';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/* Synthetic playerViews — only the fields the router reads. */
function view(wf: any, hand: Array<string> = [], srr: Array<string> = []): PlayerViewModel {
  return {
    waitingFor: wf,
    cardsInHand: hand.map((name) => ({name})),
    thisPlayer: {selfReplicatingRobotsCards: srr.map((name) => ({name}))},
  } as unknown as PlayerViewModel;
}

function kindOf(wf: any, hand: Array<string> = [], srr: Array<string> = []): ConsoleTask | undefined {
  return taskFor(view(wf, hand, srr));
}

/**
 * THE CTS-2 COVERAGE TABLE (docs/CONSOLE_MODE_CONCEPT.md) as fixtures. Every
 * user-input case the server can send maps to a TaskKind here; the RED
 * LIST printed at the bottom is the CTS work queue — when a phase lands a
 * kind natively, add it to NATIVE_KINDS and update EXPECTED_RED below
 * (the shrinking list is the progress metric).
 */
const FIXTURES: Array<{row: string, wf: any, hand?: Array<string>, srr?: Array<string>, expect: Partial<ConsoleTask>}> = [
  {row: '1 action menu', wf: {type: 'or', title: 'Take your first action', options: []}, expect: {kind: 'actionMenu'}},
  {row: '1b action menu (next)', wf: {type: 'or', title: 'Take your next action', options: []}, expect: {kind: 'actionMenu'}},
  {row: '2 card-driven or (contextual)', wf: {type: 'or', title: 'Select how to use your science tag', options: [], choiceContext: {source: {kind: 'card'}}}, expect: {kind: 'choice', flavor: 'contextual'}},
  {row: '2b generic or', wf: {type: 'or', title: 'Choose an option', options: []}, expect: {kind: 'choice', flavor: 'generic'}},
  {row: '2c WGT or', wf: {type: 'or', title: 'Select action for World Government Terraforming', options: []}, expect: {kind: 'choice', flavor: 'wgt'}},
  {row: '3 option confirm', wf: {type: 'option', title: 'Confirm'}, expect: {kind: 'choice', flavor: 'confirm'}},
  {row: '4 player target', wf: {type: 'player', title: 'Select player'}, expect: {kind: 'player'}},
  {row: '5 amount', wf: {type: 'amount', title: 'Select amount'}, expect: {kind: 'amount', flavor: 'generic'}},
  {row: '5b hydro delta amount', wf: {type: 'deltaProject', title: 'Spend energy'}, expect: {kind: 'amount', flavor: 'delta'}},
  {row: '6 resource', wf: {type: 'resource', title: 'Select resource'}, expect: {kind: 'resource'}},
  {row: '6b resources', wf: {type: 'resources', title: 'Distribute'}, expect: {kind: 'distribute', mode: 'resources'}},
  {row: '6c productionToLose', wf: {type: 'productionToLose', title: 'Lose production'}, expect: {kind: 'distribute', mode: 'production'}},
  {row: '7 payment', wf: {type: 'payment', title: 'Pay'}, expect: {kind: 'payment'}},
  {row: '10 draft pick', wf: {type: 'card', title: 'Select a card to keep', buttonLabel: 'Keep', cards: [{name: 'Birds'}]}, expect: {kind: 'cardSelect', mode: 'draft'}},
  {row: '10b draft re-pick (optional → waiting, never re-pick UI)', wf: {type: 'card', title: 'You can change your selection…', optional: true, buttonLabel: 'Select', cards: [{name: 'Birds'}]}, expect: {kind: 'draftWait'}},
  {row: '11 research buy', wf: {type: 'card', title: 'Select cards to buy or none to skip', buttonLabel: 'Buy', buyMode: true, cards: [{name: 'Birds'}]}, expect: {kind: 'cardSelect', mode: 'buy'}},
  {row: '12 hand select (discard) → hand section, not the card browser', wf: {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}]}, hand: ['Birds', 'Zeppelins'], expect: {kind: 'handSelect'}},
  {row: '12b hand select incl. a Self-Replicating Robots host', wf: {type: 'card', title: 'Select a card to place', buttonLabel: 'Select', cards: [{name: 'Birds'}]}, hand: ['Zeppelins'], srr: ['Birds'], expect: {kind: 'handSelect'}},
  {row: '13 nested target pick', wf: {type: 'card', title: 'Select card to add microbe', buttonLabel: 'Add', cards: [{name: 'Tardigrades'}]}, expect: {kind: 'cardSelect', mode: 'target'}},
  // «Посмотри N карт колоды, оставь K» — routed off the SERVER's own marker.
  // Byte-identical to row 13 on the wire apart from `deckPickPrompt`, which is
  // exactly why the marker had to exist.
  {row: '13a deck keep-some', wf: {type: 'card', title: 'Select 2 card(s) to keep', buttonLabel: 'Select', cards: [{name: 'Birds'}, {name: 'Tardigrades'}], deckPickPrompt: {revealed: 2, min: 2, max: 2, origin: 'deck', mode: 'keep'}}, expect: {kind: 'deckSelect'}},
  {row: '13b discard-pile keep-some', wf: {type: 'card', title: 'Select 1 card(s) to keep', buttonLabel: 'Select', cards: [{name: 'Birds'}], deckPickPrompt: {revealed: 1, min: 1, max: 1, origin: 'discard', mode: 'keep'}}, expect: {kind: 'deckSelect'}},
  // The MANDATORY TAKE of a draw ANOTHER player's effect made for the viewer —
  // an ordinary `SelectCard` on the wire, and the marker carries its whole
  // meaning (cause, initiator, trigger). Classified by type it lands in the
  // generic card browser, which is exactly what the marker exists to prevent.
  {row: '13c external draw take', wf: {type: 'card', title: 'Take the cards', buttonLabel: 'Take', cards: [{name: 'Birds'}], externalDrawPrompt: {intakeId: 1, count: 1, remaining: 1}}, expect: {kind: 'externalDraw'}},
  {row: '16 play-from-hand prompt', wf: {type: 'projectCard', title: 'Play a card from hand', cards: [{name: 'Birds'}]}, hand: ['Birds'], expect: {kind: 'projectCard', mode: 'playFromHand'}},
  {row: '17 std-project prompt', wf: {type: 'projectCard', title: 'Play a standard project', cards: [{name: 'Power Plant:SP'}]}, expect: {kind: 'projectCard', mode: 'standardProject'}},
  // Wave 2: the DEGENERATE third shape is structural — candidates that are
  // neither the hand (row 16) nor standard projects by the client manifest's
  // own card type (row 17). Odyssey's played events are the live producer;
  // an empty list classifies generic too (nothing the sections could serve).
  {row: '17a generic projectCard (foreign candidate)', wf: {type: 'projectCard', title: 'Play an event again', cards: [{name: 'Birds'}]}, expect: {kind: 'projectCard', mode: 'generic'}},
  {row: '17b generic projectCard (empty list)', wf: {type: 'projectCard', title: 'Play a card', cards: []}, expect: {kind: 'projectCard', mode: 'generic'}},
  {row: '18 colony build/select', wf: {type: 'colony', title: 'Select colony', coloniesModel: []}, expect: {kind: 'colony'}},
  // The MARKER outranks the type again: on the wire this is the same bare
  // `option` as row 3, and everything that makes it a colony delivery (which
  // colony, whose trade, which cube) lives in `colonyBonusPrompt`.
  {row: '18a colony bonus collect', wf: {type: 'option', title: 'Collect 1 card(s) from Miranda', colonyBonusPrompt: {colonyName: 'Miranda', cards: 1, index: 1, total: 1, trader: 'red'}}, expect: {kind: 'colonyBonus'}},
  {row: '20 free award funding', wf: {type: 'or', title: 'Fund an award', options: [], awardFundingPrompt: {free: true}}, expect: {kind: 'awardFunding'}},
  {row: '21 initial draft', wf: {type: 'initialCards', title: 'Select initial cards'}, expect: {kind: 'initialDraft'}},
  // The corp first action is a FIRST-TURN prompt (the «Разыграно» action
  // mode), not a start-scene beat — see the corporationPlay rework.
  {row: '22 start: corp initial action', wf: {type: 'or', title: 'Take first action of X corporation', options: [], startGamePrompt: {kind: 'corporationInitialAction'}}, expect: {kind: 'corpFirstAction'}},
  {row: '22b start: deferred corporation play', wf: {type: 'card', title: 'Play your corporation', cards: [], startGamePrompt: {kind: 'corporationPlay'}}, expect: {kind: 'startSequence', prompt: 'corporationPlay'}},
  {row: '22b start: prelude selection', wf: {type: 'card', title: 'Select prelude card to play', cards: [], startGamePrompt: {kind: 'preludeSelection', preludeMode: 'hand'}}, expect: {kind: 'startSequence', prompt: 'preludeSelection'}},
  {row: '22c start: merger corp selection', wf: {type: 'card', title: 'Select corporation', cards: [], startGamePrompt: {kind: 'corporationSelection'}}, expect: {kind: 'startSequence', prompt: 'corporationSelection'}},
  // The campaign deployment stages — each its own deliberate press.
  {row: '22d campaign: merge press', wf: {type: 'card', title: 'Merge the new corporation', cards: [], startGamePrompt: {kind: 'corporationMerge'}}, expect: {kind: 'startSequence', prompt: 'corporationMerge'}},
  {row: '22d2 campaign: bonus press', wf: {type: 'option', title: 'Receive the campaign bonus of 5 M€', startGamePrompt: {kind: 'campaignBonus', bonus: {megaCredits: 5}}}, expect: {kind: 'startSequence', prompt: 'campaignBonus'}},
  {row: '22e campaign: legacy press', wf: {type: 'option', title: 'Receive 2 project cards carried from the previous mission', startGamePrompt: {kind: 'campaignLegacy', legacy: {cards: 2}}}, expect: {kind: 'startSequence', prompt: 'campaignLegacy'}},
  {row: '23 and composite', wf: {type: 'and', title: 'Choose both', options: []}, expect: {kind: 'composite'}},
  {row: '24 ares global', wf: {type: 'aresGlobalParameters', title: 'Shift'}, expect: {kind: 'aresGlobal'}},
  // The MARKER outranks the type: the Venus bonus arrives as an `and` for the
  // base step and as an `or` for the final one, and both are ONE decision.
  {row: '24a venus bonus (base)', wf: {type: 'and', title: 'Gain 2', options: [], venusBonusPrompt: {kind: 'standard', baseCount: 2}}, expect: {kind: 'venusBonus', mode: 'standard'}},
  {row: '24b venus bonus (final)', wf: {type: 'or', title: 'Gain 3', options: [], venusBonusPrompt: {kind: 'final', baseCount: 2}}, expect: {kind: 'venusBonus', mode: 'final'}},
  {row: '24c spend heat', wf: {type: 'and', title: 'Spend 6 heat', options: [], spendHeatPrompt: {amount: 6}}, expect: {kind: 'spendHeat'}},
  // The shared distribution step's `and` (Cloud Development's floaters, Cyanobacteria's microbes): the
  // marker routes it onto the card-target chassis in LAYOUT mode, never onto the composite carve-out.
  {row: '24d card-resource distribution', wf: {type: 'and', title: 'Place 3 floaters on your cards', options: [], cardResourceDistributionPrompt: {amount: 3, cardResource: 'floater', cards: []}}, expect: {kind: 'cardSelect', mode: 'distribute'}},
  // A MARSBOT ATTACK — byte-identical to row 13 on the wire apart from
  // `botAttackPrompt`, which is exactly why the marker had to exist: without
  // it the prompt is a nameless target pick in the generic card browser.
  {row: '24d MarsBot attack (remove a card resource)', wf: {type: 'card', title: 'Remove 1 resource from one of your cards', buttonLabel: 'Remove resource', cards: [{name: 'Birds'}], botAttackPrompt: {attacker: 'neutral', victim: 'red', source: {kind: 'bonusCard', bonusCard: 'B02'}, effect: 'removeCardResource', cardResource: 'Animal', amount: 1, targets: []}}, expect: {kind: 'botAttack'}},
  {row: 'native placement', wf: {type: 'space', title: 'Select space', spaces: []}, expect: {kind: 'space'}},
  {row: '30 out-of-scope: delegate', wf: {type: 'delegate', title: 'Select delegate'}, expect: {kind: 'unknown', inputType: 'delegate'}},
  {row: '30b out-of-scope: classic party (no marker)', wf: {type: 'party', title: 'Select party'}, expect: {kind: 'unknown', inputType: 'party'}},
  {row: '30b2 parliament seat pick (marker)', wf: {type: 'party', title: 'Select party', votePrompt: {source: 'chairman-seat', cost: 0}}, expect: {kind: 'party'}},
  // THE SITTING'S GATES (Turmoil Redux): a plain option on the wire, classified by the server's own marker — never the title.
  {row: '30c parliament assembly gate (marker)', wf: {type: 'option', title: 'The Mars Parliament of generation 2 is in session: the verdict', parliamentPhasePrompt: {stage: 'assembly', generation: 2, final: false, seq: 1, awaiting: ['blue']}}, expect: {kind: 'parliamentPhase', stage: 'assembly'}},
  {row: '30d parliament adjourn gate (marker)', wf: {type: 'option', title: 'The Mars Parliament of generation 2 adjourns', parliamentPhasePrompt: {stage: 'adjourn', generation: 2, final: false, seq: 1, awaiting: []}}, expect: {kind: 'parliamentPhase', stage: 'adjourn'}},
  {row: '30e chairman-quest gate (marker, never the title)', wf: {type: 'option', title: 'You completed the chairman quest', chairmanQuestPrompt: {generation: 3}}, expect: {kind: 'chairmanQuest'}},
  {row: '30c out-of-scope: globalEvent', wf: {type: 'globalEvent', title: 'Select event'}, expect: {kind: 'unknown', inputType: 'globalEvent'}},
  {row: '30d out-of-scope: underworld token', wf: {type: 'claimedUndergroundToken', title: 'Select token'}, expect: {kind: 'unknown', inputType: 'claimedUndergroundToken'}},
];

/** Every PlayerInputModel discriminator — exhaustiveness anchor. */
const ALL_INPUT_TYPES = [
  'amount', 'and', 'aresGlobalParameters', 'card', 'claimedUndergroundToken',
  'colony', 'delegate', 'deltaProject', 'globalEvent', 'initialCards',
  'option', 'or', 'party', 'payment', 'player', 'productionToLose',
  'projectCard', 'resource', 'resources', 'space',
];

/** Every TaskKind — the anchor the coverage assertions below stand on. */
const ALL_TASK_KINDS: ReadonlyArray<TaskKind> = [
  'actionMenu', 'space', 'choice', 'awardFunding', 'player', 'amount', 'resource',
  'distribute', 'payment', 'draftWait', 'cardSelect', 'deckSelect', 'handSelect',
  'projectCard', 'colony', 'colonyBonus', 'externalDraw', 'venusBonus', 'spendHeat', 'botAttack',
  'composite', 'initialDraft', 'startSequence', 'corpFirstAction', 'aresGlobal', 'party', 'parliamentPhase', 'chairmanQuest', 'unknown',
];

/** The CURRENT red list — shrink it phase by phase (CTS-6). */
const EXPECTED_RED: ReadonlyArray<TaskKind> = [
  // T1: choice / player / amount / resource / distribute are native.
  // T2: cardSelect (draft / buy / target) is native; a hand-subset pick is
  //     the shell-section `handSelect` (the hand carousel in select mode).
  // T3: payment (native lanes) + projectCard (hand / std-project sections).
  // T4: colony (colonies rail pick mode).
  // T5: initialDraft (the start-scene wizard) + startSequence (the ceremony).
  // T-composite: the two MARKED composites (the Venus alt-track bonus and
  // Stormcraft's spend-heat) and the planetary-event thresholds now have their
  // own console-native surfaces, so `aresGlobal` left this list. `composite`
  // stays: an UNMARKED `and` is still the honest carve-out.
  'composite', 'unknown',
];

describe('consoleTaskRouter (CTS-2 coverage)', () => {
  it('no prompt → no task; client flows are shell-owned', () => {
    expect(taskFor(view(undefined))).to.eq(undefined);
  });

  for (const f of FIXTURES) {
    it(`row ${f.row}`, () => {
      const task = kindOf(f.wf, f.hand ?? [], f.srr ?? []);
      expect(task, f.row).to.not.eq(undefined);
      for (const [k, v] of Object.entries(f.expect)) {
        expect((task as Record<string, unknown>)[k], `${f.row} · ${k}`).to.eq(v);
      }
    });
  }

  it('EXHAUSTIVE: every input type maps to a task (never a silent undefined)', () => {
    for (const type of ALL_INPUT_TYPES) {
      const task = kindOf({type, title: 'x', options: [], cards: [], coloniesModel: [], spaces: []});
      expect(task, `type "${type}" must map`).to.not.eq(undefined);
    }
  });

  it('taskServedByHost: primitives served; only COMPOSITES defer to the modal', () => {
    // Leaf options + space options → served natively.
    const leafOr = view({type: 'or', title: 'Pick', options: [
      {type: 'option', title: 'a'}, {type: 'space', title: 'ocean', spaces: []},
    ]});
    expect(taskServedByHost(leafOr)?.kind).to.eq('choice');
    // T9: a nested PAYMENT / CARD option is now served (the one-level
    // wizard opens it; the response is or-wrapped).
    const nestedPay = view({type: 'or', title: 'Pick', options: [
      {type: 'option', title: 'a'}, {type: 'payment', title: 'pay'},
    ]});
    expect(taskServedByHost(nestedPay)?.kind).to.eq('choice');
    const nestedCard = view({type: 'or', title: 'Pick', options: [
      {type: 'card', title: 'add to a card', cards: []}, {type: 'option', title: 'skip'},
    ]});
    expect(taskServedByHost(nestedCard)?.kind).to.eq('choice');
    // The remaining honest carve-out: composites (`and`) and DEEPER `or`
    // nesting — the desktop modal keeps them (same gap the desktop premium
    // system defers to its legacy AndOptions.vue).
    const nestedAnd = view({type: 'or', title: 'Pick', options: [
      {type: 'option', title: 'a'}, {type: 'and', title: 'both', options: []},
    ]});
    expect(taskServedByHost(nestedAnd)).to.eq(undefined);
    const deepOr = view({type: 'or', title: 'Pick', options: [
      {type: 'or', title: 'inner', options: []},
    ]});
    expect(taskServedByHost(deepOr)).to.eq(undefined);
    // Bare confirm + the stepper/distribute family → served.
    expect(taskServedByHost(view({type: 'option', title: 'ok'}))?.kind).to.eq('choice');
    expect(taskServedByHost(view({type: 'player', title: 'p', players: []}))?.kind).to.eq('player');
    expect(taskServedByHost(view({type: 'amount', title: 'n', min: 0, max: 5}))?.kind).to.eq('amount');
    expect(taskServedByHost(view({type: 'resource', title: 'r', include: []}))?.kind).to.eq('resource');
    expect(taskServedByHost(view({type: 'resources', title: 'd', count: 2}))?.kind).to.eq('distribute');
    // T3: a TOP-LEVEL payment is host-served (native lanes).
    expect(taskServedByHost(view({type: 'payment', title: 'pay'}))?.kind).to.eq('payment');
    // T2: every card-select mode is host-served (the card browser).
    expect(taskServedByHost(view({type: 'card', title: 'keep', buttonLabel: 'Keep', cards: []}))?.kind).to.eq('cardSelect');
    expect(taskServedByHost(view({type: 'card', title: 'Select cards to buy', buttonLabel: 'Buy', cards: []}))?.kind).to.eq('cardSelect');
    // The OPTIONAL draft re-pick is NOT host-served — the shell shows a waiting
    // banner instead of the card browser (no re-pick UI, desktop parity).
    expect(taskServedByHost(view({type: 'card', title: 'change your selection', optional: true, cards: []}))).to.eq(undefined);
    // T3/T4: the REAL projectCard shapes + colony are SHELL-SECTION tasks,
    // NOT host tasks…
    expect(taskServedByHost(view({type: 'projectCard', title: 'p', cards: [{name: 'Power Plant:SP'}]}))).to.eq(undefined);
    expect(taskServedByHost(view({type: 'colony', title: 'c', coloniesModel: []}))).to.eq(undefined);
    // …but the GENERIC projectCard shape (foreign/empty candidates — wave 2)
    // IS host-served: the browser+payment surface that replaced the legacy
    // modal fallback.
    expect(taskServedByHost(view({type: 'projectCard', title: 'p', cards: []}))?.kind).to.eq('projectCard');
    expect(taskServedByHost(view({type: 'projectCard', title: 'p', cards: [{name: 'Birds'}]}))?.kind).to.eq('projectCard');
    // FREE award funding is served by the premium awards MA screen, NOT the host.
    expect(taskServedByHost(view({type: 'or', title: 'Fund an award', options: [], awardFundingPrompt: {free: true}}))).to.eq(undefined);
  });

  it('SHELL_SECTION_KINDS are native (served by sections, not the host)', () => {
    for (const kind of SHELL_SECTION_KINDS) {
      expect(NATIVE_KINDS.has(kind), `section kind "${kind}" must be native`).to.eq(true);
      // …but never claimed by the task host (the shell owns the surface).
      expect(kind === 'projectCard' || kind === 'handSelect' || kind === 'colony' || kind === 'party' || kind === 'parliamentPhase' || kind === 'chairmanQuest' ||
        kind === 'colonyBonus' || kind === 'externalDraw' || kind === 'awardFunding' ||
        kind === 'corpFirstAction').to.eq(true);
    }
  });

  it('SECTION_SERVED_KINDS cover every shell-section kind (wave 2: projectCard included)', () => {
    // The window between «announced» and «the screen opened» is a REAL state
    // for every section kind: nothing of theirs is mounted yet. Since wave 2
    // the set is exhaustive — the degenerate projectCard shape got its native
    // host surface (mode 'generic'), so no kind needs a desktop fallback and
    // the legacy MandatoryInputModal is gone.
    for (const kind of SECTION_SERVED_KINDS) {
      expect(SHELL_SECTION_KINDS.has(kind), `"${kind}" must be a section kind`).to.eq(true);
    }
    expect(SECTION_SERVED_KINDS.has('projectCard'),
      'every projectCard shape is console-served since wave 2').to.eq(true);
    expect(SECTION_SERVED_KINDS.has('colonyBonus'),
      'a remote colony-bonus collect is served by the colony workspace').to.eq(true);
  });

  it('the corp first action is served by the «Разыграно» table, NOT the host', () => {
    const corpAction = view({type: 'or', title: 'Take first action of X corporation', options: [], startGamePrompt: {kind: 'corporationInitialAction'}});
    expect(taskFor(corpAction)?.kind).to.eq('corpFirstAction');
    expect(taskServedByHost(corpAction)).to.eq(undefined);
    expect(SHELL_SECTION_KINDS.has('corpFirstAction')).to.eq(true);
  });

  it('a MANDATORY hand pick is a shell-section task (hand section), NOT host-served', () => {
    // Every candidate already in hand → handSelect (the hand carousel serves
    // it in select mode); the generic card browser must NOT claim it.
    const discard = view({type: 'card', title: 'Select 1 card to discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}]}, ['Birds', 'Zeppelins']);
    expect(taskFor(discard)?.kind).to.eq('handSelect');
    expect(taskServedByHost(discard), 'handSelect is served by the hand SECTION, not the task host').to.eq(undefined);
    expect(SHELL_SECTION_KINDS.has('handSelect')).to.eq(true);
    // A NON-hand card target (copy a played card / add a resource) stays a
    // generic host-served cardSelect — only IN-HAND candidates route to select.
    const target = view({type: 'card', title: 'Select card to add microbe', buttonLabel: 'Add', cards: [{name: 'Tardigrades'}]}, []);
    expect(taskFor(target)?.kind).to.eq('cardSelect');
    expect(taskServedByHost(target)?.kind).to.eq('cardSelect');
  });

  it('EXHAUSTIVE: the fixture table covers every TaskKind', () => {
    const covered = new Set<TaskKind>();
    for (const f of FIXTURES) {
      const task = kindOf(f.wf, f.hand ?? [], f.srr ?? []);
      if (task !== undefined) {
        covered.add(task.kind);
      }
    }
    expect(ALL_TASK_KINDS.filter((k) => !covered.has(k)),
      'add a fixture row — the minimize guard below is only as complete as this table').to.deep.eq([]);
  });

  /**
   * THE «B СВЕРНУТЬ» CONTRACT. A surface that offers minimize hides itself on
   * `consoleState.task.deferred`, so the board-home restore card is the ONLY
   * door back — and that card renders on the shell's `mandatoryDeferredActive`,
   * which reads exactly FOUR families: the task host, a shell section, the
   * start scene and the dedicated composites.
   *
   * A minimizable kind that no family claims is a silent soft-lock (the panel
   * unmounts, no card appears, B does nothing, and the leak detector stays
   * quiet by design — a deferred task is «set aside», never stranded). That is
   * precisely what shipped for the composites: «Разместите бонус шкалы Венеры»
   * folded on B and never came back.
   */
  it('MINIMIZABLE: every «свернуть» kind is claimed by a family the shell can restore from', () => {
    for (const f of FIXTURES) {
      const v = view(f.wf, f.hand ?? [], f.srr ?? []);
      const task = taskFor(v);
      if (task === undefined) {
        continue;
      }
      if (task.kind === 'chairmanQuest') {
        // THE SAME DELIBERATE ASYMMETRY as the external-draw take: the
        // Parliament workspace IS a claimed family, but «ПРЕДСЕДАТЕЛЬСТВО» is
        // one uninterrupted phrase past the commit — nothing folds, and before
        // it opens the player roams freely behind the announce plate.
        expect(taskMinimizable(task.kind), 'the chairmanship flow never folds').to.eq(false);
        continue;
      }
      if (task.kind === 'externalDraw') {
        // THE ONE DELIBERATE ASYMMETRY (`taskMinimizable` states it too): its
        // workspace IS claimed by a family, but the take is LOCKED once that
        // workspace is open — the take is the only way out — and before it
        // opens the player roams freely behind the announce plate. So there is
        // nothing to fold and nothing to come back to.
        expect(taskMinimizable(task.kind), 'the external-draw take never folds').to.eq(false);
        continue;
      }
      const claimed = taskServedByHost(v) !== undefined ||
        SHELL_SECTION_KINDS.has(task.kind) ||
        SCENE_KINDS.has(task.kind) ||
        NATIVE_COMPOSITE_KINDS.has(task.kind);
      expect(claimed, `"${task.kind}" (${f.row}): minimizable ⇔ some family offers the way back`)
        .to.eq(taskMinimizable(task.kind));
    }
  });

  it('the DEDICATED COMPOSITES are a family of their OWN (the arm that was missing)', () => {
    for (const kind of NATIVE_COMPOSITE_KINDS) {
      expect(taskMinimizable(kind), `"${kind}" advertises «Свернуть»`).to.eq(true);
      expect(NATIVE_KINDS.has(kind), `"${kind}" is console-native`).to.eq(true);
      // Not a section, not a scene — and not host-served either (below), which
      // is why enumerating those three families silently dropped all four.
      expect(SHELL_SECTION_KINDS.has(kind), `"${kind}" is not a shell section`).to.eq(false);
      expect(SCENE_KINDS.has(kind), `"${kind}" is not a start scene`).to.eq(false);
    }
    expect(taskServedByHost(view({type: 'and', title: 'Gain 2', options: [], venusBonusPrompt: {kind: 'standard', baseCount: 2}}))).to.eq(undefined);
    expect(taskServedByHost(view({type: 'and', title: 'Spend 6 heat', options: [], spendHeatPrompt: {amount: 6}}))).to.eq(undefined);
    expect(taskServedByHost(view({type: 'aresGlobalParameters', title: 'Shift'}))).to.eq(undefined);
    expect(taskServedByHost(view({type: 'card', title: 'Select 2 card(s) to keep', buttonLabel: 'Select', cards: [{name: 'Birds'}], deckPickPrompt: {revealed: 2, min: 2, max: 2, origin: 'deck', mode: 'keep'}}))).to.eq(undefined);
  });

  it('an ALWAYS-MOUNTED surface has nothing to minimize', () => {
    // The turn verbs and the board have no panel to fold, so no restore card is
    // owed — and the draft minimizes as a WORKSPACE (the parked stack answers).
    expect(taskMinimizable('actionMenu')).to.eq(false);
    expect(taskMinimizable('space')).to.eq(false);
    expect(taskMinimizable('draftWait')).to.eq(false);
    // …and the two kinds no console surface serves at all.
    expect(taskMinimizable('composite')).to.eq(false);
    expect(taskMinimizable('unknown')).to.eq(false);
  });

  /*
   * A FOLLOW-UP STEP — the prompt kinds whose surface opens INSIDE the flow that
   * produced it, so «a step is owed» is a real state of that flow: it holds the
   * conclusion, holds the descent open and names the crumb tail in advance.
   */
  describe('followUpStepStage (the step-shaped follow-ups)', () => {
    it('a colony pick is a step of its flow, under the crumb the frame publishes', () => {
      // The SAME key `openColoniesForPrompt` pushes and `ConsoleColoniesSection`
      // publishes up — one stage, one word, so the tail animates once.
      expect(followUpStepStage('colony')).to.eq('Colony selection');
      // A RESOLUTION-sourced ask answers from the sitting's own table: a pick is «Choice», the shared
      // distribution's marked `and` is «Distribution» (the crumb's one word, `consoleSittingFlow` prints the same).
      const resolutionPick = {type: 'card', title: 'pick', buttonLabel: 'Select', cards: [], choiceContext: {source: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel;
      const resolutionSpread = {type: 'and', title: 'lay', buttonLabel: 'Confirm', options: [], choiceContext: {source: {kind: 'resolution', resolution: 'RDX_X'}},
        cardResourceDistributionPrompt: {amount: 3, cardResource: 'floater', cards: []}} as unknown as PlayerInputModel;
      expect(followUpStepStage('cardSelect', resolutionPick)).to.eq('Choice');
      expect(followUpStepStage('cardSelect', resolutionSpread)).to.eq('Distribution');
      // The winner's free COLONY (Colony Contest): the colonies screen is the SITTING's step — «КОЛОНИИ», one
      // word — while a card's or a project's pick keeps «ВЫБОР КОЛОНИИ» (the source decides, never the title).
      const resolutionColony = {type: 'colony', title: 'Select where to build the free colony', buttonLabel: 'Build', coloniesModel: [],
        placementContext: {cancellable: false, reason: 'r', source: {kind: 'resolution', resolution: 'RDX_X'}}} as unknown as PlayerInputModel;
      const projectColony = {type: 'colony', title: 'Select where to build a colony', buttonLabel: 'Build', coloniesModel: [],
        placementContext: {cancellable: true}} as unknown as PlayerInputModel;
      expect(followUpStepStage('colony', resolutionColony)).to.eq('Colonies');
      expect(followUpStepStage('colony', projectColony)).to.eq('Colony selection');
      expect(taskServedByHost(view({type: 'and', title: 'lay', options: [], cardResourceDistributionPrompt: {amount: 3, cardResource: 'floater', cards: []}}))?.kind, 'the host serves the layout').to.eq('cardSelect');
    });

    /* A discard the played card FORCED is not a step of the play: it needs the
     * hand's own browse layer, which that play's descent has parked. */
    it('a forced hand pick is NOT one', () => {
      expect(followUpStepStage('handSelect')).to.be.undefined;
      expect(followUpStepStage('projectCard')).to.be.undefined;
      expect(followUpStepStage('space')).to.be.undefined;
      expect(followUpStepStage(undefined)).to.be.undefined;
      // …not even with the prompt in hand: a CARD's discard (Mars University) has the card as its source.
      const cardDiscard = {type: 'card', title: 'Discard 1 card', buttonLabel: 'Discard', cards: [], min: 1, max: 1,
        discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: 'Mars University'}}} as unknown as PlayerInputModel;
      expect(followUpStepStage('handSelect', cardDiscard)).to.be.undefined;
    });

    /* Colonial Affairs (RX07): the DISCARD a resolution demands (Pluto's second half, repeated) IS a step
     * of the sitting — the hand in its discard mode, under the sitting's one word for it. */
    it('a resolution-sourced DISCARD from hand is a step of the sitting: «Сброс»', () => {
      const resolutionDiscard = {type: 'card', title: 'Discard 1 card', buttonLabel: 'Discard', cards: [{name: 'Birds'}], min: 1, max: 1,
        discardPrompt: {min: 1, max: 1, source: {kind: 'resolution', resolution: 'RDX_UNITY_COLONIAL_AFFAIRS'}, colonyRepeat: {colonyName: 'Pluto', index: 1, total: 2}}} as unknown as PlayerInputModel;
      expect(followUpStepStage('handSelect', resolutionDiscard)).to.eq('Discarding');
      // …served by the HAND SECTION like every discard (the candidates are the hand — the hand-subset rule).
      expect(taskFor(view(resolutionDiscard, ['Birds', 'Zeppelins']))?.kind).to.eq('handSelect');
    });

    /* AN ENACTED RESOLUTION'S ASK (Turmoil Redux) is a step of the Parliament's
     * SITTING — under the stage name the sitting publishes for it — by the
     * prompt's structural SOURCE, never its title; the same widget from a card
     * action is nobody's step. */
    it('a resolution-sourced ask is a step of the sitting: a pick → «Выбор», a take → «Получение», a tile → «Размещение»', () => {
      const source = {kind: 'resolution', resolution: 'RDX_GREENS_CLIMATE_RESEARCH'};
      const pick = {type: 'card', title: 'Select a card', buttonLabel: 'Select', cards: [], choiceContext: {source}} as unknown as PlayerInputModel;
      const take = {type: 'card', title: 'Take', buttonLabel: 'Take', cards: [], choiceContext: {source}, externalDrawPrompt: {intakeId: 1, count: 2, remaining: 2, cause: source}} as unknown as PlayerInputModel;
      const tile = {type: 'space', title: 'Select space for ocean', buttonLabel: 'Select', spaces: [], placementContext: {source}} as unknown as PlayerInputModel;
      expect(followUpStepStage('cardSelect', pick)).to.eq('Choice');
      expect(followUpStepStage('choice', {type: 'or', title: 'x', options: [], choiceContext: {source}} as unknown as PlayerInputModel)).to.eq('Choice');
      expect(followUpStepStage('externalDraw', take)).to.eq('Intake');
      expect(followUpStepStage('space', tile)).to.eq('Placement');
      // The same kinds WITHOUT a resolution source keep their old answers.
      expect(followUpStepStage('cardSelect', {type: 'card', title: 'Select a card', buttonLabel: 'Select', cards: []} as unknown as PlayerInputModel)).to.be.undefined;
      expect(followUpStepStage('space', {type: 'space', title: 'Select space', buttonLabel: 'Select', spaces: []} as unknown as PlayerInputModel)).to.be.undefined;
      expect(followUpStepStage('colony', {type: 'colony', title: 'Select colony', buttonLabel: 'Select', coloniesModel: []} as unknown as PlayerInputModel)).to.eq('Colony selection');
    });

    /* The door being gated is `openShellTaskSurface`'s, so a step-shaped
     * follow-up has to be a kind a SHELL SECTION serves — otherwise the gate
     * would hold a prompt no section ever opens for. */
    it('a step-shaped follow-up is a kind a shell section serves', () => {
      const stepKinds = ([...SHELL_SECTION_KINDS, 'space', 'choice', 'payment'] as ReadonlyArray<TaskKind>)
        .filter((kind) => followUpStepStage(kind) !== undefined);
      expect(stepKinds).to.deep.eq(['colony']);
      for (const kind of stepKinds) {
        expect(SHELL_SECTION_KINDS.has(kind), kind).to.eq(true);
      }
    });
  });

  it('a start-game MARKER outranks the raw input type (structural rule)', () => {
    const marked = kindOf({type: 'card', title: 'anything', cards: [], startGamePrompt: {kind: 'preludeSelection'}});
    expect(marked?.kind).to.eq('startSequence');
  });

  it('RED LIST (the CTS work queue) matches the declared phase state', () => {
    const red = new Set<TaskKind>();
    for (const f of FIXTURES) {
      const task = kindOf(f.wf, f.hand ?? [], f.srr ?? []);
      if (task !== undefined && !isNativelyHandled(task)) {
        red.add(task.kind);
      }
    }
    // Print the work queue — the shrinking-list progress metric.
    console.log('    CTS red list (kinds without a native console task yet):');
    for (const kind of red) {
      console.log(`      - ${kind}`);
    }
    expect([...red].sort()).to.deep.eq([...EXPECTED_RED].sort(),
      'NATIVE_KINDS / EXPECTED_RED are out of sync — a phase landed (or regressed); update both deliberately');
    // Sanity: the natively-handled set really is disjoint from the red list.
    for (const kind of NATIVE_KINDS) {
      expect(red.has(kind), `native kind "${kind}" must not be red`).to.eq(false);
    }
  });

  /**
   * WHO OWNS THE PAD DURING THE OPENING — the guard for a whole CLASS of
   * soft-locks, not for one card.
   *
   * The Game Start Workspace holds the pad and the bar for the WHOLE opening:
   * its lifetime hold spans every gap between beats, so «the scene is up» says
   * nothing about who the server is asking. A prelude with a price («Огромный
   * астероид») played by a corporation with an alternative currency (Helion's
   * heat) raises a `SelectPayment`, and the host teleports into the workspace's
   * own zone as its «› ОПЛАТА» stage — but the scene kept the pad. The panel
   * stood there exact and valid («ОПЛАЧЕНО 5/5 · ТОЧНАЯ ОПЛАТА») while A still
   * read «РАЗЫГРАТЬ» on the queue behind it and LB/RB never reached the heat
   * lane: a decision the opening was displaying and was structurally unable to
   * accept. Every other host-served family a prelude can raise — an OrOptions,
   * an amount, a resource pick, a target player, a card buy — and every
   * dedicated composite a prelude's global parameter can trip was deaf for
   * exactly the same reason.
   *
   * THREE SIDES, and a kind is on exactly one of them:
   *
   *   · `self`    — the opening answers it ITSELF (its wizard, its deployment
   *                 presses, its first-action stage). It keeps the pad.
   *   · `frame`   — the surface is a FRAME the workspace stack already accounts
   *                 for (the hand, the colonies, «Добор карт», the awards
   *                 sheet, the Parliament, the board). The scene yields to
   *                 those by PRESENCE, which is what keeps it ABSORBING presses
   *                 in the window before that frame is up — so this predicate
   *                 must answer «no», or the press falls through to the board
   *                 standing behind the scene. `composite` / `unknown` sit here
   *                 too: nothing native serves them, so there is nobody to hand
   *                 the pad to.
   *   · `surface` — a surface of its OWN comes up over (or inside) the
   *                 workspace and takes the whole decision: the task host and
   *                 every panel cascading off it, plus the dedicated
   *                 composites. The opening hands over the pad AND the bar.
   */
  describe('promptOutranksStartScene (the opening never holds a pad it cannot use)', () => {
    type StartSide = 'self' | 'frame' | 'surface';

    /** Exhaustive over TaskKind — checked against ALL_TASK_KINDS below. */
    const START_SIDE: Readonly<Record<TaskKind, StartSide>> = {
      // ── the opening answers these ITSELF ────────────────────────────────
      initialDraft: 'self', // the setup wizard (corp / preludes / CEO / buy)
      startSequence: 'self', // every deployment press, the campaign ones included
      corpFirstAction: 'self', // the «ПЕРВОЕ ДЕЙСТВИЕ» stage of the same flow
      actionMenu: 'self', // «Фора»: the announce, before the trip to the board
      draftWait: 'self', // the initial draft's calm «ждём других» page
      // ── a FRAME serves these; presence yields, never this predicate ─────
      space: 'frame', // the board (the scene hides — `startSceneVisible`)
      projectCard: 'frame', // playFromHand → the hand step; standardProject → the sheet
      handSelect: 'frame', // the hand carousel in select mode
      colony: 'frame',
      colonyBonus: 'frame',
      awardFunding: 'frame', // Vitor's free sponsorship — the awards frame takes the scene
      party: 'frame',
      parliamentPhase: 'frame',
      chairmanQuest: 'frame', // the Parliament workspace's «ПРЕДСЕДАТЕЛЬСТВО» flow
      externalDraw: 'frame',
      deckSelect: 'frame', // «Добор карт» — routed ABOVE the scene, its own term
      composite: 'frame', // nothing native serves it…
      unknown: 'frame', // …nor it: the honest guard, and the scene keeps absorbing
      // ── THE CLASS THE OPENING USED TO SWALLOW ──────────────────────────
      payment: 'surface',
      choice: 'surface',
      player: 'surface',
      amount: 'surface',
      resource: 'surface',
      distribute: 'surface',
      cardSelect: 'surface',
      venusBonus: 'surface',
      spendHeat: 'surface',
      aresGlobal: 'surface',
      botAttack: 'surface',
    };

    it('EXHAUSTIVE: every TaskKind declares which side of the opening it is on', () => {
      expect(ALL_TASK_KINDS.filter((k) => START_SIDE[k] === undefined),
        'a new prompt family must say whether the opening answers it, a frame does, or it takes the pad').to.deep.eq([]);
      expect(Object.keys(START_SIDE).filter((k) => !ALL_TASK_KINDS.includes(k as TaskKind)),
        'stale kind in START_SIDE').to.deep.eq([]);
    });

    /* The fixture table covers every kind (its own exhaustiveness test above),
     * so this walks the whole classification against real wire shapes. The one
     * kind that splits by MODE is asserted separately below. */
    for (const f of FIXTURES) {
      it(`row ${f.row} · the opening knows who owns the pad`, () => {
        const v = view(f.wf, f.hand ?? [], f.srr ?? []);
        const task = taskFor(v);
        expect(task, f.row).to.not.eq(undefined);
        if (task === undefined || task.kind === 'projectCard') {
          return; // the mode split has its own assertions
        }
        expect(promptOutranksStartScene(v), `${f.row} · ${task.kind}`)
          .to.eq(START_SIDE[task.kind] === 'surface');
      });
    }

    it('THE REPORTED CASE: a prelude payment takes the pad from the opening', () => {
      // «Огромный астероид» + Helion — the bill the console showed and could
      // not accept. Identified structurally (the prompt TYPE), never a title.
      const pay = view({type: 'payment', title: 'Select how to spend 5 M€'});
      expect(taskFor(pay)?.kind).to.eq('payment');
      expect(promptOutranksStartScene(pay), 'the payment host owns the pad, not the queue behind it').to.eq(true);
    });

    it('a GENERIC projectCard is host-served and outranks; the two real shapes are frames', () => {
      expect(promptOutranksStartScene(view({type: 'projectCard', title: 'p', cards: []}))).to.eq(true);
      expect(promptOutranksStartScene(view({type: 'projectCard', title: 'p', cards: [{name: 'Birds'}]}))).to.eq(true);
      // playFromHand (every candidate in hand) and the std-project shape are
      // the hand step / the sheet — the scene yields to them by PRESENCE.
      expect(promptOutranksStartScene(view({type: 'projectCard', title: 'p', cards: [{name: 'Birds'}]}, ['Birds']))).to.eq(false);
      expect(promptOutranksStartScene(view({type: 'projectCard', title: 'p', cards: [{name: 'Power Plant:SP'}]}))).to.eq(false);
    });

    it('a WORKSPACE-served choice flavour does NOT outrank (the Hydronetwork owns it)', () => {
      const deltaBonus = view({type: 'or', title: 'Bonus move', options: [], deltaBonusPrompt: {stage: 1}});
      expect(taskFor(deltaBonus)?.kind).to.eq('choice');
      expect(taskServedByHost(deltaBonus), 'its own workspace serves it').to.eq(undefined);
      expect(promptOutranksStartScene(deltaBonus)).to.eq(false);
    });

    it('nothing asked → nothing outranks (the opening keeps its own pad)', () => {
      expect(promptOutranksStartScene(view(undefined))).to.eq(false);
    });

    /* THE RULE, stated once against the ONE classifier: anything the task host
     * fully serves takes the pad. A future carve-out in `taskServedByHost` is
     * inherited here instead of drifting from it. */
    it('every host-served prompt outranks the opening', () => {
      for (const f of FIXTURES) {
        const v = view(f.wf, f.hand ?? [], f.srr ?? []);
        if (taskServedByHost(v) !== undefined) {
          expect(promptOutranksStartScene(v), `${f.row}: host-served ⇒ the host owns the pad`).to.eq(true);
        }
      }
    });
  });
});
