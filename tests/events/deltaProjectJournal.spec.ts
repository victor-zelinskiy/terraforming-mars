import {expect} from 'chai';
import {testGame} from '../TestGame';
import {DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {DeltaSurge} from '../../src/server/cards/delta/DeltaSurge';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {Tag} from '../../src/common/cards/Tag';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
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

  it('a Delta Surge traversal stays ONE grouped movement event — never a spam of moves', () => {
    const [game, player] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(fakeCard({tags: [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE]}));
    player.playedCards.push(new DeltaSurge());
    player.energy = 4;

    DeltaProjectExpansion.advance(player, 4);
    // Answer both crossed choices so every reward resolves in the group.
    runAllActions(game);
    cast(player.popWaitingFor(), OrOptions).options[0].cb();
    runAllActions(game);
    cast(player.popWaitingFor(), OrOptions).options[0].cb();
    runAllActions(game);

    const root = game.gameLog.find((m) => m.category === 'delta-project' && m.role === 'root-action');
    expect(root).to.not.be.undefined;
    // ONE root; the activation line and every stage's reward line share the
    // one correlation group (the ordered payout is a single game event).
    const roots = game.gameLog.filter((m) => m.category === 'delta-project' && m.role === 'root-action');
    expect(roots.length).to.eq(1);
    const grouped = game.gameLog.filter((m) => m.correlationId === root!.correlationId);
    const text = grouped.map((m) => m.message).join('\n');
    expect(text).to.contain('grants the reward of every stage crossed');
    expect(grouped.length, 'movement + activation + stage rewards in one group').to.be.greaterThan(3);
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
