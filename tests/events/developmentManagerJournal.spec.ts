import {expect} from 'chai';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';
import {DevelopmentManager} from '@/server/cards/delta/DevelopmentManager';
import {DeltaProjectExpansion} from '@/server/delta/DeltaProjectExpansion';
import {getBehaviorExecutor} from '@/server/behavior/BehaviorExecutor';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {buildEventChildren} from '@/client/components/journal/journalEventChild';

/**
 * Development Manager's whole premium presentation rides the shared
 * passive-effect channels: the `effect-triggered` marker + its `resource-changed`
 * impact (journal fold, notification pills, endgame facts) and the ordinary
 * M€ delta on the resource rail. These specs assert the SERVER emits exactly
 * the shape those channels consume, with real game events, not fixtures.
 */
describe('Development Manager journal signal', () => {
  it('a production trigger records marker + impact inside the causing action, cause first', () => {
    const [game, player] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(new DevelopmentManager());

    game.events.beginAction(player, {kind: 'card', card: CardName.GIANT_SPACE_MIRROR, owner: player.color}, {category: 'card-play'});
    try {
      getBehaviorExecutor().execute({production: {energy: 3}}, player, fakeCard());
    } finally {
      game.events.endScope();
    }

    const root = game.events.events.find((e) => e.type === 'action');
    expect(root, 'root action event').to.not.be.undefined;

    const marker = game.events.events.find((e) =>
      e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.DEVELOPMENT_MANAGER);
    expect(marker, 'effect-triggered marker').to.not.be.undefined;
    expect(marker!.trigger).to.eq('production-gain');
    expect(marker!.tags).to.include('passive-effect');
    expect(marker!.correlationId).to.eq(root!.correlationId);

    const gain = game.events.events.find((e) =>
      e.type === 'resource-changed' && e.source?.kind === 'card' && e.source.card === CardName.DEVELOPMENT_MANAGER);
    expect(gain, 'the M€ impact').to.not.be.undefined;
    expect(gain!.parentId).to.eq(marker!.id);
    expect(gain!.impact.stock?.megacredits).to.eq(2);

    // The reward never precedes its cause: production change → marker → gain.
    const productionChange = game.events.events.find((e) => e.type === 'production-changed');
    expect(productionChange, 'the causing production event').to.not.be.undefined;
    expect(productionChange!.id).to.be.lessThan(marker!.id);
    expect(marker!.id).to.be.lessThan(gain!.id);

    // The journal folds marker + impact into ONE card-sourced row.
    const rows = buildEventChildren([...game.events.events], root!.correlationId!, player.color);
    const dpRows = rows.filter((r) => r.source.kind === 'card' && r.source.card === CardName.DEVELOPMENT_MANAGER);
    expect(dpRows).to.have.length(1);
    expect(dpRows[0].chips.some((c) => c.icon === 'megacredits' && c.text === '+2')).is.true;
  });

  it('a movement trigger records inside the delta-project group with an effect-result log line', () => {
    const [game, player] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(new DevelopmentManager());
    player.playedCards.push(fakeCard({tags: [Tag.BUILDING, Tag.POWER]}));
    player.energy = 2;

    DeltaProjectExpansion.advance(player, 2);

    const root = game.events.events.find((e) => e.type === 'action' && e.category === 'delta-project');
    expect(root, 'delta-project root').to.not.be.undefined;

    const marker = game.events.events.find((e) =>
      e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.DEVELOPMENT_MANAGER);
    expect(marker, 'movement marker').to.not.be.undefined;
    expect(marker!.trigger).to.eq('delta-advance');
    expect(marker!.correlationId).to.eq(root!.correlationId);

    // The advance's own root log precedes the effect-result gain line in the group.
    const rootLog = game.gameLog.find((m) => m.category === 'delta-project');
    expect(rootLog, 'advance root log').to.not.be.undefined;
    const effectLog = game.gameLog.find((m) =>
      m.correlationId === rootLog!.correlationId && m.role === 'effect-result');
    expect(effectLog, 'the gain line rides the same group as an effect result').to.not.be.undefined;
  });

  it('two triggers from one press fold into ONE calm journal row totalling +4 M€', () => {
    const [game, player] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(new DevelopmentManager());
    player.playedCards.push(fakeCard({tags: [Tag.BUILDING, Tag.POWER, Tag.EARTH]}));
    player.energy = 3;

    // 3 steps → movement trigger; the position-3 reward (+2 M€ production) →
    // production trigger. Two server rewards, one aggregated presentation row.
    DeltaProjectExpansion.advance(player, 3);

    const root = game.events.events.find((e) => e.type === 'action' && e.category === 'delta-project');
    const rows = buildEventChildren([...game.events.events], root!.correlationId!, player.color);
    const dpRows = rows.filter((r) => r.source.kind === 'card' && r.source.card === CardName.DEVELOPMENT_MANAGER);
    expect(dpRows, 'one aggregated row, not one per trigger').to.have.length(1);

    const total = dpRows[0].chips
      .filter((c) => c.icon === 'megacredits')
      .reduce((sum, c) => sum + parseInt(c.text, 10), 0);
    expect(total).to.eq(4);
  });
});
