import {expect} from 'chai';
import {testGame} from '../TestGame';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {Priority} from '../../src/server/deferredActions/Priority';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {effectForecastForAction, effectForecastForPlay, grantOfEffect, tilesOfBranch} from '../../src/server/models/effectForecast';
import {allForecastFacts, forecastIsEmpty} from '../../src/common/models/EffectForecastModel';
import {CarbonNanosystems} from '../../src/server/cards/promo/CarbonNanosystems';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {Pets} from '../../src/server/cards/base/Pets';
import {EarthCatapult} from '../../src/server/cards/base/EarthCatapult';
import {GeologicalSurvey} from '../../src/server/cards/ares/GeologicalSurvey';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {Manutech} from '../../src/server/cards/venusNext/Manutech';
import {ArtificialPhotosynthesis} from '../../src/server/cards/base/ArtificialPhotosynthesis';
import {Bushes} from '../../src/server/cards/base/Bushes';
import {ViralEnhancers} from '../../src/server/cards/base/ViralEnhancers';
import {NitriteReducingBacteria} from '../../src/server/cards/base/NitriteReducingBacteria';
import {SoilBacteria} from '../../src/server/cards/prelude2/SoilBacteria';
import {SaturnSystems} from '../../src/server/cards/corporation/SaturnSystems';
import {IoMiningIndustries} from '../../src/server/cards/base/IoMiningIndustries';
import {MediaGroup} from '../../src/server/cards/base/MediaGroup';
import {MeatIndustry} from '../../src/server/cards/promo/MeatIndustry';
import {Livestock} from '../../src/server/cards/base/Livestock';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {OptimalAerobraking} from '../../src/server/cards/base/OptimalAerobraking';
import {Decomposers} from '../../src/server/cards/base/Decomposers';
import {TopsoilContract} from '../../src/server/cards/promo/TopsoilContract';
import {Splice} from '../../src/server/cards/promo/Splice';
import {Research} from '../../src/server/cards/base/Research';
import {ImportedHydrogen} from '../../src/server/cards/base/ImportedHydrogen';
import {NeptunianPowerConsultants} from '../../src/server/cards/promo/NeptunianPowerConsultants';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {maxOutOceans} from '../TestingUtils';
import {MAX_OCEAN_TILES} from '../../src/common/constants';
import {ICard} from '../../src/server/cards/ICard';
import {IPlayer} from '../../src/server/IPlayer';
import {asBranchFact, chipPool, ownTilesOf, sharedTilesOf, stripTouchedPools} from '../../src/server/models/effectForecast';
import {EffectForecastTile} from '../../src/server/cards/EffectForecastContext';
import {TileType} from '../../src/common/TileType';
import {anyPlayerTagReason, tagReason} from '../../src/server/cards/effectForecastPreviews';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {EffectForecastFact} from '../../src/common/models/EffectForecastModel';

/**
 * THE EFFECT FORECAST ENGINE — a MIRROR of the live fan-out, never a
 * simulation. Each spec pins one law of `effectForecast.ts`:
 *  · read-only (the game serializes identically before and after);
 *  · the same walk `Player.onCardPlayed` makes, including the played card
 *    itself («including this») and every other seat's reactors, addressed to
 *    their recipient;
 *  · the certainty ladder (exact / asks / conditional / deferred / unknown /
 *    skipped / no) decided by the SAME predicates the live hooks read;
 *  · the second-order and tile passes, the discounts and the payment values;
 *  · the «current → resulting» arrow stripped off a pool the card touches.
 */
function playForecast(player: IPlayer, card: ICard) {
  return effectForecastForPlay(player, card, cardPlayPreview(player, card));
}

function tileOfType(tileType: TileType, placementType = 'ocean'): EffectForecastTile {
  return {
    tileType, count: 1, placementType, offMars: false,
    countsAsCity: tileType === TileType.CITY, countsAsOcean: tileType === TileType.OCEAN, countsAsGreenery: false,
  };
}

describe('effectForecast (engine)', () => {
  it('is read-only: a full table of triggers, forecast, and the game is byte-identical', () => {
    const [game, player, opponent] = testGame(2);
    player.playedCards.push(new CarbonNanosystems(), new OlympusConference(), new RoverConstruction(), new EarthCatapult(), new Manutech(), new MeatIndustry(), new Pets());
    opponent.playedCards.push(new PharmacyUnion(), new SaturnSystems(), new ArcticAlgae());
    player.cardsInHand.push(new ImmigrantCity(), new GeologicalSurvey(), new IoMiningIndustries(), new Livestock());
    player.megaCredits = 60;
    player.production.override({energy: 2});
    const before = JSON.stringify(game.serialize());
    const eventsBefore = game.events.events.length;
    const deferredBefore = game.deferredActions.length;
    for (const card of player.cardsInHand) {
      playForecast(player, card);
    }
    expect(JSON.stringify(game.serialize())).to.eq(before);
    expect(game.events.events.length, 'no event recorded').to.eq(eventsBefore);
    expect(game.deferredActions.length, 'nothing deferred').to.eq(deferredBefore);
    expect(player.getWaitingFor(), 'no prompt raised').to.be.undefined;
  });

  it('answers an empty table honestly: no facts, no discount, coverage complete', () => {
    const [/* game */, player] = testGame(2);
    const survey = new GeologicalSurvey();
    player.cardsInHand.push(survey);
    const forecast = playForecast(player, survey);
    expect(forecast.facts).to.deep.eq([]);
    expect(forecast.coverage).to.eq('complete');
    expect(forecast.discounts).to.deep.eq({base: 8, final: 8, items: [], other: 0});
    expect(forecast.paymentValues).to.deep.eq([]);
    expect(forecastIsEmpty(forecast)).to.be.true;
  });

  it('mirrors the own-table walk: Carbon Nanosystems gains a graphene, Olympus Conference adds its first science silently', () => {
    const [/* game */, player] = testGame(2);
    const nano = new CarbonNanosystems();
    const olympus = new OlympusConference();
    player.playedCards.push(nano, olympus);
    const survey = new GeologicalSurvey();
    player.cardsInHand.push(survey);
    const forecast = playForecast(player, survey);
    const nanoFact = forecast.facts.find((f) => f.source.name === CardName.CARBON_NANOSYSTEMS);
    expect(nanoFact?.certainty).to.eq('exact');
    expect(nanoFact?.source.channel).to.eq('card-played');
    expect(nanoFact?.recipient).to.deep.eq({kind: 'you'});
    expect(nanoFact?.timing).to.eq('immediate');
    expect(nanoFact?.effects[0]).to.include({direction: 'gain', icon: 'graphene', amount: 1, current: 0, resulting: 1});
    expect(nanoFact?.reasonTag).to.eq(Tag.SCIENCE);
    // Zero science stored: the live callback ADDS without asking.
    const olympusFact = forecast.facts.find((f) => f.source.name === CardName.OLYMPUS_CONFERENCE);
    expect(olympusFact?.certainty).to.eq('exact');
    expect(olympusFact?.sequence).to.eq(Priority.OLYMPUS_CONFERENCE);
    expect(olympusFact?.timing).to.eq('before-card-choices');
    expect(forecast.coverage).to.eq('complete');
  });

  it('Olympus Conference with a science stored ASKS — the same test the deferred callback makes', () => {
    const [/* game */, player] = testGame(2);
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    player.playedCards.push(olympus);
    const survey = new GeologicalSurvey();
    player.cardsInHand.push(survey);
    const fact = playForecast(player, survey).facts.find((f) => f.source.name === CardName.OLYMPUS_CONFERENCE);
    expect(fact?.certainty).to.eq('asks');
    expect(fact?.effects.map((e) => e.icon)).to.deep.eq(['science', 'cards']);
    expect(fact?.alternatives?.[0].label).to.eq('Add a science resource to this card');
    expect(fact?.note).to.eq('Answer inside this play');
  });

  it('«including this»: the played card is a reactor of its own play', () => {
    const [/* game */, player] = testGame(2);
    const nano = new CarbonNanosystems();
    player.cardsInHand.push(nano);
    const facts = playForecast(player, nano).facts;
    expect(facts.map((f) => f.source.name)).to.include(CardName.CARBON_NANOSYSTEMS);
  });

  it('addresses another seat\'s reaction to THAT seat: an opponent\'s Pharmacy Union takes a disease and loses 4 M€', () => {
    const [/* game */, player, opponent] = testGame(2);
    const union = new PharmacyUnion();
    opponent.playedCards.push(union);
    opponent.megaCredits = 10;
    const bacteria = new NitriteReducingBacteria();
    player.cardsInHand.push(bacteria);
    const facts = playForecast(player, bacteria).facts;
    const fact = facts.find((f) => f.source.name === CardName.PHARMACY_UNION);
    expect(fact?.certainty).to.eq('exact');
    expect(fact?.source.channel).to.eq('card-played-by-any');
    expect(fact?.recipient).to.deep.eq({kind: 'player', color: opponent.color});
    expect(fact?.sequence).to.eq(Priority.PHARMACY_UNION);
    // Chips are written from the RECIPIENT's point of view (their pool).
    const loss = fact?.effects.find((e) => e.icon === Resource.MEGACREDITS);
    expect(loss).to.include({direction: 'cost', amount: 4, current: 10, resulting: 6});
    expect(fact?.effects.find((e) => e.icon === 'disease')).to.include({direction: 'gain', amount: 1});
  });

  it('reports a live hook with NO forecast as `unknown` and marks the coverage partial — never silence', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new SoilBacteria()); // prelude2 — out of scope, no forecast hook
    const bushes = new Bushes();
    player.cardsInHand.push(bushes);
    const forecast = playForecast(player, bushes);
    const fact = forecast.facts.find((f) => f.source.name === CardName.SOIL_BACTERIA);
    expect(fact?.certainty).to.eq('unknown');
    expect(fact?.note).to.eq('Not calculated');
    expect(forecast.coverage).to.eq('partial');
  });

  it('itemizes the discounts through getCardCostBreakdown', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new EarthCatapult());
    const io = new IoMiningIndustries();
    player.cardsInHand.push(io);
    const {discounts} = playForecast(player, io);
    expect(discounts.base).to.eq(41);
    expect(discounts.final).to.eq(39);
    expect(discounts.items).to.deep.eq([{source: {kind: 'card', card: CardName.EARTH_CATAPULT, owner: player.color}, amount: 2}]);
    expect(discounts.other).to.eq(0);
  });

  it('lists the payment values the play accepts (graphene on a space card) with the live count', () => {
    const [/* game */, player] = testGame(2);
    const nano = new CarbonNanosystems();
    nano.resourceCount = 2;
    player.playedCards.push(nano);
    const io = new IoMiningIndustries(); // space tag
    player.cardsInHand.push(io);
    const {paymentValues} = playForecast(player, io);
    expect(paymentValues).to.deep.eq([{
      source: {kind: 'card', card: CardName.CARBON_NANOSYSTEMS, owner: player.color},
      resource: 'Graphene', value: 4, count: 2,
    }]);
    // A plant card accepts no graphene — the value is a fact about THIS play.
    const bushes = new Bushes();
    player.cardsInHand.push(bushes);
    expect(playForecast(player, bushes).paymentValues).to.deep.eq([]);
  });

  it('runs the tile pass for a city the play will place — every seat\'s trigger, the played card included, as `deferred`', () => {
    const [/* game */, player, opponent] = testGame(2);
    player.playedCards.push(new RoverConstruction());
    opponent.playedCards.push(new Pets());
    player.production.override({energy: 1});
    const city = new ImmigrantCity();
    player.cardsInHand.push(city);
    const forecast = playForecast(player, city);
    const rover = forecast.facts.find((f) => f.source.name === CardName.ROVER_CONSTRUCTION);
    expect(rover?.certainty).to.eq('deferred');
    expect(rover?.timing).to.eq('after-placement');
    expect(rover?.effects[0]).to.include({icon: Resource.MEGACREDITS, amount: 2});
    const pets = forecast.facts.find((f) => f.source.name === CardName.PETS);
    expect(pets?.recipient).to.deep.eq({kind: 'player', color: opponent.color});
    expect(pets?.sequence).to.eq(Priority.OPPONENT_TRIGGER);
    // «including this» — Immigrant City reacts to its own city.
    const self = forecast.facts.find((f) => f.source.name === CardName.IMMIGRANT_CITY);
    expect(self?.certainty).to.eq('deferred');
    expect(self?.effects[0]).to.include({icon: Resource.MEGACREDITS, amount: 1, note: 'production'});
  });

  it('ties branch-dependent reactions to the branch POSITION (`byBranch`), never to `facts`', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new Manutech());
    const photosynthesis = new ArtificialPhotosynthesis(); // «ИЛИ»: plant production or energy production
    player.cardsInHand.push(photosynthesis);
    const forecast = playForecast(player, photosynthesis);
    expect(forecast.facts.filter((f) => f.source.name === CardName.MANUTECH)).to.deep.eq([]);
    expect(forecast.byBranch).to.not.be.undefined;
    const byBranch = forecast.byBranch ?? {};
    expect(Object.keys(byBranch).map(Number)).to.deep.eq([0, 1]);
    for (const pos of [0, 1]) {
      const fact = byBranch[pos][0];
      expect(fact.certainty).to.eq('conditional');
      expect(fact.condition).to.include({state: 'depends', branchPos: pos});
      expect(fact.source.channel).to.eq('production-gain');
    }
    expect(byBranch[0][0].effects[0].icon).to.eq(Resource.ENERGY);
    expect(byBranch[1][0].effects[0].icon).to.eq(Resource.PLANTS);
  });

  it('runs the second-order pass on the play\'s own grants and CASCADES the first-order facts', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new Manutech(), new MeatIndustry(), new TopsoilContract(), new Decomposers());
    const bushes = new Bushes(); // plant production +2, plants +2 → Manutech; plant tag → Decomposers' microbe → Topsoil
    player.cardsInHand.push(bushes);
    const forecast = playForecast(player, bushes);
    const manutech = forecast.facts.find((f) => f.source.name === CardName.MANUTECH);
    expect(manutech?.certainty).to.eq('exact');
    expect(manutech?.effects[0]).to.include({icon: Resource.PLANTS, amount: 2});
    const topsoil = forecast.facts.find((f) => f.source.name === CardName.TOPSOIL_CONTRACT);
    expect(topsoil, 'Decomposers\' microbe cascades into Topsoil Contract').to.not.be.undefined;
    expect(topsoil?.effects[0]).to.include({icon: Resource.MEGACREDITS, amount: 1});
    expect(forecast.facts.find((f) => f.source.name === CardName.MEAT_INDUSTRY), 'no animal moved').to.be.undefined;

    const pets = new Pets(); // adds an animal to itself on play
    player.cardsInHand.push(pets);
    const meat = playForecast(player, pets).facts.find((f) => f.source.name === CardName.MEAT_INDUSTRY);
    expect(meat?.effects[0]).to.include({icon: Resource.MEGACREDITS, amount: 2});
  });

  it('strips the «current → resulting» arrow off a pool the card touches itself, and keeps it elsewhere', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new ViralEnhancers(), new MediaGroup());
    player.plants = 5;
    const bushes = new Bushes(); // its OWN chips move plants
    player.cardsInHand.push(bushes);
    const viral = playForecast(player, bushes).facts.find((f) => f.source.name === CardName.VIRAL_ENHANCERS);
    expect(viral?.effects[0]).to.include({icon: Resource.PLANTS, amount: 1});
    expect(viral?.effects[0].current, 'the play already moves plants — no arrow').to.be.undefined;
    // An untouched pool keeps its arrow.
    const [/* g2 */, p2] = testGame(2, undefined, '-media');
    p2.playedCards.push(new MediaGroup());
    p2.megaCredits = 20;
    const asteroid = new Asteroid();
    p2.cardsInHand.push(asteroid);
    const media = playForecast(p2, asteroid).facts.find((f) => f.source.name === CardName.MEDIA_GROUP);
    expect(media?.effects[0]).to.include({icon: Resource.MEGACREDITS, amount: 3, current: 20, resulting: 23});
  });

  describe('the POOL rule — a card resource pool is `icon + host card`', () => {
    it('Decomposers + a microbe card that stores microbes on ITSELF: the reaction lands on Decomposers\' own pool, so its «0 → 1» survives (and the host is stamped)', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Decomposers());
      const bacteria = new NitriteReducingBacteria(); // its OWN chips put 3 microbes on itself
      player.cardsInHand.push(bacteria);
      const fact = playForecast(player, bacteria).facts.find((f) => f.source.name === CardName.DECOMPOSERS);
      expect(fact?.effects[0]).to.include({icon: 'microbe', amount: 1, current: 0, resulting: 1, host: CardName.DECOMPOSERS});
    });

    it('Splice + the same card: the microbe «on the played card» is the PLAYED card\'s pool, which the play touches — no arrow, the host is the played card', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Splice());
      const bacteria = new NitriteReducingBacteria();
      player.cardsInHand.push(bacteria);
      const asks = playForecast(player, bacteria).facts.find((f) => f.source.name === CardName.SPLICE && f.certainty === 'asks');
      expect(asks, 'Splice asks the card player').to.not.be.undefined;
      const microbe = asks?.effects.find((e) => e.icon === 'microbe');
      expect(microbe).to.include({host: CardName.NITRITE_REDUCING_BACTERIA});
      expect(microbe?.current, 'the played card\'s pool is the play\'s own').to.be.undefined;
    });

    it('Manutech + a card raising energy production: the energy pool is the player\'s own — the arrow is stripped, the delta stays', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Manutech());
      const photosynthesis = new ArtificialPhotosynthesis(); // branch 0: +2 energy production
      player.cardsInHand.push(photosynthesis);
      const manutech = (playForecast(player, photosynthesis).byBranch ?? {})[0]?.find((f) => f.source.name === CardName.MANUTECH);
      expect(manutech?.effects[0]).to.include({icon: Resource.ENERGY, amount: 2});
      expect(manutech?.effects[0].current, 'stock and production of one resource read as ONE pool for the arrow').to.be.undefined;
    });

    it('the rule itself, over synthetic chips: the host decides, a host-less card chip is touched by any own chip of that icon', () => {
      const played = new NitriteReducingBacteria();
      const own: Array<ActionEffect> = [{direction: 'gain', icon: 'microbe', amount: 3, note: 'on this card'}];
      expect(chipPool(own[0], played.name)).to.eq(`microbe|card:${played.name}`);
      expect(chipPool({direction: 'gain', icon: 'microbe', amount: 1, host: CardName.DECOMPOSERS})).to.eq(`microbe|card:${CardName.DECOMPOSERS}`);
      expect(chipPool({direction: 'gain', icon: 'microbe', amount: 1, note: 'to a card'})).to.eq('microbe|card:*');
      expect(chipPool({direction: 'gain', icon: 'energy', amount: 1, note: 'production'})).to.eq('energy|player');
      expect(chipPool({direction: 'gain', icon: 'energy', amount: 1})).to.eq('energy|player');
      const source = {kind: 'card' as const, name: CardName.DECOMPOSERS, owner: 'blue' as never, channel: 'card-played' as const};
      const base: Omit<EffectForecastFact, 'id' | 'effects'> = {source, certainty: 'exact', recipient: {kind: 'you'}, timing: 'immediate', reason: 'r'};
      const facts: Array<EffectForecastFact> = [
        {...base, id: 'source-pool', effects: [{direction: 'gain', icon: 'microbe', amount: 1, host: CardName.DECOMPOSERS, current: 0, resulting: 1}]},
        {...base, id: 'played-pool', effects: [{direction: 'gain', icon: 'microbe', amount: 1, host: played.name, current: 3, resulting: 4}]},
        {...base, id: 'unknown-host', effects: [{direction: 'gain', icon: 'microbe', amount: 1, current: 0, resulting: 1}]},
        {...base, id: 'foreign', recipient: {kind: 'player', color: 'red' as never}, effects: [{direction: 'gain', icon: 'microbe', amount: 1, host: played.name, current: 3, resulting: 4}]},
      ];
      const stripped = stripTouchedPools(facts, own, played);
      expect(stripped[0].effects[0].current, 'the source\'s own pool is untouched').to.eq(0);
      expect(stripped[1].effects[0].current, 'the played card\'s pool is touched').to.be.undefined;
      expect(stripped[2].effects[0].current, 'an unknown host is conservatively touched').to.be.undefined;
      expect(stripped[3].effects[0].current, 'a foreign pool is never the actor\'s own').to.eq(3);
    });
  });

  describe('the card-declared printed block and the per-tag reasons', () => {
    it('Pharmacy Union declares its blocks: the microbe half is #0, the science half #1, the order question neither', () => {
      const [/* game */, player, opponent] = testGame(2);
      opponent.playedCards.push(new PharmacyUnion());
      const bacteria = new NitriteReducingBacteria();
      player.cardsInHand.push(bacteria);
      const microbe = playForecast(player, bacteria).facts.find((f) => f.source.name === CardName.PHARMACY_UNION);
      expect(microbe?.source.printedEffect).to.eq(0);
      expect(microbe?.reason).to.eq('Any player plays a card with a microbe tag');

      const [/* g2 */, owner] = testGame(2, undefined, '-pu-science');
      const union = new PharmacyUnion();
      union.resourceCount = 1;
      owner.playedCards.push(union);
      const research = new Research(); // two science tags
      owner.cardsInHand.push(research);
      const science = playForecast(owner, research).facts.filter((f) => f.source.name === CardName.PHARMACY_UNION);
      expect(science.length).to.be.greaterThan(0);
      for (const fact of science) {
        expect(fact.source.printedEffect, `${fact.id}`).to.eq(1);
        expect(fact.reason).to.eq('You play a card with a science tag');
      }
    });

    it('a tag reason is ONE key per tag in the player\'s grammar, never a `${0}` sentence — the twelve scope tags are named, the rest keep the parameterised fallback', () => {
      expect(tagReason(Tag.SCIENCE)).to.eq('You play a card with a science tag');
      expect(tagReason(Tag.EARTH)).to.eq('You play a card with an Earth tag');
      expect(anyPlayerTagReason(Tag.JOVIAN)).to.eq('Any player plays a card with a Jovian tag');
      expect(tagReason(Tag.WILD)).to.eq('You play a card with a ${0} tag');
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new CarbonNanosystems(), new SaturnSystems());
      const io = new IoMiningIndustries(); // space + Jovian
      const survey = new GeologicalSurvey(); // science
      player.cardsInHand.push(io, survey);
      expect(playForecast(player, survey).facts.find((f) => f.source.name === CardName.CARBON_NANOSYSTEMS)?.reason).to.eq('You play a card with a science tag');
      expect(playForecast(player, io).facts.find((f) => f.source.name === CardName.SATURN_SYSTEMS)?.reason).to.eq('Any player plays a card with a Jovian tag');
    });
  });

  it('a tile EVERY branch places is branch-INDEPENDENT: Imported Hydrogen\'s ocean fires the opponent\'s Neptunian Power Consultants in `facts`, never inside an «ИЛИ» option', () => {
    const [/* game */, player, opponent] = testGame(2);
    opponent.playedCards.push(new NeptunianPowerConsultants());
    opponent.megaCredits = 20;
    const hydrogen = new ImportedHydrogen(); // gain 3 plants OR microbes OR animals to ANOTHER card — and an ocean, always
    player.cardsInHand.push(hydrogen);
    const forecast = playForecast(player, hydrogen);
    const shared = forecast.facts.filter((f) => f.source.name === CardName.NEPTUNIAN_POWER_CONSULTANTS);
    expect(shared, 'the ocean is placed whatever the player picks — the reaction is not tied to a branch').to.have.length(1);
    expect(shared[0].certainty).to.eq('asks');
    expect(shared[0].recipient).to.deep.eq({kind: 'player', color: opponent.color});
    expect(shared[0].timing).to.eq('after-placement');
    for (const list of Object.values(forecast.byBranch ?? {})) {
      expect(list.some((f) => f.source.name === CardName.NEPTUNIAN_POWER_CONSULTANTS), 'no copy inside a branch').to.be.false;
    }
  });

  describe('what will NOT happen is not forecast', () => {
    it('oceans maxed: the ocean the card prints is never placed (the live PlaceOceanTile skips) — no ocean reaction, no placement step', () => {
      const [/* game */, player, opponent] = testGame(2);
      opponent.playedCards.push(new ArcticAlgae(), new NeptunianPowerConsultants());
      opponent.megaCredits = 20;
      maxOutOceans(player);
      const hydrogen = new ImportedHydrogen();
      player.cardsInHand.push(hydrogen);
      const preview = cardPlayPreview(player, hydrogen);
      for (const branch of preview.branches) {
        expect(branch.steps.some((s) => s.kind === 'boardPlacement'), 'no placement is promised').to.be.false;
      }
      const forecast = effectForecastForPlay(player, hydrogen, preview);
      expect(allForecastFacts(forecast).filter((f) => f.source.channel === 'tile-placed')).to.deep.eq([]);
    });

    it('one ocean left: a two-ocean card places ONE — Arctic Algae pays for one, and the step says one', () => {
      const [/* game */, player, opponent] = testGame(2);
      opponent.playedCards.push(new ArcticAlgae());
      maxOutOceans(player, MAX_OCEAN_TILES - 1);
      const lake = new LakeMarineris(); // ocean: {count: 2}
      player.cardsInHand.push(lake);
      const preview = cardPlayPreview(player, lake);
      const step = preview.branches[0].steps.find((s) => s.kind === 'boardPlacement');
      expect(step !== undefined && step.kind === 'boardPlacement' && (step.count ?? 1)).to.eq(1);
      const algae = effectForecastForPlay(player, lake, preview).facts.find((f) => f.source.name === CardName.ARCTIC_ALGAE);
      expect(algae?.effects[0]).to.include({icon: Resource.PLANTS, amount: 2});
      // …and with two left, both oceans count.
      const [/* g2 */, p2, o2] = testGame(2, undefined, '-two-left');
      o2.playedCards.push(new ArcticAlgae());
      maxOutOceans(p2, MAX_OCEAN_TILES - 2);
      const lake2 = new LakeMarineris();
      p2.cardsInHand.push(lake2);
      expect(playForecast(p2, lake2).facts.find((f) => f.source.name === CardName.ARCTIC_ALGAE)?.effects[0]).to.include({amount: 4});
    });

    it('the engine clamps a bespoke ocean step on its own (a preview that did not): none left → no tile, one left → one', () => {
      const [/* game */, player] = testGame(2);
      const branch = (count: number | undefined) => ({index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [
        {kind: 'boardPlacement' as const, placementType: 'ocean', tileType: TileType.OCEAN, count},
      ]});
      maxOutOceans(player, MAX_OCEAN_TILES - 1);
      expect(tilesOfBranch(player, branch(2), undefined).map((t) => t.count)).to.deep.eq([1]);
      maxOutOceans(player);
      expect(tilesOfBranch(player, branch(undefined), undefined)).to.deep.eq([]);
      // A composite laid over an ocean is not a new ocean and is never clamped.
      expect(tilesOfBranch(player, {...branch(undefined), steps: [{kind: 'boardPlacement', placementType: 'ocean', tileType: TileType.OCEAN_CITY}]}, undefined)).to.have.length(1);
    });

    it('a gain that changes NOTHING (a parameter at its cap) is no grant; a lone branch the rules refuse grants and places nothing', () => {
      expect(grantOfEffect({direction: 'gain', icon: 'oxygen', amount: 1, current: 14, resulting: 14, unit: '%'})).to.be.undefined;
      expect(grantOfEffect({direction: 'gain', icon: 'steel', amount: 2, current: 3, resulting: 5, note: 'production'})).to.deep.eq({kind: 'production', resource: Resource.STEEL, amount: 2});
      const [/* game */, player, opponent] = testGame(2);
      player.playedCards.push(new Manutech());
      opponent.playedCards.push(new ArcticAlgae());
      const pumping = new AquiferPumping();
      player.playedCards.push(pumping);
      player.megaCredits = 0; // cannot pay the 8 M€ — the action is refused
      const preview = actionPreview(player, pumping);
      expect(preview.branches[0].available).to.be.false;
      expect(allForecastFacts(effectForecastForAction(player, pumping, preview))).to.deep.eq([]);
    });
  });

  it('a fact tied to an option keeps a degree that already says «will not run»: skipped stays skipped, no stays no, unknown stays unknown; the rest read conditional', () => {
    const source = {kind: 'card' as const, name: CardName.NEPTUNIAN_POWER_CONSULTANTS, owner: 'red' as never, channel: 'tile-placed' as const};
    const base = {id: 'x', source, recipient: {kind: 'player' as const, color: 'red' as never}, timing: 'after-placement' as const, effects: [], reason: 'An ocean tile is placed'};
    expect(asBranchFact({...base, certainty: 'skipped'}, 1)).to.include({certainty: 'skipped'});
    expect(asBranchFact({...base, certainty: 'no'}, 1)).to.include({certainty: 'no'});
    expect(asBranchFact({...base, certainty: 'unknown'}, 1)).to.include({certainty: 'unknown'});
    expect(asBranchFact({...base, certainty: 'exact'}, 1)).to.include({certainty: 'conditional'});
    expect(asBranchFact({...base, certainty: 'asks'}, 1)).to.include({certainty: 'conditional'});
    expect(asBranchFact({...base, certainty: 'deferred'}, 1).condition).to.deep.eq({text: 'An ocean tile is placed', state: 'depends', branchPos: 1});
  });

  it('splits shared and own tiles as MULTISETS: what every available option places is the play\'s, the remainder stays the option\'s', () => {
    const ocean = tileOfType(TileType.OCEAN);
    const city = tileOfType(TileType.CITY, 'city');
    // Three options; the third is unavailable (no steps) and cannot vote.
    const perBranch = [[ocean, city], [ocean], []];
    const shared = sharedTilesOf(perBranch, [true, true, false]);
    expect(shared.map((t) => t.tileType)).to.deep.eq([TileType.OCEAN]);
    expect(ownTilesOf(perBranch[0], shared).map((t) => t.tileType)).to.deep.eq([TileType.CITY]);
    expect(ownTilesOf(perBranch[1], shared)).to.deep.eq([]);
    // Two oceans in one option, one in the other → ONE is shared, one stays own.
    const twoVsOne = sharedTilesOf([[ocean, ocean], [ocean]], [true, true]);
    expect(twoVsOne).to.have.length(1);
    expect(ownTilesOf([ocean, ocean], twoVsOne)).to.have.length(1);
    // No available option → nothing is certain.
    expect(sharedTilesOf([[ocean], [ocean]], [false, false])).to.deep.eq([]);
  });

  it('reports the «almost» as `no` (a space card that is not an event, for Optimal Aerobraking)', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new OptimalAerobraking());
    const io = new IoMiningIndustries(); // space, not an event
    player.cardsInHand.push(io);
    const fact = playForecast(player, io).facts.find((f) => f.source.name === CardName.OPTIMAL_AEROBRAKING);
    expect(fact?.certainty).to.eq('no');
    expect(fact?.reason).to.eq('The card is not an event');
    expect(fact?.condition?.state).to.eq('unmet');
  });

  it('forecasts an ACTION: the tile pass for an ocean-placing action, no card-played pass, no discount', () => {
    const [/* game */, player, opponent] = testGame(2);
    const pumping = new AquiferPumping();
    player.playedCards.push(pumping);
    opponent.playedCards.push(new ArcticAlgae());
    player.megaCredits = 20;
    const preview = actionPreview(player, pumping);
    const forecast = effectForecastForAction(player, pumping, preview);
    const algae = forecast.facts.find((f) => f.source.name === CardName.ARCTIC_ALGAE);
    expect(algae?.certainty).to.eq('deferred');
    expect(algae?.recipient).to.deep.eq({kind: 'player', color: opponent.color});
    expect(algae?.effects[0]).to.include({icon: Resource.PLANTS, amount: 2});
    expect(forecast.discounts.items).to.deep.eq([]);
    expect(forecast.paymentValues).to.deep.eq([]);
  });

  it('mirrors the MarsBot corporation: Saturn Systems advances the event track for the bot on a Jovian card', () => {
    const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C08_SATURN_SYSTEMS}, '-fc-saturn');
    game.playerIsFinishedWithResearchPhase(human); // seats the corporation
    const io = new IoMiningIndustries();
    human.cardsInHand.push(io);
    const forecast = playForecast(human, io);
    const fact = forecast.facts.find((f) => f.source.kind === 'automa-corporation');
    expect(fact?.source.name).to.eq(CardName.SATURN_SYSTEMS);
    expect(fact?.certainty).to.eq('exact');
    expect(fact?.recipient.kind).to.eq('bot');
    expect(fact?.effects[0]).to.include({icon: 'track', amount: 1});
    expect(forecast.coverage).to.eq('complete');
  });

  it('derives grants from chips the way the second-order hooks see them', () => {
    expect(grantOfEffect({direction: 'gain', icon: 'steel', amount: 2, note: 'production'})).to.deep.eq({kind: 'production', resource: Resource.STEEL, amount: 2});
    expect(grantOfEffect({direction: 'gain', icon: 'animal', amount: 1, note: 'on this card'})).to.deep.eq({kind: 'cardResource', resource: 'Animal', amount: 1, target: 'self'});
    expect(grantOfEffect({direction: 'gain', icon: 'microbe', amount: 3, note: 'to a card'})).to.deep.eq({kind: 'cardResource', resource: 'Microbe', amount: 3, target: 'any'});
    expect(grantOfEffect({direction: 'cost', icon: 'steel', amount: 2, note: 'production'})).to.be.undefined;
    expect(grantOfEffect({direction: 'gain', icon: 'tr', amount: 1})).to.deep.eq({kind: 'tr', amount: 1});
  });

  it('reads the tiles a branch will place off its board placement steps (markers place nothing)', () => {
    const [/* game */, player] = testGame(2);
    const city = new ImmigrantCity();
    player.production.override({energy: 1});
    const preview = cardPlayPreview(player, city);
    const tiles = tilesOfBranch(player, preview.branches[0], city.behavior);
    expect(tiles).to.have.length(1);
    expect(tiles[0]).to.include({countsAsCity: true, countsAsOcean: false, count: 1, offMars: false});
  });

  it('collects every fact, branch-tied ones included', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new Manutech());
    const photosynthesis = new ArtificialPhotosynthesis();
    player.cardsInHand.push(photosynthesis);
    const forecast = playForecast(player, photosynthesis);
    expect(allForecastFacts(forecast)).to.have.length(2);
  });
});
