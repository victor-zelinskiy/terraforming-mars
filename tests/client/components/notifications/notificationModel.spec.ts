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
  coalesceBurst,
  buildTurnNotification,
  buildGenerationNotification,
  buildPassNotification,
} from '@/client/components/notifications/notificationModel';

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

  describe('buildTurnNotification', () => {
    function input(o: Partial<PlayerInputModel>): PlayerInputModel {
      return o as unknown as PlayerInputModel;
    }

    it('returns nothing when not waiting or when optional', () => {
      expect(buildTurnNotification(undefined, {generation: 2, createdAt: 1})).to.eq(undefined);
      expect(buildTurnNotification(input({type: 'card', title: 'x', optional: true}), {generation: 2, createdAt: 1})).to.eq(undefined);
    });

    it('maps the inline action menu to YOUR TURN', () => {
      const n = buildTurnNotification(input({type: 'or', title: 'Take your next action'}), {generation: 5, createdAt: 1});
      expect(n).to.not.eq(undefined);
      expect(n?.kind).to.eq('your-turn');
      expect(n?.persistent).to.eq(true);
      expect(n?.id).to.eq('turn:your-turn');
      // Its button just acknowledges + closes (the action UI is already in front).
      expect(n?.cta?.action).to.eq('dismiss');
    });

    it('maps any other prompt to ACTION REQUIRED with the prompt text', () => {
      const n = buildTurnNotification(input({type: 'card', title: 'Select a card to discard'}), {generation: 5, createdAt: 1});
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
