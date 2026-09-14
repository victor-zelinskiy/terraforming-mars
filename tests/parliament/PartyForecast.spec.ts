import {expect} from 'chai';
import {testGame} from '../TestGame';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Resource} from '../../src/common/Resource';
import {AdaptedLichen} from '../../src/server/cards/base/AdaptedLichen';
import {ImportedNitrogen} from '../../src/server/cards/base/ImportedNitrogen';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {IPlayer} from '../../src/server/IPlayer';
import {ICard} from '../../src/server/cards/ICard';
import {GREENS_MEGACREDITS_PER_TR} from '../../src/server/parliament/parties/PartyEffects';

/**
 * THE PARTY EFFECTS IN THE EFFECT FORECAST (Turmoil Redux): a party effect the
 * acting seat holds answers a card play like any table reactor — a fact with
 * a `party` source (no card behind it), the same predicates the live hooks
 * read, and nothing when the seat has no access. Read-only, like the engine.
 */
function playForecast(player: IPlayer, card: ICard) {
  return effectForecastForPlay(player, card, cardPlayPreview(player, card));
}

function partyFactsOf(player: IPlayer, card: ICard, party: PartyName) {
  return allForecastFacts(playForecast(player, card)).filter((f) => f.source.kind === 'party' && f.source.name === party);
}

describe('PartyForecast', () => {
  it('the Greens (ruling by default) answer a plant-production play with M€ production — an exact fact, party-sourced', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    expect(game.parliament?.rulingParty()).eq(PartyName.GREENS);
    const facts = partyFactsOf(player, new AdaptedLichen(), PartyName.GREENS);
    expect(facts.length, 'one Greens fact for the plant production').eq(1);
    const fact = facts[0];
    expect(fact.certainty).eq('exact');
    expect(fact.recipient).deep.eq({kind: 'you'});
    expect(fact.source.owner).eq(player.color);
    const production = fact.effects.find((e) => e.note === 'production');
    expect(production, 'the fact is a production change').not.undefined;
    expect(production?.icon).eq(Resource.MEGACREDITS);
    expect(production?.direction).eq('gain');
    expect(production?.amount).eq(1);
  });

  it('the Greens answer an explicit TR grant with 2 M€ per step', () => {
    const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const facts = partyFactsOf(player, new ImportedNitrogen(), PartyName.GREENS);
    expect(facts.length, 'one Greens fact for the TR step').eq(1);
    const gain = facts[0].effects.find((e) => e.icon === Resource.MEGACREDITS && e.note !== 'production');
    expect(gain?.direction).eq('gain');
    expect(gain?.amount).eq(GREENS_MEGACREDITS_PER_TR);
  });

  it('Mars First answers a city tile only for a seat that HOLDS the effect — steel and the card, deferred', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const parliament = game.parliament!;
    player.production.add(Resource.ENERGY, 1);
    expect(partyFactsOf(player, new ImmigrantCity(), PartyName.MARS), 'no access → no fact').deep.eq([]);
    parliament.grantPartyEffect(player, PartyName.MARS, 'TestGrant');
    const facts = partyFactsOf(player, new ImmigrantCity(), PartyName.MARS);
    expect(facts.length, 'steel for the tile + a card for the city').eq(2);
    for (const fact of facts) {
      expect(fact.certainty).eq('deferred');
      expect(fact.recipient).deep.eq({kind: 'you'});
    }
    const icons = facts.flatMap((f) => f.effects.map((e) => e.icon)).sort();
    expect(icons).deep.eq(['cards', Resource.STEEL]);
  });

  it('a play that touches neither TR, production nor a tile raises no party fact', () => {
    const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const facts = allForecastFacts(playForecast(player, new SecurityFleet())).filter((f) => f.source.kind === 'party');
    expect(facts).deep.eq([]);
  });

  it('the forecast is read-only: the game serializes identically before and after', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const before = JSON.stringify(game.serialize());
    playForecast(player, new AdaptedLichen());
    playForecast(player, new ImportedNitrogen());
    expect(JSON.stringify(game.serialize())).eq(before);
  });
});
