import {expect} from 'chai';
import {
  ANIMALS_PER_ACTION, AquaticResearchStation, DATA_PER_ACTION, PLACE_CITY_OVER_OCEAN_TITLE,
} from '../../../src/server/cards/turmoilRedux/AquaticResearchStation';
import {AdministrationDistrict} from '../../../src/server/cards/turmoilRedux/AdministrationDistrict';
import {BiologicalSimulations} from '../../../src/server/cards/turmoilRedux/BiologicalSimulations';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {EcologicalZone} from '../../../src/server/cards/base/EcologicalZone';
import {Pets} from '../../../src/server/cards/base/Pets';
import {Capital} from '../../../src/server/cards/base/Capital';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Space} from '../../../src/server/boards/Space';
import {Board} from '../../../src/server/boards/Board';
import {movableCities} from '../../../src/server/boards/cityMove';
import {movableOceans} from '../../../src/server/boards/oceanMove';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {SpaceId} from '../../../src/common/Types';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {OrOptionsModel, SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {ICardRenderTile, isICardRenderTile} from '../../../src/common/cards/render/Types';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {hasNonNegativeVictoryPointsIcon} from '../../../src/common/cards/victoryPointsIcon';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {SKIP_REASON} from '../../../src/server/cards/actionPreviews';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {replayBatch, parkedBatchTailLength} from '../../../src/server/inputs/deferredInputBatch';
import {isActionMenuTitle} from '../../../src/common/inputs/actionMenuTitles';
import {aggregateByPlayer} from '../../../src/common/events/aggregate';
import {marsTileCensus} from '../../../src/common/boards/marsTileCensus';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';

/**
 * TR44 — AQUATIC RESEARCH STATION: the Greens' plate, a city ON TOP OF an
 * ocean (two tiles on one cell — the physics is pinned at the engine in
 * tests/game/TwoTileCell.spec.ts; THIS spec pins the card: its face, its
 * requirement, its placement kind and what the play pays, its action with the
 * «you may» data pick, its VP, the table's answers, save / load).
 *
 * THE GEOMETRY IS THARSIS'S OWN (the default board), named by cell:
 *   · O1 (33) — an ocean reserve with two plants printed, beside the ocean
 *     reserves 32 / 34 and the land cells 24, 25, 41, 42;
 *   · O2 (34) — an ocean reserve beside O1; L (42) — plant land beside O1;
 *     C (24) — land beside O1 only (the Capital's seat).
 */
const G = PartyName.GREENS;
const COST = 16;
const ARS = CardName.AQUATIC_RESEARCH_STATION;
const O1 = '33' as SpaceId;
const O2 = '34' as SpaceId;
const R = '32' as SpaceId;
const L = '42' as SpaceId;
const C = '24' as SpaceId;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: AquaticResearchStation};

/** A two-seat Redux table in the action phase: generation 1, nothing enacted — the Greens rule by the STARTING RULE. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, aresHazards: false});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, PartyName.MARS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new AquaticResearchStation();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  player.plants = 0;
  return {game, player, opponent, parliament, card};
}

function redsRule(t: Table): void {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
}

function greensCubes(t: Table, player: TestPlayer, n: number): void {
  const slot = t.parliament.slotOf(G)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

const cell = (game: IGame, id: SpaceId) => game.board.getSpaceOrThrow(id);

/** An ocean seated WITHOUT the parameter's train — the arrangement, never the rule. */
function seatOcean(game: IGame, id: SpaceId): Space {
  const space = cell(game, id);
  space.tile = {tileType: TileType.OCEAN};
  space.player = undefined;
  return space;
}

/** Play the card for real (past the gate) and return its placement prompt. */
function playToPrompt(t: Table): SelectSpace {
  t.player.playCard(t.card, Payment.of({megacredits: COST}));
  runAllActions(t.game);
  return cast(t.player.popWaitingFor(), SelectSpace);
}

/** The whole play: the card paid, the city on `id`. */
function playOn(t: Table, id: SpaceId): Space {
  const prompt = playToPrompt(t);
  prompt.process({type: 'space', spaceId: id});
  runAllActions(t.game);
  return cell(t.game, id);
}

/** The card on the player's table with `animals` on it (no play). */
function onTable(t: Table, animals: number): void {
  t.player.cardsInHand = [];
  t.player.playedCards.push(t.card);
  t.card.resourceCount = animals;
}

function holder<T extends ICard>(player: TestPlayer, card: T, count: number): T {
  card.resourceCount = count;
  player.playedCards.push(card);
  return card;
}

/** Activate through the REAL blue-action door; the action's optional data choice is returned (undefined = none asked). */
function activate(t: Table): OrOptions | undefined {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name), 'the card stands among the playable actions').to.include(ARS);
  door.cb([t.card]);
  runAllActions(t.game);
  const wf = t.player.getWaitingFor();
  return wf instanceof OrOptions && wf.choiceContext !== undefined ? wf : undefined;
}

function placementStepOf(player: TestPlayer, card: IProjectCard) {
  const steps = cardPlayPreview(player, card).branches[0].steps;
  return steps.find((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
}

/** The action menu's «Perform an action from a played card» branch — the batch's head, as the composer wraps it. */
function actionHead(t: Table): InputResponse {
  t.player.takeAction();
  const menu = cast(t.player.getWaitingFor(), OrOptions);
  const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
  expect(perform).gte(0);
  return {type: 'or', index: perform, response: {type: 'card', cards: [ARS]}};
}

/** After a whole batch no question of the card's is left — the action is over (the next menu, or nothing yet). */
function expectActionOver(t: Table): void {
  const wf = t.player.getWaitingFor();
  if (wf === undefined) {
    return;
  }
  const menu = cast(wf, OrOptions);
  expect(isActionMenuTitle(typeof menu.title === 'string' ? menu.title : menu.title.message), 'the next action menu, not a prompt of the card').is.true;
  expect(menu.choiceContext).is.undefined;
}

describe('AquaticResearchStation', () => {
  let t: Table;
  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 16, Animal + City + Building, an animal holder, 1 VP per 2 animals, the GREENS\' plate, TR44 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(ARS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.ANIMAL, Tag.CITY, Tag.BUILDING]);
      expect(card.resourceType).eq(CardResource.ANIMAL);
      expect(card.victoryPoints).deep.eq({resourcesHere: {}, per: 2});
      expect(hasNonNegativeVictoryPointsIcon(card), 'the «1/2 animal» icon is non-negative (TR16 draws for it)').is.true;
      expect(card.metadata.cardNumber).eq('TR44');
      expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem').eq(G);
      expect(card.requirements).has.length(1);
      expect(card.metadata.description).to.match(/^Requires the Greens to be ruling or that you have 2 delegates there\. Place a city ON TOP OF AN OCEAN TILE IN PLAY/);
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ARS];
      expect(entry).is.not.undefined;
      expect(entry?.compatibility).is.undefined;
    });

    it('the face reads the scan: «→ [animal] [data]*» in the action; ONE node «a city OVER an ocean» below', () => {
      type Node = {is?: string, type?: string, resource?: CardResource, tile?: TileType, over?: TileType, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows).has.length(2);
      const action = rows[0][0];
      const parts = (box: Node, i: number) => (box.rows?.[i] ?? []).filter((n): n is Node => typeof n === 'object');
      expect(action.is).eq('effect');
      expect(parts(action, 0).map((n) => [n.is, n.type]), 'an arrow with nothing to pay on its left').deep.eq([['symbol', ' ']]);
      expect(parts(action, 2).map((n) => [n.type, n.resource]), 'the animal here, the data to ANY card').deep.eq([
        [CardRenderItemType.RESOURCE, CardResource.ANIMAL], [CardRenderItemType.RESOURCE, CardResource.DATA], ['*', undefined],
      ]);
      expect(action.rows?.[2]).deep.include('Action: Add 1 animal resource to this card. You may also add 1 data resource to ANY card.');
      const tile = rows[1][0];
      expect(isICardRenderTile(tile as never)).is.true;
      expect((tile as ICardRenderTile).tile).eq(TileType.CITY);
      expect((tile as ICardRenderTile).over, 'the city stands ON an ocean — one node').eq(TileType.OCEAN);
      expect(rows[1], 'one symbol, never two tiles').has.length(1);
    });

    it('the structured text prints the rule: the requirement, the city over an ocean, the ocean that still pays; the action with its «you may»', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const texts = (info?.groups.flatMap((g) => g.blocks) ?? []).map((b) => String(b.text));
      expect(texts.some((s) => /Greens/.test(s)), 'the requirement').is.true;
      expect(texts).to.include('Place a city on top of an existing ocean tile, ignoring other placement restrictions.');
      expect(texts).to.include('The ocean underneath still grants its adjacency bonus when placing tiles next to it.');
      expect(texts.some((s) => /You may also add 1 data resource to ANY card/.test(s)), `the «you may» of the data: ${texts.join(' | ')}`).is.true;
    });
  });

  describe('rule 1 — the requirement: the Greens rule (the starting rule counts), or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      seatOcean(t.game, O1);
    });

    it('generation 1, nothing enacted: the Greens rule by the STARTING RULE — playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0, requirement: true, requirementKey: 'req:party',
      });
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      greensCubes(t, t.player, 1);
      expect(t.parliament.hasPartyEffect(t.player, G)).is.true;
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1});
    });
  });

  describe('rules 2–3 — WHERE: any plain ocean in play with nothing on it, whoever placed it, a city beside or not; else ONE named reason', () => {
    it('no ocean at all: unplayable — «No ocean tile to place a city on»; an empty reserve is no ocean', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)).deep.eq([{type: 'placement', message: 'No ocean tile to place a city on'}]);
    });

    it('the OPPONENT\'s ocean, an ocean on land, an ocean beside a city: all targets; a composite and a covered ocean: occupied; land and an empty reserve: requires an ocean', () => {
      seatOcean(t.game, O1);
      seatOcean(t.game, L); // an ocean on land (Artificial Lake's family)
      t.game.simpleAddTile(t.opponent, cell(t.game, C), {tileType: TileType.CITY}); // a city beside O1 — no bar
      const covered = seatOcean(t.game, O2);
      t.game.addTile(t.opponent, covered, {tileType: TileType.CITY, card: ARS}, {overOcean: true});
      runAllActions(t.game);
      const prompt = playToPrompt(t);
      expect(prompt.title).eq(PLACE_CITY_OVER_OCEAN_TITLE);
      expect(prompt.placementType).eq('city-over-ocean');
      expect(prompt.tileType).eq(TileType.CITY);
      expect(prompt.sourceCard).eq(ARS);
      expect(prompt.spaces.map((s) => s.id)).to.have.members([O1, L]);
      const reasons = new Map(prompt.illegalSpaces?.map((i) => [i.spaceId, i.reason]) ?? []);
      expect(reasons.get(O2), 'a city already stands on this ocean').eq('occupied');
      expect(reasons.get(R), 'an empty reserve').eq('requires-ocean-tile');
      expect(reasons.get('25' as SpaceId), 'land').eq('requires-ocean-tile');
    });

    it('the staged preview is the SAME question as the live prompt (parity): title, cells, reasons, tile, kind, address', () => {
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      const step = placementStepOf(t.player, t.card)!;
      expect(step.placementType).eq('city-over-ocean');
      expect(step.tileType).eq(TileType.CITY);
      const staged = step.staged;
      expect(staged, 'the play stages its placement').is.not.undefined;
      const live = playToPrompt(t).toModel();
      expect(staged!.title).eq(live.title);
      expect(staged!.spaces).deep.eq(live.spaces);
      expect(staged!.illegalSpaces).deep.eq(live.illegalSpaces);
      expect(staged!.tileType).eq(TileType.CITY);
      expect(staged!.placementType).eq('city-over-ocean');
      expect(staged!.sourceCard).eq(ARS);
    });
  });

  describe('rules 4–5 — the play: two pieces on the cell; what the cover pays', () => {
    it('an ORDINARY city of this card on top, the plain ocean under it; the ocean still counts; the city is the player\'s', () => {
      seatOcean(t.game, O1);
      const oceansBefore = t.game.board.getOceanSpaces().length;
      const space = playOn(t, O1);
      expect(space.tile).deep.eq({tileType: TileType.CITY, card: ARS, covers: {tileType: TileType.OCEAN}});
      expect(space.player).eq(t.player);
      expect(Board.isCitySpace(space)).is.true;
      expect(Board.isOceanSpace(space)).is.true;
      expect(t.game.board.getOceanSpaces().length, 'the count toward nine does not move').eq(oceansBefore);
      expect(t.game.board.countCities(t.player)).eq(1);
      expect(marsTileCensus([space]).total, 'TR45 counts two tiles').eq(2);
      expect(t.player.playedCards.get(ARS)).eq(t.card);
    });

    it('no printed bonus; +2 M€ per OTHER adjacent ocean, the one under the city paying nothing; a `tile-placed` of a CITY; the log names the cover', () => {
      seatOcean(t.game, O1);
      seatOcean(t.game, O2);
      const placedBefore = aggregateByPlayer(t.game.events.events).get(t.player.color)?.tilesPlaced ?? 0;
      const logBefore = t.game.gameLog.length;
      const prompt = playToPrompt(t);
      const paid = t.player.megaCredits;
      prompt.process({type: 'space', spaceId: O1});
      runAllActions(t.game);
      expect(t.player.plants, 'the two plants printed on O1 were covered').eq(0);
      expect(t.player.megaCredits, 'O2 pays 2').eq(paid + 2);
      expect(t.player.lastOceanBonus?.oceanSpaceIds).deep.eq([O2]);
      expect(aggregateByPlayer(t.game.events.events).get(t.player.color)?.tilesPlaced ?? 0).eq(placedBefore + 1);
      expect(t.game.events.events.filter((e) => e.type === 'tile-placed').at(-1)).deep.include({space: O1, tile: TileType.CITY});
      expect(t.game.gameLog.slice(logBefore).map((l) => l.message)).to.include('${0} placed a city tile on top of the ocean tile · ${1}');
    });

    it('the ocean under the city keeps paying: a tile placed beside it later takes its M€; the Capital beside keeps its point', () => {
      seatOcean(t.game, O1);
      t.opponent.playedCards.push(new Capital());
      t.game.simpleAddTile(t.opponent, cell(t.game, C), {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      playOn(t, O1);
      expect(t.opponent.getVictoryPoints().victoryPoints).eq(1);
      t.game.addGreenery(t.opponent, cell(t.game, L));
      runAllActions(t.game);
      expect(t.opponent.lastOceanBonus?.oceanSpaceIds).deep.eq([O1]);
    });

    it('the play is paid with steel too (the Building tag)', () => {
      seatOcean(t.game, O1);
      t.player.megaCredits = 0;
      t.player.steel = 8;
      expect(t.player.canPlay(t.card)).is.true;
    });
  });

  describe('rules 6–9 — the city is a city, the ocean an ocean, for every later card', () => {
    it('TR14 Re-settlement moves this city off the water — the ocean stays, nobody\'s; TR39 Canyon Carving moves the ocean out from under — the city stays', () => {
      seatOcean(t.game, O1);
      const space = playOn(t, O1);
      expect(movableCities(t.player).map((m) => m.from.id), 'the city may move (TR14)').to.include(O1);
      t.game.moveCityTile(t.player, space, cell(t.game, L));
      runAllActions(t.game);
      expect(space.tile).deep.eq({tileType: TileType.OCEAN});
      expect(cell(t.game, L).tile).deep.eq({tileType: TileType.CITY, card: ARS});

      // …and the other way round on a second cell.
      seatOcean(t.game, O2);
      t.game.addTile(t.player, cell(t.game, O2), {tileType: TileType.CITY, card: ARS}, {overOcean: true});
      runAllActions(t.game);
      expect(movableOceans(t.player).map((m) => m.from.id), 'the ocean under the city may move (TR39)').to.include(O2);
      t.game.moveOceanTile(t.player, cell(t.game, O2), cell(t.game, '43' as SpaceId));
      runAllActions(t.game);
      expect(cell(t.game, O2).tile).deep.eq({tileType: TileType.CITY, card: ARS});
      expect(cell(t.game, '43' as SpaceId).tile?.tileType).eq(TileType.OCEAN);
    });

    it('a Skyscrapers tier stands on it: three pieces, the ocean still under', () => {
      seatOcean(t.game, O1);
      const space = playOn(t, O1);
      t.game.addCityTier(t.player, space);
      runAllActions(t.game);
      expect(space.stackHeight).eq(2);
      expect(space.tile?.covers).deep.eq({tileType: TileType.OCEAN});
      expect(marsTileCensus([space]).parts.map((p) => [p.kind, p.count])).deep.eq([['city', 2], ['ocean', 1]]);
    });
  });

  describe('rule 10 — the action: +1 animal here, always; «you may add 1 data to ANY card» — a pick with its decline, never automatic', () => {
    it('holders of data: the animal lands, then ONE optional choice — the pick of every OWN holder beside a skip-marked decline', () => {
      onTable(t, 0);
      const census = holder(t.player, new MartianCensus(), 1);
      const computer = holder(t.player, new Supercomputer(), 0);
      holder(t.opponent, new Supercomputer(), 3);
      expect(t.card.canAct(t.player)).is.true;
      const choice = activate(t)!;
      expect(choice, 'the optional choice').is.not.undefined;
      expect(t.card.resourceCount, 'the animal landed before the question').eq(ANIMALS_PER_ACTION);
      expect(choice.options).has.length(2);
      const pick = cast(choice.options[0], SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).to.have.members([census.name, computer.name]);
      expect(pick.cards).has.length(2);
      const model = choice.toModel(t.player) as OrOptionsModel;
      expect((model.options[1] as {metadata?: {kind?: string}}).metadata?.kind, 'the decline is the structural skip').eq('skip');
      expect(choice.choiceContext?.mode).eq('optional-effect');
      t.player.process({type: 'or', index: 0, response: {type: 'card', cards: [census.name]}});
      runAllActions(t.game);
      expect(census.resourceCount).eq(1 + DATA_PER_ACTION);
      expect(computer.resourceCount).eq(0);
    });

    it('the decline: the animal stays, no data lands, nothing is recorded as lost', () => {
      onTable(t, 2);
      const census = holder(t.player, new MartianCensus(), 1);
      const choice = activate(t)!;
      const skipsBefore = t.game.events.events.filter((e) => e.type === 'effect-skipped').length;
      expect(choice).is.not.undefined;
      t.player.process({type: 'or', index: 1, response: {type: 'option'}});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(3);
      expect(census.resourceCount).eq(1);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).has.length(skipsBefore);
      expect(t.player.getPlayableActionCards().map((c) => c.name), 'once per generation').not.to.include(ARS);
    });

    it('ONE holder: still a question — never automatic', () => {
      onTable(t, 0);
      const census = holder(t.player, new MartianCensus(), 0);
      const choice = activate(t)!;
      expect(choice).is.not.undefined;
      expect(cast(choice.options[0], SelectCard<ICard>).cards.map((c) => c.name)).deep.eq([census.name]);
    });

    it('NO holder: the action is available, the animal lands, the data is skipped BY NAME', () => {
      onTable(t, 0);
      expect(t.card.canAct(t.player), 'never unavailable for want of a holder').is.true;
      expect(activate(t), 'nothing asked').is.undefined;
      expect(t.card.resourceCount).eq(1);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').at(-1);
      expect(skipped?.impact.skipped?.reason).eq(SKIP_REASON.noHolder);
    });

    it('the preview\'s target step IS the live choice: an `or` of the same pick and the decline, 1 per pick, the data icon', () => {
      onTable(t, 0);
      const census = holder(t.player, new MartianCensus(), 1);
      const branch = actionPreview(t.player, t.card).branches[0];
      const step = branch.steps.find((s) => s.kind === 'input');
      if (step === undefined || step.kind !== 'input') {
        throw new Error('the target is an input step');
      }
      expect(step.amount).eq(DATA_PER_ACTION);
      expect(step.cardResource).eq('data');
      expect(step.for, 'the pre-collected answer is ADDRESSED').is.not.undefined;
      const model = step.input as OrOptionsModel;
      expect(model.type).eq('or');
      expect(model.options).has.length(2);
      expect((model.options[0] as SelectCardModel).cards.map((c) => c.name)).deep.eq([census.name]);
      expect((model.options[1] as {metadata?: {kind?: string}}).metadata?.kind).eq('skip');
      const live = activate(t)!.toModel(t.player) as OrOptionsModel;
      expect((live.options[0] as SelectCardModel).cards.map((c) => c.name)).deep.eq((model.options[0] as SelectCardModel).cards.map((c) => c.name));
      // The animal's own chip, with its `current → resulting` on this card.
      expect(branch.effects.find((e) => e.icon === 'animal')).deep.include({direction: 'gain', amount: 1, current: 0, resulting: 1});
    });

    it('the composed batch [activate, {or 0, {card}}] replays WHOLE with its address — nothing asked twice; the decline too', () => {
      onTable(t, 0);
      const census = holder(t.player, new MartianCensus(), 1);
      const step = actionPreview(t.player, t.card).branches[0].steps.find((s) => s.kind === 'input');
      if (step === undefined || step.kind !== 'input') {
        throw new Error('the target is an input step');
      }
      replayBatch(t.player, [
        actionHead(t),
        {type: 'or', index: 0, response: {type: 'card', cards: [census.name]}, ...(step.for === undefined ? {} : {for: step.for})} as InputResponse,
      ]);
      runAllActions(t.game);
      expectActionOver(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(census.resourceCount).eq(2);
      expect(t.card.resourceCount).eq(1);

      // A new generation, the decline.
      t.player.actionsThisGeneration.delete(ARS);
      replayBatch(t.player, [
        actionHead(t),
        {type: 'or', index: 1, response: {type: 'option'}, ...(step.for === undefined ? {} : {for: step.for})} as InputResponse,
      ]);
      runAllActions(t.game);
      expectActionOver(t);
      expect(census.resourceCount).eq(2);
      expect(t.card.resourceCount).eq(2);
    });
  });

  describe('rule 11 — VP: 1 per 2 animals, rounded down', () => {
    it('0 → 0, 1 → 0, 2 → 1, 3 → 1, 4 → 2', () => {
      onTable(t, 0);
      for (const [animals, vp] of [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2]] as const) {
        t.card.resourceCount = animals;
        expect(t.player.getVictoryPoints().victoryPoints, `${animals} animals`).eq(vp);
      }
    });
  });

  describe('rule 12 — the tags and the city wake the table', () => {
    it('the animal tag: TR38 +1 data, Decomposers +1 microbe, Ecological Zone +1 animal; the building tag: TR16 draws; the city placed: Pets — and the forecast names them before the press', () => {
      seatOcean(t.game, O1);
      const simulations = holder(t.player, new BiologicalSimulations(), 2);
      const decomposers = holder(t.player, new Decomposers(), 0);
      const zone = holder(t.player, new EcologicalZone(), 0);
      const pets = holder(t.player, new Pets(), 0);
      const district = holder(t.player, new AdministrationDistrict(), 0);
      const facts = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts;
      expect(facts.find((f) => f.source.name === CardName.BIOLOGICAL_SIMULATIONS)?.effects[0]).deep.include({icon: 'data', amount: 1, current: 2, resulting: 3});
      expect(facts.find((f) => f.source.name === CardName.DECOMPOSERS)?.effects[0]).deep.include({icon: 'microbe', amount: 1});
      expect(facts.find((f) => f.source.name === CardName.ECOLOGICAL_ZONE)?.effects[0]).deep.include({icon: 'animal', amount: 1});
      expect(facts.find((f) => f.source.name === CardName.ADMINISTRATION_DISTRICT), 'TR16: a building with a non-negative VP icon').is.not.undefined;
      const handBefore = t.player.cardsInHand.length - 1;
      playOn(t, O1);
      expect(simulations.resourceCount).eq(3);
      expect(decomposers.resourceCount).eq(1);
      expect(zone.resourceCount).eq(1);
      expect(pets.resourceCount, 'a whole city was placed').eq(1);
      expect(district.resourceCount).eq(0);
      expect(t.player.cardsInHand.length, 'TR16 drew').eq(handBefore + 1);
    });
  });

  it('rule 15 — survives a save and a load: the card, its animals, both pieces on the cell', () => {
    seatOcean(t.game, O1);
    playOn(t, O1);
    t.card.resourceCount = 3;
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const player = live.getPlayerById(t.player.id);
    const card = player.playedCards.get(ARS)!;
    expect(card).is.not.undefined;
    expect(card.resourceCount).eq(3);
    expect(live.board.getSpaceOrThrow(O1).tile).deep.eq({tileType: TileType.CITY, card: ARS, covers: {tileType: TileType.OCEAN}});
    expect(live.board.getOceanSpaces().map((s) => s.id)).deep.eq([O1]);
    expect(player.getVictoryPoints().victoryPoints).eq(1);
  });
});
