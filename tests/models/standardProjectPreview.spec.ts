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
import {MAX_TEMPERATURE, TEMPERATURE_BONUS_FOR_HEAT_1, TEMPERATURE_FOR_OCEAN_BONUS} from '../../src/common/constants';
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
    expect(preview.effects.some((e) => e.icon === 'tr'), 'a step the ceiling cuts carries no rating chip (PL-147)').is.false;
  });

  /** PL-147: the formula read «−30 → −28 °C» and said nothing of the TR the press pays. */
  it('the step\'s OWN RATING follows the scale chip — implied, bare, on every door alike', () => {
    const asteroid = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14);
    const temp = asteroid.effects.findIndex((e) => e.icon === 'temperature');
    expect(asteroid.effects[temp + 1]).deep.eq({direction: 'gain', icon: 'tr', amount: 1, implied: true});
    const aquifer = buildStandardProjectPreview(player, new AquiferStandardProject(), 18);
    const oceans = aquifer.effects.findIndex((e) => e.icon === 'oceans');
    expect(aquifer.effects[oceans + 1], 'an ocean tile is a rating step too').deep.eq({direction: 'gain', icon: 'tr', amount: 1, implied: true});
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

/** PL-147: the thresholds a raise crosses are the engine's own (`claimCrossedScaleBonuses`) — the composer never named them. */
describe('standardProjectPreview — the BONUS STEPS the raise crosses (PL-147)', () => {
  function reduxTable(): [IGame, TestPlayer] {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    expect(game.parliament!.rulingParty(), 'a fresh Redux table: the Greens').eq(PartyName.GREENS);
    player.megaCredits = 30;
    return [game, player];
  }

  it('an asteroid at −26 °C crosses −24 °C: the heat production step is a fact of the track, and the Greens answer THAT production too', () => {
    const [game, player] = reduxTable();
    setTemperature(game, TEMPERATURE_BONUS_FOR_HEAT_1 - 2);
    const facts = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14).forecast?.facts ?? [];
    const heat = facts.find((f) => f.id.endsWith('temperature-heat-bonus-1'));
    expect(heat, JSON.stringify(facts.map((f) => f.id))).is.not.undefined;
    expect(heat!.source).deep.include({kind: 'rule', name: 'Temperature track bonus'});
    expect(heat!.recipient.kind).eq('you');
    expect(heat!.certainty).eq('exact');
    expect(heat!.effects[0]).deep.include({direction: 'gain', icon: 'heat', amount: 1, note: 'production'});
    const greensProduction = facts.find((f) => f.id.endsWith('greens-production'));
    expect(greensProduction, 'the Greens raise the M€ production with the heat production the track grants').is.not.undefined;
    expect(greensProduction!.effects[0]).deep.include({icon: 'megacredits', amount: 1, note: 'production'});
    expect(facts.find((f) => f.id.endsWith('greens-tr'))!.effects[0].amount, 'and 2 M€ for the one TR step').eq(2);
  });

  it('an asteroid at −2 °C crosses 0 °C: the ocean is a fact of the track (asked once the step is made), its own TR counted for the Greens', () => {
    const [game, player] = reduxTable();
    setTemperature(game, TEMPERATURE_FOR_OCEAN_BONUS - 2);
    const facts = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14).forecast?.facts ?? [];
    const ocean = facts.find((f) => f.id.endsWith('temperature-ocean-bonus'));
    expect(ocean, JSON.stringify(facts.map((f) => f.id))).is.not.undefined;
    expect(ocean!.certainty).eq('exact');
    expect(ocean!.timing).eq('after-card');
    expect(ocean!.effects[0]).deep.include({direction: 'gain', icon: 'oceans', amount: 1});
    expect(facts.find((f) => f.id.endsWith('greens-tr'))!.effects[0].amount, 'the temperature step AND the ocean tile: two rating steps').eq(4);
  });

  it('…and with no ocean left the crossing is a NAMED skip, never silence', () => {
    const [game, player] = reduxTable();
    setTemperature(game, TEMPERATURE_FOR_OCEAN_BONUS - 2);
    maxOutOceans(player);
    const facts = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14).forecast?.facts ?? [];
    const ocean = facts.find((f) => f.id.endsWith('temperature-ocean-bonus'));
    expect(ocean!.certainty).eq('skipped');
    expect(ocean!.note).eq('No ocean is left to place');
    expect(facts.find((f) => f.id.endsWith('greens-tr'))!.effects[0].amount, 'one rating step only').eq(2);
  });

  it('a step that crosses nothing names nothing', () => {
    const [game, player] = reduxTable();
    setTemperature(game, -10);
    const facts = buildStandardProjectPreview(player, new AsteroidStandardProject(), 14).forecast?.facts ?? [];
    expect(facts.filter((f) => f.source.kind === 'rule')).deep.eq([]);
  });
});
