import {expect} from 'chai';
import {
  AVAILABILITY_BLOCKERS,
  blockerCodeForReasonType,
  blockerForReason,
  blockersForReasons,
  executableNow,
  potentiallyAvailable,
  primaryBlocker,
  primaryReason,
  turnGateBlocker,
} from '@/common/availability/AvailabilityBlocker';
import {actionStatusBlocker} from '@/client/components/actions/actionPlayability';
import {computeHandCardPlayState} from '@/client/components/handCards/cardPlayability';
import {wheelPotentialCounts} from '@/client/console/potentialAvailability';
import {UnplayableReason, UnplayableReasonType} from '@/common/cards/UnplayableReason';
import {CardModel} from '@/common/models/CardModel';
import {PotentialActionsModel} from '@/common/models/PotentialActionsModel';

/*
 * POTENTIAL AVAILABILITY vs EXECUTABLE NOW — the whole console's shared answer
 * to «нельзя», guarded here without a DOM (pure, so it also runs under the
 * server runner).
 *
 * The defect this family exists to prevent: «Сейчас не ваш ход» was treated as
 * an ordinary unavailability reason, so a perfectly legal card / action / trade
 * / track advance went RED and its green wheel count vanished — the interface
 * describing the clock instead of the position, and telling the player their
 * card was wrong when nothing about it was.
 */
describe('availability blockers (potential vs executable now)', () => {
  const TURN: UnplayableReason = {type: 'turn', message: 'Not your turn right now'};
  const PHASE: UnplayableReason = {type: 'phase', message: 'Finish your current action first'};
  const TAG: UnplayableReason = {type: 'tag', message: 'Requires ${0} tag(s)', params: ['3'], requirement: true};
  const COST: UnplayableReason = {type: 'megacredits', message: 'Need ${0} more M€', params: ['4']};

  describe('the structured semantics', () => {
    it('the turn gates block execution but NOT the potential count, and are calm', () => {
      for (const gate of [AVAILABILITY_BLOCKERS.NOT_YOUR_TURN, AVAILABILITY_BLOCKERS.FINISH_CURRENT_ACTION, AVAILABILITY_BLOCKERS.EXECUTION_GATE]) {
        expect(gate.blocksExecutionNow, gate.code).to.eq(true);
        expect(gate.affectsPotentialCount, gate.code).to.eq(false);
        expect(gate.tone, gate.code).to.eq('warning');
      }
    });

    it('a domain blocker does both, and is the danger register', () => {
      expect(AVAILABILITY_BLOCKERS.DOMAIN).to.deep.eq({
        code: 'DOMAIN', blocksExecutionNow: true, affectsPotentialCount: true, tone: 'danger',
      });
    });

    /*
     * The classification is STRUCTURAL (cross-cutting invariant 1: i18n mutates
     * a message in place, so a text match silently stops matching). `turn` and
     * `phase` are the only two types the CLIENT adds to describe the window;
     * everything the server produces is by construction about the card.
     */
    it('classifies by reason TYPE — every server-produced type is a domain reason', () => {
      expect(blockerCodeForReasonType('turn')).to.eq('NOT_YOUR_TURN');
      expect(blockerCodeForReasonType('phase')).to.eq('FINISH_CURRENT_ACTION');
      const serverTypes: ReadonlyArray<UnplayableReasonType> = [
        'megacredits', 'resource', 'globalParameter', 'tr', 'tag', 'production',
        'count', 'party', 'placement', 'target', 'rule', 'generic',
      ];
      for (const type of serverTypes) {
        expect(blockerCodeForReasonType(type), type).to.eq('DOMAIN');
      }
    });

    it('turnGateBlocker discriminates «finish your action» from «not your turn»', () => {
      expect(turnGateBlocker(true).code).to.eq('FINISH_CURRENT_ACTION');
      expect(turnGateBlocker(false).code).to.eq('NOT_YOUR_TURN');
    });
  });

  describe('the two derivations', () => {
    it('nothing blocking → available on both axes', () => {
      expect(potentiallyAvailable([])).to.eq(true);
      expect(executableNow([])).to.eq(true);
    });

    it('ONLY the turn gate → potentially available, but never executable', () => {
      const blockers = blockersForReasons([TURN]);
      expect(potentiallyAvailable(blockers)).to.eq(true);
      expect(executableNow(blockers)).to.eq(false);
    });

    it('a real rule blocker → neither', () => {
      const blockers = blockersForReasons([TAG]);
      expect(potentiallyAvailable(blockers)).to.eq(false);
      expect(executableNow(blockers)).to.eq(false);
    });

    /* MIXED CAUSES — the priority rule. */
    it('a domain reason OUTRANKS the turn gate and is the one shown', () => {
      const mixed = [TURN, TAG, COST];
      expect(potentiallyAvailable(blockersForReasons(mixed)), 'a real blocker removes it from the count').to.eq(false);
      expect(primaryBlocker(blockersForReasons(mixed))?.code).to.eq('DOMAIN');
      // «Сейчас не ваш ход» must never mask the more useful line.
      expect(primaryReason(mixed)).to.eq(TAG);
    });

    it('…and among domain reasons the producer\'s own order wins', () => {
      expect(primaryReason([COST, TAG])).to.eq(COST);
    });

    it('the turn gate speaks only when it is alone', () => {
      expect(primaryReason([PHASE])).to.eq(PHASE);
      expect(primaryBlocker(blockersForReasons([PHASE]))?.code).to.eq('FINISH_CURRENT_ACTION');
    });
  });

  /*
   * THE HAND: the three-state model already separated 'soft' from 'rules'; what
   * matters here is that the separation survives as the shared semantics, so
   * the shelf paints one register and the wheel counts the other.
   */
  describe('hand cards', () => {
    const card = (reasons?: ReadonlyArray<UnplayableReason>) => ({unplayableReasons: reasons} as CardModel);

    it('an opponent\'s turn leaves a legal card POTENTIALLY playable', () => {
      const state = computeHandCardPlayState(card(), false, false, false);
      expect(state.block).to.eq('soft');
      expect(state.playable, 'the press is still refused').to.eq(false);
      expect(potentiallyAvailable(blockersForReasons(card().unplayableReasons ?? []))).to.eq(true);
      expect(blockerForReason(state.softReason as UnplayableReason).tone).to.eq('warning');
    });

    it('mid a mandatory decision it is the OTHER gate, still calm', () => {
      const state = computeHandCardPlayState(card(), false, false, true);
      expect(state.softReason?.type).to.eq('phase');
      expect(blockerForReason(state.softReason as UnplayableReason).code).to.eq('FINISH_CURRENT_ACTION');
    });

    it('a card that also lacks a tag stays a RULES block off-turn', () => {
      const state = computeHandCardPlayState(card([TAG]), false, false, false);
      expect(state.block).to.eq('rules');
      expect(state.reasons).to.deep.eq([TAG]);
      expect(potentiallyAvailable(blockersForReasons(state.reasons))).to.eq(false);
    });
  });

  /*
   * CARD ACTIONS: `soft` is by definition «the rules are fine, the moment is
   * not»; `activated` is a domain fact (spent for this generation — no change
   * of turn brings it back).
   */
  describe('card actions', () => {
    it('soft → the window gate it names', () => {
      expect(actionStatusBlocker('soft', TURN)?.code).to.eq('NOT_YOUR_TURN');
      expect(actionStatusBlocker('soft', PHASE)?.code).to.eq('FINISH_CURRENT_ACTION');
    });

    it('an unclassified soft reason is still a GATE, never a domain refusal', () => {
      // e.g. «you are viewing another player's actions» (type 'rule').
      const blocker = actionStatusBlocker('soft', {type: 'rule', message: 'You are viewing another player\'s actions'});
      expect(blocker?.affectsPotentialCount).to.eq(false);
      expect(blocker?.tone).to.eq('warning');
    });

    it('rules and activated are domain facts', () => {
      expect(actionStatusBlocker('rules')?.code).to.eq('DOMAIN');
      expect(actionStatusBlocker('activated')?.code).to.eq('DOMAIN');
    });

    it('available has no blocker at all', () => {
      expect(actionStatusBlocker('available')).to.eq(undefined);
    });
  });
});

describe('wheel potential counts', () => {
  const projection = (over: Partial<PotentialActionsModel> = {}): PotentialActionsModel => ({
    playableCards: 4, cardActions: 3, hydroAdvance: 1, colonyTrades: 2, ...over,
  });

  it('passes the server projection through for every category', () => {
    expect(wheelPotentialCounts({
      potential: projection(), handTotal: 7, hasColonies: true, hasHydro: true,
    })).to.deep.eq({cards: 4, cardActions: 3, hydro: 1, trade: 2});
  });

  /*
   * THE INTAKE CLAMP: a drawn card mid-flight into the dock is not «in hand» on
   * any HUD readout (the same rule the dock's «КАРТЫ n/m» line obeys), so the
   * playable count may never run ahead of the physical take.
   */
  it('never reads ahead of the intake-aware hand total', () => {
    const counts = wheelPotentialCounts({
      potential: projection({playableCards: 4}), handTotal: 2, hasColonies: true, hasHydro: true,
    });
    expect(counts.cards).to.eq(2);
  });

  it('a category absent from this game shows nothing', () => {
    const counts = wheelPotentialCounts({
      potential: projection(), handTotal: 7, hasColonies: false, hasHydro: false,
    });
    expect(counts.trade).to.eq(0);
    expect(counts.hydro).to.eq(0);
    expect(counts.cardActions, 'the categories that always exist are untouched').to.eq(3);
  });

  it('no projection (an opponent seat / an older server) degrades to zeros', () => {
    expect(wheelPotentialCounts({
      potential: undefined, handTotal: 7, hasColonies: true, hasHydro: true,
    })).to.deep.eq({cards: 0, cardActions: 0, hydro: 0, trade: 0});
  });

  /*
   * ACCEPTANCE 1 + 8: passing the turn is NOT a state change. The input carries
   * no turn signal at all — the counts are structurally incapable of moving
   * with it, which is the property the old `waitingFor`-derived counts lacked.
   */
  it('the input has no turn signal — a count can only move when the GAME state does', () => {
    const before = wheelPotentialCounts({potential: projection(), handTotal: 7, hasColonies: true, hasHydro: true});
    const after = wheelPotentialCounts({potential: projection(), handTotal: 7, hasColonies: true, hasHydro: true});
    expect(after).to.deep.eq(before);
    // …and a REAL change (a fleet spent, the track advanced) does move them.
    const spent = wheelPotentialCounts({
      potential: projection({colonyTrades: 1, hydroAdvance: 0}), handTotal: 7, hasColonies: true, hasHydro: true,
    });
    expect(spent.trade).to.eq(1);
    expect(spent.hydro).to.eq(0);
  });
});
