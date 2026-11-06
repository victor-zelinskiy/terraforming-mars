import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {awardManifest} from '../../../src/server/awards/Awards';
import {IMilestone} from '../../../src/server/milestones/IMilestone';
import {AutomaMAEvaluation} from '../../../src/server/automa/AutomaMAEvaluation';
import {AutomaMilestonesAwards} from '../../../src/server/automa/AutomaMilestonesAwards';
import {AutomaTilePlacer} from '../../../src/server/automa/AutomaTilePlacer';
import {AutomaTerraformer} from '../../../src/server/automa/AutomaTerraformer';
import {resolveBonusCard, tryAwardHelper} from '../../../src/server/automa/AutomaBonusCards';
import {Suburbian} from '../../../src/server/awards/modular/Suburbian';
import {Administrator} from '../../../src/server/awards/modular/Administrator';
import {newProjectCard} from '../../../src/server/createCard';
import {hasPartyRequirement} from '../../../src/server/cards/requirements/partyRequirementCards';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {Board} from '../../../src/server/boards/Board';
import {testAutomaGame} from '../AutomaTestGame';

/**
 * STAGE 2 OF THE RANDOM-SET FRAMEWORK — the names the legacy switch had no rule for, each pinned against its source
 * (docs/AUTOMA_DATA_AUDIT.md §22.1 / §22.2): the value, the target, the displayed number on the player's scale, the
 * helper and its «impossible to resolve».
 */

function milestone(game: IGame, name: string): IMilestone {
  const m = milestoneManifest.createOrThrow(name);
  game.milestones.splice(0, game.milestones.length, m);
  return m;
}

function setTracks(game: IGame, positions: Partial<Record<string, number>>) {
  for (const track of game.automa!.board.tracks) {
    track.position = positions[track.definition.role] ?? track.position;
  }
}

describe('bot-rule registry — stage 2 rules', () => {
  it('Briber: 20 M€ meets it, the claim costs 12 M€, the row shows M€ like the human\'s', () => {
    const [game, , bot] = testAutomaGame({}, '-briber');
    const briber = milestone(game, 'Briber');
    bot.megaCredits = 19;
    expect(AutomaMAEvaluation.botMilestoneMet(briber, game)).is.false;
    expect(AutomaMAEvaluation.botMilestoneScore(briber, game), 'M€ — the human row speaks M€ too').eq(19);
    bot.megaCredits = 25;
    expect(AutomaMAEvaluation.botMilestoneMet(briber, game)).is.true;
    AutomaMilestonesAwards.claimMilestoneAction(game);
    expect(game.claimedMilestones.map((c) => c.milestone.name)).deep.eq(['Briber']);
    expect(bot.megaCredits, 'lose 12 MC').eq(13);
  });

  it('the module twins: Builder7 / Spacefarer4 / Terran5 read their tag track; Tactician4 reads 28 M€', () => {
    const [game, , bot] = testAutomaGame({}, '-twins');
    const cases: Array<[string, string, number]> = [['Builder7', 'building', 7], ['Spacefarer4', 'space', 4], ['Terran5', 'earth', 5]];
    for (const [name, role, target] of cases) {
      const m = milestone(game, name);
      setTracks(game, {[role]: target - 1});
      expect(AutomaMAEvaluation.botMilestoneMet(m, game), `${name} one short`).is.false;
      setTracks(game, {[role]: target});
      expect(AutomaMAEvaluation.botMilestoneMet(m, game), `${name} at ${target}`).is.true;
      expect(AutomaMAEvaluation.botMilestoneScore(m, game), `${name} shows its printed threshold`).eq(target);
    }
    const tactician4 = milestone(game, 'Tactician4');
    bot.megaCredits = 27;
    expect(AutomaMAEvaluation.botMilestoneMet(tactician4, game)).is.false;
    expect(AutomaMAEvaluation.botMilestoneScore(tactician4, game), 'floor(27·4/28) = 3 of 4').eq(3);
    bot.megaCredits = 28;
    expect(AutomaMAEvaluation.botMilestoneScore(tactician4, game)).eq(4);
  });

  it('Hydrologist / Thawer: the bot\'s OWN placements count — Government Intervention\'s do not', () => {
    const [game, , bot] = testAutomaGame({venusNextExtension: true}, '-hydro');
    const hydrologist = milestone(game, 'Hydrologist');
    for (let i = 0; i < 3; i++) {
      AutomaTilePlacer.placeOcean(game);
    }
    expect(bot.globalParameterSteps[GlobalParameter.OCEANS], 'the counter, not the board').eq(3);
    expect(AutomaMAEvaluation.botMilestoneMet(hydrologist, game)).is.false;
    AutomaTilePlacer.placeOcean(game);
    expect(AutomaMAEvaluation.botMilestoneMet(hydrologist, game)).is.true;

    const thawer = milestone(game, 'Thawer');
    const before = bot.globalParameterSteps[GlobalParameter.TEMPERATURE];
    AutomaTerraformer.raiseTemperature(game);
    expect(bot.globalParameterSteps[GlobalParameter.TEMPERATURE] - before).eq(1);
    // B16 raises a parameter under SOLAR — «track MarsBot's increases separately» means the bot's own.
    game.generation = 2;
    const steps = {...bot.globalParameterSteps};
    resolveBonusCard(game, BonusCardId.B16_GOVERNMENT_INTERVENTION);
    expect(bot.globalParameterSteps, 'Government Intervention is not the bot\'s raise').deep.eq(steps);
    expect(AutomaMAEvaluation.botMilestoneScore(thawer, game)).eq(bot.globalParameterSteps[GlobalParameter.TEMPERATURE]);
  });

  it('Landshaper: a city, a greenery and the building track at 5 — three parts on the human\'s scale', () => {
    const [game] = testAutomaGame({}, '-landshaper');
    const landshaper = milestone(game, 'Landshaper');
    expect(AutomaMAEvaluation.botMilestoneScore(landshaper, game)).eq(0);
    setTracks(game, {building: 5});
    expect(AutomaMAEvaluation.botMilestoneScore(landshaper, game)).eq(1);
    AutomaTilePlacer.placeCity(game);
    expect(AutomaMAEvaluation.botMilestoneScore(landshaper, game)).eq(2);
    expect(AutomaMAEvaluation.botMilestoneMet(landshaper, game)).is.false;
    AutomaTilePlacer.placeGreenery(game);
    expect(AutomaMAEvaluation.botMilestoneScore(landshaper, game)).eq(3);
    expect(AutomaMAEvaluation.botMilestoneMet(landshaper, game)).is.true;
  });

  it('Merchant: 2 on every track but Venus, shown as the human\'s 0 / 1 flag', () => {
    const [game] = testAutomaGame({venusNextExtension: true}, '-merchant');
    const merchant = milestone(game, 'Merchant');
    setTracks(game, {building: 2, space: 2, event: 2, science: 2, power: 2, earth: 2, bio: 1, venus: 0});
    expect(AutomaMAEvaluation.botMilestoneScore(merchant, game)).eq(0);
    setTracks(game, {bio: 2});
    expect(AutomaMAEvaluation.botMilestoneMet(merchant, game), 'Venus at 0 does not matter').is.true;
    expect(AutomaMAEvaluation.botMilestoneScore(merchant, game)).eq(1);
  });

  it('Producer: the three best tracks except Venus combined at 16', () => {
    const [game] = testAutomaGame({venusNextExtension: true}, '-producer');
    const producer = milestone(game, 'Producer');
    setTracks(game, {building: 6, space: 5, event: 4, science: 1, power: 0, earth: 0, bio: 0, venus: 12});
    expect(AutomaMAEvaluation.botMilestoneMet(producer, game), '6 + 5 + 4 = 15, Venus 12 not counted').is.false;
    setTracks(game, {event: 5});
    expect(AutomaMAEvaluation.botMilestoneMet(producer, game)).is.true;
    expect(AutomaMAEvaluation.botMilestoneScore(producer, game)).eq(16);
  });

  it('Philantropist / Sponsor read the played pile through the milestone\'s own predicate (Sponsor counts events)', () => {
    const [game] = testAutomaGame({}, '-pile');
    const sponsor = milestone(game, 'Sponsor');
    // Big Asteroid (event, 27 M€), Space Elevator (27, active), Nuclear Zone (10).
    game.automa!.playedPile = [CardName.BIG_ASTEROID, CardName.SPACE_ELEVATOR, CardName.NUCLEAR_ZONE];
    expect(AutomaMAEvaluation.botMilestoneScore(sponsor, game), 'the event counts for the bot').eq(2);
    const philantropist = milestone(game, 'Philantropist');
    // Space Elevator 2 VP counts; Nuclear Zone −2 VP does not; an event never does.
    expect(AutomaMAEvaluation.botMilestoneScore(philantropist, game)).eq(1);
  });

  it('Administrator: untagged cards in the pile + 2; its helper reveals an untagged card and gains 5 M€', () => {
    const [game, , bot] = testAutomaGame({}, '-admin');
    const administrator = awardManifest.createOrThrow('Administrator');
    game.automa!.playedPile = [];
    expect(AutomaMAEvaluation.botAwardScore(administrator, game), 'no card yet — the offset alone').eq(2);
    const mc = bot.megaCredits;
    expect(tryAwardHelper(game, 'Administrator')).is.true;
    const resolved = newProjectCard(game.automa!.playedPile[game.automa!.playedPile.length - 1])!;
    expect(Administrator.untagged(resolved), `${resolved.name} has no tags`).is.true;
    // An untagged card is, for the bot, the official Failed Action (+5 M€ — a card with no tags advances nothing), and
    // the helper's own «gains (an additional) 5 MC» comes on top: the very reason the module prints «additional».
    expect(bot.megaCredits - mc, '5 for the Failed Action + 5 for the helper').eq(10);
    expect(AutomaMAEvaluation.botAwardScore(administrator, game)).eq(3);
  });

  it('Collector: tracks at 3+; its helper advances the least-advanced track (impossible when it is maxed)', () => {
    const [game] = testAutomaGame({}, '-collector');
    const collector = awardManifest.createOrThrow('Collector');
    setTracks(game, {building: 3, space: 4, event: 2, science: 0, power: 3, earth: 1, bio: 9});
    expect(AutomaMAEvaluation.botAwardScore(collector, game)).eq(4);
    expect(tryAwardHelper(game, 'Collector')).is.true;
    // Science space 1 on Tharsis is an «advance» cell, so the push chains on — read that it moved, not where it stopped.
    expect(game.automa!.board.getTrackOfRole('science')!.position, 'the least-advanced (science) moved').is.greaterThan(0);
    expect(game.automa!.board.getTrackOfRole('earth')!.position, 'nothing else moved').eq(1);
    for (const track of game.automa!.board.tracks) {
      track.position = track.maxPosition;
    }
    expect(tryAwardHelper(game, 'Collector')).is.false;
  });

  it('Manufacturer: building + power; its helper advances the lower of the two, building if tied', () => {
    const [game] = testAutomaGame({}, '-manufacturer');
    const manufacturer = awardManifest.createOrThrow('Manufacturer');
    setTracks(game, {building: 3, power: 3});
    expect(AutomaMAEvaluation.botAwardScore(manufacturer, game)).eq(6);
    // Move off the icons: from 0 the helper lands on cells that may chain — read the TRACK, never the score.
    setTracks(game, {building: 0, power: 0});
    expect(tryAwardHelper(game, 'Manufacturer')).is.true;
    expect(game.automa!.board.getTrackOfRole('building')!.position, 'building on the tie').is.greaterThan(0);
    expect(game.automa!.board.getTrackOfRole('power')!.position).eq(0);
  });

  it('Constructor places a city; Suburbian places a greenery on the award\'s OWN edge set', () => {
    const [game, , bot] = testAutomaGame({}, '-tiles');
    expect(tryAwardHelper(game, 'Constructor')).is.true;
    expect(game.board.getCities(bot)).has.length(1);
    expect(tryAwardHelper(game, 'Suburbian')).is.true;
    const greenery = game.board.spaces.find((s) => s.player === bot && Board.isGreenerySpace(s))!;
    expect(Suburbian.onEdge(greenery), `${greenery.id} is an edge area`).is.true;
  });

  it('Activist / Influencer read the bot\'s own Agenda marker; Influencer has no helper (no door moves it)', () => {
    const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true}, '-agenda');
    const activist = milestone(game, 'Activist');
    const influencer = awardManifest.createOrThrow('Influencer');
    expect(AutomaMAEvaluation.botMilestoneScore(activist, game)).eq(0);
    ChairmanSeat.walkAgenda(bot, game.parliament!, 3, {reason: 'card', card: CardName.LOBBYING_CAMPAIGN});
    expect(game.parliament!.agendaOf(bot)).eq(3);
    expect(AutomaMAEvaluation.botMilestoneMet(activist, game)).is.true;
    expect(AutomaMAEvaluation.botAwardScore(influencer, game)).eq(3);
    expect(tryAwardHelper(game, 'Influencer')).is.false;
  });

  it('Politologist: party-requirement cards in the pile; its helper reveals one', () => {
    const [game] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true}, '-politologist');
    const politologist = awardManifest.createOrThrow('Politologist');
    game.automa!.playedPile = [];
    expect(AutomaMAEvaluation.botAwardScore(politologist, game)).eq(0);
    expect(tryAwardHelper(game, 'Politologist')).is.true;
    const resolved = newProjectCard(game.automa!.playedPile[game.automa!.playedPile.length - 1])!;
    expect(hasPartyRequirement(resolved), `${resolved.name} has a party requirement`).is.true;
    expect(AutomaMAEvaluation.botAwardScore(politologist, game)).eq(1);
  });

  it('Entrepreneur is the ONE honest zero and has no helper', () => {
    const [game] = testAutomaGame({aresExtension: true}, '-entrepreneur');
    const entrepreneur = awardManifest.createOrThrow('Entrepreneur');
    expect(AutomaMAEvaluation.botAwardScore(entrepreneur, game)).eq(0);
    expect(tryAwardHelper(game, 'Entrepreneur')).is.false;
  });

  it('Dataminer / Aeronaut read the bot\'s TOKENS, which survive a save — an old save reads none', () => {
    const [game] = testAutomaGame({}, '-tokens');
    const dataminer = milestone(game, 'Dataminer');
    game.automa!.tokens.data = 6;
    expect(AutomaMAEvaluation.botMilestoneMet(dataminer, game)).is.false;
    game.automa!.tokens.data = 7;
    expect(AutomaMAEvaluation.botMilestoneMet(dataminer, game)).is.true;
    game.automa!.tokens.fighter = 4;
    const aeronaut = milestone(game, 'Aeronaut');
    expect(AutomaMAEvaluation.botMilestoneScore(aeronaut, game)).eq(4);

    const serialized = game.serialize();
    expect(serialized.automa!.tokens).deep.eq({data: 7, fighter: 4});
    const restored = Game.deserialize(structuredClone(serialized));
    expect(restored.automa!.tokens).deep.eq({data: 7, fighter: 4});
    const old = structuredClone(serialized);
    delete old.automa!.tokens;
    expect(Game.deserialize(old).automa!.tokens, 'an old save').deep.eq({});
  });
});
