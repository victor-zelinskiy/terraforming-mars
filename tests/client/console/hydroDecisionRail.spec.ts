import {expect} from 'chai';
import {
  HYDRO_RAIL_CTA,
  HydroRailDecision,
  buildHydroDecisions,
  buildTraversalDecisions,
  initialRailFocus,
  nextRailFocus,
  planConflictReasonKey,
  railFocusNodes,
  railIdOf,
  railNodeOf,
  railStep,
} from '@/client/console/hydroFlow/hydroDecisionRail';
import {HydroTraversalStagePlan} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';
import {CardName} from '@/common/cards/CardName';

/** A traversal stage-plan row (the model's own shape, hand-built). */
function stagePlan(position: number, over: Partial<HydroTraversalStagePlan> = {}): HydroTraversalStagePlan {
  const stage = HYDRO_STAGES[position];
  const ask: HydroTraversalStagePlan['ask'] =
    stage.rewardOptions.length > 1 ? 'choice' :
      stage.followUp === 'reuse-action' ? 'reuse-action' :
        stage.followUp === 'add-animals' ? 'animal-target' :
          stage.followUp === 'draw' ? 'draw' : 'none';
  return {position, stage, ask, mustSelect: false, isDestination: false, ...over};
}

/** A hand-built multi-decision rail — the FUTURE multi-reward movement's
 *  honest fixture: three decisions of two kinds, out-of-order on purpose
 *  (the rail must sort by game resolution order, never by array order). */
function multiRail(states: [HydroRailDecision['state'], HydroRailDecision['state'], HydroRailDecision['state']]): Array<HydroRailDecision> {
  return [
    {id: '1:animal-target', kind: 'animal-target', order: 1, state: states[1], optional: false},
    {id: '0:reuse-action', kind: 'reuse-action', order: 0, state: states[0], optional: true},
    {id: '2:animal-target', kind: 'animal-target', order: 2, state: states[2], optional: false},
  ];
}

describe('hydroDecisionRail (the pure decision + focus model)', () => {
  describe('buildHydroDecisions (today\'s single question)', () => {
    it('no question → empty rail', () => {
      expect(buildHydroDecisions({offered: false, kind: 'reuse-action', mustSelectCard: true, chosen: undefined, optional: true})).to.deep.eq([]);
      expect(buildHydroDecisions({offered: true, kind: undefined, mustSelectCard: true, chosen: undefined, optional: true})).to.deep.eq([]);
    });

    it('candidates + no pick → open', () => {
      const [d] = buildHydroDecisions({offered: true, kind: 'reuse-action', mustSelectCard: true, chosen: undefined, optional: true});
      expect(d.state).to.eq('open');
      expect(d.id).to.eq('0:reuse-action');
      expect(d.skipReasonKey).to.eq(undefined);
    });

    it('a made pick → resolved, carrying the value', () => {
      const [d] = buildHydroDecisions({offered: true, kind: 'animal-target', mustSelectCard: true, chosen: CardName.BIRDS, optional: false});
      expect(d.state).to.eq('resolved');
      expect(d.chosen).to.eq(CardName.BIRDS);
    });

    it('no candidate → unavailable, with the honest reason', () => {
      const [d] = buildHydroDecisions({offered: true, kind: 'animal-target', mustSelectCard: false, chosen: undefined, optional: false});
      expect(d.state).to.eq('unavailable');
      expect(d.skipReasonKey).to.eq('No card can receive the animals');
    });

    it('a made pick the ORDERED PLAN cannot keep → conflict: the summary stands, the reason names the shortfall', () => {
      const [d] = buildHydroDecisions({
        offered: true, kind: 'reuse-action', mustSelectCard: true,
        chosen: CardName.DEVELOPMENT_CENTER, optional: true,
        conflict: {resource: 'energy'},
      });
      expect(d.state).to.eq('conflict');
      // Never a silent clearing: the chosen card STAYS on the decision.
      expect(d.chosen).to.eq(CardName.DEVELOPMENT_CENTER);
      expect(d.conflictReasonKey).to.eq('Not enough energy left after the movement payment');
    });

    it('a conflict with NO chosen pick is just an open question (nothing to conflict with)', () => {
      const [d] = buildHydroDecisions({
        offered: true, kind: 'reuse-action', mustSelectCard: true,
        chosen: undefined, optional: true, conflict: {resource: 'energy'},
      });
      expect(d.state).to.eq('open');
      expect(d.conflictReasonKey).to.eq(undefined);
    });
  });

  describe('planConflictReasonKey (ONE wording for the rail card, the greyed browser row and the CTA)', () => {
    it('names energy when energy is the structural shortfall', () => {
      expect(planConflictReasonKey('energy')).to.eq('Not enough energy left after the movement payment');
    });
    it('states the generic conflict otherwise', () => {
      expect(planConflictReasonKey('steel')).to.eq('The movement payment conflicts with this action');
      expect(planConflictReasonKey(undefined)).to.eq('The movement payment conflicts with this action');
    });
  });

  describe('buildTraversalDecisions (a multi-reward movement — Delta Surge)', () => {
    it('one decision per interactive ask, IN PATH ORDER; plain stages build nothing', () => {
      // 0 → 4: choice (1), choice (2), plain (3), plain destination (4).
      const rail = buildTraversalDecisions([
        stagePlan(1), stagePlan(2), stagePlan(3), stagePlan(4, {isDestination: true}),
      ]);
      expect(rail.map((d) => d.kind)).to.deep.eq(['reward-choice', 'reward-choice']);
      expect(rail.map((d) => d.stagePosition)).to.deep.eq([1, 2]);
      expect(rail.map((d) => d.order)).to.deep.eq([0, 1]);
      expect(rail.every((d) => !d.optional), 'a choice is mandatory').to.eq(true);
      expect(rail.every((d) => d.state === 'open')).to.eq(true);
    });

    it('a drafted choice resolves its decision and carries the option index', () => {
      const [d] = buildTraversalDecisions([stagePlan(1, {choice: 1})]);
      expect(d.state).to.eq('resolved');
      expect(d.chosenOption).to.eq(1);
      expect(d.stageNameKey).to.eq(HYDRO_STAGES[1].nameKey);
    });

    it('target stages are OPTIONAL (the waive door) and fizzle honestly', () => {
      const rail = buildTraversalDecisions([
        stagePlan(7, {mustSelect: true}),
        stagePlan(8),
        stagePlan(9, {mustSelect: false}),
      ]);
      expect(rail.map((d) => d.kind)).to.deep.eq(['reuse-action', 'animal-target']);
      expect(rail[0].state).to.eq('open');
      expect(rail[0].optional).to.eq(true);
      expect(rail[1].state).to.eq('unavailable');
      expect(rail[1].skipReasonKey).to.eq('No card can receive the animals');
    });

    it('the hidden-information draw (stage 5) builds NOTHING — it is a stop, never a pre-select', () => {
      const rail = buildTraversalDecisions([stagePlan(5), stagePlan(6)]);
      expect(rail).to.deep.eq([]);
    });

    it('the plan\'s conflict marks EXACTLY its own stop — the other picks keep their states', () => {
      const rail = buildTraversalDecisions([
        stagePlan(7, {mustSelect: true, pick: CardName.DEVELOPMENT_CENTER}),
        stagePlan(9, {mustSelect: true, pick: CardName.BIRDS}),
      ], {position: 7, resource: 'energy'});
      expect(rail[0].state).to.eq('conflict');
      expect(rail[0].chosen, 'the promise stands').to.eq(CardName.DEVELOPMENT_CENTER);
      expect(rail[0].conflictReasonKey).to.eq('Not enough energy left after the movement payment');
      expect(rail[1].state).to.eq('resolved');
    });

    it('the focus contract holds over the grown array: first open → next open → CTA', () => {
      const rail = buildTraversalDecisions([
        stagePlan(1, {choice: 0}),
        stagePlan(2),
        stagePlan(7, {mustSelect: true, pick: CardName.BIRDS}),
        stagePlan(9, {mustSelect: true}),
      ]);
      // Resolved (1) never takes the seat; the open choice at 2 does.
      expect(initialRailFocus(rail)).to.eq('rail:1:reward-choice');
      // Answering it moves ON to the open animal pick, skipping the resolved 7.
      expect(nextRailFocus(rail.map((d) => d.id === '1:reward-choice' ? {...d, state: 'resolved' as const} : d), '1:reward-choice'))
        .to.eq('rail:3:animal-target');
      // Everything answered → the CTA.
      expect(initialRailFocus(rail.map((d) => ({...d, state: 'resolved' as const})))).to.eq(HYDRO_RAIL_CTA);
    });
  });

  describe('the focus matrix (initialRailFocus)', () => {
    const open: HydroRailDecision = {id: '0:reuse-action', kind: 'reuse-action', order: 0, state: 'open', optional: true};
    const resolved: HydroRailDecision = {...open, state: 'resolved', chosen: CardName.BIRDS};
    const unavailable: HydroRailDecision = {...open, state: 'unavailable'};

    it('no decisions → the CTA', () => {
      expect(initialRailFocus([])).to.eq(HYDRO_RAIL_CTA);
    });

    it('one unresolved → that decision', () => {
      expect(initialRailFocus([open])).to.eq('rail:0:reuse-action');
    });

    it('one resolved → the CTA (a made pick NEVER retakes the automatic seat)', () => {
      expect(initialRailFocus([resolved])).to.eq(HYDRO_RAIL_CTA);
    });

    it('one unavailable/auto-skipped → the CTA', () => {
      expect(initialRailFocus([unavailable])).to.eq(HYDRO_RAIL_CTA);
    });

    it('several unresolved → the FIRST in game order (never array order)', () => {
      expect(initialRailFocus(multiRail(['open', 'open', 'open']))).to.eq('rail:0:reuse-action');
    });

    it('first resolved, second unresolved → the second', () => {
      expect(initialRailFocus(multiRail(['resolved', 'open', 'open']))).to.eq('rail:1:animal-target');
    });

    it('all resolved → the CTA', () => {
      expect(initialRailFocus(multiRail(['resolved', 'resolved', 'resolved']))).to.eq(HYDRO_RAIL_CTA);
    });

    it('resolved + unavailable + unresolved → the first REAL unresolved', () => {
      expect(initialRailFocus(multiRail(['resolved', 'unavailable', 'open']))).to.eq('rail:2:animal-target');
    });

    it('a CONFLICT takes the automatic seat like an open question — the player\'s hand is needed there', () => {
      expect(initialRailFocus(multiRail(['resolved', 'conflict', 'resolved']))).to.eq('rail:1:animal-target');
    });
  });

  describe('nextRailFocus (the seat after an answer)', () => {
    it('moves to the NEXT open decision in game order', () => {
      expect(nextRailFocus(multiRail(['resolved', 'open', 'open']), '0:reuse-action')).to.eq('rail:1:animal-target');
    });

    it('wraps to an EARLIER reopened decision (change №2 while №1 was reset)', () => {
      expect(nextRailFocus(multiRail(['open', 'resolved', 'resolved']), '1:animal-target')).to.eq('rail:0:reuse-action');
    });

    it('nothing left open → the CTA', () => {
      expect(nextRailFocus(multiRail(['resolved', 'resolved', 'resolved']), '2:animal-target')).to.eq(HYDRO_RAIL_CTA);
    });

    it('skips unavailable slots', () => {
      expect(nextRailFocus(multiRail(['resolved', 'unavailable', 'open']), '0:reuse-action')).to.eq('rail:2:animal-target');
    });

    it('returns to a CONFLICTING pick the same way it returns to an open one', () => {
      expect(nextRailFocus(multiRail(['resolved', 'conflict', 'resolved']), '2:animal-target')).to.eq('rail:1:animal-target');
    });
  });

  describe('railStep (↑/↓ through the visible order)', () => {
    const rail = multiRail(['open', 'unavailable', 'resolved']);
    // Visible focus order: 0:reuse-action → 2:animal-target → CTA
    // (1:animal-target is unavailable — OUT of the graph).

    it('the focus graph skips unavailable decisions', () => {
      expect(railFocusNodes(rail)).to.deep.eq(['rail:0:reuse-action', 'rail:2:animal-target', HYDRO_RAIL_CTA]);
    });

    it('a CONFLICT stays IN the focus graph (walk to it to change or clear the pick)', () => {
      expect(railFocusNodes(multiRail(['resolved', 'conflict', 'resolved'])))
        .to.deep.eq(['rail:0:reuse-action', 'rail:1:animal-target', 'rail:2:animal-target', HYDRO_RAIL_CTA]);
    });

    it('↓ walks decision → decision → CTA; the bottom edge exits', () => {
      expect(railStep(rail, 'rail:0:reuse-action', 1)).to.eq('rail:2:animal-target');
      expect(railStep(rail, 'rail:2:animal-target', 1)).to.eq(HYDRO_RAIL_CTA);
      expect(railStep(rail, HYDRO_RAIL_CTA, 1)).to.eq('out-bottom');
    });

    it('↑ from the CTA reaches the LAST focusable decision; the top edge exits', () => {
      expect(railStep(rail, HYDRO_RAIL_CTA, -1)).to.eq('rail:2:animal-target');
      expect(railStep(rail, 'rail:0:reuse-action', -1)).to.eq('out-top');
    });

    it('entering from outside lands on the first (↓) / last (↑) node', () => {
      expect(railStep(rail, 'track', 1)).to.eq('rail:0:reuse-action');
      expect(railStep(rail, 'skip', -1)).to.eq(HYDRO_RAIL_CTA);
    });

    it('an empty rail is just the CTA', () => {
      expect(railFocusNodes([])).to.deep.eq([HYDRO_RAIL_CTA]);
      expect(railStep([], HYDRO_RAIL_CTA, -1)).to.eq('out-top');
    });
  });

  describe('node naming', () => {
    it('round-trips an id and rejects foreign nodes', () => {
      expect(railNodeOf({id: '0:reuse-action'})).to.eq('rail:0:reuse-action');
      expect(railIdOf('rail:0:reuse-action')).to.eq('0:reuse-action');
      expect(railIdOf('track')).to.eq(undefined);
      expect(railIdOf(HYDRO_RAIL_CTA)).to.eq(undefined);
    });
  });
});
