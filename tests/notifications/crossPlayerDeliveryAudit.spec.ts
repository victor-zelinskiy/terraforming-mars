import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
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
});
