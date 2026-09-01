import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {
  importanceForRoot,
  signOf,
  viewerImpactOfBotTurn,
  viewerImpactOfChain,
} from '@/client/components/notifications/notificationSemantics';

const RED: Color = 'red';
const BLUE: Color = 'blue';
const CARD = 'Predators' as CardName;

function event(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number; impact: EventImpact}): GameEvent {
  return {
    generation: 1,
    phase: Phase.ACTION,
    visibility: 'journal',
    ...partial,
  } as GameEvent;
}

describe('notificationSemantics (viewer-relative sign + importance)', () => {
  describe('viewerImpactOfChain', () => {
    it('is NEUTRAL when the viewer is the actor (own actions never grow a band)', () => {
      const chain = [event({id: 1, type: 'resource-changed', player: RED, correlationId: 1, impact: {stock: {megacredits: -8}}})];
      expect(viewerImpactOfChain(chain, RED, RED).sign).to.eq('neutral');
    });

    it('splits the viewer own deltas into gains and losses, sign per recipient', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 1, impact: {}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {stock: {plants: -2}}}),
        event({id: 3, type: 'cards-drawn', player: BLUE, correlationId: 1, impact: {cardsDrawn: 1}}),
        // The actor's own delta is context, never the viewer's.
        event({id: 4, type: 'resource-changed', player: RED, correlationId: 1, impact: {stock: {energy: 3}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−2'}]);
      expect(impact.gains).to.deep.eq([{icon: 'cards', text: '+1'}]);
      expect(impact.attacker).to.eq(RED);
      expect(impact.sourceCard).to.eq(CARD);
      expect(impact.scope).to.eq('stock');
    });

    it('merges WITHIN a direction, never across — a masked loss must not net to silence', () => {
      // The viewer loses 2 plants to an attack AND gains 2 plants elsewhere in
      // the same action: the two are both real and both stated (the task's
      // mixed-result rule — a net would hide the attack entirely).
      const chain = [
        event({id: 1, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {stock: {plants: -2}}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {plants: 2}}}),
        event({id: 3, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {heat: 1}}}),
        event({id: 4, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {heat: 1}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.gains).to.deep.eq([{icon: 'plants', text: '+2'}, {icon: 'heat', text: '+2'}]);
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−2'}]);
    });

    it('production losses set the production scope; discounts are never a loss', () => {
      const chain = [
        event({id: 1, type: 'production-changed', player: BLUE, correlationId: 1, target: {player: RED}, impact: {production: {energy: -1}}}),
        event({id: 2, type: 'discount-applied', player: BLUE, correlationId: 1, impact: {megacreditsSaved: 3}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.scope).to.eq('production');
      expect(impact.transfer).to.eq(true);
      expect(impact.losses).to.deep.eq([{icon: 'energy', text: '−1', production: true}]);
    });

    it('surfaces a forced discard and a VP move (the deltas the journal rows omit)', () => {
      const chain = [
        event({id: 1, type: 'cards-drawn', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {cardsDiscarded: 2}}),
        event({id: 2, type: 'vp-granted', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {vp: -1}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.losses).to.deep.eq([
        {icon: 'cards', text: '−2'},
        {icon: 'vp', text: '−1'},
      ]);
      expect(impact.scope).to.eq('vp');
    });
  });

  describe('viewerImpactOfBotTurn', () => {
    function turn(steps: MarsBotTurn['steps']): MarsBotTurn {
      return {id: 1, generation: 2, steps};
    }

    it('reads the viewer own impact steps; the bot own steps are context', () => {
      const t = turn([
        {kind: 'impact', impact: {target: RED, targetIsBot: true, changes: [{resource: 'megacredits' as never, scope: 'stock', before: 0, after: 5}]}},
        {kind: 'impact', impact: {target: BLUE, targetIsBot: false, changes: [
          {resource: 'plants' as never, scope: 'stock', before: 5, after: 3},
          {resource: 'heat' as never, scope: 'production', before: 1, after: 2},
        ]}},
      ]);
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−2'}]);
      expect(impact.gains).to.deep.eq([{icon: 'heat', text: '+1', production: true}]);
      expect(impact.attacker).to.eq(RED);
    });

    it('a blocked / empty attack leaves the impact honestly neutral', () => {
      const t = turn([
        {kind: 'attack', attack: {target: BLUE, resource: 'plants' as never, demanded: 2, removed: 0, outcome: 'protected'}},
      ]);
      expect(viewerImpactOfBotTurn(t, BLUE, RED).sign).to.eq('neutral');
    });
  });

  describe('the two axes stay independent', () => {
    it('signOf', () => {
      const chip = {icon: 'heat', text: '+1'};
      expect(signOf([chip], [])).to.eq('positive');
      expect(signOf([], [chip])).to.eq('negative');
      expect(signOf([chip], [chip])).to.eq('mixed');
      expect(signOf([], [])).to.eq('neutral');
    });

    it('importanceForRoot — a loss is critical, a gain merely notable, the rest ambient', () => {
      const base = {viewerLoss: false, viewerGain: false, prestige: false, threat: false, vpPressure: false};
      expect(importanceForRoot({...base, viewerLoss: true})).to.eq('critical');
      expect(importanceForRoot({...base, vpPressure: true})).to.eq('critical');
      expect(importanceForRoot({...base, viewerGain: true})).to.eq('notable');
      expect(importanceForRoot({...base, prestige: true})).to.eq('notable');
      expect(importanceForRoot({...base, threat: true})).to.eq('notable');
      expect(importanceForRoot(base)).to.eq('ambient');
    });
  });
});
