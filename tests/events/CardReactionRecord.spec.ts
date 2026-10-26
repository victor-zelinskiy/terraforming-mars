import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {ICard} from '../../src/server/cards/ICard';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {TileType} from '../../src/common/TileType';
import {CARD_REACTION_RING_DEPTH} from '../../src/common/models/CardReactionModel';
import {HartlanHeating} from '../../src/server/cards/turmoilRedux/HartlanHeating';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {PointLuna} from '../../src/server/cards/prelude/PointLuna';
import {NoctisCity} from '../../src/server/cards/base/NoctisCity';
import {NuclearZone} from '../../src/server/cards/base/NuclearZone';
import {Research} from '../../src/server/cards/base/Research';
import {ImportedGHG} from '../../src/server/cards/base/ImportedGHG';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

/**
 * «A CARD REACTED» — THE RECORD (`GameModel.cardReactions`, `CardReactionRecord`): the recorder writes ONE record
 * per passive-effect scope that produced an impact — the reacting card, its channel, what woke it (the trigger
 * site's `cause`), and what landed, in order, with its recipient — the console's reaction scene's script for the
 * owner and every other viewer alike. Born on the FIRST impact (a hook that only logs or does nothing leaves no
 * record), appended by every later one (a deferred gain restored under the same scope). A bounded ring with the
 * `seq` law of its siblings; never serialized.
 */
function table(): {game: IGame, player: TestPlayer, rival: TestPlayer} {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  player.megaCredits = 100;
  rival.megaCredits = 100;
  player.production.override({energy: 2});
  rival.production.override({energy: 2});
  return {game, player, rival};
}

function placeFirst(game: IGame, player: TestPlayer): void {
  const prompt = cast(player.getWaitingFor(), SelectSpace);
  prompt.cb(prompt.spaces[0]);
  runAllActions(game);
}

describe('CardReactionRecord — the recorder writes «which card reacted and what it paid»', () => {
  it('Hartlan Heating on a green tile card: one record, the corporation, card-played, the played card as the cause, both impacts in order', () => {
    const {game, player} = table();
    player.playedCards.push(new HartlanHeating());
    player.playCard(new NuclearZone());
    runAllActions(game);
    expect(game.cardReactions, 'born on the first impact — nothing before the cell').deep.eq([]);
    placeFirst(game, player);
    expect(game.cardReactions).to.have.lengthOf(1);
    const record = game.cardReactions[0];
    expect(record).deep.include({owner: player.color, kind: 'corporation', card: CardName.HARTLAN_HEATING, channel: 'card-played'});
    expect(record.cause).deep.eq({card: CardName.NUCLEAR_ZONE});
    expect(record.impacts).deep.eq([
      {kind: 'stock', resource: Resource.HEAT, amount: 6, to: player.color},
      {kind: 'production', resource: Resource.MEGACREDITS, amount: 1, to: player.color},
    ]);
    expect(record.seq).to.be.a('number');
    expect(record.root.actionId).to.be.a('number');
  });

  it('Tharsis Republic on its own city: the tile and its cell as the cause, the cash and the production in one record', () => {
    const {game, player} = table();
    player.playedCards.push(new TharsisRepublic());
    const space = game.board.getAvailableSpacesForCity(player)[0];
    game.addCity(player, space);
    runAllActions(game);
    const records = game.cardReactions.filter((r) => r.card === CardName.THARSIS_REPUBLIC);
    expect(records).to.have.lengthOf(1);
    expect(records[0].channel).eq('tile-placed');
    expect(records[0].cause).deep.eq({tile: TileType.CITY, space: space.id});
    expect(records[0].impacts).deep.eq([
      {kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: player.color},
      {kind: 'production', resource: Resource.MEGACREDITS, amount: 1, to: player.color},
    ]);
  });

  it('Point Luna on an Earth tag: a draw impact, the played card as the cause', () => {
    const {game, player} = table();
    player.playedCards.push(new PointLuna());
    player.playCard(new ImportedGHG());
    runAllActions(game);
    const records = game.cardReactions.filter((r) => r.card === CardName.POINT_LUNA);
    expect(records).to.have.lengthOf(1);
    expect(records[0].cause).deep.eq({card: CardName.IMPORTED_GHG});
    expect(records[0].impacts).deep.eq([{kind: 'draw', amount: 1, to: player.color}]);
  });

  it('two corporations on one play (Hartlan + Tharsis on Noctis City): two records, each its own', () => {
    const {game, player} = table();
    player.playedCards.push(new HartlanHeating(), new TharsisRepublic());
    player.playCard(new NoctisCity());
    runAllActions(game);
    const names = game.cardReactions.map((r) => r.card);
    expect(names).to.include.members([CardName.HARTLAN_HEATING, CardName.THARSIS_REPUBLIC]);
    expect(names.filter((n) => n === CardName.HARTLAN_HEATING)).to.have.lengthOf(1);
    expect(names.filter((n) => n === CardName.THARSIS_REPUBLIC)).to.have.lengthOf(1);
    const seqs = game.cardReactions.map((r) => r.seq);
    expect([...seqs].sort((a, b) => a - b), 'seq grows in the order the records were born').deep.eq(seqs);
  });

  it('a rival\'s reactor to the play: the record belongs to the rival, its impact addressed to the rival', () => {
    const {game, player, rival} = table();
    const watcher: ICard = fakeCard({
      name: 'Watcher' as CardName,
      type: CardType.ACTIVE,
      onCardPlayedByAnyPlayer: (owner: IPlayer) => {
        owner.stock.add(Resource.MEGACREDITS, 2);
        return undefined;
      },
    });
    rival.playedCards.push(watcher);
    player.playCard(new Research());
    runAllActions(game);
    const records = game.cardReactions.filter((r) => r.card === watcher.name);
    expect(records).to.have.lengthOf(1);
    expect(records[0].owner).eq(rival.color);
    expect(records[0].channel).eq('card-played-by-any');
    expect(records[0].cause).deep.eq({card: CardName.RESEARCH});
    expect(records[0].impacts).deep.eq([{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2, to: rival.color}]);
  });

  it('a hook that produces no impact leaves no record', () => {
    const {game, player} = table();
    player.playedCards.push(new HartlanHeating());
    player.playCard(new Research());
    runAllActions(game);
    expect(game.cardReactions).deep.eq([]);
  });

  it('a non-card tag names the tag as the cause', () => {
    const {game, player} = table();
    const reactor: ICard = fakeCard({
      name: 'Tag watcher' as CardName,
      type: CardType.ACTIVE,
      onNonCardTagAdded: (owner: IPlayer, tag: Tag) => {
        if (tag === Tag.SCIENCE) {
          owner.stock.add(Resource.MEGACREDITS, 1);
        }
      },
    });
    player.playedCards.push(reactor);
    player.triggerOnNonCardTagAdded(Tag.SCIENCE);
    const records = game.cardReactions.filter((r) => r.card === reactor.name);
    expect(records).to.have.lengthOf(1);
    expect(records[0].channel).eq('tag-added');
    expect(records[0].cause).deep.eq({tag: Tag.SCIENCE});
  });

  it('the ring is bounded, and seq is monotonic across the game\'s age', () => {
    const {game, player} = table();
    for (let i = 0; i < CARD_REACTION_RING_DEPTH + 4; i++) {
      game.publishCardReaction({root: {}, owner: player.color, kind: 'card', card: CardName.RESEARCH, channel: 'card-played', impacts: []});
    }
    expect(game.cardReactions).to.have.lengthOf(CARD_REACTION_RING_DEPTH);
    const last = game.cardReactions[game.cardReactions.length - 1].seq;
    game.gameAge += 1;
    const next = game.publishCardReaction({root: {}, owner: player.color, kind: 'card', card: CardName.RESEARCH, channel: 'card-played', impacts: []});
    expect(next.seq).to.be.greaterThan(last);
  });

  it('the published record is the stored one — later impacts of the same scope land on it', () => {
    const {game, player} = table();
    const stored = game.publishCardReaction({root: {}, owner: player.color, kind: 'card', card: CardName.RESEARCH, channel: 'card-played', impacts: []});
    stored.impacts.push({kind: 'draw', amount: 1, to: player.color});
    expect(game.cardReactions[0].impacts).to.have.lengthOf(1);
  });
});
