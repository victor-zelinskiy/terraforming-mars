import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {
  mergeChips,
  summarizeImpact,
  diffRootNotifications,
  diffNegativeNotifications,
  diffRevealNotifications,
  coalesceBurst,
  buildTurnNotification,
  buildGenerationNotification,
  buildPassNotification,
} from '@/client/components/notifications/notificationModel';
import {RevealLogMeta} from '@/common/logs/RevealLogMeta';

const RED: Color = 'red';
const BLUE: Color = 'blue';
const CARD = 'Wind Turbines' as CardName;

function rootHeader(actor: Color, correlationId: number, category: LogMessage['category'] = 'card-play'): LogMessage {
  const m = new LogMessage(LogMessageType.DEFAULT, '${0} played ${1}', [
    {type: LogMessageDataType.PLAYER, value: actor},
    {type: LogMessageDataType.CARD, value: CARD},
  ]);
  m.correlationId = correlationId;
  m.role = 'root-action';
  m.category = category;
  return m;
}

function event(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number; impact: EventImpact}): GameEvent {
  return {
    generation: 1,
    phase: Phase.ACTION,
    visibility: 'journal',
    ...partial,
  } as GameEvent;
}

function chip(icon: string, text: string, extra: Partial<JournalImpactChip> = {}): JournalImpactChip {
  return {icon, text, ...extra};
}

describe('notificationModel (pure)', () => {
  describe('mergeChips', () => {
    it('merges same icon+flags and drops zero net', () => {
      const merged = mergeChips([chip('energy', '+1'), chip('energy', '+2'), chip('megacredits', '+1'), chip('megacredits', '−1')]);
      expect(merged).to.have.length(1);
      expect(merged[0]).to.include({icon: 'energy', text: '+3'});
    });

    it('keeps production and saved variants distinct from stock', () => {
      const merged = mergeChips([chip('heat', '+1'), chip('heat', '+1', {production: true}), chip('megacredits', '−2', {saved: true})]);
      expect(merged).to.have.length(3);
      expect(merged.find((c) => c.saved === true)?.text).to.eq('−2');
    });
  });

  describe('summarizeImpact', () => {
    it('surfaces top pills and counts all rows as details', () => {
      const vms = [
        {source: {kind: 'none'} as const, bucket: 'card' as const, chips: [chip('energy', '+1')]},
        {source: {kind: 'label', label: 'X'} as const, bucket: 'discount' as const, chips: [chip('megacredits', '−2', {saved: true})]},
        {source: {kind: 'none'} as const, bucket: 'card' as const, chips: [chip('tr', '+1')]},
      ];
      const {pills, detailCount} = summarizeImpact(vms, 2);
      expect(detailCount).to.eq(3);
      expect(pills).to.have.length(2);
      // TR is the most salient → first.
      expect(pills[0].icon).to.eq('tr');
    });

    it('orders pills GAINS-first, the cost last', () => {
      const vms = [
        {source: {kind: 'label', label: 'Payment'} as const, bucket: 'payment' as const, chips: [chip('megacredits', '−1')]},
        {source: {kind: 'none'} as const, bucket: 'card' as const, chips: [chip('energy', '+1')]},
        {source: {kind: 'none'} as const, bucket: 'card' as const, chips: [chip('tr', '+1')]},
      ];
      const {pills} = summarizeImpact(vms, 5);
      expect(pills.map((p) => p.icon)).to.deep.eq(['tr', 'energy', 'megacredits']);
    });
  });

  describe('diffRootNotifications', () => {
    const header = rootHeader(RED, 7);
    const chain = [
      event({id: 70, type: 'action', player: RED, correlationId: 7, impact: {}}),
      event({id: 71, type: 'resource-changed', player: RED, correlationId: 7, source: {kind: 'card', card: CARD}, impact: {stock: {energy: 1}}}),
    ];

    it('emits an opponent action and records the encountered id', () => {
      const {models, encounteredIds} = diffRootNotifications({
        messages: [header], events: chain, seen: new Set(), viewerColor: BLUE, generation: 1, createdAt: 1000,
      });
      expect(encounteredIds).to.deep.eq([7]);
      expect(models).to.have.length(1);
      expect(models[0]).to.include({id: 'g7', kind: 'normal', variant: 'play-card', actor: RED});
      expect(models[0].pills.some((p) => p.icon === 'energy')).to.eq(true);
    });

    it('suppresses the viewer OWN ordinary action but still marks it seen', () => {
      const {models, encounteredIds} = diffRootNotifications({
        messages: [header], events: chain, seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1000,
      });
      expect(encounteredIds).to.deep.eq([7]);
      expect(models).to.have.length(0);
    });

    it('does not re-emit an already-seen root', () => {
      const {models} = diffRootNotifications({
        messages: [header], events: chain, seen: new Set([7]), viewerColor: BLUE, generation: 1, createdAt: 1000,
      });
      expect(models).to.have.length(0);
    });

    it('shows a milestone highlight even when it is the viewer own (via category)', () => {
      // The server now stamps the root-action log with category 'milestone'
      // (no separate milestone-claimed GameEvent needed).
      const header = rootHeader(RED, 8, 'milestone');
      const chain = [event({id: 80, type: 'action', player: RED, correlationId: 8, source: {kind: 'milestone', name: 'Terraformer' as never}, impact: {}})];
      const {models} = diffRootNotifications({
        messages: [header], events: chain, seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1000,
      });
      expect(models).to.have.length(1);
      expect(models[0]).to.include({kind: 'important', variant: 'milestone', typeLabelKey: 'Achievement'});
    });

    it('shows an award funding highlight (via category), kind important', () => {
      const header = rootHeader(BLUE, 9, 'award');
      const chain = [event({id: 90, type: 'action', player: BLUE, correlationId: 9, source: {kind: 'award', name: 'Banker' as never}, impact: {}})];
      const {models} = diffRootNotifications({
        messages: [header], events: chain, seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1000,
      });
      expect(models[0]).to.include({kind: 'important', variant: 'award', typeLabelKey: 'Award'});
    });

    it('maps each action category to its visual variant', () => {
      const cases: Array<[LogMessage['category'], string]> = [
        ['card-play', 'play-card'],
        ['card-action', 'blue-action'],
        ['corporation-action', 'blue-action'],
        ['standard-project', 'standard-project'],
        ['colony', 'colony'],
      ];
      for (const [category, variant] of cases) {
        const header = rootHeader(BLUE, 20, category);
        const {models} = diffRootNotifications({
          messages: [header],
          events: [event({id: 200, type: 'action', player: BLUE, correlationId: 20, impact: {}})],
          seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1000,
        });
        expect(models[0]?.variant, `${category}`).to.eq(variant);
      }
    });
  });

  describe('passive-effect root', () => {
    it('carries the effect source card (for the name + popover + details)', () => {
      const header = rootHeader(BLUE, 50);
      header.category = undefined; // no action category → reaches the effect-triggered branch
      const chain = [event({id: 50, type: 'effect-triggered', player: BLUE, correlationId: 50, source: {kind: 'card', card: CARD}, impact: {}})];
      const {models} = diffRootNotifications({messages: [header], events: chain, seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1});
      expect(models[0]).to.include({variant: 'passive-effect', effectCard: CARD, typeLabelKey: 'Effect triggered'});
    });
  });

  describe('coalesceBurst', () => {
    // Opponent (RED) actions viewed by BLUE — so they are NOT self-suppressed.
    function normalModel(corr: number) {
      return diffRootNotifications({
        messages: [rootHeader(RED, corr)],
        events: [event({id: corr * 10, type: 'resource-changed', player: RED, correlationId: corr, source: {kind: 'card', card: CARD}, impact: {stock: {energy: 1}}})],
        seen: new Set(), viewerColor: BLUE, generation: 1, createdAt: 1000,
      }).models[0];
    }

    it('keeps individual cards at or below the threshold', () => {
      const models = [normalModel(1), normalModel(2), normalModel(3)];
      expect(coalesceBurst(models)).to.have.length(3);
    });

    it('collapses a same-actor burst into one summary', () => {
      const models = [normalModel(1), normalModel(2), normalModel(3), normalModel(4)];
      const out = coalesceBurst(models);
      expect(out).to.have.length(1);
      expect(out[0].groupCount).to.eq(4);
      expect(out[0].typeLabelKey).to.eq('Multiple events');
    });
  });

  describe('Vermin variants (via rootVariant)', () => {
    function verminHeader(correlationId: number, category: LogMessage['category']): LogMessage {
      const m = new LogMessage(LogMessageType.DEFAULT, '${0} played ${1}', [
        {type: LogMessageDataType.PLAYER, value: BLUE},
        {type: LogMessageDataType.CARD, value: 'Vermin' as CardName},
      ]);
      m.correlationId = correlationId;
      m.role = 'root-action';
      m.category = category;
      return m;
    }

    it('a played Vermin is a VP THREAT (warning), not a card play', () => {
      const {models} = diffRootNotifications({
        messages: [verminHeader(30, 'card-play')],
        events: [event({id: 300, type: 'action', player: BLUE, correlationId: 30, impact: {}})],
        seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1,
      });
      expect(models[0]).to.include({variant: 'threat', kind: 'important', typeLabelKey: 'VP threat'});
    });

    it('the vp-pressure flip is a VP LOSS card (shown to everyone, incl. owner)', () => {
      const {models} = diffRootNotifications({
        messages: [verminHeader(31, 'vp-pressure')],
        events: [event({id: 310, type: 'action', player: BLUE, correlationId: 31, impact: {}})],
        seen: new Set(), viewerColor: BLUE, generation: 1, createdAt: 1, // viewer is the owner
      });
      expect(models[0]).to.include({variant: 'vp-loss', kind: 'negative', typeLabelKey: 'VP loss'});
    });
  });

  describe('diffNegativeNotifications (the viewer as victim)', () => {
    const opp: {kind: 'card'; card: CardName; owner: Color} = {kind: 'card', card: CARD, owner: BLUE};

    function neg(o: {id: number; corr: number; type: GameEvent['type']; impact: EventImpact; target?: {player: Color}}) {
      return event({id: o.id, type: o.type, player: RED, correlationId: o.corr, source: opp, target: o.target, impact: o.impact});
    }

    function detect(e: GameEvent) {
      return diffNegativeNotifications({events: [e], seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1}).models;
    }

    it('classifies a DESTROY (stock loss, no target)', () => {
      const m = detect(neg({id: 1, corr: 1, type: 'resource-changed', impact: {stock: {plants: -3}}}));
      expect(m[0]).to.include({variant: 'destroy', kind: 'negative', typeLabelKey: 'Resource lost'});
      expect(m[0].negative).to.deep.include({attacker: BLUE, scope: 'stock', transfer: false, sourceCard: CARD});
      expect(m[0].negative?.loss[0]).to.include({icon: 'plants', text: '−3'});
    });

    it('classifies a PRODUCTION-REDUCTION (production loss, no target)', () => {
      const m = detect(neg({id: 2, corr: 2, type: 'production-changed', impact: {production: {energy: -1}}}));
      expect(m[0]).to.include({variant: 'production-reduction', typeLabelKey: 'Income reduced'});
      expect(m[0].negative?.scope).to.eq('production');
      expect(m[0].negative?.transfer).to.eq(false);
    });

    it('classifies a STEAL (stock loss + target) with a mirror gain', () => {
      const m = detect(neg({id: 3, corr: 3, type: 'resource-changed', target: {player: BLUE}, impact: {stock: {titanium: -2}}}));
      expect(m[0]).to.include({variant: 'steal', typeLabelKey: 'Stolen'});
      expect(m[0].negative?.transfer).to.eq(true);
      expect(m[0].negative?.gain?.[0]).to.include({icon: 'titanium', text: '+2'});
    });

    it('classifies a PRODUCTION-TRANSFER (production loss + target) as ONE linked event', () => {
      const m = detect(neg({id: 4, corr: 4, type: 'production-changed', target: {player: BLUE}, impact: {production: {energy: -1}}}));
      expect(m[0]).to.include({variant: 'production-transfer', typeLabelKey: 'Income redirected'});
      expect(m[0].negative?.transfer).to.eq(true);
      expect(m[0].negative?.gain?.[0]).to.include({icon: 'energy', text: '+1', production: true});
    });

    it('does NOT flag the viewer spending their OWN resource', () => {
      const own = event({id: 5, type: 'resource-changed', player: RED, correlationId: 5, source: {kind: 'card', card: CARD, owner: RED}, impact: {stock: {megacredits: -3}}});
      expect(detect(own)).to.have.length(0);
    });

    it('does NOT flag a payment', () => {
      const pay = event({id: 6, type: 'resource-changed', player: RED, correlationId: 6, source: {kind: 'payment'}, impact: {stock: {megacredits: -5}}});
      expect(detect(pay)).to.have.length(0);
    });

    it('seeds (encountered) and does not re-emit a seen loss', () => {
      const e = neg({id: 7, corr: 7, type: 'resource-changed', impact: {stock: {plants: -2}}});
      const first = diffNegativeNotifications({events: [e], seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1});
      expect(first.encounteredIds).to.deep.eq([7]);
      const again = diffNegativeNotifications({events: [e], seen: new Set([7]), viewerColor: RED, generation: 1, createdAt: 1});
      expect(again.models).to.have.length(0);
    });
  });

  describe('diffRevealNotifications (public card reveals/shows)', () => {
    function revealMsg(o: {corr: number; actor: Color; cards: Array<CardName>; single?: boolean; reveal: RevealLogMeta}): LogMessage {
      const data = [
        {type: LogMessageDataType.PLAYER, value: o.actor},
        o.single ?
          {type: LogMessageDataType.CARD, value: o.cards[0]} :
          {type: LogMessageDataType.CARDS, value: o.cards},
      ] as LogMessage['data'];
      const m = new LogMessage(LogMessageType.DEFAULT, '${0} revealed ${1}', data);
      m.correlationId = o.corr;
      m.reveal = o.reveal;
      return m;
    }

    function detect(m: LogMessage, viewer: Color = RED) {
      return diffRevealNotifications({messages: [m], seen: new Set(), viewerColor: viewer, generation: 1, createdAt: 1});
    }

    it('builds a HAND-SHOW notification (PublicPlans) for an opponent', () => {
      const m = revealMsg({corr: 1, actor: BLUE, cards: ['A' as CardName, 'B' as CardName, 'C' as CardName], reveal: {origin: 'hand', result: 'shown', source: 'Public Plans' as CardName}});
      const {models} = detect(m);
      expect(models).to.have.length(1);
      expect(models[0]).to.include({variant: 'reveal-hand', kind: 'important', typeLabelKey: 'Cards shown', actor: BLUE});
      expect(models[0].reveal?.cards).to.deep.eq(['A', 'B', 'C']);
      expect(models[0].cta?.action).to.eq('view-reveal');
    });

    it('builds a DECK-REVEAL (single card, discarded) notification', () => {
      const m = revealMsg({corr: 2, actor: BLUE, cards: [CARD], single: true, reveal: {origin: 'deck', result: 'discarded'}});
      const {models} = detect(m);
      expect(models[0]).to.include({variant: 'reveal-deck', kind: 'normal', typeLabelKey: 'Card revealed'});
      expect(models[0].reveal).to.deep.include({origin: 'deck', result: 'discarded'});
      expect(models[0].reveal?.cards).to.deep.eq([CARD]);
    });

    it('SUPPRESSES the reveal for the actor (they already know their cards)', () => {
      const m = revealMsg({corr: 3, actor: BLUE, cards: [CARD], single: true, reveal: {origin: 'hand', result: 'shown'}});
      const res = detect(m, BLUE); // viewer IS the actor
      expect(res.encounteredIds).to.have.length(1); // still seeded
      expect(res.models).to.have.length(0);
    });

    it('ignores a message with no reveal marker', () => {
      const m = new LogMessage(LogMessageType.DEFAULT, '${0} drew a card', [{type: LogMessageDataType.PLAYER, value: BLUE}]);
      m.correlationId = 4;
      expect(detect(m).models).to.have.length(0);
    });

    it('does not re-emit a seen reveal', () => {
      const m = revealMsg({corr: 5, actor: BLUE, cards: [CARD], single: true, reveal: {origin: 'deck', result: 'discarded'}});
      const first = diffRevealNotifications({messages: [m], seen: new Set(), viewerColor: RED, generation: 1, createdAt: 1});
      const key = first.encounteredIds[0];
      const again = diffRevealNotifications({messages: [m], seen: new Set([key]), viewerColor: RED, generation: 1, createdAt: 1});
      expect(again.models).to.have.length(0);
    });
  });

  describe('buildTurnNotification', () => {
    function input(o: Partial<PlayerInputModel>): PlayerInputModel {
      return o as unknown as PlayerInputModel;
    }

    it('returns nothing when not waiting or when optional', () => {
      expect(buildTurnNotification(undefined, {generation: 2, createdAt: 1, freshTurn: true})).to.eq(undefined);
      expect(buildTurnNotification(input({type: 'card', title: 'x', optional: true}), {generation: 2, createdAt: 1, freshTurn: true})).to.eq(undefined);
    });

    it('announces YOUR TURN only on a FRESH hand-off (transition)', () => {
      const n = buildTurnNotification(input({type: 'or', title: 'Take your first action'}), {generation: 5, createdAt: 1, freshTurn: true});
      expect(n).to.not.eq(undefined);
      expect(n?.kind).to.eq('your-turn');
      expect(n?.persistent).to.eq(true);
      expect(n?.id).to.eq('turn:your-turn');
      expect(n?.cta?.action).to.eq('dismiss');
    });

    it('does NOT re-announce YOUR TURN when the action menu continues the same turn', () => {
      // After a sub-prompt the menu returns as 'Take your next action' — still the
      // viewer's turn (not a hand-off), so no card. Same for the lone repeating player.
      const cont = buildTurnNotification(input({type: 'or', title: 'Take your next action'}), {generation: 5, createdAt: 1, freshTurn: false});
      expect(cont).to.eq(undefined);
      const firstAgain = buildTurnNotification(input({type: 'or', title: 'Take your first action'}), {generation: 5, createdAt: 1, freshTurn: false});
      expect(firstAgain).to.eq(undefined);
    });

    it('maps any other prompt to ACTION REQUIRED regardless of freshTurn', () => {
      const n = buildTurnNotification(input({type: 'card', title: 'Select a card to discard'}), {generation: 5, createdAt: 1, freshTurn: false});
      expect(n?.kind).to.eq('action-required');
      expect(n?.persistent).to.eq(true);
      expect(n?.prompt).to.eq('Select a card to discard');
    });
  });

  describe('highlight notifications', () => {
    it('builds a generation card', () => {
      const n = buildGenerationNotification(6, 1);
      expect(n).to.include({id: 'gen:6', kind: 'important', typeLabelKey: 'New generation'});
    });
    it('builds a pass card with the actor', () => {
      const n = buildPassNotification(RED, 6, 1);
      expect(n).to.include({id: 'pass:6:red', kind: 'important', actor: RED, typeLabelKey: 'Player passed'});
    });
  });
});
