import {expect} from 'chai';
import {flushPromises} from '@vue/test-utils';
import {
  armBonusGainClaim, awaitVisibleBonusGainSource, bonusGainDestinationSelectors, bonusGainRewardState, bonusGainSourceSelectors, bonusGainSpec,
  consumeBonusGainReward, detectBonusGainAutoResolve, noteBonusGainRows, noteBonusGainStageEntering, pendingBonusGainRows,
  resetBonusGainReward, seedBonusGainRewardHold,
} from '@/client/console/startBonusGain';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {BonusGainRow} from '@/client/console/bonusAction';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';

/**
 * THE «ФОРА» GAIN REWARD BEAT — the two moments its steel and M€ can arrive,
 * and the arithmetic that has to agree with `Player.bonusGainAmount` exactly.
 */
const STEEL: BonusGainRow = {resource: 'steel', amount: 2, index: 1};
const mcRow = (per: number, amount: number): BonusGainRow =>
  ({resource: 'megacredits', amount, index: 2, perCardInHand: per});

function view(opts: {
  bonus?: number,
  hand?: number,
  gains?: ReadonlyArray<BonusGainRow>,
  marked?: boolean,
  source?: string,
} = {}): PlayerViewModel {
  const marked = opts.marked ?? opts.gains !== undefined;
  return {
    thisPlayer: {
      bonusActions: opts.bonus ?? 0,
      bonusActionSource: opts.source,
    },
    cardsInHand: new Array(opts.hand ?? 0).fill(0).map((_, i) => ({name: `card-${i}`})),
    waitingFor: marked ? {
      type: 'or',
      title: 'Take your next action',
      options: [],
      bonusActionPrompt: {
        source: opts.source ?? CardName.HEAD_START,
        remaining: opts.bonus ?? 1,
        granted: 2,
        gains: opts.gains,
      },
    } : undefined,
  } as unknown as PlayerViewModel;
}

describe('startBonusGain (the «Фора» gain reward beat)', () => {
  afterEach(() => {
    // Module state is BUNDLE-SHARED: a leaked hold would make every later spec
    // read the panel short by N.
    resetBonusGainReward();
    clearPanelRewardHold();
  });

  it('remembers the pending rows ONLY from a view that states them', () => {
    noteBonusGainRows(view({bonus: 2, gains: [STEEL, mcRow(2, 6)]}));
    expect(pendingBonusGainRows()).to.have.length(2);
    // A payment / placement INSIDE a bonus action carries no marker — reading
    // it as «nothing is pending» would forget the set halfway through the very
    // action whose end resolves it.
    noteBonusGainRows(view({bonus: 2, marked: false}));
    expect(pendingBonusGainRows(), 'the unmarked prompt changed nothing').to.have.length(2);
    // …but an EMPTY list on a MARKED prompt is real information.
    noteBonusGainRows(view({bonus: 1, gains: []}));
    expect(pendingBonusGainRows()).to.have.length(0);
  });

  describe('the auto-resolve at the window\'s end', () => {
    it('fires only on the ledger\'s falling edge', () => {
      const pending = {rows: [STEEL], source: CardName.HEAD_START};
      expect(detectBonusGainAutoResolve(view({bonus: 2}), view({bonus: 1, hand: 3}), pending),
        'the window is still open').to.eq(undefined);
      expect(detectBonusGainAutoResolve(undefined, view({hand: 3}), pending),
        'no before-view (a fresh load) is not a falling edge').to.eq(undefined);
      const closed = detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 3}), pending);
      expect(closed?.kind).to.eq('auto');
      expect(closed?.specs).to.deep.eq([{channel: 'stock', resource: 'steel', amount: 2}]);
      expect(closed?.source).to.eq(CardName.HEAD_START);
    });

    it('reads the M€ off the COMMITTED hand — the server\'s own arithmetic', () => {
      // `Player.bonusGainAmount`: perCardInHand × the hand AS IT STANDS. The
      // older prompt said 6 (3 cards); the player then PLAYED one with their
      // last bonus action, so what actually arrives is 4.
      const pending = {rows: [mcRow(2, 6)], source: CardName.HEAD_START};
      const reward = detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 2}), pending);
      expect(reward?.specs).to.deep.eq([{channel: 'stock', resource: 'megacredits', amount: 4}]);
    });

    it('an empty hand grants nothing, so there is nothing to fly', () => {
      const pending = {rows: [mcRow(2, 6)], source: CardName.HEAD_START};
      expect(detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 0}), pending)).to.eq(undefined);
    });

    it('nothing pending → no beat (the player claimed both early)', () => {
      const pending = {rows: [], source: CardName.HEAD_START};
      expect(detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 3}), pending)).to.eq(undefined);
    });
  });

  describe('the commit seed', () => {
    it('a CLAIM holds the panel for exactly its own amount, and owes the flight', () => {
      armBonusGainClaim(STEEL, CardName.HEAD_START, {x: 10, y: 20});
      seedBonusGainRewardHold(view({bonus: 2, gains: [STEEL]}), view({bonus: 2, hand: 3, gains: []}));
      expect(heldStock('steel'), 'the panel shows committed − held until the touchdown').to.eq(2);
      const owed = bonusGainRewardState.owed;
      expect(owed?.kind).to.eq('claim');
      expect(owed?.point, 'the pressed row\'s own centre, captured before it unmounted')
        .to.deep.eq({x: 10, y: 20});
      // …and it is handed over exactly once.
      expect(consumeBonusGainReward()).to.eq(owed);
      expect(bonusGainRewardState.owed).to.eq(undefined);
      expect(consumeBonusGainReward()).to.eq(undefined);
    });

    it('a claim ANSWERED BY THE CLOSING RESPONSE never pays twice', () => {
      // The player claims on the same press that spends the last action: the
      // auto-resolve is what actually pays, and holding the claim's amount as
      // well would leave the panel short by it.
      noteBonusGainRows(view({bonus: 1, gains: [STEEL]}));
      armBonusGainClaim(STEEL, CardName.HEAD_START, {x: 1, y: 1});
      seedBonusGainRewardHold(view({bonus: 1}), view({hand: 1}));
      expect(bonusGainRewardState.owed?.kind).to.eq('auto');
      expect(heldStock('steel')).to.eq(2);
      expect(bonusGainRewardState.owed?.specs).to.have.length(1);
    });

    it('the window\'s end CLEARS the pending set — one payout, once', () => {
      noteBonusGainRows(view({bonus: 1, gains: [STEEL]}));
      seedBonusGainRewardHold(view({bonus: 1}), view({hand: 1}));
      expect(pendingBonusGainRows()).to.have.length(0);
      consumeBonusGainReward();
      // A second commit past the closed window owes nothing.
      seedBonusGainRewardHold(view({bonus: 0}), view({hand: 1}));
      expect(bonusGainRewardState.owed).to.eq(undefined);
    });

    it('an ordinary response owes nothing at all', () => {
      seedBonusGainRewardHold(view({bonus: 0}), view({bonus: 0, hand: 4}));
      expect(bonusGainRewardState.owed).to.eq(undefined);
      expect(heldStock('steel')).to.eq(0);
    });
  });

  it('the auto-resolve emerges from the CARD, in the order it can be standing', () => {
    const sel = bonusGainSourceSelectors(CardName.HEAD_START);
    // The window is over, so the granting card is back in «РАЗЫГРАНО» — the
    // workspace's own shelf leads, the stage seat follows for the case where a
    // panel is still holding the card in its source column.
    expect(sel[0]).to.contain('.con-start__played');
    expect(sel[0]).to.contain(CardName.HEAD_START);
    expect(sel).to.contain('[data-embed-source-slot]');
    // No source named (a reload wiped it): the seat is the only honest guess.
    expect(bonusGainSourceSelectors(undefined)).to.deep.eq(['[data-embed-source-slot]']);
  });

  it('a spec is a whole, positive number of units on the STOCK channel', () => {
    expect(bonusGainSpec('steel', 2)).to.deep.eq({channel: 'stock', resource: 'steel', amount: 2});
    expect(bonusGainSpec('megacredits', -3).amount, 'the framework moves GAINS only').to.eq(0);
    expect(bonusGainSpec('megacredits', 4.6).amount).to.eq(5);
  });
});

describe('startBonusGain · the wave waits for its source to be SEEN', () => {
  it('resolves false at once when there is nothing to look for', async () => {
    expect(await awaitVisibleBonusGainSource([], 50)).to.eq(false);
  });

  it('resolves false at once when the scene is gone, never polling a dead stage', async () => {
    let asked = 0;
    const started = Date.now();
    const seen = await awaitVisibleBonusGainSource(['.nothing-here'], 5_000, () => {
      asked++;
      return false;
    });
    expect(seen).to.eq(false);
    expect(asked, 'alive is asked at most once — never a poll of a dead stage').to.be.at.most(1);
    expect(Date.now() - started, 'no wait for a stage that is gone').to.be.lessThan(1_000);
  });

  it('gives up at its own deadline — the caller flies anyway and the gain degrades as before', async () => {
    const started = Date.now();
    expect(await awaitVisibleBonusGainSource(['.con-start__played [data-played-key="Head Start"]'], 120)).to.eq(false);
    expect(Date.now() - started, 'bounded').to.be.lessThan(2_000);
  });
});

/*
 * FLAKE ZERO Ф4 (class N) — the two waits of the «Фора» beat count from their EVENT, never from the ask / the commit:
 * the source wait from the last moment the card was still coming in (its entrance running or pending on a slow frame),
 * the hold's backstop from the start scene's entrance. Counted from the ask / the commit, both ran out on a 300 ms
 * frame and the gain ticked with no token.
 */
describe('startBonusGain · the waits count from their event', () => {
  let clock: ManualFlowClock;
  let shelf: HTMLElement | undefined;
  const originalFromPoint = document.elementsFromPoint;
  const originalGetAnimations = (document as unknown as {getAnimations?: unknown}).getAnimations;
  let entrance: Array<unknown> = [];

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
    Object.defineProperty(window, 'innerHeight', {value: 1080, configurable: true});
    document.elementsFromPoint = () => [];
    entrance = [];
    (document as unknown as {getAnimations: () => Array<unknown>}).getAnimations = () => entrance;
  });
  afterEach(() => {
    shelf?.remove();
    shelf = undefined;
    document.elementsFromPoint = originalFromPoint;
    (document as unknown as {getAnimations?: unknown}).getAnimations = originalGetAnimations;
    resetBonusGainReward();
    clearPanelRewardHold();
    setFlowClock(undefined);
  });

  /** «РАЗЫГРАНО» fading in: the shelf at opacity 0 under its entrance, the granting card on its hook inside it. */
  function fadingShelf(): HTMLElement {
    shelf = document.createElement('div');
    shelf.className = 'con-start__played';
    shelf.style.opacity = '0';
    const card = document.createElement('div');
    card.setAttribute('data-played-key', CardName.HEAD_START);
    card.getBoundingClientRect = () => ({left: 400, top: 300, width: 160, height: 230, right: 560, bottom: 530, x: 400, y: 300, toJSON: () => ({})}) as DOMRect;
    shelf.appendChild(card);
    document.body.appendChild(shelf);
    entrance = [{playState: 'running', pending: false, effect: {getComputedTiming: () => ({endTime: 300}), target: shelf}}];
    return shelf;
  }
  const step = async (ms: number) => {
    for (let left = ms; left > 0; left -= 50) {
      clock.advance(Math.min(50, left));
      await flushPromises();
    }
  };

  it('the source wait goes on while the card is still COMING IN — past the old 1.2 s — and the wave flies out of it', async () => {
    const fading = fadingShelf();
    let seen: boolean | undefined;
    void awaitVisibleBonusGainSource(bonusGainSourceSelectors(CardName.HEAD_START)).then((v) => {
      seen = v;
    });
    // A starved frame: the shelf's entrance stands pending / running for 2.5 s.
    await step(2_500);
    expect(seen, 'the card is still coming in — the wave waits for it').to.eq(undefined);
    fading.style.opacity = '1';
    entrance = [];
    await step(100);
    expect(seen, 'the card is SEEN — the wave flies out of it').to.eq(true);
  });

  it('…and a card that is faded and NOT moving degrades at the budget, as before', async () => {
    fadingShelf();
    entrance = [];
    let seen: boolean | undefined;
    void awaitVisibleBonusGainSource(bonusGainSourceSelectors(CardName.HEAD_START)).then((v) => {
      seen = v;
    });
    await step(1_300);
    expect(seen).to.eq(false);
  });

  /** The player rail RE-ENTERING (CI 43884064237): `.con-res` at opacity 0 under its entrance, the M€ row inside it. */
  let rail: HTMLElement | undefined;
  afterEach(() => {
    rail?.remove();
    rail = undefined;
  });
  function enteringRail(): HTMLElement {
    rail = document.createElement('aside');
    rail.className = 'con-res';
    rail.style.opacity = '0';
    const row = document.createElement('div');
    row.className = 'con-res__row con-res__row--megacredits';
    row.getBoundingClientRect = () => ({left: 20, top: 400, width: 200, height: 40, right: 220, bottom: 440, x: 20, y: 400, toJSON: () => ({})}) as DOMRect;
    rail.appendChild(row);
    document.body.appendChild(rail);
    return rail;
  }

  it('the wave waits for its LANDING too — a rail still coming in is no end, and the wave flies once both are painted', async () => {
    const fading = fadingShelf();
    fading.style.opacity = '1';
    const entering = enteringRail();
    entrance = [{playState: 'running', pending: false, effect: {getComputedTiming: () => ({endTime: 480}), target: entering}}];
    let seen: boolean | undefined;
    void awaitVisibleBonusGainSource(bonusGainSourceSelectors(CardName.HEAD_START), undefined, () => true,
      bonusGainDestinationSelectors([bonusGainSpec('megacredits', 6)])).then((v) => {
      seen = v;
    });
    // The card stands, the rail is still entering on a starved frame — past the budget the wave would have had.
    await step(2_000);
    expect(seen, 'the landing is still coming in — the wave waits for it').to.eq(undefined);
    entering.style.opacity = '1';
    entrance = [];
    await step(100);
    expect(seen, 'both ends are SEEN — the wave flies').to.eq(true);
  });

  it('…a landing that is unpainted and NOT coming in degrades at the budget, as before', async () => {
    fadingShelf().style.opacity = '1';
    enteringRail();
    entrance = [];
    let seen: boolean | undefined;
    void awaitVisibleBonusGainSource(bonusGainSourceSelectors(CardName.HEAD_START), undefined, () => true,
      bonusGainDestinationSelectors([bonusGainSpec('megacredits', 6)])).then((v) => {
      seen = v;
    });
    await step(1_300);
    expect(seen).to.eq(false);
  });

  it('the hold\'s backstop counts from the scene\'s ENTRANCE — the surface that comes back gets the whole budget', () => {
    armBonusGainClaim(STEEL, CardName.HEAD_START, {x: 10, y: 20});
    seedBonusGainRewardHold(view({bonus: 2, gains: [STEEL]}), view({bonus: 2, hand: 3, gains: []}));
    expect(bonusGainRewardState.owed, 'a wave is owed').to.not.eq(undefined);
    clock.advance(5_000);
    noteBonusGainStageEntering(); // the start scene mounts: its entrance, its ceremony still revealing
    clock.advance(5_000);
    expect(bonusGainRewardState.owed, 'the entrance still has the time to fly it').to.not.eq(undefined);
    expect(heldStock('steel'), 'the panel still holds the gain for its token').to.eq(2);
    clock.advance(1_100);
    expect(bonusGainRewardState.owed, 'no surface flew it — the backstop lets go').to.eq(undefined);
  });
});
