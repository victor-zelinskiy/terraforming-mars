import {expect} from 'chai';
import {
  HYDRO_RAIL_CTA,
  HydroRailDecision,
  buildHydroDecisions,
  initialRailFocus,
  nextRailFocus,
  railFocusNodes,
  railIdOf,
  railNodeOf,
  railStep,
} from '@/client/console/hydroFlow/hydroDecisionRail';
import {CardName} from '@/common/cards/CardName';

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
  });

  describe('railStep (↑/↓ through the visible order)', () => {
    const rail = multiRail(['open', 'unavailable', 'resolved']);
    // Visible focus order: 0:reuse-action → 2:animal-target → CTA
    // (1:animal-target is unavailable — OUT of the graph).

    it('the focus graph skips unavailable decisions', () => {
      expect(railFocusNodes(rail)).to.deep.eq(['rail:0:reuse-action', 'rail:2:animal-target', HYDRO_RAIL_CTA]);
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
