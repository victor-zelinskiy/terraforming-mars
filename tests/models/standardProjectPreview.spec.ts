import {expect} from 'chai';
import {buildStandardProjectPreview} from '../../src/server/models/standardProjectPreview';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {PowerPlantStandardProject} from '../../src/server/cards/base/standardProjects/PowerPlantStandardProject';
import {AsteroidStandardProject} from '../../src/server/cards/base/standardProjects/AsteroidStandardProject';
import {AquiferStandardProject} from '../../src/server/cards/base/standardProjects/AquiferStandardProject';
import {GreeneryStandardProject} from '../../src/server/cards/base/standardProjects/GreeneryStandardProject';
import {CityStandardProject} from '../../src/server/cards/base/standardProjects/CityStandardProject';
import {BuildColonyStandardProject} from '../../src/server/cards/colonies/BuildColonyStandardProject';
import {setTemperature, maxOutOceans} from '../TestingUtils';
import {MAX_TEMPERATURE} from '../../src/common/constants';
import {Resource} from '../../src/common/Resource';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';

describe('standardProjectPreview', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {coloniesExtension: true});
  });

  it('cost chip mirrors the row price (current → resulting M€)', () => {
    player.megaCredits = 30;
    const preview = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14);
    const cost = preview.effects[0];
    expect(cost.direction).to.eq('cost');
    expect(cost.icon).to.eq('megacredits');
    expect(cost.amount).to.eq(14);
    expect(cost.current).to.eq(30);
    expect(cost.resulting).to.eq(16);
  });

  it('derives the temperature chip from the card`s own tr declaration', () => {
    const preview = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14);
    const temp = preview.effects.find((e) => e.icon === 'temperature');
    expect(temp).is.not.undefined;
    expect(temp!.direction).to.eq('gain');
    expect(temp!.amount).to.eq(2);
    expect(temp!.unit).to.eq('°C');
    expect(temp!.current).to.eq(game.getTemperature());
    expect(temp!.resulting).to.eq(game.getTemperature() + 2);
  });

  it('a maxed scale clamps to the chip`s own honest «no effect» (current === resulting)', () => {
    setTemperature(game, MAX_TEMPERATURE);
    const preview = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14);
    const temp = preview.effects.find((e) => e.icon === 'temperature');
    expect(temp!.current).to.eq(MAX_TEMPERATURE);
    expect(temp!.resulting).to.eq(MAX_TEMPERATURE);
  });

  it('oceans count their own tiles (oceans chip + target)', () => {
    const preview = buildStandardProjectPreview(player, new AquiferStandardProject(), 18);
    const oceans = preview.effects.find((e) => e.icon === 'oceans');
    expect(oceans).is.not.undefined;
    expect(oceans!.current).to.eq(0);
    expect(oceans!.resulting).to.eq(1);
    expect(preview.target).to.eq('space');
  });

  it('Aquifer with oceans maxed promises NO target (the committed fallback path)', () => {
    maxOutOceans(player);
    const preview = buildStandardProjectPreview(player, new AquiferStandardProject(), 18);
    expect(preview.target).to.eq(undefined);
  });

  it('co-located production hooks: Power Plant (energy), City (M€) — current → resulting', () => {
    player.production.add(Resource.ENERGY, 2);
    const power = buildStandardProjectPreview(player, new PowerPlantStandardProject(), 11);
    const energy = power.effects.find((e) => e.icon === 'energy' && e.note === 'production');
    expect(energy).is.not.undefined;
    expect(energy!.current).to.eq(2);
    expect(energy!.resulting).to.eq(3);

    const city = buildStandardProjectPreview(player, new CityStandardProject(), 25);
    const mc = city.effects.find((e) => e.icon === 'megacredits' && e.note === 'production');
    expect(mc).is.not.undefined;
    expect(mc!.amount).to.eq(1);
    expect(city.target).to.eq('space');
  });

  it('pay-on-commit targets are declared beside their overrides (Greenery → space, Colony → colony)', () => {
    expect(buildStandardProjectPreview(player, new GreeneryStandardProject(), 23).target).to.eq('space');
    expect(buildStandardProjectPreview(player, new BuildColonyStandardProject(), 17).target).to.eq('colony');
  });

  it('never mutates game state (a preview is read-only)', () => {
    player.megaCredits = 30;
    const before = JSON.stringify({
      mc: player.megaCredits,
      temp: game.getTemperature(),
      energyProd: player.production.energy,
      tr: player.terraformRating,
    });
    buildStandardProjectPreview(player, new AsteroidStandardProject(), 14);
    buildStandardProjectPreview(player, new PowerPlantStandardProject(), 11);
    buildStandardProjectPreview(player, new AquiferStandardProject(), 18);
    const after = JSON.stringify({
      mc: player.megaCredits,
      temp: game.getTemperature(),
      energyProd: player.production.energy,
      tr: player.terraformRating,
    });
    expect(after).to.eq(before);
  });
});

/** PL-066: the workspace's row showed the project's own chips and nothing of what the TABLE answers to them. */
describe('standardProjectPreview — what the TABLE answers (the forecast, PL-066)', () => {
  it('an asteroid under the ruling Greens names their 2 M€ before the press', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    expect(game.parliament!.rulingParty(), 'a fresh Redux table: the Greens').eq(PartyName.GREENS);
    player.megaCredits = 30;
    const preview = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14);
    const greens = (preview.forecast?.facts ?? []).find((f) => f.source.kind === 'party' && f.source.name === PartyName.GREENS);
    expect(greens, 'the Greens answer the TR step').is.not.undefined;
    expect(greens!.effects.some((e) => e.icon === 'megacredits' && e.amount === 2 && e.direction === 'gain')).is.true;
    expect(preview.forecast?.coverage).eq('complete');
  });

  it('a maxed temperature raises nothing — no step, no TR, no forecast', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    setTemperature(game, MAX_TEMPERATURE);
    player.megaCredits = 30;
    expect(buildStandardProjectPreview(player, new AsteroidStandardProject(), 14).forecast).is.undefined;
  });

  it('a quiet table answers nothing to a power plant', () => {
    const [, player] = testGame(2);
    player.megaCredits = 30;
    expect(buildStandardProjectPreview(player, new PowerPlantStandardProject(), 11).forecast).is.undefined;
  });
});
