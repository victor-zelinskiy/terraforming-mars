import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Resource} from '../../src/common/Resource';
import {actionPreview} from '../../src/server/models/actionPreview';
import {RegolithEaters} from '../../src/server/cards/base/RegolithEaters';
import {Ants} from '../../src/server/cards/base/Ants';
import {Predators} from '../../src/server/cards/base/Predators';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {NitriteReducingBacteria} from '../../src/server/cards/base/NitriteReducingBacteria';
import {TitanAirScrapping} from '../../src/server/cards/colonies/TitanAirScrapping';
import {TitanShuttles} from '../../src/server/cards/colonies/TitanShuttles';
import {AsteroidRights} from '../../src/server/cards/promo/AsteroidRights';
import {CometAiming} from '../../src/server/cards/promo/CometAiming';
import {WeatherBalloons} from '../../src/server/cards/promo/WeatherBalloons';
import {SelfReplicatingRobots} from '../../src/server/cards/promo/SelfReplicatingRobots';
import {PhysicsComplex} from '../../src/server/cards/base/PhysicsComplex';
import {DecreaseAnyProduction} from '../../src/server/deferredActions/DecreaseAnyProduction';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {CardName} from '../../src/common/cards/CardName';
import {cast} from '../../src/common/utils/utils';
import {addCity, churn, runAllActions} from '../TestingUtils';

describe('actionPreview', () => {
  it('declarative multi-branch (Regolith Eaters): two branches, both available with resources', () => {
    const [/* game */, player] = testGame(2);
    const card = new RegolithEaters();
    card.resourceCount = 2;

    const preview = actionPreview(player, card);
    expect(preview.kind).eq('declarative');
    expect(preview.cardResource).deep.eq({type: card.resourceType, count: 2});
    expect(preview.branches).has.length(2);

    // behaviors[0] = spend 2 microbes → +O2; behaviors[1] = add 1 microbe.
    const [spend, add] = preview.branches;
    expect(spend.available).is.true;
    expect(add.available).is.true;
    // Both available + 2 branches → real OrOptions, runtime indices 0 and 1.
    expect(spend.index).eq(0);
    expect(add.index).eq(1);

    // The spend branch shows a cost chip (2 microbes: 2 → 0) AND a gain chip
    // (oxygen, current → resulting). No interactive steps.
    expect(spend.steps).has.length(0);
    const microbeCost = spend.effects.find((e) => e.direction === 'cost');
    expect(microbeCost, 'expected a microbe cost effect').is.not.undefined;
    expect(microbeCost?.current).eq(2);
    expect(microbeCost?.resulting).eq(0);
    const oxygenGain = spend.effects.find((e) => e.icon === 'oxygen');
    expect(oxygenGain, 'expected an oxygen gain effect').is.not.undefined;
    expect(oxygenGain?.direction).eq('gain');
    expect(oxygenGain?.unit).eq('%');
    expect(oxygenGain?.resulting).eq((oxygenGain?.current ?? 0) + 1);

    // The add branch resolves immediately — a single gain chip, no steps.
    expect(add.steps).has.length(0);
    const microbeGain = add.effects.find((e) => e.direction === 'gain');
    expect(microbeGain, 'expected a microbe gain effect').is.not.undefined;
    expect(microbeGain?.current).eq(2);
    expect(microbeGain?.resulting).eq(3);
  });

  it('declarative multi-branch: one executable branch + autoSelect collapses to no branch pick (index -1)', () => {
    const [/* game */, player] = testGame(2);
    const card = new RegolithEaters();
    card.resourceCount = 0; // can't spend 2 → only "add" is executable

    const preview = actionPreview(player, card);
    const [spend, add] = preview.branches;

    expect(spend.available).is.false;
    expect(spend.unavailableReason, 'spend branch should explain why').is.not.undefined;
    expect(spend.index).eq(-1);
    // An UNAVAILABLE branch still carries its effects so the modal can show the
    // shortfall context (have 0, need 2) — not just a bare "unavailable".
    const cost = spend.effects.find((e) => e.direction === 'cost');
    expect(cost, 'unavailable spend branch should still expose its cost').is.not.undefined;
    expect(cost?.current).eq(0);
    expect(cost?.amount).eq(2);

    expect(add.available).is.true;
    // autoSelect=true + exactly one executable branch → server resolves without
    // an OrOptions, so the lone branch carries no branch pick.
    expect(add.index).eq(-1);
  });

  it('READ-ONLY: building a preview never mutates player / card / game state', () => {
    const [game, player] = testGame(2);
    const card = new RegolithEaters();
    card.resourceCount = 2;

    const before = JSON.stringify({
      resourceCount: card.resourceCount,
      mc: player.megaCredits,
      steel: player.steel,
      titanium: player.titanium,
      energy: player.energy,
      plants: player.plants,
      heat: player.heat,
      oxygen: game.getOxygenLevel(),
      temperature: game.getTemperature(),
      deferred: game.deferredActions.length,
      waitingFor: player.getWaitingFor() !== undefined,
    });

    actionPreview(player, card);

    const after = JSON.stringify({
      resourceCount: card.resourceCount,
      mc: player.megaCredits,
      steel: player.steel,
      titanium: player.titanium,
      energy: player.energy,
      plants: player.plants,
      heat: player.heat,
      oxygen: game.getOxygenLevel(),
      temperature: game.getTemperature(),
      deferred: game.deferredActions.length,
      waitingFor: player.getWaitingFor() !== undefined,
    });

    expect(after).eq(before);
    // The preview must not leave a prompt waiting on the player.
    expect(player.getWaitingFor()).is.undefined;
  });

  it('DecreaseAnyProduction.previewSelectPlayer: target picker with current→result data', () => {
    const [/* game */, player, opponent] = testGame(2);
    player.production.add(Resource.ENERGY, 2);
    opponent.production.add(Resource.ENERGY, 2);

    const model = new DecreaseAnyProduction(player, Resource.ENERGY, {count: 1}).previewSelectPlayer();
    expect(model, 'a choice should be offered with two reducible players').is.not.undefined;
    expect(model?.type).eq('player');
    expect(model?.scope).eq('production');
    expect(model?.icon).eq(Resource.ENERGY);
    expect(model?.players).includes(player.color);
    expect(model?.players).includes(opponent.color);
  });

  it('DecreaseAnyProduction.previewSelectPlayer: an unreducible opponent is shown disabled with a reason', () => {
    const [/* game */, player, opponent] = testGame(2);
    player.production.add(Resource.ENERGY, 2);
    // opponent has 0 energy production → cannot be reduced.

    const model = new DecreaseAnyProduction(player, Resource.ENERGY, {count: 1}).previewSelectPlayer();
    expect(model).is.not.undefined;
    const disabled = model?.disabledPlayers?.find((d) => d.color === opponent.color);
    expect(disabled, 'the unreducible opponent should be a disabled target').is.not.undefined;
  });

  it('bespoke hook (Ants): a card-target picker step with multiple owners', () => {
    const [/* game */, player, player2] = testGame(2);
    const ants = new Ants();
    player.playedCards.push(ants);
    const tardigrades = new Tardigrades();
    const nitrite = new NitriteReducingBacteria();
    player2.playedCards.push(tardigrades, nitrite);
    tardigrades.resourceCount++;
    nitrite.resourceCount++;

    const preview = actionPreview(player, ants);
    expect(preview.kind).eq('bespoke');
    expect(preview.cardResource?.type).eq(ants.resourceType);
    const branch = preview.branches[0];
    expect(branch.available).is.true;
    const step = branch.steps.find((s) => s.kind === 'input');
    expect(step, 'expected a card-target input step').is.not.undefined;
    if (step?.kind === 'input' && step.input.type === 'card') {
      expect(step.input.cards).has.length(2);
      expect(step.input.showOwner).is.true;
    }
  });

  it('bespoke hook (Predators): no target → unavailable branch, no step', () => {
    const [/* game */, player] = testGame(2);
    const preview = actionPreview(player, new Predators());
    expect(preview.kind).eq('bespoke');
    const branch = preview.branches[0];
    expect(branch.available).is.false;
    expect(branch.steps).has.length(0);
  });

  // The submit protocol: the branch-pick response the batch route replays
  // ({type:'or', index, response:{type:'option'}}) must execute the chosen branch.
  // The preview reports the SAME runtime index, so the round-trips line up.
  describe('branch submit protocol', () => {
    it('picking the spend branch (index 0) raises oxygen and spends from the card', () => {
      const [game, player] = testGame(2);
      const card = new RegolithEaters();
      card.resourceCount = 2;
      player.playedCards.push(card);

      // The preview's spend branch (the one that raises oxygen) is runtime index 0.
      const preview = actionPreview(player, card);
      const spend = preview.branches.find((b) => b.effects.some((e) => e.icon === 'oxygen'));
      expect(spend?.index).eq(0);

      const or = cast(churn(card.action(player), player), OrOptions);
      or.process({type: 'or', index: 0, response: {type: 'option'}}, player);
      runAllActions(game);

      expect(game.getOxygenLevel()).eq(1);
      expect(card.resourceCount).eq(0);
    });

    it('picking the add branch (index 1) adds a microbe', () => {
      const [game, player] = testGame(2);
      const card = new RegolithEaters();
      card.resourceCount = 2;
      player.playedCards.push(card);

      const or = cast(churn(card.action(player), player), OrOptions);
      or.process({type: 'or', index: 1, response: {type: 'option'}}, player);
      runAllActions(game);

      expect(card.resourceCount).eq(3);
    });
  });

  // The bespoke `orBranches` builder must assign the SAME runtime indices the
  // card's own action() builds, including the auto-resolve-on-single rule.
  describe('bespoke multi-branch (orBranches)', () => {
    it('TitanAirScrapping: spend index 0, add index 1, matching + executing the live OrOptions', () => {
      const [game, player] = testGame(2);
      const card = new TitanAirScrapping();
      card.resourceCount = 2;
      player.titanium = 1;
      player.playedCards.push(card);

      const preview = actionPreview(player, card);
      expect(preview.kind).eq('bespoke');
      expect(preview.branches).has.length(2);
      expect(preview.branches[0].available).is.true;
      expect(preview.branches[0].index).eq(0);
      expect(preview.branches[1].available).is.true;
      expect(preview.branches[1].index).eq(1);

      // The live OrOptions order matches; index 0 spends 2 floaters for +1 TR.
      const or = cast(card.action(player), OrOptions);
      expect(or.options).has.length(2);
      const tr0 = player.terraformRating;
      or.process({type: 'or', index: 0, response: {type: 'option'}}, player);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(player.terraformRating).eq(tr0 + 1);
    });

    it('TitanAirScrapping: a single executable branch auto-resolves (index -1)', () => {
      const [/* game */, player] = testGame(2);
      const card = new TitanAirScrapping();
      card.resourceCount = 0; // no floaters → spend unavailable
      player.titanium = 1; // only "add" is executable
      player.playedCards.push(card);

      const preview = actionPreview(player, card);
      expect(preview.branches[0].available).is.false;
      expect(preview.branches[0].index).eq(-1);
      expect(preview.branches[1].available).is.true;
      expect(preview.branches[1].index).eq(-1); // auto-resolve → no branch pick
    });

    // A branch whose OrOptions option is a SelectAmount DIRECTLY carries an
    // `optionInput` (not a step); the amount nests into the branch pick.
    it('TitanShuttles: the spend branch carries an optionInput (SelectAmount) the submit nests', () => {
      const [game, player] = testGame(2);
      const card = new TitanShuttles();
      card.resourceCount = 3;
      player.playedCards.push(card);

      const preview = actionPreview(player, card);
      const spend = preview.branches[1];
      expect(spend.index).eq(1);
      expect(spend.optionInput?.type).eq('amount');
      expect(spend.steps).has.length(0);

      // Submitting {type:'or', index:1, response:{type:'amount', amount:2}} spends
      // 2 floaters for 2 titanium (the amount nested in the branch pick).
      const or = cast(card.action(player), OrOptions);
      or.process({type: 'or', index: 1, response: {type: 'amount', amount: 2}}, player);
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(player.titanium).eq(2);
    });

    // A branch whose OrOptions option is a SelectCard DIRECTLY (the "add asteroid
    // to ANY card" branch when several candidate cards exist) carries an
    // `optionInput` (type 'card') — the chosen target nests into the branch pick.
    it('AsteroidRights: the add branch carries an optionInput (SelectCard) nested into the branch pick', () => {
      const [game, player] = testGame(2);
      const card = new AsteroidRights();
      card.resourceCount = 1; // spend branches available
      player.megaCredits = 10; // can afford the add
      const second = new CometAiming(); // a 2nd asteroid-holding card → multi-candidate
      player.playedCards.push(card, second);

      const preview = actionPreview(player, card);
      const add = preview.branches[2];
      expect(add.available).is.true;
      expect(add.index).eq(2); // spend(0), spend(1), add(2) — all in the OrOptions
      expect(add.optionInput?.type).eq('card');

      // {type:'or', index:2, response:{type:'card', cards:[CometAiming]}} adds the
      // asteroid to the chosen target (the M€ payment is a follow-up deferred).
      const or = cast(card.action(player), OrOptions);
      or.process({type: 'or', index: 2, response: {type: 'card', cards: [CardName.COMET_AIMING]}}, player);
      runAllActions(game);
      expect(second.resourceCount).eq(1);
    });

    // When the add branch is the ONLY available one (no asteroids to spend),
    // action() returns the bare SelectCard (no OrOptions wrapper) → the preview's
    // lone branch auto-resolves (index -1) but still pre-collects the target; the
    // client submits {type:'card', cards} at the top level.
    it('AsteroidRights: add-only returns a bare SelectCard, preview auto-resolves (index -1) yet pre-collects the target', () => {
      const [game, player] = testGame(2);
      const card = new AsteroidRights();
      card.resourceCount = 0; // no asteroids → spend branches unavailable
      player.megaCredits = 10;
      const second = new CometAiming();
      player.playedCards.push(card, second);

      const preview = actionPreview(player, card);
      const add = preview.branches[2];
      expect(add.available).is.true;
      expect(add.index).eq(-1); // lone available branch → no branch pick
      expect(add.optionInput?.type).eq('card'); // target still pre-collected

      const selectCard = cast(card.action(player), SelectCard);
      selectCard.process({type: 'card', cards: [CardName.COMET_AIMING]});
      runAllActions(game);
      expect(second.resourceCount).eq(1);
    });
  });

  describe('variable-amount basis', () => {
    it('WeatherBalloons: the "M€ per city" branch shows the live Cities-on-Mars count as the gain basis', () => {
      const [/* game */, player] = testGame(2);
      const card = new WeatherBalloons();
      card.resourceCount = 1; // a floater to spend
      addCity(player); // two cities on Mars
      addCity(player);

      const preview = actionPreview(player, card);
      // behaviors[0] = spend 1 floater → 1 M€ per city on Mars.
      const spend = preview.branches[0];
      const mc = spend.effects.find((e) => e.icon === 'megacredits' && e.direction === 'gain');
      expect(mc, 'expected an M€ gain effect').is.not.undefined;
      expect(mc?.amount).eq(2); // 1 M€ × 2 cities
      expect(mc?.basis, 'the gain should carry a basis').is.not.undefined;
      expect(mc?.basis?.label).eq('Cities on Mars');
      expect(mc?.basis?.count).eq(2);
    });
  });

  describe('SelfReplicatingRobots', () => {
    it('previews TWO branches: double (hosted X→2X) + link (eligible hand cards, non-eligible greyed with a reason)', () => {
      const [/* game */, player] = testGame(2);
      const srr = new SelfReplicatingRobots();
      player.playedCards.push(srr);
      // A hosted card with 3 resources → "double" branch (3 → 6).
      const hosted = new Tardigrades();
      hosted.resourceCount = 3;
      srr.targetCards.push(hosted);
      // Hand: one BUILDING card (eligible) + one science-only card (ineligible).
      const eligible = new PhysicsComplex(); // has a building tag
      const ineligible = new WeatherBalloons(); // science only
      player.cardsInHand = [eligible, ineligible];

      const preview = actionPreview(player, srr);
      expect(preview.branches).has.length(2);
      const [dbl, link] = preview.branches;

      // Double branch: available, previews the hosted card's resources doubling.
      expect(dbl.available).is.true;
      expect(dbl.index).eq(0);
      const dblEff = dbl.effects.find((e) => e.current === 3);
      expect(dblEff, 'double should preview 3 → 6').is.not.undefined;
      expect(dblEff?.resulting).eq(6);

      // Link branch: available, hosts a card picker with the eligible card
      // selectable and the ineligible one greyed (with a reason).
      expect(link.available).is.true;
      expect(link.index).eq(1);
      expect(link.optionInput?.type).eq('card');
      const input = link.optionInput as unknown as {cards: Array<unknown>, disabledCards?: Array<{name: string}>};
      expect(input.cards).has.length(1); // only the eligible (building) card is selectable
      expect(input.disabledCards, 'the non-eligible card is shown greyed').has.length(1);
      expect(input.disabledCards?.[0].name).eq(CardName.WEATHER_BALLOONS);
    });

    it('with no hosted cards, "double" is unavailable with a reason and "link" auto-resolves', () => {
      const [/* game */, player] = testGame(2);
      const srr = new SelfReplicatingRobots();
      player.playedCards.push(srr);
      player.cardsInHand = [new PhysicsComplex()]; // one eligible card, no hosted

      const preview = actionPreview(player, srr);
      const [dbl, link] = preview.branches;
      expect(dbl.available).is.false;
      expect(dbl.unavailableReason).is.not.undefined;
      // Only "link" is available → the OrOptions reduces to its bare SelectCard
      // (index -1), but the target is still pre-collected via optionInput.
      expect(link.available).is.true;
      expect(link.index).eq(-1);
      expect(link.optionInput?.type).eq('card');
    });
  });
});
