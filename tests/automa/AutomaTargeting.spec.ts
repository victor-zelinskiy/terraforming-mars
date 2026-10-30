import {expect} from 'chai';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {Counter} from '../../src/server/behavior/Counter';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {RemoveAnyPlants} from '../../src/server/deferredActions/RemoveAnyPlants';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {AutomaTargeting} from '../../src/server/automa/AutomaTargeting';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {CometForVenus} from '../../src/server/cards/venusNext/CometForVenus';
import {GalileanWaystation} from '../../src/server/cards/colonies/GalileanWaystation';
import {SponsoredAcademies} from '../../src/server/cards/venusNext/SponsoredAcademies';
import {Virus} from '../../src/server/cards/base/Virus';
import {Ants} from '../../src/server/cards/base/Ants';
import {Predators} from '../../src/server/cards/base/Predators';
import {Ceres} from '../../src/server/colonies/Ceres';
import {CardResource} from '../../src/common/CardResource';
import {RemoveResourcesFromCard} from '../../src/server/deferredActions/RemoveResourcesFromCard';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {TabbedTargetsStep} from '../../src/common/models/ActionPreviewModel';
import {OrOptionsModel} from '../../src/common/models/PlayerInputModel';
import {cast} from '../../src/common/utils/utils';
import {fakeCard} from '../TestingUtils';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {Birds} from '../../src/server/cards/base/Birds';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

function optionTitles(input: OrOptions): Array<string> {
  return input.options.map((o) => typeof o.title === 'string' ? o.title : o.title.message);
}

describe('Automa targeting — the human turn vs MarsBot', () => {
  describe('remove: the M€ supply as the matching resource type', () => {
    it('RemoveAnyPlants offers MarsBot and removes from its M€ supply', () => {
      const [/* game */, human, bot] = testAutomaGame();
      bot.megaCredits = 7;
      const options = cast(new RemoveAnyPlants(human, 5).execute(), OrOptions);
      const botOption = options.options[0];
      expect(optionTitles(options)[0]).contains('Remove ${0} plants');
      botOption.cb(undefined);
      expect(bot.megaCredits).eq(2);
      expect(human.plants).eq(0); // A removal, not a steal.
    });

    it('with Colonies the REAL storage plants (Ganymede) go first, the M€ proxy tops up', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 7;
      game.automa!.shippingStorage[ColonyName.GANYMEDE] = 2;
      expect(AutomaTargeting.attackableStock(bot, Resource.PLANTS)).eq(9);

      const options = cast(new RemoveAnyPlants(human, 5).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(game.automa!.shippingStorage[ColonyName.GANYMEDE]).eq(0);
      expect(bot.megaCredits).eq(4); // 2 from storage + 3 from the supply.
    });

    it('a broke MarsBot (0 M€, no storage) is not a removable target', () => {
      const [/* game */, human, bot] = testAutomaGame();
      bot.megaCredits = 0;
      expect(new RemoveAnyPlants(human, 5).execute()).is.undefined;
    });
  });

  /*
   * THE BOT IS ONE MORE PLAYER AT THE TABLE (the owner, 2026-10-30): its storage areas and the M€ supply standing in are
   * how its ENGINE pays — the journal, the log and every reader of the event stream see ONE loss of the unit attacked,
   * its total, never an M€ row and never a storage area.
   */
  describe('the loss reads as the unit attacked — never the engine\'s currency', () => {
    const botEvents = (game: ReturnType<typeof testAutomaGame>[0], color: string) =>
      game.events.events.filter((e) => e.player === color && (e.type === 'resource-changed' || e.type === 'card-resource-changed'));
    const lines = (game: ReturnType<typeof testAutomaGame>[0]) => game.gameLog.map((l) => l.message);

    it('plants off storage + M€: ONE plants event (attackable 9 → 4), ONE plants line, no M€', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 7;
      game.automa!.shippingStorage[ColonyName.GANYMEDE] = 2;
      const logBefore = game.gameLog.length;
      game.events.beginAction(human, undefined);
      cast(new RemoveAnyPlants(human, 5).execute(), OrOptions).options[0].cb(undefined);
      game.events.endScope();
      expect(bot.megaCredits, 'the engine still pays').eq(4);
      const events = botEvents(game, bot.color);
      expect(events.map((e) => e.impact?.stock)).deep.eq([{plants: -5}]);
      expect(events[0].impact?.snapshot).deep.eq({resource: Resource.PLANTS, scope: 'stock', before: 9, after: 4});
      const added = lines(game).slice(logBefore);
      expect(added.filter((m) => m.includes('storage area')), 'no storage area').deep.eq([]);
      expect(added).to.include('${0} lost ${1} ${2} because of ${3}');
      expect(game.gameLog.slice(logBefore).some((l) => l.data.some((d) => d.value === Resource.MEGACREDITS)), 'no M€ token').eq(false);
    });

    it('a steal: the bot\'s ONE «stole» line, the thief gains the stolen type silently', () => {
      const [game, human, bot] = testAutomaGame();
      bot.megaCredits = 3;
      const logBefore = game.gameLog.length;
      cast(new StealResources(human, Resource.STEEL, 2).execute(), OrOptions).options[0].cb(undefined);
      expect(human.steel).eq(2);
      expect(lines(game).slice(logBefore)).deep.eq(['${3} stole ${1} ${2} from ${0}']);
    });

    it('a card resource: ONE animal event on no card, ONE animal line — the Miranda area and the M€ never named', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 4;
      game.automa!.shippingStorage[ColonyName.MIRANDA] = 1;
      const logBefore = game.gameLog.length;
      game.events.beginAction(human, undefined);
      AutomaTargeting.removeCardResourceFromBot(game, CardResource.ANIMAL, 2);
      game.events.endScope();
      expect(bot.megaCredits).eq(3);
      expect(botEvents(game, bot.color).map((e) => e.impact?.cardResources)).deep.eq([[{cardResource: CardResource.ANIMAL, amount: -2}]]);
      expect(lines(game).slice(logBefore)).deep.eq(['${0} lost ${1} ${2}']);
    });
  });

  describe('steal: the thief receives the STOLEN TYPE, MarsBot pays in M€', () => {
    it('stealing steel gives the human steel; the bot loses M€', () => {
      const [/* game */, human, bot] = testAutomaGame();
      bot.megaCredits = 3;
      const options = cast(new StealResources(human, Resource.STEEL, 2).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(human.steel).eq(2);
      expect(bot.megaCredits).eq(1);
    });

    it('the Ceres storage steel is stolen first ("as usual"), then the M€ proxy', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 3;
      game.automa!.shippingStorage[ColonyName.CERES] = 1;
      const options = cast(new StealResources(human, Resource.STEEL, 2).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(human.steel).eq(2);
      expect(game.automa!.shippingStorage[ColonyName.CERES]).eq(0);
      expect(bot.megaCredits).eq(2);
    });

    it('stealing M€ drains the supply first, then the Luna storage', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 3;
      game.automa!.shippingStorage[ColonyName.LUNA] = 4;
      const options = cast(new StealResources(human, Resource.MEGACREDITS, 5, undefined, true).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(human.megaCredits).eq(5);
      expect(bot.megaCredits).eq(0);
      expect(game.automa!.shippingStorage[ColonyName.LUNA]).eq(2);
    });
  });

  describe('decrease production → the mapped track regresses', () => {
    it('an energy production attack regresses the Energy track with the marker', () => {
      const [game, /* human */, bot] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.ENERGY];
      track.position = 3;
      bot.production.add(Resource.ENERGY, -1, {log: true});
      expect(track.position).eq(2);
      expect(track.regressedPositions.has(3)).is.true;
      expect(bot.production.energy).eq(0); // Never a real production mutation.
    });

    it('a 2-step M€ production decrease regresses the Event track twice', () => {
      const [game, /* human */, bot] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.EVENT];
      track.position = 5;
      bot.production.add(Resource.MEGACREDITS, -2, {log: true});
      expect(track.position).eq(3);
      expect(track.regressedPositions).deep.eq(new Set([4, 5]));
    });

    it('canHaveProductionReduced mirrors the track position', () => {
      const [game, human, bot] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.BIO];
      expect(bot.canHaveProductionReduced(Resource.PLANTS, 1, human)).is.false;
      track.position = 2;
      expect(bot.canHaveProductionReduced(Resource.PLANTS, 1, human)).is.true;
      expect(bot.canHaveProductionReduced(Resource.PLANTS, 3, human)).is.false;
    });

    it('a positive production write to the bot throws (no silent dead state — frame §5)', () => {
      const [/* game */, /* human */, bot] = testAutomaGame();
      expect(() => bot.production.add(Resource.ENERGY, 1)).to.throw(/unsupported/);
      expect(bot.production.energy).eq(0);
    });
  });

  describe('counting what all players have → the tracks', () => {
    it('an "all players" tag count reads the bot track position (current, post-regression)', () => {
      const [game, human] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.EVENT];
      track.position = 5;
      track.regress(); // Position 4 — the CURRENT position counts.
      const counter = new Counter(human, fakeCard({}));
      expect(counter.count({tag: Tag.EVENT, all: true})).eq(4);
    });

    it('Galilean Waystation counts HALF the Jovian track, rounded down (FAQ)', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true});
      game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 5; // Jovian rides Energy.
      const counter = new Counter(human, new GalileanWaystation());
      expect(counter.count({tag: Tag.JOVIAN, all: true})).eq(2);

      const plain = new Counter(human, fakeCard({}));
      expect(plain.count({tag: Tag.JOVIAN, all: true})).eq(5);
    });
  });

  it('Comet for Venus targets MarsBot when its Venus track is above 0', () => {
    const [game, human, bot] = testAutomaGame({venusNextExtension: true});
    const card = new CometForVenus();
    expect(card.bespokePlay(human)).is.undefined; // Venus track 0 → no target.

    game.automa!.board.tracks[7].position = 2;
    bot.megaCredits = 6;
    // The flat premium attack shape: options[0] IS the bot's removal option.
    const options = cast(card.bespokePlay(human), OrOptions);
    const remove = cast(options.options[0], SelectOption);
    expect(remove.metadata?.player?.color).eq(bot.color);
    remove.cb(undefined);
    expect(bot.megaCredits).eq(2); // −4 M€ from the supply.
  });

  it('Sponsored Academies pays MarsBot 1 M€ instead of the free draw (FAQ)', () => {
    const [/* game */, human, bot] = testAutomaGame({venusNextExtension: true});
    new SponsoredAcademies().bespokePlay(human);
    expect(bot.megaCredits).eq(1);
    expect(bot.cardsInHand).is.empty;
  });

  it('Virus can remove 2 "animals" from MarsBot: Miranda storage first, then M€', () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true});
    game.colonies.splice(0, game.colonies.length, new Ceres());
    bot.megaCredits = 5;
    game.automa!.shippingStorage[ColonyName.MIRANDA] = 1;

    const options = cast(new Virus().buildRemovalOptions(human), OrOptions);
    const botOption = options.options[options.options.length - 2]; // Before 'Skip removal'.
    botOption.cb(undefined);
    expect(game.automa!.shippingStorage[ColonyName.MIRANDA]).eq(0);
    expect(bot.megaCredits).eq(4);
  });
});

describe('Automa targeting — CARD-resource removal from MarsBot (microbes/animals storage, floaters counter)', () => {
  it('microbe / animal = the matching storage area + the M€-supply proxy', () => {
    const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
    bot.megaCredits = 4;
    game.automa!.shippingStorage[ColonyName.ENCELADUS] = 2; // microbes
    game.automa!.shippingStorage[ColonyName.MIRANDA] = 1; // animals
    expect(AutomaTargeting.attackableCardResourceStock(bot, CardResource.MICROBE)).eq(6);
    expect(AutomaTargeting.attackableCardResourceStock(bot, CardResource.ANIMAL)).eq(5);
  });

  it('FLOATER reads the automa.floaters counter (NOT the dead Titan storage) — correct WITH or WITHOUT Venus Next', () => {
    // Colonies-only: floaters live in automa.floaters, and the shippingStorage[TITAN]
    // map is a write-only dead pool → it MUST be ignored.
    const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
    bot.megaCredits = 4;
    game.automa!.floaters = 3;
    game.automa!.shippingStorage[ColonyName.TITAN] = 9; // dead pool — must NOT count
    expect(AutomaTargeting.attackableCardResourceStock(bot, CardResource.FLOATER)).eq(7); // 3 counter + 4 M€

    // WITH Venus Next the Titan storage area isn't used for floaters at all; the
    // counter is still the bot's floater pool, so the number is Venus-agnostic.
    const [g2, /* h2 */, bot2] = testAutomaGame({venusNextExtension: true});
    bot2.megaCredits = 2;
    g2.automa!.floaters = 5;
    expect(AutomaTargeting.attackableCardResourceStock(bot2, CardResource.FLOATER)).eq(7); // 5 counter + 2 M€
  });

  it('removeCardResourceFromBot(FLOATER) drains the automa.floaters counter first, then M€', () => {
    const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
    bot.megaCredits = 5;
    game.automa!.floaters = 1;
    const removed = AutomaTargeting.removeCardResourceFromBot(game, CardResource.FLOATER, 3);
    expect(removed).eq(3);
    expect(game.automa!.floaters).eq(0); // counter drained first
    expect(bot.megaCredits).eq(3); // then 2 from the M€ proxy
  });

  it('without Colonies the M€ supply alone proxies a card-resource', () => {
    const [/* game */, /* human */, bot] = testAutomaGame();
    bot.megaCredits = 3;
    expect(AutomaTargeting.attackableCardResourceStock(bot, CardResource.MICROBE)).eq(3);
    bot.megaCredits = 0;
    expect(AutomaTargeting.attackableCardResourceStock(bot, CardResource.MICROBE)).eq(0);
  });

  it('RemoveResourcesFromCard(MICROBE) offers MarsBot — Enceladus storage drains first, then M€', () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true});
    bot.megaCredits = 5;
    game.automa!.shippingStorage[ColonyName.ENCELADUS] = 1;
    // A lone bot with no microbe cards → the ONLY target is the bot.
    const or = cast(new RemoveResourcesFromCard(human, CardResource.MICROBE, 1, {autoselect: false}).execute(), OrOptions);
    or.options[0].cb(undefined);
    expect(game.automa!.shippingStorage[ColonyName.ENCELADUS]).eq(0); // storage first
    expect(bot.megaCredits).eq(5); // M€ untouched (storage covered it)
  });

  it('Ants / Predators stay AVAILABLE against a lone MarsBot (its storage / M€ is the target)', () => {
    const [/* game */, human, bot] = testAutomaGame();
    bot.megaCredits = 2;
    expect(new Ants().canAct(human)).is.true;
    expect(new Predators().canAct(human)).is.true;
    // A broke bot with no storage → genuinely no target.
    bot.megaCredits = 0;
    expect(new Ants().canAct(human)).is.false;
    expect(new Predators().canAct(human)).is.false;
  });

  it('previewRemovalModel exposes the bot as an OrOptions option (matches the live prompt for the action confirm)', () => {
    const [/* game */, human, bot] = testAutomaGame();
    bot.megaCredits = 3;
    const model = new RemoveResourcesFromCard(human, CardResource.ANIMAL, 1, {autoselect: false}).previewRemovalModel();
    expect(model?.type).eq('or');
    const or = model as OrOptionsModel;
    // The bot option carries the card-resource removal metadata (icon + player impact).
    const botOpt = or.options.find((o) => o.type === 'option' && o.metadata?.kind === 'resourceRemoval');
    expect(botOpt, 'bot removal option in the preview').is.not.undefined;
  });

  /**
   * THE «ХИЩНИКИ» SHAPE — a bot AND an opponent card are both legal targets, so the
   * picker is an `OrOptions` [the card `SelectCard`, the bot row]. The pre-collected
   * response must replay against the LIVE prompt byte for byte, or the action
   * confirm silently loses every card target the moment a bot joins the table.
   */
  it('Predators with BOTH an opponent card and the bot: the preview step IS the live prompt', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(2);
    const [human, opponent] = humans;
    bot.megaCredits = 3;
    const card = new Predators();
    human.playedCards.push(card);
    const birds = new Birds();
    opponent.playedCards.push(birds);
    opponent.addResourceTo(birds, 4);

    const step = card.actionPreview(human).branches[0].steps[0];
    expect(step.kind).eq('input');
    const model = (step as {input: OrOptionsModel}).input;
    expect(model.type).eq('or');
    // The CARD branch is an option of its own — the console descends into it.
    expect(model.options[0].type).eq('card');
    expect(model.options[1].type).eq('option');
    // …and the step NAMES what its −1 moves, so the picker can read «4 → 3».
    expect((step as {amount?: number}).amount).eq(-1);
    expect((step as {cardResource?: string}).cardResource).eq('animal');

    // THE LIVE PROMPT, same shape, same order — and the pre-collected response
    // («card branch, take from Birds») is accepted verbatim.
    card.action(human);
    const live = cast(game.deferredActions.pop()!.execute(), OrOptions);
    expect(live.options[0]).instanceOf(SelectCard);
    expect(live.options.length).eq(model.options.length);
    live.process({type: 'or', index: 0, response: {type: 'card', cards: [birds.name]}}, human);
    runAllActions(game);
    expect(birds.resourceCount, 'the animal left the opponent card').eq(3);
    expect(card.resourceCount, 'and landed on Predators').eq(1);
  });

  it('Virus preview: MarsBot is a player-target in the ANIMAL tab (its Miranda + M€ proxy)', () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true});
    bot.megaCredits = 4;
    game.automa!.shippingStorage[ColonyName.MIRANDA] = 1;
    const preview = cardPlayPreview(human, new Virus());
    const step = preview.branches[0].steps.find((s) => s.kind === 'tabbedTargets') as TabbedTargetsStep;
    expect(step, 'tabbedTargets step').is.not.undefined;
    expect(step.animal?.targets?.some((t) => t.color === bot.color), 'bot in the animal tab').is.true;
  });
});

/**
 * «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» (the owner, 2026-10-28): the removal's `OrOptions` against a table with MarsBot names
 * which branch is which (`tableTargetPrompt`), so the console stands the bot beside the players without reading the
 * shape. The options, their order and the wire answer are the historical ones; the preview carries the same marker.
 */
describe('Automa targeting — the table target marker (one zone)', () => {
  it('cards + bot, mandatory: [card 0, bot 1] — no skip; the marker names WHO the bot is, never how its engine pays', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(2, {coloniesExtension: true});
    const [human, opponent] = humans;
    bot.megaCredits = 3;
    game.automa!.shippingStorage[ColonyName.ENCELADUS] = 2;
    const tardigrades = new Tardigrades();
    opponent.playedCards.push(tardigrades);
    opponent.addResourceTo(tardigrades, 2);
    const live = cast(new RemoveResourcesFromCard(human, CardResource.MICROBE, 1, {autoselect: false}).execute(), OrOptions);
    expect(live.options.map((o) => o.type)).deep.eq(['card', 'option']);
    const model = live.toModel(human);
    expect(model.tableTargetPrompt).deep.eq({cardBranch: 0, botBranch: 1, bot: {color: bot.color}});
  });

  it('a lone bot, optional: [bot 0, skip 1]', () => {
    const [/* game */, human, bot] = testAutomaGame();
    bot.megaCredits = 3;
    const live = cast(new RemoveResourcesFromCard(human, CardResource.ANIMAL, 1, {mandatory: false}).execute(), OrOptions);
    expect(live.toModel(human).tableTargetPrompt).deep.eq({botBranch: 0, skipBranch: 1, bot: {color: bot.color}});
  });

  it('the bot\'s option reads the unit attacked — a FLOATER, its counter and its M€ summed, never an M€ row', () => {
    const [game, human, bot] = testAutomaGame();
    bot.megaCredits = 3;
    game.automa!.floaters = 2;
    const model = new RemoveResourcesFromCard(human, CardResource.FLOATER, 1, {autoselect: false}).previewRemovalModel() as OrOptionsModel;
    const botOption = model.options[model.tableTargetPrompt!.botBranch] as {metadata?: {player?: {changes?: ReadonlyArray<{icon: string}>}}};
    expect(botOption.metadata?.player?.changes?.map((c) => c.icon)).deep.eq([CardResource.FLOATER]);
    expect(bot.color).is.not.undefined;
  });

  it('the preview carries the SAME marker as the live prompt (the pre-collected answer replays)', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(2);
    const [human, opponent] = humans;
    bot.megaCredits = 3;
    const card = new Predators();
    human.playedCards.push(card);
    const birds = new Birds();
    opponent.playedCards.push(birds);
    opponent.addResourceTo(birds, 4);
    const step = card.actionPreview(human).branches[0].steps[0] as {input: OrOptionsModel};
    card.action(human);
    const live = cast(game.deferredActions.pop()!.execute(), OrOptions);
    expect(step.input.tableTargetPrompt).deep.eq(live.toModel(human).tableTargetPrompt);
    expect(step.input.tableTargetPrompt?.cardBranch).eq(0);
    expect(step.input.tableTargetPrompt?.botBranch).eq(1);
  });

  it('no bot: no marker (the bare pick and its decline stay as they were)', () => {
    const [, human, opponent] = testGame(2);
    const birds = new Birds();
    opponent.playedCards.push(birds);
    opponent.addResourceTo(birds, 2);
    const input = new RemoveResourcesFromCard(human, CardResource.ANIMAL, 1, {mandatory: false}).execute();
    expect(input).instanceOf(OrOptions);
    expect(cast(input, OrOptions).toModel(human).tableTargetPrompt).is.undefined;
  });
});
