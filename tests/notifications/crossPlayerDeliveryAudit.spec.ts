import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {DomedCrater} from '../../src/server/cards/base/DomedCrater';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {Pets} from '../../src/server/cards/base/Pets';
import {MonsInsurance} from '../../src/server/cards/promo/MonsInsurance';
import {Teractor} from '../../src/server/cards/corporation/Teractor';
import {ConvertPlants} from '../../src/server/cards/base/standardActions/ConvertPlants';
import {CardName} from '../../src/common/cards/CardName';
import {EmptyBoard} from '../testing/EmptyBoard';
import {TestPlayer} from '../TestPlayer';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {diffRootNotifications, diffNegativeNotifications} from '../../src/client/components/notifications/notificationModel';
import {NotificationModel} from '../../src/client/components/notifications/notificationTypes';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {HiredRaiders} from '../../src/server/cards/base/HiredRaiders';
import {Predators} from '../../src/server/cards/base/Predators';
import {Fish} from '../../src/server/cards/base/Fish';
import {SponsoredAcademies} from '../../src/server/cards/venusNext/SponsoredAcademies';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {Luna} from '../../src/server/colonies/Luna';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {viewerImpactOfBotTurn} from '../../src/client/components/notifications/notificationSemantics';
import {causeLinesOf} from '../../src/client/components/notifications/notificationCauseView';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {AutomaController} from '../../src/server/automa/AutomaController';
import {ModularFloodgates} from '../../src/server/cards/delta/ModularFloodgates';

/**
 * CROSS-PLAYER DELIVERY AUDIT — «игрок обязан узнать, что чужой ход дал или
 * отнял у него что-то».
 *
 * Every scenario drives a REAL door (playCard / the deferred placements the
 * engine itself uses — never a bare game.addTile, which would skip the action
 * scope production always has), then replays the CLIENT's own pipeline over
 * the same streams the routes serve: `diffRootNotifications` must yield a
 * card for the ACTOR's correlation whose viewer band carries the viewer's
 * deltas. This is the corpus vehicle for the reported Ares bug («Запретная
 * зона»: сосед построился — владельцу не пришло «+1 M€») and its whole class.
 */

/** The exact streams the client fetches, replicated from the two routes
 *  (journal-events' ANALYTICS_ONLY_TAGS exclusion included). */
const ANALYTICS_ONLY_TAGS = new Set(['resource-payment', 'payment-bonus', 'colony-track', 'trade-discount', 'global-parameter', 'reveal']);

function deliveredModels(game: IGame, viewer: Color): Array<NotificationModel> {
  const events = game.events.events.filter((e) => !(e.tags ?? []).some((t) => ANALYTICS_ONLY_TAGS.has(t)));
  const {models} = diffRootNotifications({
    messages: game.gameLog,
    events,
    seen: new Set<number>(),
    viewerColor: viewer,
    generation: game.getGeneration(),
    createdAt: 1000,
  });
  return models;
}


/** Play through the REAL door (Player.playCard opens the card-play scope) and
 *  return the action's correlation root. */
function playThroughDoor(g: IGame, actor: TestPlayer, card: Parameters<TestPlayer['playCard']>[0]): number {
  actor.playCard(card);
  const root = g.events.events.find((e) =>
    e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === card.name);
  expect(root, `the play rooted an action event for ${card.name}`).is.not.undefined;
  return root!.correlationId;
}

function bandOf(models: ReadonlyArray<NotificationModel>, correlationId: number): NotificationModel {
  const model = models.find((m) => m.correlationId === correlationId);
  expect(model, `a notification model exists for correlation ${correlationId} ` +
    `(built models: ${models.map((m) => `${m.id}/${m.variant}`).join(', ') || 'none'})`).is.not.undefined;
  // ⭐ THE «ПОЧЕМУ» GUARANTEE, corpus-wide: every personal band this audit
  // delivers must carry at least one typed cause AND that cause must render a
  // NAMEABLE line (never an internal kind, never an empty zone). A scenario
  // that trips this has produced a gain/loss the player cannot explain.
  const impact = model!.viewerImpact;
  if (impact !== undefined && impact.sign !== 'neutral') {
    expect(impact.causes.length,
      `the band for correlation ${correlationId} carries typed causes`).greaterThan(0);
    const lines = causeLinesOf(impact);
    expect(lines.length,
      `every band renders a nameable «Источник» line (causes: ${JSON.stringify(impact.causes)})`).greaterThan(0);
  }
  return model!;
}

describe('cross-player delivery audit (the viewer hears about foreign actions)', () => {
  let game: IGame;
  let builder: TestPlayer; // the ACTOR (the reported user's seat)
  let owner: TestPlayer; // the VIEWER whose stuff moves («другой игрок»)

  function fresh(opts: {ares?: boolean} = {}): void {
    [game, builder, owner] = testGame(2, opts.ares === true ? {aresExtension: true} : {});
    if (opts.ares === true) {
      game.board = EmptyBoard.newInstance();
    }
  }

  it('S1 — the REPORTED case: Ares owner benefit reaches the owner as a positive band on the builder\'s card', () => {
    fresh({ares: true});
    // The owner's «Запретная зона»-style tile with an adjacency bonus.
    const tileSpace = game.board.getAvailableSpacesOnLand(builder)[0];
    tileSpace.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
    game.addTile(owner, tileSpace, {tileType: TileType.RESTRICTED_AREA});
    owner.megaCredits = 0;

    // The builder plays a CITY CARD — the real door: the play opens the action
    // scope, the placement rides a deferred SelectSpace that CAPTURES it.
    const crater = new DomedCrater();
    builder.megaCredits = 50;
    const rootId = playThroughDoor(game, builder, crater);

    runAllActions(game);
    // MID-PROMPT: the chain is OPEN (the atomic gate would hold the card).
    const placement = cast(builder.getWaitingFor(), SelectSpace);
    expect(game.openEventCorrelations(), 'the pending placement keeps the chain open').contains(rootId);

    // The builder places ADJACENT to the owner's tile — through the REAL
    // answer road (process() restores the prompt's captured scope; a bare
    // cb() would drop the correlation the way no production input ever does).
    const adjacent = game.board.getAdjacentSpaces(tileSpace).find((s) => placement.spaces.includes(s));
    expect(adjacent, 'an adjacent legal space exists').is.not.undefined;
    builder.process({type: 'space', spaceId: adjacent!.id});
    runAllActions(game);
    expect(game.openEventCorrelations(), 'the chain closed with the placement').does.not.contain(rootId);

    // The SERVER recorded the owner benefit inside the builder's chain.
    const ownerGain = game.events.events.find((e) =>
      e.player === owner.color && e.impact.stock?.megacredits === 1 && e.correlationId === rootId);
    expect(ownerGain, 'the owner\'s +1 M€ event lives in the builder\'s correlation').is.not.undefined;
    expect(owner.megaCredits).eq(1);

    // …and the CLIENT pipeline delivers it: ONE card for the builder's action,
    // leading with the owner's own gain (never suppressed, never anonymous).
    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.actor, 'the card is the BUILDER\'s action').eq(builder.color);
    expect(model.sign, 'the owner reads it as a personal gain').eq('positive');
    expect(model.importance).eq('notable');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+1'}]);
    // The «почему»: the owner-benefit event inherits the placer's card as its
    // source — the cause names the card whose placement paid the viewer.
    expect(model.viewerImpact?.causes[0].origin).deep.include({kind: 'card', card: CardName.DOMED_CRATER});
    expect(model.affects, 'the personal feed mode keeps it').contains(owner.color);
    // The builder's own view of the same action carries NO viewer band (it is
    // their own move — self-suppressed as an ordinary action).
    expect(deliveredModels(game, builder.color).find((m) => m.correlationId === rootId)).is.undefined;
  });

  it('S2 — passive effects of the VIEWER\'s cards fired by a foreign city: M€ + card resource, one band', () => {
    fresh({ares: true});
    const rover = new RoverConstruction();
    const pets = new Pets();
    owner.playedCards.push(rover, pets);
    owner.megaCredits = 0;

    const crater = new DomedCrater();
    builder.megaCredits = 50;
    const rootId = playThroughDoor(game, builder, crater);
    runAllActions(game);
    const placement = cast(builder.getWaitingFor(), SelectSpace);
    builder.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(game);

    // Server truth: both passive payouts recorded in the builder's chain.
    const roverGain = game.events.events.find((e) =>
      e.player === owner.color && e.impact.stock?.megacredits === 2 && e.correlationId === rootId);
    expect(roverGain, 'Rover Construction\'s +2 M€ is in the chain').is.not.undefined;
    const petsGain = game.events.events.find((e) =>
      e.player === owner.color && e.correlationId === rootId &&
      e.impact.cardResources?.some((cr) => cr.amount === 1));
    expect(petsGain, 'Pets\' +1 animal is in the chain').is.not.undefined;

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.sign).eq('positive');
    const gains = model.viewerImpact?.gains ?? [];
    expect(gains.find((c) => c.icon === 'megacredits')?.text, 'the M€ payout leads the band').eq('+2');
    expect(gains.find((c) => c.icon === 'Animal')?.text, 'the animal rides the same band').eq('+1');
    // The cause names one of the viewer's OWN earning cards (the «Источник» line).
    expect(model.viewerImpact?.ownSource, 'the source is the viewer\'s own card').eq(true);
    expect(model.viewerImpact?.sourceCard).is.not.undefined;
    // TWO engine pieces paid the viewer → TWO cause groups, each owning its own
    // chips (a multi-source total never claims one origin for everything), and
    // each names the VIEWER's own card plus the trigger that fired it.
    const causes = model.viewerImpact?.causes ?? [];
    expect(causes.map((c) => 'card' in c.origin ? c.origin.card : undefined))
      .has.members([CardName.ROVER_CONSTRUCTION, CardName.PETS]);
    for (const cause of causes) {
      expect(cause.own, 'both are the viewer\'s own cards').eq(true);
      expect(cause.trigger, 'the city placement is the trigger').eq('tile-placed');
      expect(cause.triggerTile, 'the ONE placed tile names itself').eq(TileType.CITY);
    }
    const roverCause = causes.find((c) => 'card' in c.origin && c.origin.card === CardName.ROVER_CONSTRUCTION);
    expect(roverCause?.gains).deep.eq([{icon: 'megacredits', text: '+2'}]);
    const petsCause = causes.find((c) => 'card' in c.origin && c.origin.card === CardName.PETS);
    expect(petsCause?.gains).deep.eq([{icon: 'Animal', text: '+1'}]);
  });

  it('S3 — the SECOND reported door: a greenery via the plants CONVERSION next to the owner Ares tile', () => {
    fresh({ares: true});
    const tileSpace = game.board.getAvailableSpacesOnLand(builder)[0];
    tileSpace.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
    game.addTile(owner, tileSpace, {tileType: TileType.RESTRICTED_AREA});
    owner.megaCredits = 0;

    // The BASIC ACTION door (the wheel's «озеленение за растения»): the scope
    // opens at the COMMIT, so the whole chain is synchronous and complete.
    builder.plants = 8;
    const convert = new ConvertPlants();
    const picker = cast(convert.action(builder), SelectSpace);
    const adjacent = game.board.getAdjacentSpaces(tileSpace).find((s) => picker.spaces.includes(s));
    expect(adjacent, 'an adjacent greenery space exists').is.not.undefined;
    picker.cb(adjacent!);
    runAllActions(game);

    const root = game.events.events.find((e) =>
      e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === CardName.CONVERT_PLANTS);
    expect(root, 'the conversion rooted an action scope').is.not.undefined;
    const rootId = root!.correlationId;

    const ownerGain = game.events.events.find((e) =>
      e.player === owner.color && e.impact.stock?.megacredits === 1 && e.correlationId === rootId);
    expect(ownerGain, 'the owner benefit is in the conversion chain').is.not.undefined;

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.sign).eq('positive');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+1'}]);
  });

  it('S4 — a deferred victim pick (Asteroid): ONE hostile story in the attacker\'s chain, no standalone twin', () => {
    fresh();
    owner.plants = 3;
    const asteroid = new Asteroid();
    builder.megaCredits = 50;
    builder.titanium = 0;
    const rootId = playThroughDoor(game, builder, asteroid);
    runAllActions(game);
    // The attacker resolves the victim pick (the deferred RemoveAnyPlants —
    // in a 2p game an OrOptions of [take from the victim, skip]). Answered
    // through the REAL process() road so the captured scope is restored.
    cast(builder.getWaitingFor(), OrOptions);
    builder.process({type: 'or', index: 0, response: {type: 'option'}});
    runAllActions(game);
    expect(owner.plants, 'the plants were taken').eq(0);

    const loss = game.events.events.find((e) =>
      e.player === owner.color && (e.impact.stock?.plants ?? 0) < 0);
    expect(loss, 'the victim loss event exists').is.not.undefined;
    expect(loss!.correlationId, 'the loss lives in the ATTACKER\'s chain (the captured deferred context)').eq(rootId);

    const models = deliveredModels(game, owner.color);
    const model = bandOf(models, rootId);
    expect(model.kind, 'the root card upgrades to the hostile family').eq('negative');
    expect(model.sign).eq('negative');
    expect(model.viewerImpact?.losses).deep.eq([{icon: 'plants', text: '−3'}]);
    // ONE story: with the root covering the loss, the standalone hostile diff
    // (seeded exactly like the layer seeds it) yields NO neg-twin.
    const events = game.events.events.filter((e) => !(e.tags ?? []).some((t) => ANALYTICS_ONLY_TAGS.has(t)));
    const neg = diffNegativeNotifications({
      events,
      seen: new Set([rootId]),
      viewerColor: owner.color,
      generation: game.getGeneration(),
      createdAt: 1000,
    });
    expect(neg.models, 'no standalone hostile twin').has.length(0);
  });

  it('S5 — a WGT ocean (solar phase) pays the Ares neighbour INSIDE its own scoped chain (was: dropped outright)', () => {
    [game, builder, owner] = testGame(2, {aresExtension: true, venusNextExtension: false});
    // A land space adjacent to an ocean space carries the owner tile.
    const oceanSpace = game.board.getAvailableSpacesForOcean(builder)
      .find((s) => game.board.getAdjacentSpaces(s).some((n) => n.spaceType === 'land' && n.tile === undefined));
    expect(oceanSpace, 'an ocean space with a land neighbour exists').is.not.undefined;
    const landNeighbour = game.board.getAdjacentSpaces(oceanSpace!)
      .find((n) => n.spaceType === 'land' && n.tile === undefined)!;
    landNeighbour.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
    game.addTile(owner, landNeighbour, {tileType: TileType.RESTRICTED_AREA});
    owner.megaCredits = 0;

    // The WGT prompt — the real solar-phase door. Its ocean branch is the
    // SelectSpace option; the WGT act opens the solar-phase scope itself.
    const wgt = game.worldGovernmentTerraformingInput(builder);
    const oceanOption = wgt.options.find((o) => o instanceof SelectSpace) as SelectSpace | undefined;
    expect(oceanOption, 'the WGT offers the ocean branch').is.not.undefined;
    oceanOption!.cb(oceanSpace!);
    runAllActions(game);

    const root = game.events.events.find((e) => e.type === 'action' && e.category === 'solar-phase');
    expect(root, 'the WGT act rooted a solar-phase scope').is.not.undefined;
    const rootId = root!.correlationId;
    const ownerGain = game.events.events.find((e) =>
      e.player === owner.color && e.impact.stock?.megacredits === 1 && e.correlationId === rootId);
    expect(ownerGain, 'the owner benefit EXISTS and lives in the WGT chain (it used to be dropped)').is.not.undefined;

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.actor, 'the card is the WGT actor\'s').eq(builder.color);
    expect(model.sign).eq('positive');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+1'}]);
  });

  it('S6 — Mons Insurance on-play: every opponent\'s −2 M€ production is a recorded, delivered attack (was: no event)', () => {
    fresh();
    // A second corp (the Merger shape) — additionalCorp skips the research
    // phase-finish, keeping the test inside the action phase.
    builder.playedCards.push(new Teractor());
    owner.production.override({megacredits: 3});
    const mons = new MonsInsurance();
    builder.playCorporationCard(mons);
    runAllActions(game);

    const root = game.events.events.find((e) =>
      e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === mons.name);
    expect(root, 'the corp play rooted an action scope (it had none at all)').is.not.undefined;
    const rootId = root!.correlationId;
    const loss = game.events.events.find((e) =>
      e.player === owner.color && e.impact.production?.megacredits === -2 && e.correlationId === rootId);
    expect(loss, 'the victim\'s production loss is recorded in the corp-play chain').is.not.undefined;
    expect(owner.production.megacredits).eq(1);

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.kind, 'a production attack upgrades to the hostile family').eq('negative');
    expect(model.sign).eq('negative');
    expect(model.viewerImpact?.losses).deep.eq([{icon: 'megacredits', text: '−2', production: true}]);
    expect(model.viewerImpact?.attacker).eq(builder.color);
  });

  it('S7 — the FINAL greenery pays the Ares neighbour inside a scoped chain (was: dropped outright)', () => {
    fresh({ares: true});
    const tileSpace = game.board.getAvailableSpacesOnLand(builder)[0];
    tileSpace.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
    game.addTile(owner, tileSpace, {tileType: TileType.RESTRICTED_AREA});
    owner.megaCredits = 0;

    builder.plants = 8;
    builder.takeActionForFinalGreenery();
    const finalPrompt = cast(builder.getWaitingFor(), OrOptions);
    const placeIdx = finalPrompt.options.findIndex((o) => o instanceof SelectSpace);
    expect(placeIdx, 'the place-greenery branch exists').gte(0);
    const spaces = (finalPrompt.options[placeIdx] as SelectSpace).spaces;
    const adjacent = game.board.getAdjacentSpaces(tileSpace).find((s) => spaces.includes(s));
    expect(adjacent, 'an adjacent greenery space exists').is.not.undefined;
    builder.process({type: 'or', index: placeIdx, response: {type: 'space', spaceId: adjacent!.id}});
    runAllActions(game);

    const root = game.events.events.find((e) =>
      e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === CardName.CONVERT_PLANTS);
    expect(root, 'the final greenery rooted a conversion scope').is.not.undefined;
    const rootId = root!.correlationId;
    const ownerGain = game.events.events.find((e) =>
      e.player === owner.color && e.impact.stock?.megacredits === 1 && e.correlationId === rootId);
    expect(ownerGain, 'the neighbour income EXISTS in the chain (it used to be dropped)').is.not.undefined;

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.sign).eq('positive');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+1'}]);
  });

  it('S8 — THARSIS (the reported case): a foreign city\'s DEFERRED production payout reaches the corp owner', () => {
    fresh();
    owner.playedCards.push(new TharsisRepublic());
    owner.production.override({megacredits: 0});

    const crater = new DomedCrater();
    builder.megaCredits = 50;
    const rootId = playThroughDoor(game, builder, crater);
    runAllActions(game);
    const placement = cast(builder.getWaitingFor(), SelectSpace);
    builder.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(game);
    expect(owner.production.megacredits, 'the production actually rose').eq(1);

    // The DEFERRED GainProduction carried the captured tile-placed effect
    // context: the event lives in the builder's chain, attributed to Tharsis.
    const gain = game.events.events.find((e) =>
      e.player === owner.color && e.impact.production?.megacredits === 1);
    expect(gain, 'the owner\'s production event exists').is.not.undefined;
    expect(gain!.correlationId, 'it lives in the builder\'s correlation').eq(rootId);
    expect(gain!.source, 'attributed to the owner\'s corporation').deep.include({card: CardName.THARSIS_REPUBLIC});

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.actor).eq(builder.color);
    expect(model.sign).eq('positive');
    expect(model.importance).eq('notable');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+1', production: true}]);
    // The full causal chain, typed: source = the OWNER's Tharsis Republic
    // (own), trigger = the placed city. Actor stays the builder — the three
    // roles never substitute for one another.
    const cause = model.viewerImpact?.causes[0];
    expect(cause?.origin).deep.include({card: CardName.THARSIS_REPUBLIC});
    expect(cause?.own, 'the corp is the VIEWER\'s, not the actor\'s').eq(true);
    expect(cause?.trigger).eq('tile-placed');
    expect(cause?.triggerTile).eq(TileType.CITY);
    expect(model.affects).contains(owner.color);
    // No band on the actor's own card, and no hostile twin anywhere.
    expect(deliveredModels(game, builder.color).find((m) => m.correlationId === rootId)?.viewerImpact).is.undefined;
  });

  it('S9 — THARSIS self: the owner\'s own city keeps the self-suppression policy (no self-notification noise)', () => {
    fresh();
    owner.playedCards.push(new TharsisRepublic());
    owner.production.override({megacredits: 0});

    const crater = new DomedCrater();
    owner.megaCredits = 50;
    const rootId = playThroughDoor(game, owner, crater);
    runAllActions(game);
    const placement = cast(owner.getWaitingFor(), SelectSpace);
    owner.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(game);
    expect(owner.production.megacredits, 'the card\'s own +3 M€ production + Tharsis\' +1').eq(4);
    expect(owner.megaCredits, 'the own-city +3 M€ landed (the test door charges no cost)').eq(53);

    // The owner's OWN action never grows a viewer band on their screen.
    expect(deliveredModels(game, owner.color).find((m) => m.correlationId === rootId)).is.undefined;
    // The opponent sees the ordinary neutral root card — the owner's gains are
    // not THEIR impact.
    const foreign = bandOf(deliveredModels(game, builder.color), rootId);
    expect(foreign.sign).eq('neutral');
    expect(foreign.viewerImpact).is.undefined;
  });

  it('S10 — a BOT city pays the human Tharsis owner through the bot turn script (the same player-facing contract)', () => {
    const [g, human, bot] = testAutomaGame();
    human.playedCards.push(new TharsisRepublic());
    human.production.override({megacredits: 0});
    // Building track: the next advance lands on the 'city' cell (index 10 on
    // the Tharsis automa board); a building-tag project card advances it.
    g.automa!.board.getTrackOfRole('building')!.position = 9;
    g.automa!.actionDeck = [{kind: 'project', name: CardName.NOCTIS_FARMING}];
    AutomaController.takeTurn(g);
    runAllActions(g);
    expect(human.production.megacredits, 'the deferred payout ran').eq(1);

    // The typed turn script carries the human's change as an impact step —
    // the script closes AFTER the turn's deferred payouts drain.
    const turn = g.automa!.turnHistory[0];
    expect(turn, 'the city turn was archived').is.not.undefined;
    const humanImpact = turn.steps.find((s) =>
      s.kind === 'impact' && s.impact.target === human.color && !s.impact.targetIsBot);
    expect(humanImpact, 'the human impact step exists in the script').is.not.undefined;

    // The bot card's own semantics lead with the viewer's gain.
    const impact = viewerImpactOfBotTurn(turn, human.color, bot.color);
    expect(impact.sign).eq('positive');
    expect(impact.gains).deep.eq([{icon: 'megacredits', text: '+1', production: true}]);
    // The «почему» rides the SCRIPT itself (born final — no event fetch at
    // presentation time): finish() joined the turn's chain onto the impact
    // step, so the band names the human's own Tharsis + the city trigger.
    const scriptCauses = (humanImpact as Extract<typeof humanImpact, {kind: 'impact'}>).impact.causes ?? [];
    expect(scriptCauses.map((c) => 'card' in c.source ? c.source.card : undefined))
      .contains(CardName.THARSIS_REPUBLIC);
    const cause = impact.causes[0];
    expect(cause?.origin).deep.include({card: CardName.THARSIS_REPUBLIC});
    expect(cause?.own).eq(true);
    expect(cause?.trigger).eq('tile-placed');
    expect(cause?.triggerTile, 'the ONE placed city names the trigger').eq(TileType.CITY);
    expect(causeLinesOf(impact).length, 'the zone renders').greaterThan(0);
    // SAVE/RELOAD: the attribution is part of the ARCHIVED script — a
    // reconnect rebuilds the same «почему» without touching live state.
    const restored = Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
    const restoredImpact = restored.automa!.turnHistory[0].steps.find((s) =>
      s.kind === 'impact' && s.impact.target === human.color && !s.impact.targetIsBot);
    expect(restoredImpact, 'the script impact round-trips, causes included').deep.eq(humanImpact);

    // The event ALSO exists in the automa-turn chain (journal truth)…
    const root = g.events.events.find((e) => e.type === 'action' && e.category === 'automa-turn');
    expect(root).is.not.undefined;
    const gain = g.events.events.find((e) =>
      e.player === human.color && e.impact.production?.megacredits === 1);
    expect(gain, 'the production event exists').is.not.undefined;
    expect(gain!.correlationId, 'in the automa-turn correlation').eq(root!.correlationId);
    expect(turn.correlationId, 'the script and the chain share ONE key').eq(root!.correlationId);

    // …and presentation stays SINGLE-OWNER: the generic root pipeline yields
    // no automa-turn card (the bot pipeline's own card leads), and the layer
    // filters the category — so exactly one card carries the story.
    const models = deliveredModels(g, human.color);
    const generic = models.filter((m) => m.correlationId === root!.correlationId && m.category !== 'automa-turn');
    expect(generic, 'no second (generic) card for the bot turn').has.length(0);
  });

  it('S11 — a change at the FLOOR is a no-op and produces NO false notification; a partial hit reports the HONEST delta', () => {
    const [g, actor, floored, partial] = testGame(3);
    actor.playedCards.push(new Teractor());
    floored.production.override({megacredits: -5}); // already at the floor
    partial.production.override({megacredits: -4}); // only −1 is possible
    const mons = new MonsInsurance();
    actor.playCorporationCard(mons);
    runAllActions(g);

    const root = g.events.events.find((e) =>
      e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === mons.name);
    expect(root).is.not.undefined;
    const rootId = root!.correlationId;

    // The floored victim: NO event, NO band, NO hostile card — a no-op is silent.
    expect(floored.production.megacredits).eq(-5);
    expect(g.events.events.find((e) => e.player === floored.color && e.impact.production !== undefined),
      'no production event for the floored victim').is.undefined;
    const flooredModel = deliveredModels(g, floored.color).find((m) => m.correlationId === rootId);
    expect(flooredModel?.viewerImpact, 'no false loss band').is.undefined;
    expect(flooredModel?.sign ?? 'neutral').eq('neutral');

    // The partial victim: the REAL −1 (never the printed −2).
    expect(partial.production.megacredits).eq(-5);
    const partialModel = bandOf(deliveredModels(g, partial.color), rootId);
    expect(partialModel.sign).eq('negative');
    expect(partialModel.viewerImpact?.losses).deep.eq([{icon: 'megacredits', text: '−1', production: true}]);
  });

  it('S12 — two sequential foreign actions produce two cards in ORDER', () => {
    fresh({ares: true});
    const tileSpace = game.board.getAvailableSpacesOnLand(builder)[0];
    tileSpace.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
    game.addTile(owner, tileSpace, {tileType: TileType.RESTRICTED_AREA});
    owner.megaCredits = 0;

    // Action 1: a greenery next to the owner's tile (conversion door).
    builder.plants = 16;
    const convert = new ConvertPlants();
    const picker1 = cast(convert.action(builder), SelectSpace);
    const adj = game.board.getAdjacentSpaces(tileSpace).filter((s) => picker1.spaces.includes(s));
    expect(adj.length, 'two adjacent legal spaces exist').gte(2);
    picker1.cb(adj[0]);
    runAllActions(game);
    // Action 2: a second greenery, also adjacent.
    const picker2 = cast(convert.action(builder), SelectSpace);
    picker2.cb(adj[1]);
    runAllActions(game);
    expect(owner.megaCredits).eq(2);

    const roots = game.events.events.filter((e) =>
      e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === CardName.CONVERT_PLANTS);
    expect(roots).has.length(2);
    const models = deliveredModels(game, owner.color);
    const idx0 = models.findIndex((m) => m.correlationId === roots[0].correlationId);
    const idx1 = models.findIndex((m) => m.correlationId === roots[1].correlationId);
    expect(idx0, 'both cards were built').gte(0);
    expect(idx1).gte(0);
    expect(idx0, 'delivery order follows event order').lt(idx1);
    for (const idx of [idx0, idx1]) {
      expect(models[idx].sign).eq('positive');
      expect(models[idx].viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+1'}]);
    }
  });

  it('S13 — ONE action touches TWO different owners: each gets their OWN recipient-specific band, nothing leaks', () => {
    const [g, actor, tharsisOwner, roverOwner] = testGame(3);
    tharsisOwner.playedCards.push(new TharsisRepublic());
    tharsisOwner.production.override({megacredits: 0});
    roverOwner.playedCards.push(new RoverConstruction());
    roverOwner.megaCredits = 0;

    const crater = new DomedCrater();
    actor.megaCredits = 50;
    actor.playCard(crater);
    const root = g.events.events.find((e) =>
      e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === crater.name);
    expect(root).is.not.undefined;
    const rootId = root!.correlationId;
    runAllActions(g);
    const placement = cast(actor.getWaitingFor(), SelectSpace);
    actor.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(g);

    expect(tharsisOwner.production.megacredits).eq(1);
    expect(roverOwner.megaCredits).eq(2);

    const tharsisModel = bandOf(deliveredModels(g, tharsisOwner.color), rootId);
    expect(tharsisModel.viewerImpact?.gains, 'ONLY the production payout — never the other owner\'s M€')
      .deep.eq([{icon: 'megacredits', text: '+1', production: true}]);
    const roverModel = bandOf(deliveredModels(g, roverOwner.color), rootId);
    expect(roverModel.viewerImpact?.gains, 'ONLY the stock payout — never the other owner\'s production')
      .deep.eq([{icon: 'megacredits', text: '+2'}]);
    // The actor's own card carries neither band.
    expect(deliveredModels(g, actor.color).find((m) => m.correlationId === rootId)?.viewerImpact).is.undefined;
  });

  it('S14 — a STEAL (Hired Raiders): the victim\'s loss names the thief, one hostile card, and the thief hears nothing extra', () => {
    fresh();
    owner.megaCredits = 10;
    const raiders = new HiredRaiders();
    builder.megaCredits = 5;
    const rootId = playThroughDoor(game, builder, raiders);
    runAllActions(game);
    const steal = cast(builder.getWaitingFor(), OrOptions);
    // The victim has no steel, so the tree is [steal M€ from owner, skip].
    expect(steal.options).has.length(2);
    builder.process({type: 'or', index: 0, response: {type: 'option'}});
    runAllActions(game);
    expect(owner.megaCredits).eq(7);

    // The victim's loss event carries STEAL semantics: target = the thief.
    const loss = game.events.events.find((e) =>
      e.player === owner.color && e.impact.stock?.megacredits === -3);
    expect(loss, 'the victim loss event exists').is.not.undefined;
    expect(loss!.correlationId).eq(rootId);
    expect(loss!.target?.player, 'the thief is named structurally').eq(builder.color);

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.kind).eq('negative');
    expect(model.viewerImpact?.losses).deep.eq([{icon: 'megacredits', text: '−3'}]);
    expect(model.viewerImpact?.attacker).eq(builder.color);
    expect(model.viewerImpact?.transfer, 'shown as a transfer to the thief').eq(true);
    // The thief's own +3 stays inside their self-suppressed action.
    expect(deliveredModels(game, builder.color).find((m) => m.correlationId === rootId)?.viewerImpact).is.undefined;
  });

  it('S15 — a BLUE-ACTION attack (Predators): the card-action door + deferred foreign card-resource removal', () => {
    fresh();
    const predators = new Predators();
    builder.playedCards.push(predators);
    const fish = new Fish();
    owner.playedCards.push(fish);
    fish.resourceCount = 2;

    // The REAL blue-action door: playActionCard opens the 'card-action' scope.
    const picker = cast(builder.playActionCard(), SelectCard);
    picker.process({type: 'card', cards: [predators.name]});
    runAllActions(game);
    // The attacker picks the target card (never auto-selected).
    const target = cast(builder.getWaitingFor(), SelectCard);
    builder.process({type: 'card', cards: [fish.name]});
    expect(target.cards.map((c) => c.name)).contains(fish.name);
    runAllActions(game);
    expect(fish.resourceCount).eq(1);
    expect(predators.resourceCount).eq(1);

    const root = game.events.events.find((e) =>
      e.type === 'action' && e.category === 'card-action' && e.source !== undefined && 'card' in e.source && e.source.card === predators.name);
    expect(root, 'the blue action rooted a card-action scope').is.not.undefined;
    const loss = game.events.events.find((e) =>
      e.player === owner.color && e.impact.cardResources?.some((cr) => cr.amount === -1 && cr.target === fish.name));
    expect(loss, 'the victim\'s card-resource loss is recorded').is.not.undefined;
    expect(loss!.correlationId, 'in the attacker\'s chain (captured deferred context)').eq(root!.correlationId);

    const model = bandOf(deliveredModels(game, owner.color), root!.correlationId);
    expect(model.sign).eq('negative');
    expect(model.viewerImpact?.losses).deep.eq([{icon: 'Animal', text: '−1'}]);
  });

  it('S16 — a COLONY TRADE pays every colony owner inside the trade\'s own chain (GiveColonyBonus)', () => {
    [game, builder, owner] = testGame(2, {coloniesExtension: true});
    // A deterministic colony with a plain colony bonus: Luna (+2 M€ per trade).
    let luna = game.colonies.find((c) => c.name === 'Luna');
    if (luna === undefined) {
      luna = new Luna();
      game.colonies.push(luna);
    }
    expect(luna.metadata.colony.type).eq(ColonyBenefit.GAIN_RESOURCES);
    luna.colonies.push(owner.id);
    owner.megaCredits = 0;
    builder.megaCredits = 20;

    const trade = builder.colonies.coloniesTradeAction();
    expect(trade, 'the trade door is open').is.not.undefined;
    cast(trade, AndOptions);
    // Pay with M€ (the only affordable handler here), then pick Luna.
    trade!.process({type: 'and', responses: [
      {type: 'or', index: 0, response: {type: 'option'}},
      {type: 'colony', colonyName: luna.name},
    ]}, builder);
    runAllActions(game);
    expect(owner.megaCredits, 'the colony owner was paid').eq(2);

    const root = game.events.events.find((e) => e.type === 'action' && e.category === 'colony');
    expect(root, 'the trade rooted a colony scope').is.not.undefined;
    const gain = game.events.events.find((e) =>
      e.player === owner.color && e.impact.stock?.megacredits === 2);
    expect(gain, 'the owner\'s payout event exists').is.not.undefined;
    expect(gain!.correlationId, 'inside the trade\'s correlation (the captured GiveColonyBonus context)').eq(root!.correlationId);

    const model = bandOf(deliveredModels(game, owner.color), root!.correlationId);
    expect(model.sign).eq('positive');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+2'}]);
  });

  it('S17 — a CARD-DRAW payout (Sponsored Academies): every opponent\'s draw is evented and banded', () => {
    [game, builder, owner] = testGame(2, {venusNextExtension: true});
    const academies = new SponsoredAcademies();
    builder.cardsInHand.push(new Pets()); // something to discard
    builder.megaCredits = 50;
    const rootId = playThroughDoor(game, builder, academies);
    runAllActions(game);
    // Answer the discard pick when asked (a single candidate may resolve itself).
    if (builder.getWaitingFor() !== undefined) {
      cast(builder.getWaitingFor(), SelectCard);
      builder.process({type: 'card', cards: [CardName.PETS]});
      runAllActions(game);
    }
    expect(owner.cardsInHand, 'the opponent drew 1').has.length(1);

    const draw = game.events.events.find((e) =>
      e.player === owner.color && e.impact.cardsDrawn === 1);
    expect(draw, 'the opponent\'s draw event exists').is.not.undefined;
    expect(draw!.correlationId, 'inside the play\'s correlation').eq(rootId);

    const model = bandOf(deliveredModels(game, owner.color), rootId);
    expect(model.sign).eq('positive');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'cards', text: '+1'}]);
  });

  it('S18 — a BOT turn with several linked changes for one viewer: sync + deferred payouts merge into one script impact', () => {
    const [g, human, bot] = testAutomaGame();
    human.playedCards.push(new TharsisRepublic(), new RoverConstruction());
    human.production.override({megacredits: 0});
    human.megaCredits = 0;
    g.automa!.board.getTrackOfRole('building')!.position = 9; // next cell = 'city'
    g.automa!.actionDeck = [{kind: 'project', name: CardName.NOCTIS_FARMING}];
    AutomaController.takeTurn(g);
    runAllActions(g);
    expect(human.production.megacredits, 'Tharsis (deferred) paid').eq(1);
    expect(human.megaCredits, 'Rover Construction (synchronous) paid').eq(2);

    const turn = g.automa!.turnHistory[0];
    const impact = viewerImpactOfBotTurn(turn, human.color, bot.color);
    expect(impact.sign).eq('positive');
    // BOTH payouts, one band — stock and production merged separately.
    expect(impact.gains).deep.include({icon: 'megacredits', text: '+2'});
    expect(impact.gains).deep.include({icon: 'megacredits', text: '+1', production: true});
    // The human's impact step is ONE step carrying both changes.
    const humanImpacts = turn.steps.filter((s) =>
      s.kind === 'impact' && s.impact.target === human.color);
    expect(humanImpacts, 'exactly one impact step per participant').has.length(1);
  });

  it('S19 — SAVE/RELOAD: the recorded stream (the notification source of truth) survives serialization byte-for-byte', () => {
    fresh();
    owner.playedCards.push(new TharsisRepublic());
    owner.production.override({megacredits: 0});
    const crater = new DomedCrater();
    builder.megaCredits = 50;
    const rootId = playThroughDoor(game, builder, crater);
    runAllActions(game);
    builder.process({type: 'space', spaceId: cast(builder.getWaitingFor(), SelectSpace).spaces[0].id});
    runAllActions(game);

    const restored = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    expect(restored.events.events, 'the event stream round-trips').deep.eq(game.events.events);
    // The client pipeline rebuilds the SAME delivery from the restored game.
    const model = bandOf(deliveredModels(restored, owner.color), rootId);
    expect(model.sign).eq('positive');
    expect(model.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+1', production: true}]);
    // (The deferred queue itself is deliberately NOT persisted — a save always
    // happens after the request's synchronous drain, and a pending PROMPT is
    // re-raised on load; the stream is the notification source of truth.)
  });

  it('S20 — UNDO: restoring the pre-action save leaves NO trace of the undone events (nothing stale to present)', () => {
    fresh();
    owner.playedCards.push(new TharsisRepublic());
    owner.production.override({megacredits: 0});
    const before = JSON.parse(JSON.stringify(game.serialize()));
    const crater = new DomedCrater();
    builder.megaCredits = 50;
    const rootId = playThroughDoor(game, builder, crater);
    runAllActions(game);
    builder.process({type: 'space', spaceId: cast(builder.getWaitingFor(), SelectSpace).spaces[0].id});
    runAllActions(game);
    expect(deliveredModels(game, owner.color).some((m) => m.correlationId === rootId)).eq(true);

    // The undo road: the game reloads from the earlier save.
    const undone = Game.deserialize(before);
    expect(undone.events.events.some((e) => e.correlationId === rootId), 'the undone chain is gone from the stream').eq(false);
    expect(deliveredModels(undone, owner.color).some((m) => m.correlationId === rootId),
      'nothing stale can be built for the undone action').eq(false);
    // The client half (a PREPARING entry dropped on same-generation absence)
    // is spec'd in notificationState.spec: «dropPreparing forgets an undone event».
  });

  it('S21 — a TRACK BLOCKADE (Modular Floodgates): the blue-action door, the victim\'s worded band with the deployer as attacker, and no self-notification', () => {
    [game, builder, owner] = testGame(2, {deltaProjectExpansion: true});
    const floodgates = new ModularFloodgates();
    builder.playedCards.push(floodgates);
    floodgates.resourceCount = 1;

    // The REAL blue-action door: playActionCard opens the 'card-action' scope.
    const picker = cast(builder.playActionCard(), SelectCard);
    picker.process({type: 'card', cards: [floodgates.name]});
    runAllActions(game);
    // Two variants stand; the deploy is the second. A menu option answers in
    // TWO steps: the branch pick, then the follow-up blockade input
    // (SelectOption.andThen hands it back as the next ask) — both under the
    // captured card-action scope.
    const variants = cast(builder.getWaitingFor(), OrOptions);
    expect(variants.options).has.length(2);
    builder.process({type: 'or', index: 1, response: {type: 'option'}});
    runAllActions(game);
    builder.process({type: 'deltaBlockade', target: owner.color});
    runAllActions(game);
    expect(floodgates.resourceCount).eq(0);
    expect(owner.deltaProjectData?.blockade?.by).eq(builder.color);

    const root = game.events.events.find((e) =>
      e.type === 'action' && e.category === 'card-action' && e.source !== undefined && 'card' in e.source && e.source.card === floodgates.name);
    expect(root, 'the blue action rooted a card-action scope').is.not.undefined;
    const fact = game.events.events.find((e) => e.type === 'delta-blockade-changed');
    expect(fact, 'the canonical blockade fact is recorded').is.not.undefined;
    expect(fact!.player).eq(owner.color);
    expect(fact!.target?.player).eq(builder.color);
    expect(fact!.correlationId, 'in the deployer\'s chain (captured deferred context)').eq(root!.correlationId);

    // The VICTIM: exactly one hostile card, the worded loss, the attacker named.
    const model = bandOf(deliveredModels(game, owner.color), root!.correlationId);
    expect(model.sign).eq('negative');
    expect(model.viewerImpact?.losses).deep.eq([{icon: 'hydro-blockade', text: ''}]);
    expect(model.viewerImpact?.attacker).eq(builder.color);
    expect(model.viewerImpact?.scope).eq('track');
    expect(model.viewerImpact?.sourceCard).eq(CardName.MODULAR_FLOODGATES);
    expect(model.affects).contains(owner.color);
    const victimCards = deliveredModels(game, owner.color).filter((m) => m.correlationId === root!.correlationId);
    expect(victimCards, 'exactly ONE card for the victim — never a twin').has.length(1);

    // The ACTOR: their own action carries NO viewer band (no self-notification).
    expect(deliveredModels(game, builder.color).find((m) => m.correlationId === root!.correlationId)?.viewerImpact).is.undefined;
  });
});
