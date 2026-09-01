import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {viewerImpactOfChain} from '@/client/components/notifications/notificationSemantics';
import {diffRootNotifications} from '@/client/components/notifications/notificationModel';
import {quickToastAllowed} from '@/client/components/notifications/notificationFeedPolicy';

/**
 * A PASSIVE PAYOUT INSIDE SOMEBODY ELSE'S ACTION — the Social Heating shape.
 *
 * Another player (or MarsBot) advances on the Hydronetwork; the server records
 * the mover's action chain and, inside it, a heat gain owned by the VIEWER and
 * sourced to the viewer's own card. Nothing about that is card-specific: it is
 * the ordinary affected-player mechanism, and these specs pin what the viewer
 * must end up seeing —
 *  - the RESULT first («+3 тепла»), because that is what changed for them;
 *  - the CAUSE second, naming who moved;
 *  - the SOURCE named as their OWN card (not the root «Гидросеть», and not in a
 *    way that reads as the opponent holding it);
 *  - exactly ONE notification for one movement resolution, and NONE at all when
 *    the viewer is the one who moved.
 */

const RED: Color = 'red'; // the viewer — owner of the paying card
const BLUE: Color = 'blue'; // the mover
const HEATING = 'Social Heating' as CardName;

function moveHeader(actor: Color, correlationId: number): LogMessage {
  const m = new LogMessage(LogMessageType.DEFAULT, '${0} directed ${1} energy into the Hydronetwork, reaching ${2}', [
    {type: LogMessageDataType.PLAYER, value: actor},
    {type: LogMessageDataType.RAW_STRING, value: '3'},
    {type: LogMessageDataType.STRING, value: 'Orbital Logistics'},
  ]);
  m.correlationId = correlationId;
  m.role = 'root-action';
  m.category = 'delta-project';
  return m;
}

function event(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number; impact: EventImpact}): GameEvent {
  return {generation: 1, phase: Phase.ACTION, visibility: 'journal', ...partial} as GameEvent;
}

/** The mover's own chain: the action root, their energy spend, and the
 *  viewer's heat gain sourced to the viewer's own card. */
function movementChain(mover: Color): Array<GameEvent> {
  return [
    event({id: 1, type: 'action', player: mover, correlationId: 1, category: 'delta-project',
      source: {kind: 'card', card: CardName.DELTA_PROJECT, owner: mover}, impact: {}}),
    event({id: 2, type: 'resource-changed', player: mover, correlationId: 1, parentId: 1,
      impact: {stock: {energy: -3}}}),
    event({id: 3, type: 'resource-changed', player: RED, correlationId: 1, parentId: 1,
      source: {kind: 'card', card: HEATING, owner: RED}, impact: {stock: {heat: 3}}}),
  ];
}

describe('a passive payout inside another player’s action', () => {
  describe('the viewer’s own reading', () => {
    it('is a positive gain, attributed to the viewer’s OWN card', () => {
      const meta = viewerImpactOfChain(movementChain(BLUE), RED, BLUE);
      expect(meta.sign).to.eq('positive');
      expect(meta.gains).to.have.length(1);
      expect(meta.gains[0]).to.include({icon: 'heat', text: '+3'});
      expect(meta.losses).to.deep.eq([]);
      expect(meta.sourceCard).to.eq(HEATING);
      expect(meta.ownSource).is.true;
      expect(meta.attacker).is.undefined;
    });

    it('an ATTACK still names the ATTACKER’s card, and never claims it is the viewer’s', () => {
      const chain = [
        event({id: 1, type: 'action', player: BLUE, correlationId: 1,
          source: {kind: 'card', card: 'Sabotage' as CardName, owner: BLUE}, impact: {}}),
        event({id: 2, type: 'resource-changed', player: RED, correlationId: 1, parentId: 1,
          source: {kind: 'card', card: 'Sabotage' as CardName, owner: BLUE}, impact: {stock: {steel: -2}}}),
      ];
      const meta = viewerImpactOfChain(chain, RED, BLUE);
      expect(meta.sign).to.eq('negative');
      expect(meta.sourceCard).to.eq('Sabotage');
      expect(meta.ownSource).is.undefined;
      expect(meta.attacker).to.eq(BLUE);
    });

    it('the MOVER sees nothing here — their own action is not news to them', () => {
      const meta = viewerImpactOfChain(movementChain(RED), RED, RED);
      expect(meta.sign).to.eq('neutral');
      expect(meta.gains).to.deep.eq([]);
    });
  });

  describe('the notification it produces', () => {
    function build(mover: Color) {
      return diffRootNotifications({
        messages: [moveHeader(mover, 1)],
        events: movementChain(mover),
        seen: new Set<number>(),
        viewerColor: RED,
        generation: 1,
        createdAt: 1,
      }).models;
    }

    it('ONE card for one movement resolution — never one per step', () => {
      const models = build(BLUE);
      expect(models).to.have.length(1);
      expect(models[0].variant).to.eq('hydronetwork');
    });

    it('leads with the viewer’s gain and names the source card', () => {
      const m = build(BLUE)[0];
      expect(m.sign).to.eq('positive');
      expect(m.importance).to.eq('notable');
      expect(m.viewerImpact?.gains).to.have.length(1);
      expect(m.viewerImpact?.gains[0]).to.include({icon: 'heat', text: '+3'});
      expect(m.viewerImpact?.sourceCard).to.eq(HEATING);
      expect(m.viewerImpact?.ownSource).is.true;
      // The CAUSE is the mover — the card is the source, not the actor.
      expect(m.actor).to.eq(BLUE);
    });

    it('the viewer’s OWN movement produces no self-notification', () => {
      expect(build(RED)).to.have.length(0);
    });

    it('the feed delivers it to the affected owner even in «personal» mode', () => {
      const m = build(BLUE)[0];
      expect(m.affects).to.include(RED);
      expect(quickToastAllowed(m, 'personal', RED)).is.true;
      // …and stays out of an uninvolved seat's personal feed.
      expect(quickToastAllowed(m, 'personal', 'green' as Color)).is.false;
    });
  });
});
