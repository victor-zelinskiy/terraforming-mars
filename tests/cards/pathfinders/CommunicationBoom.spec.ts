import {expect} from 'chai';
import {fakeCard, runAllActions, testGame} from '../../TestingUtils';
import {CommunicationBoom} from '../../../src/server/cards/pathfinders/CommunicationBoom';
import {Kelvinists} from '../../../src/server/turmoil/parties/Kelvinists';
import {CardName} from '../../../src/common/cards/CardName';
import {CardResource} from '../../../src/common/CardResource';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';

describe('CommunicationBoom', () => {
  it('resolve play', () => {
    const card = new CommunicationBoom();
    const [game, player, player2] = testGame(2, {turmoilExtension: true});
    const turmoil = game.turmoil!;

    const a = fakeCard({name: 'A' as CardName, resourceType: CardResource.MICROBE});
    const b = fakeCard({name: 'B' as CardName, resourceType: CardResource.DATA});
    const c = fakeCard({name: 'C' as CardName, resourceType: CardResource.MICROBE});
    const d = fakeCard({name: 'D' as CardName, resourceType: CardResource.DATA});
    player.playedCards.push(a, b, c, d);

    const e = fakeCard({name: 'E' as CardName, resourceType: CardResource.DATA});
    const f = fakeCard({name: 'F' as CardName, resourceType: CardResource.DATA});
    player2.playedCards.push(e, f);

    player.megaCredits = 8;
    player2.megaCredits = 12;

    turmoil.initGlobalEvent(game);
    turmoil.chairman = player2;
    turmoil.dominantParty = new Kelvinists();
    turmoil.dominantParty.partyLeader = player2;
    turmoil.dominantParty.delegates.add(player);
    turmoil.dominantParty.delegates.add(player2);
    turmoil.dominantParty.delegates.add(player2);

    card.resolve(game, turmoil);

    expect(player.megaCredits).eq(0);
    expect(a.resourceCount).eq(0);
    expect(b.resourceCount).eq(2);
    expect(c.resourceCount).eq(0);
    expect(d.resourceCount).eq(2);

    expect(player2.megaCredits).eq(2);
    expect(e.resourceCount).eq(2);
    expect(f.resourceCount).eq(2);

    player.popWaitingFor();
    player2.popWaitingFor();

    runAllActions(game);

    // The shared distribution step decides the SHAPE: ONE unit over two holders is the family's ordinary
    // card pick (which holder gets it), never a column of 0…1 dials.
    const playerPick = cast(player.getWaitingFor(), SelectCard);
    expect(playerPick.cards.map((c) => c.name)).deep.eq([b.name, d.name]);
    expect(playerPick.resourceGainPrompt?.amount).eq(1);
    player.process({type: 'card', cards: [b.name]});
    expect(b.resourceCount).eq(3);

    runAllActions(game);

    // Three units over two holders IS a distribution: the marked `and` of one amount per holder, the sum
    // exactly the count (a wrong sum is refused by the step, with nothing applied).
    const playerOptions2 = cast(player2.getWaitingFor(), AndOptions);
    expect(playerOptions2.options).has.length(2);
    expect(playerOptions2.options[0].title).contains(e.name);
    expect(playerOptions2.cardResourceDistributionPrompt?.amount).eq(3);
    expect(playerOptions2.cardResourceDistributionPrompt?.cards.map((c) => c.name)).deep.eq([e.name, f.name]);
    playerOptions2.options[0].cb(3);
    playerOptions2.cb(undefined);
    expect(e.resourceCount).eq(5);
  });
});
