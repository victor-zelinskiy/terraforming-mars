import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Resource} from '../../src/common/Resource';
import {CardResource} from '../../src/common/CardResource';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {stepsForBehavior} from '../../src/server/models/actionPreview';
import {VenusSoils} from '../../src/server/cards/venusNext/VenusSoils';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {NitriteReducingBacteria} from '../../src/server/cards/base/NitriteReducingBacteria';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {VenusianPlants} from '../../src/server/cards/venusNext/VenusianPlants';
import {Extremophiles} from '../../src/server/cards/venusNext/Extremophiles';
import {Thermophiles} from '../../src/server/cards/venusNext/Thermophiles';
import {LawSuit} from '../../src/server/cards/promo/LawSuit';
import {Insulation} from '../../src/server/cards/base/Insulation';
import {CrashSiteCleanup} from '../../src/server/cards/promo/CrashSiteCleanup';
import {Sabotage} from '../../src/server/cards/base/Sabotage';
import {EnergyTapping} from '../../src/server/cards/base/EnergyTapping';
import {OrOptions} from '../../src/server/inputs/OrOptions';

describe('cardPlayPreview', () => {
  it('VenusSoils (declarative): venus + plant-production gain chips + a microbe target step', () => {
    const [/* game */, player] = testGame(2);
    // Two microbe-holding cards in play → the "add 2 microbes to ANOTHER card"
    // behavior offers a real choice (a SelectCard step), not an auto-resolve.
    player.playedCards.push(new Tardigrades(), new NitriteReducingBacteria());

    const preview = cardPlayPreview(player, new VenusSoils());
    expect(preview.kind).eq('declarative');
    expect(preview.branches).has.length(1);
    const branch = preview.branches[0];
    expect(branch.index).eq(-1);
    expect(branch.available).is.true;

    // Gain chips: venus +1 (a global parameter, with unit) and plant production +1.
    const venus = branch.effects.find((e) => e.icon === 'venus');
    expect(venus, 'expected a venus gain chip').is.not.undefined;
    expect(venus?.direction).eq('gain');
    expect(venus?.unit).eq('%');
    const plantProd = branch.effects.find((e) => e.icon === Resource.PLANTS && e.note === 'production');
    expect(plantProd, 'expected a plant production chip').is.not.undefined;
    expect(plantProd?.direction).eq('gain');
    expect(plantProd?.amount).eq(1);
    // The "+2 microbe to a card" gain chip (no single pool → no current/resulting).
    const microbe = branch.effects.find((e) => e.note === 'to a card');
    expect(microbe, 'expected a "to a card" microbe chip').is.not.undefined;
    expect(microbe?.amount).eq(2);

    // ONE interactive step: the card-target picker for the 2 microbes.
    expect(branch.steps).has.length(1);
    const step = branch.steps[0];
    expect(step.kind).eq('input');
    if (step.kind === 'input') {
      expect(step.input.type).eq('card');
      const model = step.input as SelectCardModel;
      const names = model.cards.map((c) => c.name);
      expect(names).to.include.members([new Tardigrades().name, new NitriteReducingBacteria().name]);
    }
  });

  it('VenusSoils (declarative): no microbe card to target → no step (auto-resolves)', () => {
    const [/* game */, player] = testGame(2);
    const preview = cardPlayPreview(player, new VenusSoils());
    expect(preview.branches[0].steps).has.length(0);
    // The effect chips still describe the on-play impact.
    expect(preview.branches[0].effects.some((e) => e.icon === 'venus')).is.true;
  });

  it('READ-ONLY: building a play preview never mutates player / card / game state', () => {
    const [game, player] = testGame(2);
    const tardigrades = new Tardigrades();
    player.playedCards.push(tardigrades);
    const card = new VenusSoils();
    const before = {
      venus: game.getVenusScaleLevel(),
      plantsProd: player.production.get(Resource.PLANTS),
      tardigrades: tardigrades.resourceCount,
    };
    cardPlayPreview(player, card);
    expect(game.getVenusScaleLevel()).eq(before.venus);
    expect(player.production.get(Resource.PLANTS)).eq(before.plantsProd);
    expect(tardigrades.resourceCount).eq(before.tardigrades);
  });

  it('step order matches the Executor defer order: addResourcesToAnyCard BEFORE decreaseAnyProduction', () => {
    // 3 players so decreaseAnyProduction offers a CHOICE (a single non-self
    // target is auto-attacked with no step); both opponents get plant production.
    const [/* game */, player, player2, player3] = testGame(3);
    // Two microbe cards so the add-step offers a choice.
    player.playedCards.push(new Tardigrades(), new NitriteReducingBacteria());
    player2.production.add(Resource.PLANTS, 2);
    player3.production.add(Resource.PLANTS, 2);
    const steps = stepsForBehavior(player, new VenusSoils(), {
      addResourcesToAnyCard: {count: 1, type: CardResource.MICROBE},
      decreaseAnyProduction: {count: 1, type: Resource.PLANTS},
    });
    const inputs = steps.filter((s) => s.kind === 'input');
    expect(inputs).has.length(2);
    // First step is the card target (addResourcesToAnyCard), second is the player
    // target (decreaseAnyProduction) — matching the executor's defer order so the
    // batched responses line up positionally with the live follow-up prompts.
    expect(inputs[0].kind === 'input' && inputs[0].input.type).eq('card');
    expect(inputs[1].kind === 'input' && inputs[1].input.type).eq('player');
  });

  it('Asteroid (declarative): shows automatic gain chips; plant-removal rides the follow-up (no input step)', () => {
    const [/* game */, player] = testGame(2);
    const preview = cardPlayPreview(player, new Asteroid());
    expect(preview.kind).eq('declarative');
    const branch = preview.branches[0];
    // Temperature raise + titanium gain are shown as chips.
    expect(branch.effects.some((e) => e.icon === 'temperature')).is.true;
    expect(branch.effects.some((e) => e.icon === Resource.TITANIUM)).is.true;
    // removeAnyPlants is an OrOptions with no clean controlled capture → not
    // pre-collected as a step (it rides the post-batch follow-up routing).
    expect(branch.steps.filter((s) => s.kind === 'input')).has.length(0);
  });

  // The preview's pre-collected step response must be byte-compatible with the
  // LIVE follow-up prompt the server produces after play, so the batch lines up.
  describe('play protocol (preview step matches the live follow-up)', () => {
    it('VenusSoils: the previewed microbe-target step matches the live AddResourcesToCard prompt', () => {
      const [game, player] = testGame(2);
      const t1 = new Tardigrades();
      const t2 = new NitriteReducingBacteria();
      player.playedCards.push(t1, t2);
      const card = new VenusSoils();

      // The preview's step candidate set.
      const preview = cardPlayPreview(player, card);
      const step = preview.branches[0].steps[0];
      const previewNames = (step.kind === 'input' ? (step.input as SelectCardModel).cards : []).map((c) => c.name);

      // Live play: the behavior raises venus + plant production immediately, then
      // defers the "add 2 microbes to a card" target pick.
      const plantProdBefore = player.production.get(Resource.PLANTS);
      player.playCard(card);
      runAllActions(game);
      expect(player.production.get(Resource.PLANTS)).eq(plantProdBefore + 1);

      const select = cast(player.popWaitingFor(), SelectCard);
      expect(previewNames).to.have.members(select.cards.map((c) => c.name));

      // Apply the pre-collected response → the 2 microbes land on the chosen card.
      select.process({type: 'card', cards: [t1.name]}, player);
      runAllActions(game);
      expect(t1.resourceCount).eq(2);
    });
  });

  // Bespoke `cardPlayPreview` hooks — each surfaces the SAME choice bespokePlay
  // builds, so it's pre-collected in the play modal.
  describe('bespoke hooks', () => {
    it('VenusianPlants: declarative venus chip + a SelectCard step over the Venus resource cards', () => {
      const [/* game */, player] = testGame(2);
      const a = new Extremophiles();
      const b = new Thermophiles();
      player.playedCards.push(a, b);
      const card = new VenusianPlants();

      const preview = card.cardPlayPreview(player);
      expect(preview.branches).has.length(1);
      const branch = preview.branches[0];
      expect(branch.effects.some((e) => e.icon === 'venus')).is.true;
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(1);
      expect(inputs[0].kind === 'input' && inputs[0].input.type).eq('card');
      const names = (inputs[0].kind === 'input' ? (inputs[0].input as SelectCardModel).cards : []).map((c) => c.name);
      expect(names).to.have.members([a.name, b.name]);
    });

    it('LawSuit: a SelectPlayer step over the players who attacked you', () => {
      const [/* game */, player, player2] = testGame(2);
      player.removingPlayers.push(player2.id);
      const card = new LawSuit();

      const preview = card.cardPlayPreview(player);
      const step = preview.branches[0].steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('player');
    });

    it('Insulation: a SelectAmount step bounded by current heat production', () => {
      const [/* game */, player] = testGame(2);
      player.production.add(Resource.HEAT, 3);
      const card = new Insulation();

      const preview = card.cardPlayPreview(player);
      const step = preview.branches[0].steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('amount');
    });

    it('CrashSiteCleanup: two branches (gain titanium / gain steel) with their gain chips', () => {
      const [/* game */, player] = testGame(2);
      const card = new CrashSiteCleanup();

      const preview = card.cardPlayPreview(player);
      expect(preview.branches).has.length(2);
      // Both options are always available → real OrOptions, runtime indices 0 & 1.
      expect(preview.branches[0].index).eq(0);
      expect(preview.branches[1].index).eq(1);
      expect(preview.branches[0].effects.some((e) => e.icon === Resource.TITANIUM)).is.true;
      expect(preview.branches[1].effects.some((e) => e.icon === Resource.STEEL)).is.true;
    });

    it('Sabotage: an OrOptions step whose options match the live attack prompt', () => {
      const [/* game */, player, player2] = testGame(2);
      player2.megaCredits = 10;
      player2.steel = 5;
      const card = new Sabotage();

      const preview = card.cardPlayPreview(player);
      const step = preview.branches[0].steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('or');
      const previewOptionCount = step.kind === 'input' && step.input.type === 'or' ? step.input.options.length : 0;

      // The live OrOptions the same bespokePlay builds has the SAME option count
      // (the preview hosts that exact model, so the batched pick lines up).
      const live = cast(card.bespokePlay(player), OrOptions);
      expect(previewOptionCount).eq(live.options.length);
    });

    it('EnergyTapping: a "+1 your energy production" chip + a DecreaseAnyProduction step', () => {
      // 3 players so the decrease offers a CHOICE (a single non-self target is
      // auto-attacked with no step).
      const [/* game */, player, player2, player3] = testGame(3);
      player2.production.add(Resource.ENERGY, 2);
      player3.production.add(Resource.ENERGY, 2);
      const card = new EnergyTapping();

      const preview = card.cardPlayPreview(player);
      const branch = preview.branches[0];
      const prodGain = branch.effects.find((e) => e.icon === Resource.ENERGY && e.note === 'production');
      expect(prodGain, 'expected a +energy production chip').is.not.undefined;
      expect(prodGain?.direction).eq('gain');
      const step = branch.steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('player');
    });
  });
});
