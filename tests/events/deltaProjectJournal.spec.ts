import {expect} from 'chai';
import {testGame} from '../TestGame';
import {DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {Tag} from '../../src/common/cards/Tag';
import {fakeCard} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';

describe('Delta Project journal signal', () => {
  it('advancing the track roots a delta-project journal event', () => {
    const [game, player] = testGame(2, {deltaProjectExpansion: true});
    player.energy = 3;
    player.playedCards.push(fakeCard({tags: [Tag.BUILDING]}));

    DeltaProjectExpansion.advance(player, 1);

    const log = game.gameLog.find((m) => m.category === 'delta-project');
    expect(log, 'delta-project root log').to.not.be.undefined;
    expect(log!.correlationId, 'correlationId').to.be.a('number');
    expect(log!.role).to.eq('root-action');

    const ev = game.events.events.find((e) =>
      e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.DELTA_PROJECT);
    expect(ev, 'delta-project action event').to.not.be.undefined;
    expect(ev!.correlationId).to.eq(log!.correlationId);
    expect(ev!.category).to.eq('delta-project');
  });

  it('immediate reward logs share the advance correlation group', () => {
    const [game, player] = testGame(2, {deltaProjectExpansion: true});
    player.energy = 3;
    player.playedCards.push(fakeCard({tags: [Tag.BUILDING, Tag.POWER, Tag.EARTH]}));

    // Reach position 3 (Earth → +2 M€ production, an immediate reward logged in-scope).
    DeltaProjectExpansion.advance(player, 3);

    const root = game.gameLog.find((m) => m.category === 'delta-project');
    expect(root).to.not.be.undefined;
    const grouped = game.gameLog.filter((m) => m.correlationId === root!.correlationId);
    // The advance line + the +2 M€ production reward line share one journal group.
    expect(grouped.length).to.be.greaterThan(1);
    expect(player.production.megacredits).to.eq(2);
  });

  it('logs the jump past an occupied 2 VP position', () => {
    const [game, player, player2] = testGame(2, {deltaProjectExpansion: true});
    // Give the advancing player every track tag + the energy to leap 9 → 11.
    player.playedCards.push(fakeCard({tags: [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE, Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL]}));
    player.energy = 5;
    player.deltaProjectData!.position = 9;
    player2.deltaProjectData!.position = 10; // 2 VP slot occupied

    DeltaProjectExpansion.advance(player, 2);

    expect(player.deltaProjectData!.position).to.eq(11);
    const grouped = game.gameLog.filter((m) => m.category === 'delta-project');
    expect(grouped.length).to.be.greaterThan(0);
  });
});
