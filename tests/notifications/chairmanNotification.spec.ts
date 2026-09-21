import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Color} from '../../src/common/Color';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {EventSource} from '../../src/common/events/EventSource';
import {NotificationModel} from '../../src/client/components/notifications/notificationTypes';
import {diffRootNotifications} from '../../src/client/components/notifications/notificationModel';
import {VARIANT_RELEVANCE} from '../../src/client/components/notifications/notificationFeedPolicy';
import {answerQuestGate} from '../parliament/parliamentArrange';

/*
 * «ПРЕДСЕДАТЕЛЬСТВО» — WHAT THE OTHER PLAYERS ARE TOLD
 * (docs/claude/prompts/parliament-chairman-quest.md §4, probe 8).
 *
 * The server's own flow is driven (the quest completes, the gate is answered)
 * and the CLIENT's pipeline is replayed over the same streams the routes
 * serve — once per viewer. One fact, two texts, three readers:
 *  · the player who completed it — NOTHING (they walked the whole flow);
 *  · the previous chairman — their delegate is back in their reserve;
 *  · everyone else — the office is taken, the generation's quest is closed.
 */
const ANALYTICS_ONLY_TAGS = new Set(['resource-payment', 'payment-bonus', 'colony-track', 'trade-discount', 'global-parameter', 'reveal']);

function deliveredModels(game: IGame, viewer: Color): Array<NotificationModel> {
  const events = game.events.events.filter((e) => !(e.tags ?? []).some((t) => ANALYTICS_ONLY_TAGS.has(t)));
  const {models} = diffRootNotifications({
    messages: game.gameLog,
    events,
    seen: new Set<number>(),
    viewerColor: viewer,
    generation: game.getGeneration(),
    createdAt: 1000,
  });
  return models;
}

function chairmanCard(game: IGame, viewer: Color): NotificationModel | undefined {
  return deliveredModels(game, viewer).find((m) => m.variant === 'chairman');
}

/** Run `f` as one of `player`'s own actions — the only chain a quest counts. */
function asOwnAction(player: TestPlayer, f: () => void): void {
  const source: EventSource = {kind: 'card', card: CardName.TREES, owner: player.color};
  player.game.events.beginAction(player, source, {category: 'card-play'});
  try {
    f();
  } finally {
    player.game.events.endScope();
  }
}

describe('«ПРЕДСЕДАТЕЛЬСТВО» — the other players\' notification', () => {
  function reduxGame(): [IGame, TestPlayer, TestPlayer, TestPlayer] {
    const [game, p1, p2, p3] = testGame(3, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    return [game, p1, p2, p3];
  }

  it('is EXEMPT from the personal feed filter — the whole point of the classification', () => {
    expect(VARIANT_RELEVANCE['chairman']).eq('exempt');
  });

  it('ONE fact, TWO texts: the previous chairman reads their own, everyone else the office change; the actor reads nothing', () => {
    const [game, p1, p2, p3] = reduxGame();
    const parliament = game.parliament!;
    parliament.chairman = p2.id;

    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    expect(chairmanCard(game, p3.color), 'nothing is told before the gate is answered — nothing has happened').is.undefined;

    answerQuestGate(game, p1);
    expect(parliament.chairman).eq(p1.id);

    // The ACTOR walked the whole flow: a card would be a second telling.
    expect(chairmanCard(game, p1.color), 'the player who completed it gets no card').is.undefined;

    // THE PREVIOUS CHAIRMAN — where their delegate WENT, not what was lost.
    const loser = chairmanCard(game, p2.color);
    expect(loser, 'the previous chairman is told').is.not.undefined;
    expect(loser!.header?.message).eq('Your delegate left the chairmanship and returned to your reserve');
    expect(loser!.cta, 'the card opens the OBJECT it is about').deep.eq({labelKey: 'Open the Parliament', action: 'open-parliament'});
    expect(loser!.typeLabelKey).eq('Chairmanship');
    expect(loser!.kind, 'a fact of the table, not one player\'s routine action').eq('important');

    // EVERYONE ELSE — the group's own header: the office is taken.
    const bystander = chairmanCard(game, p3.color);
    expect(bystander, 'a player the event does not touch is told too — the generation\'s quest is closed').is.not.undefined;
    expect(bystander!.header?.message).eq('${0} takes the chairmanship');
    expect(bystander!.actor).eq(p1.color);
  });

  it('a SITTING chairman who completes it again: nobody is told they lost anything', () => {
    const [game, p1, p2] = reduxGame();
    const parliament = game.parliament!;
    parliament.chairman = p1.id;

    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    answerQuestGate(game, p1);
    expect(parliament.chairman).eq(p1.id);

    const card = chairmanCard(game, p2.color);
    expect(card, 'the office did not change hands, but the quest is still closed for the generation').is.not.undefined;
    expect(card!.header?.message, 'and nobody reads a loss that did not happen').eq('${0} takes the chairmanship');
    const seated = game.events.events.filter((e) => e.type === 'chairman-seated');
    expect(seated).has.length(1);
    expect(seated[0].target, 'no previous holder ⇒ no addressee for the second text').is.undefined;
  });

  it('the corner case (the delegate pick) records the same event, with the previous holder, in its OWN journal group', () => {
    const [game, p1, p2, p3] = reduxGame();
    const parliament = game.parliament!;
    parliament.chairman = p2.id;
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    for (let i = 0; i < 6; i++) {
      parliament.placeVote(p1, parliament.slots[i < 3 ? 1 : 2], 'reserve');
    }

    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    answerQuestGate(game, p1);
    expect(chairmanCard(game, p3.color), 'nothing is announced while the pick still stands').is.undefined;

    const pick = p1.getWaitingFor()!;
    pick.process({type: 'party', partyName: parliament.resolutionOf(parliament.slots[2].instance).party}, p1);
    expect(parliament.chairman).eq(p1.id);

    const loser = chairmanCard(game, p2.color);
    expect(loser!.header?.message).eq('Your delegate left the chairmanship and returned to your reserve');
    const bystander = chairmanCard(game, p3.color);
    expect(bystander!.header?.message).eq('${0} takes the chairmanship');
  });
});
