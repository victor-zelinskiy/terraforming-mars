import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ProductionIncomeModel} from '@/common/models/ProductionIncomeModel';
import {
  detectGenerationScene, generationIncomeReward, generationSceneState, noteGenerationFlipEnd, resetGenerationScene, runGenerationFlip,
  endGenerationScene, armedGenerationScene, seedGenerationIncomeHold, GENERATION_INCOME_KEY, incomeHookOf,
  registerGenerationSceneHandoff, runGenerationIncomeFlights,
} from '@/client/console/generationScene/generationScene';
import {reactive} from 'vue';
import {railRewardPending, resetRailRewards, verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {CardResource} from '@/common/CardResource';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';

/**
 * THE GENERATION CHANGE IS ONE SCENE (TR61) — the pure half: the scene is
 * detected off the SERVER'S RECORD of the phase (never a diff), claimed once
 * per seat and generation, its flip beat settles on the strip's own signal,
 * its promise to the rail is a card hook's payment read as tokens (the
 * standard income — the rating, the production, the conversion — ticks with
 * the commit as known moves), it holds the foreground from the first beat and
 * lets go on an interrupt.
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

  // The owner, 2026-10-26: the standard income does not fly (a fan of chips off every badge overloaded the beat) —
  // every row ticks with the commit through its own delta chip; the rating, the production, the conversion are KNOWN.
  it('the standard income is KNOWN, never a token: the rating, every production value, the conversion', () => {
    const reward = generationIncomeReward(record({income: {megacredits: -2, steel: 2, titanium: 0, plants: 1, energy: 3, heat: 0}}));
    expect(reward.cause).deep.eq([]);
    expect(reward.reactions).deep.eq([]);
    expect(reward.known).deep.eq({'stock:megacredits': 21 - 2, 'stock:steel': 2, 'stock:plants': 1, 'stock:energy': 3 - 4, 'stock:heat': 4});
    expect(reward.vp).is.undefined;
  });

  it('a scene with no hook holds nothing — the counters tick with the commit, the scene still runs', () => {
    expect(seedGenerationIncomeHold(view({}), view({})), 'nothing armed').is.false;
    const before = view({generation: 1, phase: Phase.ACTION, stock: {megacredits: 10, steel: 0, plants: 0, energy: 4, heat: 2}});
    const after = view({generation: 2, income: record(), stock: {megacredits: 10 + 21 + 5, steel: 2, plants: 1, energy: 3, heat: 2 + 4}});
    expect(detectGenerationScene(before, after)).is.not.undefined;
    expect(seedGenerationIncomeHold(before, after)).is.false;
    expect(railRewardPending(GENERATION_INCOME_KEY)).is.false;
    expect(generationSceneState.phase).eq('income');
    endGenerationScene('test');
    expect(generationSceneState.phase).eq('idle');
    expect(generationSceneState.lastEnd).eq('test');
  });

  // R07 Pristar: a card's own production hook pays INSIDE the phase, and the record names it (`hooks`) — its payment
  // is the beat's one flight; a payment taken back is known.
  it('a hook the record names is the only token — a token per resource paid, a payment taken back is known', () => {
    const reward = generationIncomeReward(record({
      hooks: [
        {card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6}},
        {card: CardName.SOLBANK, income: {...Units.EMPTY, megacredits: 2, heat: -1}},
      ],
    }));
    expect(reward.cause.map((s) => `${s.resource}:${s.amount}`)).deep.eq(['megacredits:6', 'megacredits:2']);
    expect(reward.known).deep.eq({'stock:megacredits': 21 + 5, 'stock:steel': 2, 'stock:plants': 1, 'stock:energy': 3 - 4, 'stock:heat': 4 - 1});
  });

  // The flight asks with the registry's spec — a reactive Proxy. Asked by identity on the Proxy, no hook token ever
  // found its mark (PL-982).
  it('the card a token is born on is read off the RAW spec, through the registry Proxy', () => {
    const reward = generationIncomeReward(record({hooks: [{card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6}}]}));
    const held = reactive({cause: [...reward.cause]}).cause;
    expect(incomeHookOf(held[0])).eq(CardName.PRISTAR);
    expect(incomeHookOf({channel: 'stock', resource: 'megacredits', amount: 6})).is.undefined;
  });

  it('a hook that laid a resource on its OWN card flies it too — onto the card, with the points it brings', () => {
    const income = record({hooks: [{
      card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6},
      cardResources: {resource: CardResource.PRESERVATION, amount: 1, vp: 1},
    }]});
    const reward = generationIncomeReward(income);
    expect(reward.cause).deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 6},
      {channel: 'card-resource', resource: 'preservation', amount: 1, targetCard: CardName.PRISTAR},
    ]);
    expect(reward.vp).deep.eq([0, 1]);
    expect(incomeHookOf(reward.cause[1])).eq(CardName.PRISTAR);
    // Checked against the views: the M€ row, the card's counter and the score moved by exactly what the record says.
    const before = view({generation: 1, phase: Phase.ACTION, stock: {megacredits: 10, steel: 0, plants: 0, energy: 4, heat: 2}});
    const after = view({generation: 2, income, stock: {megacredits: 10 + 21 + 5 + 6, steel: 2, plants: 1, energy: 3, heat: 2 + 4}});
    (before.thisPlayer as unknown as Record<string, unknown>).tableau = [{name: CardName.PRISTAR, resources: 0}];
    (after.thisPlayer as unknown as Record<string, unknown>).tableau = [{name: CardName.PRISTAR, resources: 1}];
    (before.thisPlayer as unknown as Record<string, unknown>).victoryPointsBreakdown = {total: 20};
    (after.thisPlayer as unknown as Record<string, unknown>).victoryPointsBreakdown = {total: 21};
    const verdict = verifyRailReward(reward, before, after);
    expect(verdict.mismatches).deep.eq([]);
    expect(verdict.vp).deep.eq([0, 1]);
  });

  it('a hook the record names keeps the promise against the applied views — the seed holds its token only', () => {
    const income = record({hooks: [{card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6}}]});
    const before = view({generation: 1, phase: Phase.ACTION, stock: {megacredits: 10, steel: 0, plants: 0, energy: 4, heat: 2}});
    const after = view({generation: 2, income, stock: {megacredits: 10 + 21 + 5 + 6, steel: 2, plants: 1, energy: 3, heat: 2 + 4}});
    const verdict = verifyRailReward(generationIncomeReward(income), before, after);
    expect(verdict.mismatches).deep.eq([]);
    expect(verdict.cause.map((s) => `${s.resource}:${s.amount}`)).deep.eq(['megacredits:6']);
    expect(detectGenerationScene(before, after)).is.not.undefined;
    // Under the server runner there is no DOM, but the seed is pure: it either holds (reduced motion off) or refuses.
    const held = seedGenerationIncomeHold(before, after);
    expect(held).eq(railRewardPending(GENERATION_INCOME_KEY));
    endGenerationScene('test');
    expect(railRewardPending(GENERATION_INCOME_KEY), 'an interrupt releases every held row').is.false;
  });

  it('a diff that breaks the promise (a hook paid something it did not name) holds nothing — the counters tick with the commit', () => {
    const income = record({hooks: [{card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6}}]});
    const before = view({generation: 1, phase: Phase.ACTION, stock: {megacredits: 10}});
    const after = view({generation: 2, income, stock: {megacredits: 99}});
    expect(detectGenerationScene(before, after)).is.not.undefined;
    expect(seedGenerationIncomeHold(before, after)).is.false;
    expect(railRewardPending(GENERATION_INCOME_KEY)).is.false;
    expect(generationSceneState.phase).eq('income');
    endGenerationScene('test');
  });

  /*
   * STATE DELIVERY (2026-10-28): beat 4 — the RISE into the sitting / the draft — waits for the SCREEN HANDOFF the
   * shell injects (a card still flying into the dock, a reveal not taken): the scene keeps its hold through the wait,
   * an interrupted scene rises nothing, and with no director registered (tests, a dead shell) the rise is immediate.
   */
  describe('the rise waits for the screen handoff (injected)', () => {
    afterEach(() => registerGenerationSceneHandoff(undefined));

    it('holds the foreground in «rise» until the director hands the screen over, then concludes', async () => {
      let release: (() => void) | undefined;
      const asked: Array<string> = [];
      registerGenerationSceneHandoff((id) => new Promise<void>((resolve) => {
        asked.push(id);
        release = resolve;
      }));
      const before = view({generation: 1, phase: Phase.ACTION});
      const after = view({generation: 2, phase: Phase.ACTION, income: record()});
      expect(detectGenerationScene(before, after)).is.not.undefined;
      let concluded = false;
      const run = runGenerationIncomeFlights(() => after).then(() => {
        concluded = true;
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(asked).deep.eq(['generation-rise']);
      expect(generationSceneState.phase, 'the scene stands in «rise» while the screen is owed').eq('rise');
      expect(isAnimationHoldActive(), 'and keeps its own hold through the wait').is.true;
      expect(concluded).is.false;
      release!();
      await run;
      expect(concluded).is.true;
      expect(generationSceneState.phase).eq('idle');
      expect(isAnimationHoldActive()).is.false;
    });

    it('a scene interrupted during the wait rises nothing', async () => {
      let release: (() => void) | undefined;
      registerGenerationSceneHandoff(() => new Promise<void>((resolve) => {
        release = resolve;
      }));
      const after = view({generation: 2, phase: Phase.ACTION, income: record()});
      expect(detectGenerationScene(view({generation: 1, phase: Phase.ACTION}), after)).is.not.undefined;
      const run = runGenerationIncomeFlights(() => after);
      await Promise.resolve();
      await Promise.resolve();
      endGenerationScene('interrupted');
      release!();
      await run;
      expect(generationSceneState.lastEnd, 'the interrupt is the scene end, never the conclusion').eq('interrupted');
      expect(generationSceneState.rose).eq('');
    });

    it('with no director registered the rise is immediate', async () => {
      const after = view({generation: 2, phase: Phase.ACTION, income: record()});
      expect(detectGenerationScene(view({generation: 1, phase: Phase.ACTION}), after)).is.not.undefined;
      await runGenerationIncomeFlights(() => after);
      expect(generationSceneState.phase).eq('idle');
      expect(generationSceneState.lastEnd).eq('concluded');
    });
  });
});
