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
import {MiningExpedition} from '../../src/server/cards/base/MiningExpedition';
import {Comet} from '../../src/server/cards/base/Comet';
import {JovianLanterns} from '../../src/server/cards/colonies/JovianLanterns';
import {TitanFloatingLaunchPad} from '../../src/server/cards/colonies/TitanFloatingLaunchPad';
import {SelectCardModel, OrOptionsModel, SelectOptionModel} from '../../src/common/models/PlayerInputModel';
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
import {MetalsCompany} from '../../src/server/cards/prelude/MetalsCompany';
import {EcoLine} from '../../src/server/cards/corporation/Ecoline';
import {CrediCor} from '../../src/server/cards/corporation/Credicor';
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
import {StratosphericBirds} from '../../src/server/cards/venusNext/StratosphericBirds';
import {DeuteriumExport} from '../../src/server/cards/venusNext/DeuteriumExport';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {Virus} from '../../src/server/cards/base/Virus';
import {ProductiveOutpost} from '../../src/server/cards/colonies/ProductiveOutpost';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {ImportedNitrogen} from '../../src/server/cards/base/ImportedNitrogen';
import {ImportedHydrogen} from '../../src/server/cards/base/ImportedHydrogen';
import {LargeConvoy} from '../../src/server/cards/base/LargeConvoy';
import {Pets} from '../../src/server/cards/base/Pets';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';

describe('cardPlayPreview', () => {
  // PRELUDES preview through the SAME path as a project card: the opening
  // ceremony plays them straight from the start scene (no play modal), and
  // the console arms its premium on-play reward beat from this preview.
  it('MetalsCompany (a PRELUDE): previews its production gains like any declarative card', () => {
    const [/* game */, player] = testGame(2);
    const preview = cardPlayPreview(player, new MetalsCompany());
    expect(preview.kind).eq('declarative');
    expect(preview.branches).has.length(1);
    const effects = preview.branches[0].effects;
    for (const resource of [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM]) {
      const chip = effects.find((e) => e.icon === resource && e.note === 'production');
      expect(chip, `expected a ${resource} production chip`).is.not.undefined;
      expect(chip?.direction).eq('gain');
      expect(chip?.amount).eq(1);
    }
  });

  // CORPORATIONS preview too: the opening ceremony plays the chosen corp
  // straight from the start scene (the deferred `corporationPlay` press), and
  // the console arms its reward beat from this preview. Their starting M€ are
  // applied OUTSIDE the behavior (`playCorporationCard`), so the preview
  // prepends them — the corp's single biggest on-play gain.
  it('Ecoline (a CORPORATION): starting M€ chip PLUS its own behavior gains', () => {
    const [/* game */, player] = testGame(2);
    const preview = cardPlayPreview(player, new EcoLine());
    expect(preview.kind).eq('declarative');
    expect(preview.isCorporation).is.true;
    const effects = preview.branches[0].effects;

    // The starting M€ lead the chips, with an honest current → resulting.
    const mc = effects.find((e) => e.icon === Resource.MEGACREDITS && e.note === undefined);
    expect(mc, 'expected a starting M€ chip').is.not.undefined;
    expect(mc?.direction).eq('gain');
    expect(mc?.amount).eq(36);
    expect(mc?.current).eq(player.megaCredits);
    expect(mc?.resulting).eq(player.megaCredits + 36);
    expect(effects[0]).eq(mc); // prepended — the corp pays it whatever it does

    // …and the behavior's own gains still ride the generic walker.
    const plantProd = effects.find((e) => e.icon === Resource.PLANTS && e.note === 'production');
    expect(plantProd?.amount).eq(2);
    const plantStock = effects.find((e) => e.icon === Resource.PLANTS && e.note === undefined);
    expect(plantStock?.amount).eq(3);
  });

  it('Credicor (a CORPORATION with NO behavior): still previews its starting M€', () => {
    const [/* game */, player] = testGame(2);
    const preview = cardPlayPreview(player, new CrediCor());
    // Its rule text is a passive effect — the ONLY on-play result is the M€,
    // and that is exact, so the preview is declarative (never a mute dynamic).
    expect(preview.kind).eq('declarative');
    expect(preview.branches).has.length(1);
    expect(preview.branches[0].effects).has.length(1);
    expect(preview.branches[0].effects[0]).to.include({
      direction: 'gain', icon: Resource.MEGACREDITS, amount: 57,
    });
  });

  it('READ-ONLY: previewing a corporation never grants its starting M€', () => {
    const [/* game */, player] = testGame(2);
    const before = player.megaCredits;
    cardPlayPreview(player, new CrediCor());
    cardPlayPreview(player, new EcoLine());
    expect(player.megaCredits).eq(before);
    expect(player.production.plants).eq(0);
  });

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
    // The lost resource is named by its NORMALIZED icon key ('microbe', lowercase
    // — what `iconClassFor` resolves to the `.card-resource-microbe` sprite), NOT
    // the raw CardResource value ('Microbe'), so the warning shows the icon.
    expect((steps[0] as {resource?: string}).resource).eq('microbe');
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

  it('Asteroid (declarative): automatic gain chips PLUS a pre-collected plant-removal target picker', () => {
    const [/* game */, player, opponent] = testGame(3);
    opponent.plants = 5; // a removable target → the live OrOptions offers a choice
    const preview = cardPlayPreview(player, new Asteroid());
    expect(preview.kind).eq('declarative');
    const branch = preview.branches[0];
    // Temperature raise + titanium gain are shown as chips.
    expect(branch.effects.some((e) => e.icon === 'temperature')).is.true;
    expect(branch.effects.some((e) => e.icon === Resource.TITANIUM)).is.true;
    // The plant removal is now PRE-COLLECTED as an OrOptions target step — it no
    // longer rides a delayed "select a player" modal after РАЗЫГРАТЬ.
    expect(branch.steps.some((s) => s.kind === 'input' && s.input.type === 'or'), 'plant-removal OrOptions step').is.true;
  });

  it('Asteroid (declarative): a "no valid target" WARNING when NO opponent has plants (never a blank result)', () => {
    const [/* game */, player] = testGame(2); // opponent starts with 0 plants → no removable target
    const branch = cardPlayPreview(player, new Asteroid()).branches[0];
    // previewOptions() returns undefined (no candidate) → no INPUT step; instead an
    // honest "no valid target" WARNING (outside solo) so the modal is never mute
    // about the skipped plant removal. The automatic gains still show as chips.
    expect(branch.steps.filter((s) => s.kind === 'input')).has.length(0);
    expect(branch.steps.some((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning'), 'no-target warning').is.true;
    expect(branch.effects.some((e) => e.icon === 'temperature')).is.true;
  });

  it('Asteroid (declarative): SOLO mode adds NO warning (the neutral-opponent nuance — unchanged)', () => {
    const [/* game */, player] = testGame(1);
    const branch = cardPlayPreview(player, new Asteroid()).branches[0];
    // previewOptions() short-circuits to undefined in solo; the warning is suppressed
    // there (a solo "no target" would mislead), so the branch has no removal step at all.
    expect(branch.steps.filter((s) => s.kind === 'input')).has.length(0);
    expect(branch.steps.some((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning')).is.false;
  });

  it('EnergyTapping (bespoke): a "no production can be reduced" WARNING when no player has energy production', () => {
    const [/* game */, player] = testGame(2); // both players start with 0 energy production → no target
    const branch = cardPlayPreview(player, new EnergyTapping()).branches[0];
    // The +1 energy production chip still shows; the "decrease any player's energy
    // production" target has no picker, so a warning takes its place (non-solo).
    expect(branch.steps.some((s) => s.kind === 'input')).is.false;
    expect(branch.steps.some((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning'), 'no-production warning').is.true;
  });

  it('Virus (bespoke): a "no valid target" WARNING when there is nobody to remove animals/plants from', () => {
    const [/* game */, player] = testGame(2); // opponent 0 plants, no animal cards anywhere
    const branch = cardPlayPreview(player, new Virus()).branches[0];
    expect(branch.steps.some((s) => s.kind === 'tabbedTargets'), 'no target picker').is.false;
    expect(branch.steps.some((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning'), 'no-target warning').is.true;
  });

  it('Comet (declarative): the plant attack IS pre-collected, the ocean placement noted after', () => {
    const [/* game */, player, opponent] = testGame(3);
    opponent.plants = 5;
    const branch = cardPlayPreview(player, new Comet()).branches[0];
    // Comet ALSO places an ocean, but the plant attack is independent of WHERE the
    // ocean lands, so it's elevated to Priority.PLAY_CARD_PLANT_REMOVAL (ahead of the
    // ocean) and PRE-COLLECTED in the play modal as an OrOptions step. The ocean is an
    // inherently post-confirm placement → noted (PlacementBanner). Order matters: the
    // OrOptions step comes BEFORE the placement note (matching the live prompt order).
    const orIdx = branch.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'or');
    const placeIdx = branch.steps.findIndex((s) => s.kind === 'boardPlacement');
    expect(orIdx, 'pre-collected plant OrOptions step').is.greaterThan(-1);
    expect(placeIdx, 'ocean placement note').is.greaterThan(-1);
    expect(orIdx, 'plant pick is collected BEFORE the placement note').is.lessThan(placeIdx);
  });

  it('Comet (placement card): the pre-collected plant pick resolves the live OrOptions BEFORE the ocean', () => {
    const [game, player, opponent] = testGame(3);
    opponent.plants = 5;
    // The preview offers the plant OrOptions (option 0 = the opponent). The batch
    // replay submits that index. Prove the LIVE prompt order now matches: after play,
    // the plant OrOptions prompts FIRST (so the batch's plant response lands on it),
    // and the ocean placement is the remaining post-confirm prompt.
    const preview = cardPlayPreview(player, new Comet()).branches[0];
    const orStep = preview.steps.find((s) => s.kind === 'input' && s.input.type === 'or');
    expect(orStep, 'preview offers a plant OrOptions step').is.not.undefined;

    const card = new Comet();
    card.play(player);
    runAllActions(game);
    // FIRST live prompt = the plant OrOptions (elevated ahead of the ocean) — exactly
    // where the batch's pre-collected {type:'or', index:0} response lands.
    const live = cast(player.popWaitingFor(), OrOptions);
    live.options[0].cb();
    expect(opponent.plants, 'plant attack applied from the pre-collected pick').to.eq(2);
    // The ocean is the leftover post-confirm placement (PlacementBanner).
    runAllActions(game);
    cast(player.popWaitingFor(), SelectSpace);
  });

  // A card that HOLDS the resource it adds on play can target ITSELF. The preview
  // runs while the card is still in HAND (not on the tableau), so the live
  // `getResourceCards` can't see it — the preview must add the card-being-played to
  // the candidate set explicitly, else the modal can't offer "add to the card you're
  // playing" (and falsely warns "no eligible card" when nothing else holds it).
  describe('on-play self-target (card holds the resource it adds)', () => {
    it('JovianLanterns: the card itself is an on-play floater target even with NO other floater card', () => {
      const [game, player] = testGame(2);
      const card = new JovianLanterns();
      const branch = cardPlayPreview(player, card).branches[0];
      // The "+2 floaters to a card" gain chip shows (not suppressed) …
      expect(branch.effects.some((e) => e.note === 'to a card' && e.amount === 2)).is.true;
      // … and the target picker offers the card ITSELF — with NO false silent-loss warning.
      const step = branch.steps.find((s) => s.kind === 'input' && s.input.type === 'card');
      expect(step, 'a floater-target picker').to.exist;
      const names = step!.kind === 'input' ? (step!.input as SelectCardModel).cards.map((c) => c.name) : [];
      expect(names).to.include(card.name);
      expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning'), 'no false silent-loss warning').is.false;

      // The pre-collected self-pick replays against the live follow-up: once played,
      // the card IS on the tableau, so it's a candidate and the 2 floaters land on it.
      player.playCard(card);
      runAllActions(game);
      const live = cast(player.popWaitingFor(), SelectCard);
      expect(live.cards.map((c) => c.name)).to.include(card.name);
      live.process({type: 'card', cards: [card.name]});
      runAllActions(game);
      expect(card.resourceCount).eq(2);
    });

    it('TitanFloatingLaunchPad: itself is a valid target (a Jovian-restricted add + its own Jovian tag)', () => {
      const [/* game */, player] = testGame(2);
      const card = new TitanFloatingLaunchPad();
      // The add is restricted to Jovian cards; Titan FLP carries a Jovian tag, so it
      // qualifies as its own target (it isn't on the tableau at preview time).
      const branch = cardPlayPreview(player, card).branches[0];
      const step = branch.steps.find((s) => s.kind === 'input' && s.input.type === 'card');
      expect(step, 'a floater-target picker').to.exist;
      const names = step!.kind === 'input' ? (step!.input as SelectCardModel).cards.map((c) => c.name) : [];
      expect(names).to.include(card.name);
    });
  });

  // The preview's pre-collected step response must be byte-compatible with the
  // LIVE follow-up prompt the server produces after play, so the batch lines up.
  describe('play protocol (preview step matches the live follow-up)', () => {
    it('StratosphericBirds: the "spend a floater from a card" SOURCE pick is pre-collected (not a post-confirm modal)', () => {
      const [game, player] = testGame(2);
      const dirigibles = new Dirigibles();
      const deuteriumExport = new DeuteriumExport();
      player.playedCards.push(dirigibles, deuteriumExport);
      player.addResourceTo(dirigibles, 2);
      player.addResourceTo(deuteriumExport, 1);
      const card = new StratosphericBirds();

      // The on-play preview hosts the floater-SOURCE picker IN the modal — every
      // floater-holding card is a candidate (the player chooses WHICH to spend from
      // BEFORE confirm). This is the class the audit covers: a "spend from one of your
      // cards" source pick, not just a target-player pick.
      const step = card.cardPlayPreview(player).branches[0].steps
        .find((s) => s.kind === 'input' && s.input.type === 'card');
      expect(step, 'a floater-source card pick step').to.exist;
      const previewNames = step!.kind === 'input' ? (step!.input as SelectCardModel).cards.map((c) => c.name) : [];
      expect(previewNames).to.have.members([dirigibles.name, deuteriumExport.name]);
      // The step carries the signed delta (−1) so the picker shows each candidate's
      // floater `current → resulting` (the projected change), not just the bare count.
      expect((step as {amount?: number}).amount).to.eq(-1);

      // Live play: bespokePlay defers the floater RemoveResourcesFromCard — the LIVE
      // SelectCard enumerates the SAME candidates, so the pre-collected pick replays.
      player.playCard(card);
      runAllActions(game);
      const live = cast(player.popWaitingFor(), SelectCard);
      expect(live.cards.map((c) => c.name)).to.have.members(previewNames);
      live.process({type: 'card', cards: [dirigibles.name]});
      expect(dirigibles.resourceCount).to.eq(1); // 2 − 1, no post-confirm modal needed
    });

    it('StratosphericBirds: a SINGLE floater source is STILL shown (autoselect:false → never a silent spend)', () => {
      const [/* game */, player] = testGame(2);
      const onlyFloaterCard = new Dirigibles();
      player.playedCards.push(onlyFloaterCard);
      player.addResourceTo(onlyFloaterCard, 3);

      // Even with exactly ONE eligible card, the picker step is emitted (the client
      // pre-selects it + shows its floater count → the player still SEES where the
      // floater is spent from). It is NOT auto-applied behind the modal.
      const step = new StratosphericBirds().cardPlayPreview(player).branches[0].steps
        .find((s) => s.kind === 'input' && s.input.type === 'card');
      expect(step, 'the lone floater source is still a shown pick step').to.exist;
      const names = step!.kind === 'input' ? (step!.input as SelectCardModel).cards.map((c) => c.name) : [];
      expect(names).to.deep.eq([onlyFloaterCard.name]);
    });

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
      select.process({type: 'card', cards: [t1.name]});
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

    it('EcologyResearch: no animal/microbe card → WARNING notes (no silent loss), no gain chips', () => {
      const [/* game */, player] = testGame(2);
      // No animal- or microbe-holding card in play — both additions would be lost.
      const branch = new EcologyResearch().cardPlayPreview(player).branches[0];
      // No misleading "to a card" gain chips.
      expect(branch.effects.some((e) => e.note === 'to a card'), 'no fake gain chips').is.false;
      // Two WARNING note steps naming the lost resources by their icon keys.
      const warnings = branch.steps.filter((s) => s.kind === 'note' && s.noteKind === 'warning');
      expect(warnings).has.length(2);
      const resources = warnings.map((w) => (w as {resource?: string}).resource);
      expect(resources).to.have.members(['animal', 'microbe']);
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

    it('SoilEnrichment: a single eligible card still shows the picker (no autoselect)', () => {
      const [/* game */, player] = testGame(2);
      const t1 = new Tardigrades();
      t1.resourceCount = 1;
      player.playedCards.push(t1);
      const branch = new SoilEnrichment().cardPlayPreview(player).branches[0];
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(1);
      expect(inputs[0].kind === 'input' && inputs[0].input.type).eq('card');
      const names = (inputs[0].kind === 'input' ? (inputs[0].input as SelectCardModel).cards : []).map((c) => c.name);
      expect(names).to.have.members([t1.name]);
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

    it('LocalHeatTrapping: with an animal card → two branches (gain plants / add animals), each showing −5 heat', () => {
      const [/* game */, player] = testGame(2);
      player.heat = 5;
      player.playedCards.push(new Birds());
      const preview = new LocalHeatTrapping().cardPlayPreview(player);
      expect(preview.branches).has.length(2);
      const [gain, animal] = preview.branches;
      // Both branches show the −5 heat cost (it is spent regardless of the choice).
      expect(gain.effects.some((e) => e.icon === Resource.HEAT && e.direction === 'cost')).is.true;
      expect(animal.effects.some((e) => e.icon === Resource.HEAT && e.direction === 'cost')).is.true;
      // The animal branch is now available with a card-target picker (was an OrOptions step).
      expect(animal.available).is.true;
      expect(animal.steps.some((s) => s.kind === 'input' && s.input.type === 'card')).is.true;
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
      select.process({type: 'card', cards: [e1.name]});
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
      select.process({type: 'card', cards: [a.name, b.name]});
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
    it('MiningExpedition: a pre-collected plant-removal OrOptions (target current→resulting, self-warning, skip, disabled)', () => {
      const [/* game */, player, opponent, protectedPlayer] = testGame(4);
      opponent.plants = 6; // a removable target
      player.plants = 3; // → a self-removal option (with a warning)
      protectedPlayer.plants = 0; // → a disabled "No plants to remove" target

      const branch = cardPlayPreview(player, new MiningExpedition()).branches[0];
      // The automatic gains (steel + oxygen) show as chips; the plant attack is the step.
      expect(branch.effects.some((e) => e.icon === Resource.STEEL && e.direction === 'gain')).is.true;
      expect(branch.effects.some((e) => e.icon === 'oxygen')).is.true;

      const step = branch.steps.find((s) => s.kind === 'input' && s.input.type === 'or');
      expect(step, 'a plant-removal OrOptions step').to.exist;
      const model = step!.kind === 'input' ? (step!.input as OrOptionsModel) : undefined;
      // The opponent target carries a current→resulting plant preview via metadata.
      const targetOption = (model!.options as ReadonlyArray<SelectOptionModel>).find((o) => o.metadata?.player?.color === opponent.color);
      expect(targetOption?.metadata?.player?.current).eq(6);
      expect(targetOption?.metadata?.player?.resulting).eq(4); // remove up to 2
      // A self-removal option exists with the self-harm warning.
      const selfOption = (model!.options as ReadonlyArray<SelectOptionModel>).find((o) => (o.warnings ?? []).includes('removeOwnPlants'));
      expect(selfOption, 'a self-removal option with a warning').to.exist;
      // A "skip" option (do not remove) is part of the picker.
      expect((model!.options as ReadonlyArray<SelectOptionModel>).some((o) => o.metadata?.kind === 'skip'), 'a skip option').is.true;
      // The 0-plant opponent is a disabled target with a reason.
      expect((model!.disabledOptions ?? []).some((d) => d.reason === 'No plants to remove'), 'a disabled target').is.true;
    });

    it('MiningExpedition: the pre-collected plant choice replays against the live follow-up', () => {
      const [game, player, opponent] = testGame(3);
      opponent.plants = 6;
      const card = new MiningExpedition();

      // The preview's OrOptions option ORDER (the index the modal captures).
      const branch = cardPlayPreview(player, card).branches[0];
      const step = branch.steps.find((s) => s.kind === 'input' && s.input.type === 'or');
      const model = step!.kind === 'input' ? (step!.input as OrOptionsModel) : undefined;
      const targetIdx = (model!.options as ReadonlyArray<SelectOptionModel>).findIndex((o) => o.metadata?.player?.color === opponent.color);
      expect(targetIdx).is.greaterThan(-1);

      // Live play: steel + oxygen apply immediately, then the plant-removal OrOptions.
      player.playCard(card);
      runAllActions(game);
      const live = cast(player.popWaitingFor(), OrOptions);
      // The live OrOptions enumerates options IDENTICALLY (same side-effect-free
      // builder), so the captured index targets the same opponent.
      live.process({type: 'or', index: targetIdx, response: {type: 'option'}}, player);
      runAllActions(game);
      expect(opponent.plants).eq(4); // 6 − 2
    });

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

  // REGRESSION: a declarative card whose `addResourcesToAnyCard` is an ARRAY (add X
  // to a card AND Y to another) had BOTH the chips and the pickers silently dropped
  // by the `!Array.isArray` guard in the preview walkers.
  describe('array addResourcesToAnyCard (Imported Nitrogen bug)', () => {
    it('ImportedNitrogen: chips + pickers for BOTH the microbe and the animal addition', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Tardigrades(), new Birds()); // a microbe + an animal card

      // Declarative card → the generic module-level preview (no co-located hook).
      const branch = cardPlayPreview(player, new ImportedNitrogen()).branches[0];
      // The declarative plants + TR.
      expect(branch.effects.some((e) => e.icon === Resource.PLANTS), 'plants chip').is.true;
      expect(branch.effects.some((e) => e.icon === 'tr'), 'TR chip').is.true;
      // BOTH "to a card" gain chips (the array additions).
      expect(branch.effects.find((e) => e.note === 'to a card' && e.amount === 3), 'microbe chip').is.not.undefined;
      expect(branch.effects.find((e) => e.note === 'to a card' && e.amount === 2), 'animal chip').is.not.undefined;
      // BOTH target pickers, in array order (microbe +3, then animal +2), each
      // carrying its resource icon key so the modal names WHICH resource it adds.
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.length(2);
      expect(inputs[0].kind === 'input' && inputs[0].amount).eq(3);
      expect(inputs[0].kind === 'input' && inputs[0].cardResource).eq('microbe');
      expect(inputs[1].kind === 'input' && inputs[1].amount).eq(2);
      expect(inputs[1].kind === 'input' && inputs[1].cardResource).eq('animal');
    });

    it('ImportedNitrogen: PLAYABLE with NO target cards (rules: resources are lost) — both warn, no pick required', () => {
      const [/* game */, player] = testGame(2);
      player.megaCredits = 30; // afford the 23 cost; NO microbe/animal cards in play
      // The rules let you play it even with nowhere to put the resources (they're
      // simply lost) — `canPlay` must NOT require a target card.
      expect(new ImportedNitrogen().canPlay(player), 'playable with no target cards').is.true;
      const branch = cardPlayPreview(player, new ImportedNitrogen()).branches[0];
      // No pickers (nothing to add to) → confirm is NOT gated on a pick; both
      // additions surface as a "no eligible card" warning (honest, not silent).
      expect(branch.steps.filter((s) => s.kind === 'input')).has.length(0);
      expect(branch.steps.filter((s) => s.kind === 'note' && s.noteKind === 'warning')).has.length(2);
    });

    it('ImportedNitrogen: an addition with NO eligible card warns (no silent loss)', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Tardigrades()); // a microbe card but NO animal card

      const branch = cardPlayPreview(player, new ImportedNitrogen()).branches[0];
      expect(branch.effects.find((e) => e.note === 'to a card' && e.amount === 3), 'microbe chip').is.not.undefined;
      expect(branch.effects.some((e) => e.note === 'to a card' && e.amount === 2), 'no animal chip').is.false;
      expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning'), 'an animal warning').is.true;
    });

    it('ImportedNitrogen: the array picks replay against the live deferred prompts IN ORDER', () => {
      const [game, player] = testGame(2);
      const microbeCard = new Tardigrades();
      const animalCard = new Birds();
      player.playedCards.push(microbeCard, animalCard);

      player.playCard(new ImportedNitrogen());
      runAllActions(game); // applies plants + TR, defers the two AddResourcesToCard
      // Microbe first (array order), then animal — matching the preview step order.
      cast(player.popWaitingFor(), SelectCard).process({type: 'card', cards: [microbeCard.name]});
      runAllActions(game);
      expect(microbeCard.resourceCount).eq(3);
      cast(player.popWaitingFor(), SelectCard).process({type: 'card', cards: [animalCard.name]});
      runAllActions(game);
      expect(animalCard.resourceCount).eq(2);
    });
  });

  // "Gain a resource OR add a card-resource to ANOTHER card" cards (Imported
  // Hydrogen, Large Convoy, Local Heat Trapping) used to silently auto-gain the
  // fallback and HIDE the alternatives when no target card existed. They now show
  // EVERY branch — the impossible ones DISABLED with a reason — and pre-collect the
  // chosen branch + its target in the play modal.
  describe('gain-or-add-to-card multi-branch (no hidden auto-select)', () => {
    it('ImportedHydrogen: no microbe/animal card → 3 branches, plants available, the other two disabled-with-reason', () => {
      const [/* game */, player] = testGame(2);
      const preview = new ImportedHydrogen().cardPlayPreview(player);
      expect(preview.branches).has.length(3);
      const [gain, microbe, animal] = preview.branches;
      // The fallback is the lone available branch → it auto-resolves (index -1: the
      // live bespokePlay gains plants with no OrOptions).
      expect(gain.available).is.true;
      expect(gain.index).eq(-1);
      expect(gain.effects.some((e) => e.icon === Resource.PLANTS && e.current === player.plants)).is.true;
      // Both add-alternatives are shown DISABLED with a clear reason (never hidden).
      expect(microbe.available).is.false;
      expect(microbe.unavailableReason).is.not.undefined;
      expect(microbe.effects.some((e) => e.note === 'to a card' && e.amount === 3)).is.true;
      expect(animal.available).is.false;
      expect(animal.unavailableReason).is.not.undefined;
      expect(animal.effects.some((e) => e.note === 'to a card' && e.amount === 2)).is.true;
    });

    it('ImportedHydrogen: with both targets → 3 available branches, runtime indices 0/1/2 + target pickers', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new Tardigrades(), new Pets());
      const preview = new ImportedHydrogen().cardPlayPreview(player);
      const [gain, microbe, animal] = preview.branches;
      expect(gain.index).eq(0);
      expect(microbe.available).is.true;
      expect(microbe.index).eq(1);
      expect(animal.available).is.true;
      expect(animal.index).eq(2);
      // The add branches host the target picker (a SelectCard step, +N impact).
      const microbeStep = microbe.steps.find((s) => s.kind === 'input' && s.input.type === 'card');
      expect(microbeStep, 'microbe target picker').is.not.undefined;
      expect(microbeStep?.kind === 'input' && microbeStep.amount).eq(3);
      expect(animal.steps.some((s) => s.kind === 'input' && s.input.type === 'card')).is.true;
    });

    it('ImportedHydrogen: the pre-collected choice + target resolve BEFORE the ocean (the batch lines up)', () => {
      const [game, player] = testGame(2);
      const tardigrades = new Tardigrades();
      player.playedCards.push(tardigrades);
      const card = new ImportedHydrogen();

      // The preview says: branch 1 = add microbes, then pick the card.
      const preview = card.cardPlayPreview(player);
      const microbe = preview.branches[1];
      expect(microbe.index).eq(1);

      // Live: play, then replay the batch responses. The CHOICE must surface before
      // the ocean (deferred at PLAY_CARD_RESOURCE_CHOICE, ahead of PLACE_OCEAN_TILE).
      player.playCard(card);
      runAllActions(game);
      const choice = cast(player.popWaitingFor(), OrOptions);
      expect(choice.options).has.length(2); // plants + microbes
      choice.process({type: 'or', index: microbe.index, response: {type: 'option'}}, player);
      runAllActions(game);
      // The target picker comes NEXT — still before the ocean.
      const select = cast(player.popWaitingFor(), SelectCard);
      expect(select.cards.map((c) => c.name)).to.include(tardigrades.name);
      select.process({type: 'card', cards: [tardigrades.name]});
      runAllActions(game);
      expect(tardigrades.resourceCount).eq(3);
      // ONLY now does the ocean placement remain — it rides PlacementBanner.
      cast(player.popWaitingFor(), SelectSpace);
    });

    it('LargeConvoy: shows the automatic draw 2 chip on every branch + a disabled animal branch when no target', () => {
      const [/* game */, player] = testGame(2);
      const preview = new LargeConvoy().cardPlayPreview(player);
      expect(preview.branches).has.length(2);
      const [gain, animal] = preview.branches;
      // The declarative behavior (draw 2) shows on each branch as part of the outcome.
      expect(gain.effects.some((e) => e.icon === 'cards' && e.note === 'draw' && e.amount === 2)).is.true;
      expect(animal.effects.some((e) => e.icon === 'cards' && e.note === 'draw')).is.true;
      // The animal alternative is shown disabled with a reason (no animal card).
      expect(animal.available).is.false;
      expect(animal.unavailableReason).is.not.undefined;
      expect(gain.available).is.true;
      expect(gain.effects.some((e) => e.icon === Resource.PLANTS && e.amount === 5)).is.true;
    });

    it('LocalHeatTrapping: every branch shows the −5 heat cost; the animal branch is disabled with a reason when no target', () => {
      const [/* game */, player] = testGame(2);
      player.heat = 8;
      const preview = new LocalHeatTrapping().cardPlayPreview(player);
      expect(preview.branches).has.length(2);
      const [gain, animal] = preview.branches;
      // The −5 heat (a prefix cost) is shown on BOTH branches.
      expect(gain.effects.some((e) => e.icon === Resource.HEAT && e.direction === 'cost' && e.amount === 5)).is.true;
      expect(animal.effects.some((e) => e.icon === Resource.HEAT && e.direction === 'cost')).is.true;
      expect(gain.effects.some((e) => e.icon === Resource.PLANTS && e.amount === 4)).is.true;
      expect(animal.available).is.false;
      expect(animal.unavailableReason).is.not.undefined;
    });

    it('LocalHeatTrapping: with an animal card the animal branch is available with the target picker', () => {
      const [/* game */, player] = testGame(2);
      player.heat = 8;
      player.playedCards.push(new Pets());
      const preview = new LocalHeatTrapping().cardPlayPreview(player);
      const animal = preview.branches[1];
      expect(animal.available).is.true;
      expect(animal.index).eq(1);
      const step = animal.steps.find((s) => s.kind === 'input' && s.input.type === 'card');
      expect(step, 'animal target picker').is.not.undefined;
      expect(step?.kind === 'input' && step.amount).eq(2);
    });

    it('READ-ONLY: the gain-or-add preview never mutates plants / heat / card resources', () => {
      const [/* game */, player] = testGame(2);
      player.heat = 8;
      const pets = new Pets();
      player.playedCards.push(pets);
      const before = {plants: player.plants, heat: player.heat, pets: pets.resourceCount};
      new ImportedHydrogen().cardPlayPreview(player);
      new LargeConvoy().cardPlayPreview(player);
      new LocalHeatTrapping().cardPlayPreview(player);
      expect(player.plants).eq(before.plants);
      expect(player.heat).eq(before.heat);
      expect(pets.resourceCount).eq(before.pets);
    });
  });
});
