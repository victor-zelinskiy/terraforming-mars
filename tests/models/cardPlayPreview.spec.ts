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
import {SoilEnrichment} from '../../src/server/cards/promo/SoilEnrichment';
import {LocalHeatTrapping} from '../../src/server/cards/base/LocalHeatTrapping';
import {AstraMechanica} from '../../src/server/cards/promo/AstraMechanica';
import {PublicPlans} from '../../src/server/cards/promo/PublicPlans';
import {Hackers} from '../../src/server/cards/base/Hackers';
import {AirRaid} from '../../src/server/cards/colonies/AirRaid';
import {Atmoscoop} from '../../src/server/cards/venusNext/Atmoscoop';
import {SponsoredAcademies} from '../../src/server/cards/venusNext/SponsoredAcademies';
import {StormCraftIncorporated} from '../../src/server/cards/colonies/StormCraftIncorporated';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {Virus} from '../../src/server/cards/base/Virus';
import {ProductiveOutpost} from '../../src/server/cards/colonies/ProductiveOutpost';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';

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

  it('VenusSoils (declarative): no microbe card to target → a WARNING step (no silent loss)', () => {
    const [/* game */, player] = testGame(2);
    const preview = cardPlayPreview(player, new VenusSoils());
    // With NO eligible microbe card the resource would be silently lost — the
    // preview now emits a warning note (and suppresses the fake "+microbe" chip).
    const steps = preview.branches[0].steps;
    expect(steps).has.length(1);
    expect(steps[0].kind).eq('note');
    expect((steps[0] as {noteKind?: string}).noteKind).eq('warning');
    // The Venus parameter chip still describes the on-play impact.
    expect(preview.branches[0].effects.some((e) => e.icon === 'venus')).is.true;
    // The microbe-to-a-card gain chip is SUPPRESSED (no card can hold it).
    expect(preview.branches[0].effects.some((e) => e.note === 'to a card')).is.false;
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
      // One animal card + two microbe cards. autoSelect:false (the no-autoselect
      // principle) → BOTH the animal and microbe picks are ALWAYS shown so the
      // player sees where each resource goes — even the single-candidate animal.
      player.playedCards.push(new Birds(), new Tardigrades(), new NitriteReducingBacteria());
      const branch = new EcologyResearch().cardPlayPreview(player).branches[0];
      // Both bespoke gain chips.
      const animalChip = branch.effects.find((e) => e.note === 'to a card' && e.amount === 1);
      const microbeChip = branch.effects.find((e) => e.note === 'to a card' && e.amount === 2);
      expect(animalChip, 'animal gain chip').is.not.undefined;
      expect(microbeChip, 'microbe gain chip').is.not.undefined;
      // Two card pickers in defer order: animal (the lone Birds) then microbe.
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(2);
      expect(inputs[0].kind === 'input' && inputs[0].input.type).eq('card');
      expect(inputs[1].kind === 'input' && inputs[1].input.type).eq('card');
    });
  });

  // Cards that override `play()` DIRECTLY (not `behavior`/`bespokePlay`) — the
  // older pattern that bypasses the split, so the preview reaches them only via
  // their hook. The coverage guard's `customizesPlay` check catches this class so
  // a new one can't slip through to a bare dynamic modal.
  describe('play() override hooks', () => {
    it('SoilEnrichment: a +5 plants chip + the "which card to take a microbe from" picker', () => {
      const [/* game */, player] = testGame(2);
      const t1 = new Tardigrades();
      const t2 = new NitriteReducingBacteria();
      t1.resourceCount = 2;
      t2.resourceCount = 1;
      player.playedCards.push(t1, t2);

      const branch = new SoilEnrichment().cardPlayPreview(player).branches[0];
      expect(branch.effects.find((e) => e.icon === Resource.PLANTS)?.amount).eq(5);
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(1);
      expect(inputs[0].kind === 'input' && inputs[0].input.type).eq('card');
      const names = (inputs[0].kind === 'input' ? (inputs[0].input as SelectCardModel).cards : []).map((c) => c.name);
      expect(names).to.have.members([t1.name, t2.name]);
    });

    it('SoilEnrichment: a single eligible card auto-resolves → no step', () => {
      const [/* game */, player] = testGame(2);
      const t1 = new Tardigrades();
      t1.resourceCount = 1;
      player.playedCards.push(t1);
      const branch = new SoilEnrichment().cardPlayPreview(player).branches[0];
      expect(branch.steps.filter((s) => s.kind === 'input')).has.length(0);
      expect(branch.effects.some((e) => e.icon === Resource.PLANTS)).is.true;
    });

    it('LocalHeatTrapping: −5 heat + +4 plants when there are no animal cards (the choice auto-resolves)', () => {
      const [/* game */, player] = testGame(2);
      player.heat = 5;
      const branch = new LocalHeatTrapping().cardPlayPreview(player).branches[0];
      const heat = branch.effects.find((e) => e.icon === Resource.HEAT && e.direction === 'cost');
      expect(heat?.amount).eq(5);
      expect(branch.effects.find((e) => e.icon === Resource.PLANTS)?.amount).eq(4);
      expect(branch.steps.filter((s) => s.kind === 'input')).has.length(0);
    });

    it('LocalHeatTrapping: with an animal card → −5 heat + a plants/animals OrOptions step', () => {
      const [/* game */, player] = testGame(2);
      player.heat = 5;
      player.playedCards.push(new Birds());
      const branch = new LocalHeatTrapping().cardPlayPreview(player).branches[0];
      expect(branch.effects.some((e) => e.icon === Resource.HEAT && e.direction === 'cost')).is.true;
      const step = branch.steps.find((s) => s.kind === 'input');
      expect(step !== undefined && step.kind === 'input' && step.input.type).eq('or');
    });
  });

  // Multi-card on-play picks pre-collected in the modal. Astra "returns UP TO 2"
  // (two SLOTS merged into one response, the 2nd optional); Public Plans "reveals
  // ANY NUMBER" (one multi-select pick shown as a count + a live +N M€ chip).
  describe('multi-card on-play picks', () => {
    it('AstraMechanica: two card SLOTS over the played events, merged (2nd slot optional)', () => {
      const [/* game */, player] = testGame(2);
      const e1 = new Sabotage();
      const e2 = new Asteroid(); // both are EVENT cards with no special tile
      player.playedCards.push(e1, e2);

      const branch = new AstraMechanica().cardPlayPreview(player).branches[0];
      // Two card-target SLOTS over the same event set; the 2nd de-dupes the 1st.
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(2);
      expect(inputs[0].kind === 'input' && inputs[0].input.type).eq('card');
      expect(inputs[1].kind === 'input' && inputs[1].input.type).eq('card');
      const names = (inputs[0].kind === 'input' ? (inputs[0].input as SelectCardModel).cards : []).map((c) => c.name);
      expect(names).to.have.members([e1.name, e2.name]);
      expect(inputs[1].kind === 'input' && (inputs[1] as {dedupeFromSteps?: ReadonlyArray<number>}).dedupeFromSteps)
        .to.deep.equal([0]);
      // Merge marker: the slots collapse to ONE response; min 0 (rules allow
      // returning nothing) + an emptyWarning for the confirm popup on an empty submit.
      expect(branch.mergeCardSteps?.min).eq(0);
      expect(branch.mergeCardSteps?.emptyWarning, 'an empty-submit warning is supplied').is.not.undefined;
    });

    it('AstraMechanica: only ONE slot when a single event is in play', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Sabotage()); // the only event
      const branch = new AstraMechanica().cardPlayPreview(player).branches[0];
      expect(branch.steps.filter((s) => s.kind === 'input')).has.length(1);
      expect(branch.mergeCardSteps?.min).eq(0);
    });

    it('AstraMechanica: the merged single-card response replays against the live SelectCard (return just 1)', () => {
      const [game, player] = testGame(2);
      const e1 = new Sabotage();
      const e2 = new Asteroid(); // both are EVENT cards with no special tile
      player.playedCards.push(e1, e2);
      const card = new AstraMechanica();

      // The live play is ONE SelectCard over the events (the modal MERGES its slot
      // picks into this single response).
      const select = cast(card.bespokePlay(player), SelectCard);
      expect(select.cards.map((c) => c.name)).to.have.members([e1.name, e2.name]);

      // The player filled only ONE slot → the merged response returns just e1.
      select.process({type: 'card', cards: [e1.name]}, player);
      runAllActions(game);
      expect(player.cardsInHand.map((c) => c.name)).to.include(e1.name);
      expect(player.playedCards.get(e1.name)).is.undefined; // returned to hand
      expect(player.playedCards.get(e2.name)).is.not.undefined; // the other stays played
    });

    it('PublicPlans: a MULTI-select step over the OTHER hand cards (excludes itself; count + 1 M€ each)', () => {
      const [/* game */, player] = testGame(2);
      const card = new PublicPlans();
      const a = new Sabotage();
      const b = new MediaArchives();
      player.cardsInHand.push(card, a, b);

      const branch = card.cardPlayPreview(player).branches[0];
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(1);
      const step = inputs[0];
      expect(step.kind === 'input' && step.input.type).eq('card');
      if (step.kind === 'input') {
        const model = step.input as SelectCardModel;
        const names = model.cards.map((c) => c.name);
        // The card being played is EXCLUDED (the live reveal runs after it leaves
        // hand); the OTHER hand cards are the candidates.
        expect(names).to.have.members([a.name, b.name]);
        expect(names).to.not.include(card.name);
        expect(model.min).eq(0);
        expect(model.max).eq(2); // reveal ANY NUMBER of the other 2
        expect(step.multiSelect?.countLabel).eq('Cards to reveal');
        expect(step.multiSelect?.revealGain).to.deep.equal({resource: Resource.MEGACREDITS, amount: 1});
      }
    });

    it('PublicPlans: the multi-select response replays against the live reveal SelectCard (+1 M€ each)', () => {
      const [game, player] = testGame(2);
      const a = new Sabotage();
      const b = new MediaArchives();
      player.cardsInHand.push(a, b);
      const mcBefore = player.megaCredits;

      const select = cast(new PublicPlans().bespokePlay(player), SelectCard);
      select.process({type: 'card', cards: [a.name, b.name]}, player);
      runAllActions(game);
      expect(player.megaCredits).eq(mcBefore + 2);
    });

    it('READ-ONLY: the Astra / Public Plans hooks never mutate hand / played state', () => {
      const [/* game */, player] = testGame(2);
      const e1 = new Sabotage();
      const e2 = new MediaArchives();
      player.playedCards.push(e1, e2);
      player.cardsInHand.push(new Mine());
      const before = {hand: player.cardsInHand.length, mc: player.megaCredits};
      new AstraMechanica().cardPlayPreview(player);
      new PublicPlans().cardPlayPreview(player);
      expect(player.cardsInHand.length).eq(before.hand);
      expect(player.megaCredits).eq(before.mc);
      // The events stay played (the preview never returns them to hand).
      expect(player.playedCards.get(e1.name)).is.not.undefined;
      expect(player.playedCards.get(e2.name)).is.not.undefined;
    });
  });

  // Player-target attacks + steals + multi-step on-play picks pre-collected.
  describe('attack / steal / draw on-play picks', () => {
    it('Hackers: −1 energy / +2 M€ production chips + a DecreaseAnyProduction (M€) step', () => {
      const [/* game */, player] = testGame(3); // 3 players → the decrease offers a choice
      const branch = new Hackers().cardPlayPreview(player).branches[0];
      const energy = branch.effects.find((e) => e.icon === Resource.ENERGY && e.note === 'production');
      expect(energy?.direction).eq('cost');
      expect(energy?.amount).eq(1);
      const mc = branch.effects.find((e) => e.icon === Resource.MEGACREDITS && e.note === 'production');
      expect(mc?.direction).eq('gain');
      expect(mc?.amount).eq(2);
      const step = branch.steps[0];
      expect(step.kind).eq('input');
      expect(step.kind === 'input' && step.input.type).eq('player');
    });

    it('AirRaid: +5 M€ / −1 floater chips + a steal OrOptions + the floater-card pick', () => {
      const [/* game */, player, player2] = testGame(3);
      const stormcraft = new StormCraftIncorporated();
      const dirigibles = new Dirigibles();
      player.playedCards.push(stormcraft, dirigibles);
      player.addResourceTo(stormcraft); // a floater
      player.addResourceTo(dirigibles); // a 2nd floater card → the floater pick is offered
      player2.megaCredits = 8; // a valid steal target (≥5)

      const branch = new AirRaid().cardPlayPreview(player).branches[0];
      // The PLAYER nets exactly +5 M€ (a mandatory steal needs the full amount).
      const mcGain = branch.effects.find((e) => e.icon === Resource.MEGACREDITS && e.direction === 'gain');
      expect(mcGain?.amount).eq(5);
      expect(mcGain?.current).eq(player.megaCredits);
      expect(mcGain?.resulting).eq(player.megaCredits + 5);
      // −1 floater cost.
      expect(branch.effects.some((e) => e.icon === 'floater' && e.direction === 'cost')).is.true;
      // The steal OrOptions step (per-target loss via metadata) + the floater pick.
      expect(branch.steps.some((s) => s.kind === 'input' && s.input.type === 'or'), 'a steal OrOptions step').is.true;
      expect(branch.steps.some((s) => s.kind === 'input' && s.input.type === 'card'), 'a floater-card pick step').is.true;
    });

    it('AirRaid: an opponent with fewer than 5 M€ is a DISABLED steal target ("Not enough to steal")', () => {
      const [/* game */, player, player2, player3] = testGame(4);
      player2.megaCredits = 8; // a valid target
      player3.megaCredits = 3; // some, but < 5 → disabled with a specific reason

      const orOptions = new StealResources(player, Resource.MEGACREDITS, 5, undefined, true).previewOptions();
      expect(orOptions, 'a steal OrOptions is built').is.not.undefined;
      const model = orOptions!.toModel(player);
      // player2 is a selectable steal option; the under-5 opponent is a disabled
      // target whose reason distinguishes "not enough" from "nothing".
      const reasons = (model.disabledOptions ?? []).map((d) => d.reason);
      expect(reasons).to.include('Not enough to steal');
    });

    it('Atmoscoop: a temperature/Venus OrOptions step BEFORE the +2 floater pick (defer order)', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Dirigibles()); // a floater-holding card → the +2 floater pick is offered

      const branch = new Atmoscoop().cardPlayPreview(player).branches[0];
      // The +2 floater "to a card" gain chip (from behavior).
      expect(branch.effects.some((e) => e.note === 'to a card' && e.amount === 2)).is.true;
      // Both global parameters open in a fresh game → a temp/Venus OrOptions step.
      const orIdx = branch.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'or');
      const cardIdx = branch.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'card');
      expect(orIdx, 'a temp/Venus OrOptions step').is.greaterThan(-1);
      expect(cardIdx, 'a floater pick step').is.greaterThan(-1);
      // The parameter choice defers (DEFAULT) before the floater add (GAIN_*).
      expect(orIdx).is.lessThan(cardIdx);
    });

    it('SponsoredAcademies: −1 card / +3 cards chips + a discard hand pick (excludes itself)', () => {
      const [/* game */, player] = testGame(2);
      const card = new SponsoredAcademies();
      const a = new Sabotage();
      const b = new MediaArchives();
      player.cardsInHand.push(card, a, b); // 3 in hand → after self-exclusion, 2 → a real discard pick

      const branch = card.cardPlayPreview(player).branches[0];
      expect(branch.effects.some((e) => e.icon === 'cards' && e.direction === 'cost' && e.amount === 1), 'discard chip').is.true;
      expect(branch.effects.some((e) => e.icon === 'cards' && e.direction === 'gain' && e.amount === 3), 'draw chip').is.true;
      const step = branch.steps[0];
      expect(step.kind === 'input' && step.input.type).eq('card');
      if (step.kind === 'input') {
        const names = (step.input as SelectCardModel).cards.map((c) => c.name);
        expect(names).to.have.members([a.name, b.name]);
        expect(names).to.not.include(card.name);
      }
    });

    it('SponsoredAcademies: with one other card left the discard auto-resolves (no step)', () => {
      const [/* game */, player] = testGame(2);
      const card = new SponsoredAcademies();
      player.cardsInHand.push(card, new Sabotage()); // after self-exclusion, 1 → live auto-discards
      const branch = card.cardPlayPreview(player).branches[0];
      expect(branch.steps.filter((s) => s.kind === 'input')).has.length(0);
      expect(branch.effects.some((e) => e.icon === 'cards' && e.direction === 'gain'), 'draw chip still shows').is.true;
    });

    it('Virus: a tabbed remove-animals (card pick) / remove-plants (player targets) step with correct OR indices', () => {
      const [/* game */, player, player2] = testGame(2);
      // player2 plays Virus; player (its opponent) has an animal card + plants.
      const birds = new Birds();
      player.playedCards.push(birds);
      player.addResourceTo(birds); // 1 animal → the card is a valid animal target
      player.plants = 8;

      const branch = new Virus().cardPlayPreview(player2).branches[0];
      const step = branch.steps[0];
      expect(step.kind).eq('tabbedTargets');
      if (step.kind === 'tabbedTargets') {
        // Animals tab — the animal card, hosted at OR index 0 (the SelectCard option).
        expect(step.animal, 'an animals tab').is.not.undefined;
        expect(step.animal?.branchIndex).eq(0);
        expect(step.animal?.amount).eq(2);
        const animalNames = (step.animal!.input as SelectCardModel).cards.map((c) => c.name);
        expect(animalNames).to.include(birds.name);
        // Plants tab — the opponent at OR index 1, impact 8 → 3 (remove 5).
        expect(step.plant, 'a plants tab').is.not.undefined;
        expect(step.plant?.amount).eq(5);
        const t = step.plant!.targets.find((x) => x.color === player.color);
        expect(t, 'the opponent is a plant target').is.not.undefined;
        expect(t?.optionIndex).eq(1);
        expect(t?.current).eq(8);
        expect(t?.resulting).eq(3);
      }
    });

    it('Virus: the pre-collected plant pick replays against the live OrOptions', () => {
      const [game, player, player2] = testGame(2);
      const birds = new Birds();
      player.playedCards.push(birds);
      player.addResourceTo(birds);
      player.plants = 8;

      // The preview says: pick the opponent's plants → {type:'or', index:1, response:{type:'option'}}.
      const step = new Virus().cardPlayPreview(player2).branches[0].steps[0];
      const optionIndex = step.kind === 'tabbedTargets' ?
        step.plant!.targets.find((x) => x.color === player.color)!.optionIndex : -1;

      // The LIVE play produces the SAME OrOptions; the index resolves the plant removal.
      const orOptions = cast(new Virus().bespokePlay(player2), OrOptions);
      orOptions.options[optionIndex].process({type: 'option'}, player2);
      runAllActions(game);
      expect(player.plants).eq(3); // 8 − 5
    });

    it('ProductiveOutpost: aggregates every owned colony FIXED bonus into result chips', () => {
      const [game, player] = testGame(2);
      const luna = new Luna(); // GAIN_RESOURCES 2 M€
      const ceres = new Ceres(); // GAIN_RESOURCES 2 steel
      const titan = new Titan(); // ADD_RESOURCES_TO_CARD: +1 floater to a card
      luna.colonies.push(player.id, player.id); // TWO colonies on Luna → 4 M€
      ceres.colonies.push(player.id);
      titan.colonies.push(player.id);
      game.colonies.push(luna, ceres, titan);
      player.playedCards.push(new Dirigibles()); // a floater-holding card → Titan's bonus has a target

      const branch = new ProductiveOutpost().cardPlayPreview(player).branches[0];
      expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning')).is.false;
      // Luna ×2 → +4 M€, Ceres → +2 steel (aggregated, current → resulting).
      const mc = branch.effects.find((e) => e.icon === Resource.MEGACREDITS);
      expect(mc?.amount).eq(4);
      expect(mc?.resulting).eq(player.megaCredits + 4);
      const steel = branch.effects.find((e) => e.icon === Resource.STEEL);
      expect(steel?.amount).eq(2);
      // Titan → +1 floater to a card.
      const floater = branch.effects.find((e) => e.icon === 'floater');
      expect(floater?.amount).eq(1);
      expect(floater?.note).eq('to a card');
    });

    it('ProductiveOutpost: a card-resource bonus with NO eligible card warns (no silent loss)', () => {
      const [game, player] = testGame(2);
      const titan = new Titan(); // +1 floater to a card, but the player has no floater card
      titan.colonies.push(player.id);
      game.colonies.push(titan);

      const branch = new ProductiveOutpost().cardPlayPreview(player).branches[0];
      expect(branch.effects.some((e) => e.icon === 'floater'), 'the floater chip is suppressed').is.false;
      expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning'), 'a warning note').is.true;
    });
  });
});
