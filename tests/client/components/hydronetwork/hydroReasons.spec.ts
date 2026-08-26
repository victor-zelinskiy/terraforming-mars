import {expect} from 'chai';
import {buildHydroModel, HydroModelInput, HydroPlayerPos} from '../../../../src/client/components/hydronetwork/hydroNetworkModel';
import {destinationAt, gradeDestination, hydroPlanReasons, hydroPrimaryBlocker, hydroReasonBlocker, HydroReasonKind, HydroTurnState, hydroTurnStateOf} from '../../../../src/client/components/hydronetwork/hydroReasons';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '../../../../src/common/models/DeltaTrackPreviewModel';
import {Tag} from '../../../../src/common/cards/Tag';
import {CardName} from '../../../../src/common/cards/CardName';

function dest(steps: number, opts: Partial<DeltaTrackDestination> = {}): DeltaTrackDestination {
  return {
    steps,
    position: steps,
    legal: true,
    affordable: true,
    energyDeficit: 0,
    occupied: false,
    jumpedOverVp2: false,
    requiredTags: [],
    wildCoveredTags: [],
    missingTags: [],
    ...opts,
  };
}

function fullPreview(energy: number, overrides: Partial<DeltaTrackPreviewModel> = {}): DeltaTrackPreviewModel {
  const destinations: Array<DeltaTrackDestination> = [];
  for (let steps = 1; steps <= 11; steps++) {
    destinations.push(dest(steps, {affordable: steps <= energy, energyDeficit: Math.max(0, steps - energy)}));
  }
  return {
    currentPosition: 0,
    availableEnergy: energy,
    usedThisGeneration: false,
    atEndOfTrack: false,
    maxLegalSteps: Math.min(energy, 11),
    maxEnergySteps: Math.min(energy, 11),
    maxPreviewSteps: 11,
    destinations,
    reuseActionCards: [],
    animalTargetCards: [],
    ...overrides,
  };
}

function viewer(overrides: Partial<HydroPlayerPos> = {}): HydroPlayerPos {
  return {color: 'red', name: 'Red', position: 0, isViewer: true, isMarsBot: false, stops: [], ...overrides};
}

function modelInput(overrides: Partial<HydroModelInput> = {}): HydroModelInput {
  return {
    preview: fullPreview(3),
    players: [viewer()],
    viewerColor: 'red',
    selectedPosition: -1,
    rewardChoice: undefined,
    selectedCard: undefined,
    actionAvailable: true,
    ...overrides,
  };
}

function reasonsFor(overrides: Partial<HydroModelInput> = {}, opts: {occupantName?: string, turnState?: HydroTurnState} = {}) {
  const input = modelInput(overrides);
  const model = buildHydroModel(input);
  return hydroPlanReasons({
    model,
    preview: input.preview,
    actionAvailable: input.actionAvailable,
    // The historical assumption of these cases: the action is absent because
    // the server isn't waiting on the viewer at all.
    turnState: opts.turnState ?? 'not-your-turn',
    rewardChoice: input.rewardChoice,
    occupantName: opts.occupantName,
  });
}

describe('hydroPlanReasons', () => {
  it('a confirmable stage has NO reasons (the CTA is live)', () => {
    expect(reasonsFor({selectedPosition: 3})).deep.eq([]);
  });

  it('missing preview → a loading gate, never a generic block', () => {
    const rs = reasonsFor({preview: undefined});
    expect(rs.map((r) => r.kind)).deep.eq(['loading']);
  });

  it('end of track is the single terminal reason', () => {
    const rs = reasonsFor({preview: fullPreview(3, {atEndOfTrack: true})});
    expect(rs.map((r) => r.kind)).deep.eq(['end-of-track']);
  });

  it('used-this-generation supersedes everything else', () => {
    const rs = reasonsFor({preview: fullPreview(0, {usedThisGeneration: true}), actionAvailable: false, selectedPosition: 5});
    expect(rs.map((r) => r.kind)).deep.eq(['used-this-generation']);
  });

  it('names EVERY missing tag with its icon key', () => {
    const rs = reasonsFor({
      selectedPosition: 3,
      preview: fullPreview(5, {
        maxLegalSteps: 1,
        destinations: [
          dest(1), dest(2, {legal: false, missingTags: [Tag.POWER]}),
          dest(3, {legal: false, missingTags: [Tag.POWER, Tag.EARTH]}),
          ...Array.from({length: 8}, (_v, i) => dest(i + 4, {legal: false, missingTags: [Tag.POWER]})),
        ],
      }),
    });
    const tags = rs.filter((r) => r.kind === 'missing-tag');
    expect(tags.map((r) => r.tag)).deep.eq([Tag.POWER, Tag.EARTH]);
    expect(tags.every((r) => r.blocking)).eq(true);
  });

  it('energy deficit is concrete: need N, you have M', () => {
    const rs = reasonsFor({selectedPosition: 7, preview: fullPreview(2)});
    expect(rs.map((r) => r.kind)).deep.eq(['energy-deficit']);
    expect(rs[0].params).deep.eq([7, 2]);
  });

  it('zero energy reads as "no energy", not as a deficit equation', () => {
    const rs = reasonsFor({selectedPosition: 1, preview: fullPreview(0), actionAvailable: false});
    expect(rs.map((r) => r.kind)).deep.eq(['no-energy']);
  });

  it('an occupied finish slot names the occupant', () => {
    const preview = fullPreview(11, {
      destinations: [
        ...Array.from({length: 9}, (_v, i) => dest(i + 1)),
        dest(10, {legal: false, occupied: true}),
        dest(11),
      ],
    });
    const rs = reasonsFor({selectedPosition: 10, preview}, {occupantName: 'Ivan'});
    expect(rs[0].kind).eq('vp-occupied');
    expect(rs[0].params).deep.eq(['Ivan']);
  });

  it('not-your-turn shows ONLY when a legal+affordable move exists', () => {
    // A real waiting-for-turn case: moves exist but the action is absent.
    const withMoves = reasonsFor({selectedPosition: 1, actionAvailable: false});
    expect(withMoves.map((r) => r.kind)).deep.eq(['not-your-turn']);
    // No legal move at all (tags): the per-stage reason explains it instead.
    const noMoves = reasonsFor({
      selectedPosition: 1,
      actionAvailable: false,
      preview: fullPreview(5, {
        maxLegalSteps: 0,
        destinations: Array.from({length: 11}, (_v, i) => dest(i + 1, {legal: false, missingTags: [Tag.BUILDING]})),
      }),
    });
    expect(noMoves.map((r) => r.kind)).deep.eq(['missing-tag']);
  });

  it('multiple simultaneous blockers are ALL surfaced (turn + tags + energy)', () => {
    const rs = reasonsFor({
      selectedPosition: 5,
      actionAvailable: false,
      preview: fullPreview(2, {
        maxLegalSteps: 1,
        destinations: [
          dest(1), dest(2),
          ...Array.from({length: 9}, (_v, i) => dest(i + 3, {
            legal: false, missingTags: [Tag.SCIENCE],
            affordable: i + 3 <= 2, energyDeficit: Math.max(0, i + 3 - 2),
          })),
        ],
      }),
    });
    expect(rs.map((r) => r.kind)).deep.eq(['not-your-turn', 'missing-tag', 'energy-deficit']);
  });

  it('NEVER blames the turn while the viewer is ON the action menu', () => {
    // The screenshot case: the action menu is live («ДЕЙСТВИЕ 2/2») but the
    // server withholds the advance. Blaming «Сейчас не ваш ход» is a lie the
    // player can see through — the honest reason is the rule that blocks it.
    const used = reasonsFor(
      {selectedPosition: 5, actionAvailable: false, preview: fullPreview(3, {usedThisGeneration: true})},
      {turnState: 'action-menu'});
    expect(used.map((r) => r.kind)).deep.eq(['used-this-generation']);

    // A rule NONE of the gates models → the honest last resort, still not a
    // fabricated turn excuse.
    const unknown = reasonsFor({selectedPosition: 1, actionAvailable: false}, {turnState: 'action-menu'});
    expect(unknown.map((r) => r.kind)).deep.eq(['unavailable']);

    // Mid-decision SOMEWHERE ELSE: the open prompt owns the player — say THAT.
    const busy = reasonsFor({selectedPosition: 1, actionAvailable: false}, {turnState: 'busy'});
    expect(busy.map((r) => r.kind)).deep.eq(['finish-current-action']);
  });

  /**
   * …AND NEVER BLAMES «текущее действие» WHEN THE CURRENT ACTION IS THIS SCREEN.
   *
   * A card-granted bonus move (Dynamic Ocean Barrier) routes the player INTO
   * the Hydronetwork and then asks its question there. The old derivation read
   * «a prompt exists and it is not the action menu ⇒ busy», so the workspace
   * the prompt itself had opened printed «Сначала завершите текущее
   * действие» directly above the decision it was telling the player to go
   * and finish.
   */
  it('REGRESSION: an OWN prompt is not «busy» — the player is standing where it sent them', () => {
    const own = reasonsFor({selectedPosition: 1, actionAvailable: false}, {turnState: 'own-prompt'});
    expect(own.map((r) => r.kind)).to.not.include('finish-current-action');
    // …and it does not fabricate a turn excuse in its place either.
    expect(own.map((r) => r.kind)).to.not.include('not-your-turn');
  });
  it('a clean stage gates on the bonus choice, then the card pick', () => {
    const choice = reasonsFor({selectedPosition: 1});
    expect(choice.map((r) => r.kind)).deep.eq(['choose-bonus']);
    expect(choice[0].blocking).eq(false);
    expect(reasonsFor({selectedPosition: 1, rewardChoice: 0})).deep.eq([]);

    const pick = reasonsFor({
      selectedPosition: 7,
      preview: fullPreview(8, {reuseActionCards: [CardName.IRONWORKS]}),
    });
    expect(pick.map((r) => r.kind)).deep.eq(['choose-card']);
    expect(pick[0].blocking).eq(false);
  });

  it('a blocked stage never nags about its bonus', () => {
    const rs = reasonsFor({selectedPosition: 1, preview: fullPreview(0), actionAvailable: false});
    expect(rs.some((r) => r.kind === 'choose-bonus')).eq(false);
  });

  it('details mode (current / passed stage) is informational — no reasons', () => {
    expect(reasonsFor({selectedPosition: 0})).deep.eq([]);
  });
});

/*
 * THE TURN GATE IS NOT A TRACK RULE. «Сейчас не ваш ход» over a stage whose
 * every requirement shows a green ✓ told the player the Hydronetwork refused
 * them; it does not — it is simply not their moment. So the two turn kinds take
 * the calm register and keep the advance potentially available, while every real
 * Delta-track rule (energy, path tags, an occupied VP slot, the once-per-
 * generation gate) does the opposite and outranks them when both apply.
 */
describe('hydro blocker semantics', () => {
  it('the turn gates are WARNINGS that keep the advance potentially available', () => {
    for (const turnState of ['not-your-turn', 'busy'] as ReadonlyArray<HydroTurnState>) {
      const rs = reasonsFor({selectedPosition: 1, actionAvailable: false}, {turnState});
      const blocker = hydroPrimaryBlocker(rs);
      expect(blocker?.tone, turnState).eq('warning');
      expect(blocker?.affectsPotentialCount, turnState).eq(false);
      expect(blocker?.blocksExecutionNow, 'the reinforce button stays disabled').eq(true);
    }
  });

  it('a real track rule is a DANGER and OUTRANKS the turn gate', () => {
    // No energy at all AND an opponent's turn: the useful line must win.
    const rs = reasonsFor({selectedPosition: 1, preview: fullPreview(0), actionAvailable: false});
    expect(rs.some((r) => r.kind === 'no-energy')).eq(true);
    const blocker = hydroPrimaryBlocker(rs);
    expect(blocker?.tone).eq('danger');
    expect(blocker?.affectsPotentialCount).eq(true);
  });

  it('the once-per-generation gate is a domain fact, not a timing one', () => {
    const rs = reasonsFor({preview: fullPreview(3, {usedThisGeneration: true}), selectedPosition: 1, actionAvailable: false});
    expect(rs[0].kind).eq('used-this-generation');
    expect(hydroReasonBlocker(rs[0]).tone).eq('danger');
  });

  it('every reason kind is classified (the exhaustiveness guard)', () => {
    const kinds: ReadonlyArray<HydroReasonKind> = [
      'loading', 'end-of-track', 'used-this-generation', 'not-your-turn', 'finish-current-action',
      'unavailable', 'missing-tag', 'vp-occupied', 'no-energy', 'energy-deficit',
      'choose-bonus', 'choose-card',
    ];
    for (const kind of kinds) {
      const blocker = hydroReasonBlocker({kind, textKey: 'x', blocking: true});
      expect(blocker, kind).to.not.eq(undefined);
      expect(['warning', 'danger'], kind).to.include(blocker.tone);
    }
  });

  it('nothing blocking → no blocker at all', () => {
    expect(hydroPrimaryBlocker([])).eq(undefined);
    // A to-do gate is not a refusal either.
    const todo = reasonsFor({selectedPosition: 1}, {turnState: 'action-menu'});
    expect(hydroPrimaryBlocker(todo)).eq(undefined);
  });
});

describe('gradeDestination / destinationAt', () => {
  it('grades: tags > occupancy > energy > ok', () => {
    expect(gradeDestination(dest(1, {missingTags: [Tag.BUILDING], occupied: true, affordable: false}))).eq('blocked');
    expect(gradeDestination(dest(1, {occupied: true, affordable: false}))).eq('occupied');
    expect(gradeDestination(dest(1, {affordable: false, energyDeficit: 1}))).eq('needs-energy');
    expect(gradeDestination(dest(1))).eq('ok');
  });

  it('destinationAt maps an absolute position onto the step list', () => {
    const preview = fullPreview(3);
    expect(destinationAt(preview, 0)).eq(undefined);
    expect(destinationAt(preview, 1)?.steps).eq(1);
    expect(destinationAt(preview, 11)?.steps).eq(11);
    expect(destinationAt(undefined, 3)).eq(undefined);
  });
});

/**
 * THE TURN STATE ITSELF — three structural facts, four answers, and the ONE
 * distinction the old inline derivation could not make.
 */
describe('hydroTurnStateOf', () => {
  it('no prompt at all → not-your-turn', () => {
    expect(hydroTurnStateOf({waiting: false, actionMenu: false, ownsPrompt: false})).eq('not-your-turn');
    // Nothing else can outrank «the server is not asking the viewer anything».
    expect(hydroTurnStateOf({waiting: false, actionMenu: true, ownsPrompt: true})).eq('not-your-turn');
  });

  it('the action menu → action-menu (a withheld advance there is a RULE)', () => {
    expect(hydroTurnStateOf({waiting: true, actionMenu: true, ownsPrompt: false})).eq('action-menu');
  });

  it('a prompt THIS workspace owns → own-prompt, however the player got here', () => {
    expect(hydroTurnStateOf({waiting: true, actionMenu: false, ownsPrompt: true})).eq('own-prompt');
  });

  /** The wheel-entry case: something ELSE is owed, so the advance really is
   *  out of reach and saying so is the truth. */
  it('a prompt this workspace does NOT own → busy', () => {
    expect(hydroTurnStateOf({waiting: true, actionMenu: false, ownsPrompt: false})).eq('busy');
  });
});
