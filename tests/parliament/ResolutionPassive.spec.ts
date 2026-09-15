import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Board} from '../../src/server/boards/Board';
import {Space} from '../../src/server/boards/Space';
import {runAllActions} from '../TestingUtils';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {DEV_PASSIVE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {IPlayer} from '../../src/server/IPlayer';
import {ICard} from '../../src/server/cards/ICard';

/**
 * THE ENACTED RESOLUTION'S PASSIVE EFFECT (Turmoil Redux) — the seam a real
 * resolution plugs into, proven on the DEV passive example («Urban Charter»:
 * 2 M€ per city placed on Mars): the live hook fires for every participant
 * under the resolution's own source, and its FORECAST twin answers a city play
 * with a resolution-sourced fact — the same law every table reactor obeys.
 */
function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

function resolutionFactsOf(player: IPlayer, card: ICard, id: string) {
  const forecast = effectForecastForPlay(player, card, cardPlayPreview(player, card));
  return allForecastFacts(forecast).filter((f) => f.source.kind === 'resolution' && f.source.name === id);
}

describe('ResolutionPassive', () => {
  it('the enacted DEV passive pays 2 M€ for a city on Mars, nothing for a greenery, nothing while not enacted', () => {
    const [game, p1, , parliament] = reduxGame();
    const plain = (spaces: ReadonlyArray<Space>) => spaces.filter((s) => s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => Board.isOceanSpace(a)));
    p1.megaCredits = 0;
    game.addCity(p1, plain(game.board.getAvailableSpacesOnLand(p1))[0]);
    runAllActions(game);
    expect(p1.megaCredits, 'no resolution enacted → no bonus').eq(0);

    parliament.enacted = resolutionInstanceId(DEV_PASSIVE_RESOLUTION_ID, 0);
    game.addCity(p1, plain(game.board.getAvailableSpacesOnLand(p1))[0]);
    runAllActions(game);
    expect(p1.megaCredits, 'a city on Mars pays 2 M€').eq(2);
    game.addGreenery(p1, plain(game.board.getAvailableSpacesForGreenery(p1))[0]);
    runAllActions(game);
    expect(p1.megaCredits, 'a greenery pays nothing').eq(2);
  });

  it('the forecast twin: a city play lists a resolution-sourced deferred fact once the resolution is enacted', () => {
    const [, p1, , parliament] = reduxGame();
    p1.production.add(Resource.ENERGY, 1);
    expect(resolutionFactsOf(p1, new ImmigrantCity(), DEV_PASSIVE_RESOLUTION_ID), 'nothing enacted → no fact').deep.eq([]);
    parliament.enacted = resolutionInstanceId(DEV_PASSIVE_RESOLUTION_ID, 0);
    const facts = resolutionFactsOf(p1, new ImmigrantCity(), DEV_PASSIVE_RESOLUTION_ID);
    expect(facts.length, 'one fact for the city').eq(1);
    const fact = facts[0];
    expect(fact.certainty).eq('deferred');
    expect(fact.recipient).deep.eq({kind: 'you'});
    expect(fact.source.owner).eq(p1.color);
    expect(fact.source.channel).eq('tile-placed');
    const gain = fact.effects[0];
    expect(gain.icon).eq(Resource.MEGACREDITS);
    expect(gain.direction).eq('gain');
    expect(gain.amount).eq(2);
    // A play without a tile raises no resolution fact.
    expect(resolutionFactsOf(p1, new SecurityFleet(), DEV_PASSIVE_RESOLUTION_ID)).deep.eq([]);
  });
});
