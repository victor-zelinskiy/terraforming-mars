import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {Color} from '../../src/common/Color';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {NotificationModel} from '../../src/client/components/notifications/notificationTypes';
import {diffRootNotifications} from '../../src/client/components/notifications/notificationModel';
import {VARIANT_RELEVANCE} from '../../src/client/components/notifications/notificationFeedPolicy';
import {quietResolutionOf, seatEnacted, seatResolution} from '../parliament/parliamentArrange';

/*
 * PL-112 — «ЭФФЕКТ ПАРТИИ ПОЛУЧЕН / ПОТЕРЯН», WHO IS TOLD. The server's own diff
 * is driven (the second cube, the cube taken back, a grant) and the CLIENT's
 * pipeline is replayed over the same streams the routes serve — once per
 * viewer. One fact, one reader: the seat it is about gets ONE card of its
 * own (its own doing or not — the law of access moved for THEM, never an
 * «own ordinary action» to suppress), with the Parliament as its object; a
 * rival gets nothing (they read it in the journal); the enactment is the
 * sitting's own telling and never this card.
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

function partyEffectCards(game: IGame, viewer: Color): Array<NotificationModel> {
  return deliveredModels(game, viewer).filter((m) => m.variant === 'party-effect');
}

describe('PL-112 — a party\'s effect gained / lost: the owner\'s notification', () => {
  function reduxGame() {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    seatEnacted(parliament, quietResolutionOf(PartyName.REDS));
    seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
    parliament.announceAccessChanges(game);
    return {game, p1, p2, parliament};
  }

  it('is EXEMPT from the personal feed filter — the one reader is the seat it is about', () => {
    expect(VARIANT_RELEVANCE['party-effect']).eq('exempt');
  });

  it('the second cube: the OWNER gets one card — the line as its header, «Party effect» as its label, the Parliament as its object; the rival gets nothing', () => {
    const {game, p1, p2, parliament} = reduxGame();
    const slot = parliament.slotOf(PartyName.GREENS)!;
    parliament.placeVote(p1, slot, 'lobby');
    parliament.placeVote(p1, slot, 'reserve');
    parliament.announceAccessChanges(game);

    const mine = partyEffectCards(game, p1.color);
    expect(mine).has.length(1);
    expect(mine[0].header?.message).eq('${0} gains the ${1} party effect: ${2} delegate(s) on its resolution');
    expect(mine[0].typeLabelKey).eq('Party effect');
    expect(mine[0].kind, 'never suppressed as the viewer\'s own routine action').eq('important');
    expect(mine[0].cta).deep.eq({labelKey: 'Open the Parliament', action: 'open-parliament'});
    expect(mine[0].actor).eq(p1.color);

    expect(partyEffectCards(game, p2.color), 'the rival reads it in the journal, never as a card').deep.eq([]);
  });

  it('the cube taken back and a grant revoked: the owner is told the loss the same way', () => {
    const {game, p1, parliament} = reduxGame();
    const slot = parliament.slotOf(PartyName.GREENS)!;
    parliament.placeVote(p1, slot, 'lobby');
    parliament.placeVote(p1, slot, 'reserve');
    parliament.announceAccessChanges(game);
    parliament.removeLatestVote(p1, slot);
    parliament.grantPartyEffect(p1, PartyName.MARS, 'Septem Tribus');
    parliament.announceAccessChanges(game);
    const cards = partyEffectCards(game, p1.color);
    expect(cards.map((c) => c.header?.message)).deep.eq([
      '${0} gains the ${1} party effect: ${2} delegate(s) on its resolution',
      '${0} loses the ${1} party effect: fewer than ${2} delegate(s) on its resolution',
      '${0} gains the ${1} party effect — granted by ${2}',
    ]);
  });
});
