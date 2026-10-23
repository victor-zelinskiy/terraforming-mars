import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ProductionIncomeModel} from '@/common/models/ProductionIncomeModel';
import {
  detectGenerationScene, generationIncomeReward, generationSceneState, noteGenerationFlipEnd, resetGenerationScene, runGenerationFlip,
  endGenerationScene, armedGenerationScene, seedGenerationIncomeHold, GENERATION_INCOME_KEY,
} from '@/client/console/generationScene/generationScene';
import {railRewardPending, resetRailRewards, verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';

/**
 * THE GENERATION CHANGE IS ONE SCENE (TR61) — the pure half: the scene is
 * detected off the SERVER'S RECORD of the phase (never a diff), claimed once
 * per seat and generation, its flip beat settles on the strip's own signal,
 * its promise to the rail is the record read as tokens (the rating apart,
 * the conversion and a negative production as known moves), it holds the
 * foreground from the first beat and lets go on an interrupt.
 */
function record(over: Partial<ProductionIncomeModel> = {}): ProductionIncomeModel {
  return {
    generation: 2, correlationId: 7,
    income: {megacredits: 5, steel: 2, titanium: 0, plants: 1, energy: 3, heat: 0},
    rating: 21, conversion: 4,
    ...over,
  };
}

function view(over: {generation?: number, phase?: Phase, income?: ProductionIncomeModel, stock?: Partial<Record<string, number>>} = {}): PlayerViewModel {
  return {
    id: 'p-me',
    game: {generation: over.generation ?? 2, phase: over.phase ?? Phase.RESEARCH, gameOptions: {draftVariant: false}},
    thisPlayer: {color: 'red', needsToResearch: true, megacredits: 10, steel: 0, titanium: 0, plants: 0, energy: 4, heat: 2, ...(over.stock ?? {})},
    players: [{color: 'red', name: 'Я'}],
    productionIncome: over.income,
    waitingFor: undefined,
  } as unknown as PlayerViewModel;
}

describe('the generation scene — the pure half (TR61)', () => {
  beforeEach(() => {
    resetGenerationScene();
    resetRailRewards();
  });
  after(() => {
    resetGenerationScene();
    resetRailRewards();
  });

  it('detects the scene off the record, claims it ONCE, and never off a fresh load', () => {
    const next = view({income: record()});
    expect(detectGenerationScene(undefined, next), 'a fresh load claims and plays nothing').is.undefined;
    expect(detectGenerationScene(view({generation: 1, phase: Phase.ACTION}), next), 'the same record again — seen').is.undefined;
    resetGenerationScene();
    const event = detectGenerationScene(view({generation: 1, phase: Phase.ACTION}), next);
    expect(event).to.deep.include({color: 'red', generation: 2, flipTo: 2});
    expect(armedGenerationScene()).eq(event);
    expect(detectGenerationScene(view({generation: 1, phase: Phase.ACTION}), next), 'claimed').is.undefined;
    expect(detectGenerationScene(view({generation: 2}), view({income: record({generation: 3}), generation: 3})), 'a running scene refuses a second').is.undefined;
  });

  it('no record, no scene: a rival\'s production, an old save', () => {
    expect(detectGenerationScene(view({generation: 1}), view({}))).is.undefined;
  });

  it('the flip beat: no generation advance in this response (a sitting stands between) — no flip, no wait; a flip settles on the strip\'s signal', async () => {
    const still = detectGenerationScene(view({generation: 2, phase: Phase.ACTION}), view({generation: 2, phase: Phase.PARLIAMENT, income: record()}))!;
    expect(still.flipTo).is.undefined;
    const displayed = view({generation: 2});
    await runGenerationFlip(still, displayed);
    expect(generationSceneState.phase).eq('flip');
    expect(displayed.game.generation).eq(2);
    endGenerationScene('test');
    expect(generationSceneState.phase).eq('idle');

    resetGenerationScene();
    const flips = detectGenerationScene(view({generation: 1}), view({generation: 2, income: record()}))!;
    const shown = view({generation: 1});
    let settled = false;
    const beat = runGenerationFlip(flips, shown).then(() => {
      settled = true;
    });
    expect(shown.game.generation, 'the displayed view flips NOW — the strip reads it').eq(2);
    expect(isAnimationHoldActive(), 'the scene holds the foreground from its first beat').is.true;
    await Promise.resolve();
    expect(settled, 'nothing settles before the strip says so').is.false;
    noteGenerationFlipEnd(1);
    await Promise.resolve();
    expect(settled, 'an older readout\'s end is not this flip').is.false;
    noteGenerationFlipEnd(2);
    await beat;
    expect(settled).is.true;
    endGenerationScene('test');
  });

  it('the promise to the rail: one token per production value, the rating apart; the conversion and a negative production are known moves', () => {
    const reward = generationIncomeReward(record({income: {megacredits: -2, steel: 2, titanium: 0, plants: 1, energy: 3, heat: 0}}));
    expect(reward.cause.map((s) => `${s.resource}:${s.amount}`)).deep.eq(['megacredits:21', 'steel:2', 'plants:1', 'energy:3']);
    expect(reward.reactions).deep.eq([]);
    expect(reward.known).deep.eq({'stock:megacredits': -2, 'stock:energy': -4, 'stock:heat': 4});
    const plain = generationIncomeReward(record({rating: 0, conversion: 0}));
    expect(plain.cause.map((s) => `${s.resource}:${s.amount}`)).deep.eq(['megacredits:5', 'steel:2', 'plants:1', 'energy:3']);
    expect(plain.known).deep.eq({});
  });

  it('the seed holds the rail only against a diff that keeps the promise, and only while a scene is armed', () => {
    expect(seedGenerationIncomeHold(view({}), view({})), 'nothing armed').is.false;
    const before = view({generation: 1, phase: Phase.ACTION, stock: {megacredits: 10, steel: 0, plants: 0, energy: 4, heat: 2}});
    const after = view({generation: 2, income: record(), stock: {megacredits: 10 + 21 + 5, steel: 2, plants: 1, energy: 3, heat: 2 + 4}});
    expect(detectGenerationScene(before, after)).is.not.undefined;
    const held = seedGenerationIncomeHold(before, after);
    // Under the server runner there is no DOM, but the seed is pure: it either holds (reduced motion off) or refuses.
    expect(held).eq(railRewardPending(GENERATION_INCOME_KEY));
    expect(generationSceneState.phase).eq('income');
    endGenerationScene('test');
    expect(railRewardPending(GENERATION_INCOME_KEY), 'an interrupt releases every held row').is.false;
    expect(generationSceneState.phase).eq('idle');
    expect(generationSceneState.lastEnd).eq('test');
  });

  // R07 Pristar: a card's own production hook pays INSIDE the phase, and the record names it (`hooks`) — the wave
  // carries it as its own token AFTER the income instead of refusing the whole M€ row (PL-607, every generation).
  it('a hook the record names rides the wave after the income — a token per resource paid, a payment taken back is known', () => {
    const reward = generationIncomeReward(record({
      hooks: [
        {card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6}},
        {card: CardName.SOLBANK, income: {...Units.EMPTY, megacredits: 2, heat: -1}},
      ],
    }));
    expect(reward.cause.map((s) => `${s.resource}:${s.amount}`)).deep.eq([
      'megacredits:21', 'megacredits:5', 'steel:2', 'plants:1', 'energy:3', 'megacredits:6', 'megacredits:2',
    ]);
    expect(reward.known).deep.eq({'stock:energy': -4, 'stock:heat': 4 - 1});
  });

  it('a hook the record names keeps the promise against the applied views — nothing refused', () => {
    const income = record({hooks: [{card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6}}]});
    const before = view({generation: 1, phase: Phase.ACTION, stock: {megacredits: 10, steel: 0, plants: 0, energy: 4, heat: 2}});
    const after = view({generation: 2, income, stock: {megacredits: 10 + 21 + 5 + 6, steel: 2, plants: 1, energy: 3, heat: 2 + 4}});
    const verdict = verifyRailReward(generationIncomeReward(income), before, after);
    expect(verdict.mismatches).deep.eq([]);
    expect(verdict.cause.map((s) => `${s.resource}:${s.amount}`)).to.include('megacredits:6');
    // …and the SAME payment unnamed is the old refusal: the M€ row disagrees, nothing of the cause is held.
    expect(verifyRailReward(generationIncomeReward(record()), before, after).cause).deep.eq([]);
  });

  it('a diff that breaks the promise (a hook paid something else) holds nothing — the counters tick with the commit, the scene still runs', () => {
    const before = view({generation: 1, phase: Phase.ACTION, stock: {megacredits: 10}});
    const after = view({generation: 2, income: record(), stock: {megacredits: 99}});
    expect(detectGenerationScene(before, after)).is.not.undefined;
    expect(seedGenerationIncomeHold(before, after)).is.false;
    expect(railRewardPending(GENERATION_INCOME_KEY)).is.false;
    expect(generationSceneState.phase).eq('income');
    endGenerationScene('test');
  });
});
