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
import {ProjectInspection} from '../../src/server/cards/promo/ProjectInspection';
import {RoboticWorkforce} from '../../src/server/cards/base/RoboticWorkforce';
import {Viron} from '../../src/server/cards/venusNext/Viron';
import {Mine} from '../../src/server/cards/base/Mine';
import {DirectedHeatUsage} from '../../src/server/cards/promo/DirectedHeatUsage';
import {actionPreview} from '../../src/server/models/actionPreview';
import {InterplanetaryTrade} from '../../src/server/cards/promo/InterplanetaryTrade';
import {TerraformingGanymede} from '../../src/server/cards/base/TerraformingGanymede';
import {MediaArchives} from '../../src/server/cards/base/MediaArchives';
import {IoSulphurResearch} from '../../src/server/cards/venusNext/IoSulphurResearch';
import {CommunityServices} from '../../src/server/cards/colonies/CommunityServices';
import {Decomposers} from '../../src/server/cards/base/Decomposers';
import {EcologyExperts} from '../../src/server/cards/prelude/EcologyExperts';
import {Tag} from '../../src/common/cards/Tag';
import {Phase} from '../../src/common/Phase';
import {NitrogenRichAsteroid} from '../../src/server/cards/base/NitrogenRichAsteroid';
import {Potatoes} from '../../src/server/cards/promo/Potatoes';
import {NoctisCity} from '../../src/server/cards/base/NoctisCity';
import {HermeticOrderOfMars} from '../../src/server/cards/promo/HermeticOrderofMars';
import {EcologyResearch} from '../../src/server/cards/colonies/EcologyResearch';
import {Birds} from '../../src/server/cards/base/Birds';

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
      // The signed delta (+2 microbes) drives the picker's per-card "N → N+2"
      // impact preview.
      expect(step.amount).eq(2);
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

    it('ProjectInspection: a card picker over the actions already used this generation', () => {
      const [/* game */, player] = testGame(2);
      const used = new DirectedHeatUsage();
      player.playedCards.push(used);
      player.heat = 6; // so the heat→M€/plants action canAct
      player.actionsThisGeneration.add(used.name);

      const preview = new ProjectInspection().cardPlayPreview(player);
      const step = preview.branches[0].steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('card');
      const names = step.kind === 'input' ? (step.input as SelectCardModel).cards.map((c) => c.name) : [];
      expect(names).to.include(used.name);
    });

    it('Viron (corporation action): the action preview is a card picker over the used actions', () => {
      const [/* game */, player] = testGame(2);
      const used = new DirectedHeatUsage();
      player.playedCards.push(used);
      player.heat = 6;
      player.actionsThisGeneration.add(used.name);

      const preview = actionPreview(player, new Viron());
      const step = preview.branches[0].steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('card');
    });

    it('RoboticWorkforce: a card picker over your building cards to copy', () => {
      const [/* game */, player] = testGame(2);
      const mine = new Mine();
      player.playedCards.push(mine);

      const preview = new RoboticWorkforce().cardPlayPreview(player);
      const step = preview.branches[0].steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('card');
      const names = step.kind === 'input' ? (step.input as SelectCardModel).cards.map((c) => c.name) : [];
      expect(names).to.include(mine.name);
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

  // FIXED-result hooks: cards with NO on-play choice but a COMPUTABLE result. The
  // refined rule — "показывать изменение заранее" — is that a no-choice card must
  // STILL surface its result chip, never ride a bare dynamic fallback. Each shows
  // a `current → resulting` chip computed read-only, no steps.
  describe('fixed computable result (no choice, result chip only)', () => {
    it('InterplanetaryTrade: a M€ production chip = 1 per distinct tag in play', () => {
      const [/* game */, player] = testGame(2);
      const card = new InterplanetaryTrade();
      const expected = player.tags.distinctCount('default', Tag.SPACE);
      expect(expected).is.greaterThan(0); // the card's own SPACE tag is always counted

      const branch = card.cardPlayPreview(player).branches[0];
      expect(branch.steps).has.length(0);
      const chip = branch.effects.find((e) => e.icon === Resource.MEGACREDITS && e.note === 'production');
      expect(chip, 'expected a M€ production chip').is.not.undefined;
      expect(chip?.direction).eq('gain');
      expect(chip?.amount).eq(expected);
      expect(chip?.current).eq(player.production.get(Resource.MEGACREDITS));
      expect(chip?.resulting).eq(player.production.get(Resource.MEGACREDITS) + expected);
    });

    it('TerraformingGanymede: a TR chip = 1 per Jovian tag', () => {
      const [/* game */, player] = testGame(2);
      const card = new TerraformingGanymede();
      const expected = card.computeTr(player).tr;

      const branch = card.cardPlayPreview(player).branches[0];
      expect(branch.steps).has.length(0);
      const chip = branch.effects.find((e) => e.icon === 'tr');
      expect(chip, 'expected a TR chip').is.not.undefined;
      expect(chip?.direction).eq('gain');
      expect(chip?.amount).eq(expected);
      expect(chip?.resulting).eq(player.terraformRating + expected);
    });

    it('MediaArchives: a M€ gain chip = total events ever played', () => {
      const [/* game */, player] = testGame(2);
      const card = new MediaArchives();

      const branch = card.cardPlayPreview(player).branches[0];
      expect(branch.steps).has.length(0);
      const chip = branch.effects.find((e) => e.icon === Resource.MEGACREDITS && e.note !== 'production');
      expect(chip, 'expected a M€ stock gain chip').is.not.undefined;
      expect(chip?.direction).eq('gain');
      expect(chip?.current).eq(player.megaCredits);
    });

    it('IoSulphurResearch: a draw chip (1 card, or 3 with ≥3 Venus tags)', () => {
      const [/* game */, player] = testGame(2);
      const card = new IoSulphurResearch();

      const branch = card.cardPlayPreview(player).branches[0];
      expect(branch.steps).has.length(0);
      const chip = branch.effects.find((e) => e.note === 'draw');
      expect(chip, 'expected a draw chip').is.not.undefined;
      expect(chip?.amount).eq(1); // no Venus tags in a fresh game
    });

    it('CommunityServices: a M€ production chip = 1 per no-tag card (incl. this)', () => {
      const [/* game */, player] = testGame(2);
      const card = new CommunityServices();
      const expected = player.tags.numberOfCardsWithNoTags() + 1;

      const branch = card.cardPlayPreview(player).branches[0];
      const chip = branch.effects.find((e) => e.icon === Resource.MEGACREDITS && e.note === 'production');
      expect(chip?.amount).eq(expected);
      expect(chip?.amount).is.greaterThan(0);
    });

    it('Decomposers: no chip in normal hand play; +2 microbe chip in the Ecology Experts prelude path', () => {
      const [game, player] = testGame(2);
      const card = new Decomposers();

      // Normal play (not preludes) → the conditional bonus is 0 → no chip.
      expect(card.cardPlayPreview(player).branches[0].effects).has.length(0);

      // Preludes phase, Ecology Experts just played → +2 microbes to this card.
      game.phase = Phase.PRELUDES;
      player.playedCards.push(new EcologyExperts());
      const branch = card.cardPlayPreview(player).branches[0];
      const chip = branch.effects.find((e) => e.note === 'on this card');
      expect(chip, 'expected a +2 microbe chip').is.not.undefined;
      expect(chip?.direction).eq('gain');
      expect(chip?.amount).eq(2);
    });

    it('READ-ONLY: a fixed-result hook never mutates production / TR / state', () => {
      const [/* game */, player] = testGame(2);
      const before = {
        mcProd: player.production.get(Resource.MEGACREDITS),
        tr: player.terraformRating,
      };
      new InterplanetaryTrade().cardPlayPreview(player);
      new TerraformingGanymede().cardPlayPreview(player);
      new CommunityServices().cardPlayPreview(player);
      expect(player.production.get(Resource.MEGACREDITS)).eq(before.mcProd);
      expect(player.terraformRating).eq(before.tr);
    });
  });

  // behavior+bespoke HIDDEN result: cards that ARE declarative (a `behavior`), but
  // whose `bespokePlay` adds a FIXED, computable result NOT in that behavior. The
  // hook shows BOTH the behavior chips AND the bespoke extra — the modal never
  // shows only half the on-play effect. Guarded structurally by
  // `cardPlayPreviewCoverage.spec.ts`'s second test.
  describe('behavior + bespoke hidden result (both halves shown)', () => {
    it('NitrogenRichAsteroid: behavior temperature + TR chips PLUS the bespoke +1/+4 plant production', () => {
      const [/* game */, player] = testGame(2);
      const branch = new NitrogenRichAsteroid().cardPlayPreview(player).branches[0];
      // Declarative half (auto-included by playPreview).
      expect(branch.effects.some((e) => e.icon === 'temperature'), 'temperature chip').is.true;
      expect(branch.effects.some((e) => e.icon === 'tr'), 'TR chip').is.true;
      // Bespoke half (the part that was previously hidden).
      const plantProd = branch.effects.find((e) => e.icon === Resource.PLANTS && e.note === 'production');
      expect(plantProd, 'plant production chip').is.not.undefined;
      expect(plantProd?.amount).eq(1); // <3 plant tags in a fresh game
    });

    it('Potatoes: behavior +2 M€ production PLUS the bespoke −2 plant cost', () => {
      const [/* game */, player] = testGame(2);
      const branch = new Potatoes().cardPlayPreview(player).branches[0];
      expect(branch.effects.some((e) => e.icon === Resource.MEGACREDITS && e.note === 'production'), 'M€ production chip').is.true;
      const plantCost = branch.effects.find((e) => e.icon === Resource.PLANTS && e.direction === 'cost');
      expect(plantCost, 'plant cost chip').is.not.undefined;
      expect(plantCost?.amount).eq(2);
    });

    it('NoctisCity: behavior +3 M€ production PLUS the bespoke −1 energy production', () => {
      const [/* game */, player] = testGame(2);
      const branch = new NoctisCity().cardPlayPreview(player).branches[0];
      const energy = branch.effects.find((e) => e.icon === Resource.ENERGY && e.note === 'production');
      expect(energy, 'energy production chip').is.not.undefined;
      expect(energy?.direction).eq('cost');
      expect(energy?.amount).eq(1);
    });

    it('HermeticOrderOfMars: behavior +2 M€ production PLUS the bespoke board-derived M€ gain', () => {
      const [/* game */, player] = testGame(2);
      const branch = new HermeticOrderOfMars().cardPlayPreview(player).branches[0];
      expect(branch.effects.some((e) => e.icon === Resource.MEGACREDITS && e.note === 'production'), 'M€ production chip').is.true;
      // The board-derived M€ stock gain chip is present (0 with no tiles on the board).
      expect(branch.effects.some((e) => e.icon === Resource.MEGACREDITS && e.note !== 'production'), 'M€ stock gain chip').is.true;
    });

    it('EcologyResearch: bespoke animal + microbe "to a card" chips with their pickers, in defer order', () => {
      const [/* game */, player] = testGame(2);
      // One animal card + two microbe cards → the microbe picker is a real choice;
      // the single animal card auto-resolves (no step).
      player.playedCards.push(new Birds(), new Tardigrades(), new NitriteReducingBacteria());
      const branch = new EcologyResearch().cardPlayPreview(player).branches[0];
      // Both bespoke gain chips.
      const animalChip = branch.effects.find((e) => e.note === 'to a card' && e.amount === 1);
      const microbeChip = branch.effects.find((e) => e.note === 'to a card' && e.amount === 2);
      expect(animalChip, 'animal gain chip').is.not.undefined;
      expect(microbeChip, 'microbe gain chip').is.not.undefined;
      // The microbe pick is the only step (animal auto-resolves to its single card).
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(1);
      expect(inputs[0].kind === 'input' && inputs[0].input.type).eq('card');
    });
  });
});
