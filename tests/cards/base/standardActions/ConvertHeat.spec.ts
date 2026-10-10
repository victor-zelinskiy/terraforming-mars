import {expect} from 'chai';
import {ConvertHeat} from '../../../../src/server/cards/base/standardActions/ConvertHeat';
import {Phase} from '../../../../src/common/Phase';
import {churn, setTemperature} from '../../../TestingUtils';
import {TestPlayer} from '../../../TestPlayer';
import {PoliticalAgendas} from '../../../../src/server/turmoil/PoliticalAgendas';
import {Reds} from '../../../../src/server/turmoil/parties/Reds';
import {MAX_TEMPERATURE} from '../../../../src/common/constants';
import {testGame} from '../../../TestGame';
import {IGame} from '../../../../src/server/IGame';
import {cast} from '../../../../src/common/utils/utils';
import {OrOptions} from '../../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../../src/server/inputs/SelectOption';
import {PartyName} from '../../../../src/common/turmoil/PartyName';
import {heatConversionMetadata} from '../../../../src/server/cards/base/standardActions/ConvertHeat';

describe('ConvertHeat', () => {
  let card: ConvertHeat;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new ConvertHeat();
    [game, player] = testGame(2, {turmoilExtension: true});
  });

  it('Can not act without heat', () => {
    expect(card.canAct(player)).eq(false);
    player.heat = 7;
    expect(card.canAct(player)).eq(false);
  });

  it('Can not act with reds', () => {
    player.heat = 8;
    game.phase = Phase.ACTION;
    game.turmoil!.rulingParty = new Reds();
    PoliticalAgendas.setNextAgenda(game.turmoil!, game);
    expect(card.canAct(player)).eq(false);
    player.megaCredits = 2;
    expect(card.canAct(player)).eq(false);
    player.megaCredits = 3;
    expect(card.canAct(player)).eq(true);
  });

  it('Should play', () => {
    player.heat = 8;
    expect(card.canAct(player)).eq(true);
    expect(churn(card.action(player), player)).eq(undefined);
    expect(game.getTemperature()).eq(-28);
  });

  it('Spending heat when the global parameter is at its goal is a valid stall action', () => {
    player.heat = 8;

    expect(card.canAct(player)).eq(true);

    setTemperature(game, MAX_TEMPERATURE);

    expect(player.terraformRating).eq(20);
    expect(card.canAct(player)).eq(true);

    cast(card.action(player), undefined);

    expect(game.getTemperature()).eq(MAX_TEMPERATURE);
    expect(player.heat).eq(0);
    expect(player.terraformRating).eq(20);
  });

  it('canAct adds maxtemp warning at MAX_TEMPERATURE', () => {
    player.heat = 8;
    setTemperature(game, MAX_TEMPERATURE);

    expect(card.warnings.has('maxtemp')).is.false;
    expect(card.canAct(player)).eq(true);
    expect(card.warnings.has('maxtemp')).is.true;
  });
});

/**
 * PL-067 (TR41): the conversion is a ONE-PRESS verb on the console (the wheel, the rail) and nothing stood before the
 * press to say what the table answers — the ruling Greens' 2 M€ arrived as a surprise. The option now carries its
 * reading: the formula (price · step · the step's implied rating) and the forecast engine's own answer.
 */
describe('ConvertHeat — the option\'s reading (PL-067)', () => {
  function convertHeatOption(player: TestPlayer): SelectOption {
    const menu = cast(player.getActions(), OrOptions);
    const option = menu.options.find((o): o is SelectOption => o instanceof SelectOption && o.title === 'Convert 8 heat into temperature');
    expect(option, 'the conversion is on the menu').is.not.undefined;
    return option!;
  }

  it('under the ruling Greens the option names the formula and the Greens\' 2 M€ before the press', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    expect(game.parliament!.rulingParty(), 'a fresh Redux table: the Greens').eq(PartyName.GREENS);
    player.heat = 8;
    const metadata = convertHeatOption(player).metadata;
    expect(metadata).deep.include({kind: 'globalParameter', icon: 'temperature', amount: 1});
    expect(metadata?.effects).deep.eq([
      {direction: 'cost', icon: 'heat', amount: 8, current: 8, resulting: 0},
      {direction: 'gain', icon: 'temperature', amount: 2, current: game.getTemperature(), resulting: game.getTemperature() + 2, unit: '°C'},
      {direction: 'gain', icon: 'tr', amount: 1, implied: true},
    ]);
    const greens = metadata?.forecast?.facts.find((f) => f.id.endsWith('greens-tr'));
    expect(greens, JSON.stringify(metadata?.forecast?.facts.map((f) => f.id))).is.not.undefined;
    expect(greens!.effects[0]).deep.include({direction: 'gain', icon: 'megacredits', amount: 2});
  });

  it('on a quiet table the formula stands and no forecast rides the option — one press', () => {
    const [game, player] = testGame(2);
    game.phase = Phase.ACTION;
    player.heat = 8;
    const metadata = convertHeatOption(player).metadata;
    expect(metadata?.effects?.map((e) => e.icon)).deep.eq(['heat', 'temperature', 'tr']);
    expect(metadata?.forecast).is.undefined;
  });

  it('the Kelvinists\' 6-heat variant reads the same formula at its own price', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    player.heat = 6;
    const metadata = heatConversionMetadata(player, 6);
    expect(metadata.effects?.[0]).deep.include({direction: 'cost', icon: 'heat', amount: 6, current: 6, resulting: 0});
    expect(metadata.effects?.map((e) => e.icon)).deep.eq(['heat', 'temperature', 'tr']);
  });

  it('at the temperature\'s maximum the step reads «no effect» and nothing reacts', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    setTemperature(game, MAX_TEMPERATURE);
    player.heat = 8;
    const metadata = heatConversionMetadata(player, 8);
    expect(metadata.effects?.map((e) => e.icon), 'a step the ceiling cuts carries no rating chip').deep.eq(['heat', 'temperature']);
    expect(metadata.effects?.[1]).deep.include({current: MAX_TEMPERATURE, resulting: MAX_TEMPERATURE});
    expect(metadata.forecast).is.undefined;
  });
});
