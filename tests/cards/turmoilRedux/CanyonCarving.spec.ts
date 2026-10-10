import {expect} from 'chai';
import {CanyonCarving} from '../../../src/server/cards/turmoilRedux/CanyonCarving';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {
  MOVE_OCEAN_TILE_CONSTRAINT, MOVE_OCEAN_TILE_TITLE, NO_SPACE_TO_MOVE_AN_OCEAN_REASON, OCEAN_MOVE_LABEL,
} from '../../../src/server/deferredActions/MoveOceanTile';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {Space} from '../../../src/server/boards/Space';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ArcticAlgae} from '../../../src/server/cards/base/ArcticAlgae';
import {Capital} from '../../../src/server/cards/base/Capital';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {SpaceId} from '../../../src/common/Types';
import {TileType} from '../../../src/common/TileType';
import {Resource} from '../../../src/common/Resource';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {aggregateByPlayer} from '../../../src/common/events/aggregate';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {maxOutOceans, runAllActions} from '../../TestingUtils';

/**
 * TR39 — CANYON CARVING: the set's second tile MOVE and the first of a tile
 * nobody owns — any plain ocean travels to an adjacent cell, the player
 * gains TR and the cell's bonuses. Every rule reading of the card file's
 * header is pinned here at the PLAY; the mover, the set and the hypothesis
 * have their own specs (tests/boards/oceanMove, oceanMovePreview).
 *
 * The geometry is Tharsis's own (see tests/boards/oceanMove.spec.ts): A (33)
 * beside B₁ (34, a reserve) and B₂ (42, plant land); O₂ (43) beside both B
 * and never A; C (24) beside A and neither B.
 */
const G = PartyName.GREENS;
const COST = 6;
const A = '33' as SpaceId;
const B_OCEAN = '34' as SpaceId;
const B_LAND = '42' as SpaceId;
const O2 = '43' as SpaceId;
const CAPITAL_CELL = '24' as SpaceId;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: CanyonCarving};

/** A two-seat Redux table in the action phase, three QUIET real resolutions seated: generation 1, nothing enacted — the Greens rule by the STARTING RULE. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, aresHazards: false});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, PartyName.MARS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  p1.megaCredits = 40;
  return {game, p1, p2, parliament, card: new CanyonCarving()};
}

function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

function greensCubes(t: Table, player: TestPlayer, n: number): void {
  const slot = t.parliament.slotOf(G)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

const cell = (game: IGame, id: SpaceId) => game.board.getSpaceOrThrow(id);
const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

/** An ocean seated WITHOUT the parameter's train — the arrangement, never the rule. */
function seatOcean(game: IGame, id: SpaceId): Space {
  const space = cell(game, id);
  space.tile = {tileType: TileType.OCEAN};
  space.player = undefined;
  return space;
}

function seatCapital(game: IGame, owner: TestPlayer, id: SpaceId): Space {
  owner.playedCards.push(new Capital());
  const space = cell(game, id);
  game.simpleAddTile(owner, space, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
  return space;
}

/** Play the card for real (no requirement asked — `playCard` is past the gate) and return its move prompt. */
function playToPrompt(t: Table): SelectSpace {
  t.p1.playCard(t.card);
  runAllActions(t.game);
  return cast(t.p1.popWaitingFor(), SelectSpace);
}

function placementStepOf(player: TestPlayer, card: IProjectCard) {
  const steps = cardPlayPreview(player, card).branches[0].steps;
  return steps.find((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
}

describe('CanyonCarving', () => {
  it('registers with source-backed metadata (the scan: 6 · Building · green · the Greens · 1 VP) — in the Redux manifest without compatibility', () => {
    const card = new CanyonCarving();
    expect(card.name).eq(CardName.CANYON_CARVING);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(COST);
    expect(card.tags).deep.eq([Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR39');
    expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem').eq(G);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'the badge prints 1').eq(1);
    expect(card.resourceType).is.undefined;
    expect(card.metadata.description).to.match(/^Requires the Greens to be ruling or that you have 2 delegates there\. Remove any 1 ocean tile/);
    // The face, one row: «− [ocean] + [ocean]*».
    type Node = {is?: string, type?: string};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(1);
    expect(rows[0].map((n) => n.type ?? n.is)).deep.eq(['-', CardRenderItemType.OCEANS, '+', CardRenderItemType.OCEANS, '*']);
    const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
    const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.CANYON_CARVING];
    expect(entry, 'registered in the Redux manifest').is.not.undefined;
    expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
  });

  describe('rule 1 — the requirement: the Greens rule (the starting rule counts), or 2 of your delegates on their resolution', () => {
    let t: Table;
    beforeEach(() => {
      t = table();
      seatOcean(t.game, A);
      t.p1.cardsInHand.push(t.card);
    });

    it('generation 1, nothing enacted: the Greens rule by the STARTING RULE — playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0, requirement: true, requirementKey: 'req:party',
      });
      greensCubes(t, t.p1, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      greensCubes(t, t.p1, 1);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s: with one cube the card still reads «1 of 2»', () => {
      redsRule(t);
      t.p1.playedCards.push(new CouncilSeat());
      greensCubes(t, t.p1, 1);
      expect(t.parliament.hasPartyEffect(t.p1, G)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, current: 1});
    });
  });

  describe('rule 4 — playable while at least one ocean may travel; else ONE named reason', () => {
    it('no ocean on the board at all: «no ocean tile on the board has a free adjacent space»', () => {
      const t = table();
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(t.card.unplayableReason(t.p1)).deep.eq({type: 'placement', message: NO_SPACE_TO_MOVE_AN_OCEAN_REASON});
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_SPACE_TO_MOVE_AN_OCEAN_REASON}]);
    });

    it('every ocean walled in: the same reason; an upgraded ocean alone: the same reason', () => {
      const t = table();
      t.p1.cardsInHand.push(t.card);
      const only = seatOcean(t.game, '06' as SpaceId);
      for (const n of t.game.board.getAdjacentSpaces(only)) {
        if (n.spaceType === SpaceType.OCEAN) {
          t.game.addTile(t.p2, n, {tileType: TileType.OCEAN});
          t.game.addTile(t.p2, n, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: n.tile});
        } else {
          t.game.simpleAddTile(t.p2, n, {tileType: TileType.GREENERY});
        }
      }
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_SPACE_TO_MOVE_AN_OCEAN_REASON}]);
    });

    it('an ocean with a free cell beside it — anyone\'s: playable, no reason', () => {
      const t = table();
      t.p1.cardsInHand.push(t.card);
      t.game.addTile(t.p2, cell(t.game, A), {tileType: TileType.OCEAN});
      expect(t.p1.canPlay(t.card)).is.true;
      expect(t.card.unplayableReason(t.p1)).is.undefined;
    });
  });

  describe('rules 2, 3, 11 — the question: the ocean AND the cell, one prompt, never auto-answered', () => {
    it('the play raises the shared move step under the ocean\'s rule: the marker, the kind, the tile, the address, the rule in the title', () => {
      const t = table();
      seatOcean(t.game, A);
      const prompt = playToPrompt(t);
      expect(prompt.title).eq(MOVE_OCEAN_TILE_TITLE);
      expect(prompt.sourceCard).eq(CardName.CANYON_CARVING);
      expect(prompt.placementEffect).eq('move');
      expect(prompt.placementType).eq('ocean-move');
      expect(prompt.tileType).eq(TileType.OCEAN);
      expect(prompt.tileMove?.sources.map((s) => s.from.id)).deep.eq([A]);
      expect(ids(prompt.tileMove!.sources[0].to)).to.include.members([B_OCEAN, B_LAND]);
      expect(cell(t.game, A).tile?.tileType, 'nothing moved by the play itself').eq(TileType.OCEAN);
    });

    it('an upgraded ocean is LISTED with its reason beside the one that can move', () => {
      const t = table();
      seatOcean(t.game, A);
      const upgraded = seatOcean(t.game, O2);
      t.game.addTile(t.p1, upgraded, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: upgraded.tile});
      const prompt = playToPrompt(t);
      expect(prompt.tileMove?.disabledSources).deep.eq([{space: upgraded, reason: 'upgraded-ocean'}]);
    });

    it('the staged preview is the SAME question as the live prompt (parity): title, oceans, cells, reasons, tile, kind, address', () => {
      const t = table();
      seatOcean(t.game, A);
      seatOcean(t.game, '06' as SpaceId);
      t.p1.cardsInHand.push(t.card);
      const staged = placementStepOf(t.p1, t.card)?.staged;
      expect(staged, 'the play stages its move').is.not.undefined;
      const live = playToPrompt(t).toModel();
      expect(staged!.title).eq(live.title);
      expect(staged!.spaces).deep.eq(live.spaces);
      expect(staged!.illegalSpaces).deep.eq(live.illegalSpaces);
      expect(staged!.tileMove).deep.eq(live.tileMove);
      expect(staged!.tileType).eq(TileType.OCEAN);
      expect(staged!.placementType).eq('ocean-move');
      expect(staged!.placementEffect).eq('move');
      expect(staged!.sourceCard).eq(CardName.CANYON_CARVING);
    });

    it('the preview: the move names itself on the step — an «ocean-move» with the ocean tile and the rule\'s tail, never «place an ocean tile»', () => {
      const t = table();
      seatOcean(t.game, A);
      t.p1.cardsInHand.push(t.card);
      const step = placementStepOf(t.p1, t.card)!;
      expect(step.placementType).eq('ocean-move');
      expect(step.tileType).eq(TileType.OCEAN);
      expect(step.constraint).eq(MOVE_OCEAN_TILE_CONSTRAINT);
    });
  });

  describe('rules 5–7 — the move pays its own TR and lands as an ordinary ocean placement; the parameter stands still', () => {
    it('the ocean count and the gate are the same before and after; +1 TR as the CARD\'s; the cell\'s bonus; the OTHER oceans\' adjacency only', () => {
      const t = table();
      seatOcean(t.game, A);
      seatOcean(t.game, O2);
      const countBefore = t.game.board.getOceanSpaces().length;
      const trBefore = t.p1.terraformRating;
      const fromCards = t.p1.terraformRatingFromCards;
      t.p1.plants = 0;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      cast(t.p1.getWaitingFor(), SelectSpace);
      const mcAfterPay = t.p1.megaCredits;
      // Answered through the player's own door, so the TR rides the scope the play opened — the CARD's segment.
      t.p1.process({type: 'space', spaceId: B_LAND, movedFrom: A});
      runAllActions(t.game);
      expect(t.game.board.getOceanSpaces().length).eq(countBefore);
      expect(t.game.canAddOcean()).is.true;
      expect(t.p1.terraformRating).eq(trBefore + 1);
      expect(t.p1.terraformRatingFromCards).eq(fromCards + 1);
      expect(t.p1.terraformRatingSources.at(-1)).deep.include({sourceType: 'card', sourceName: CardName.CANYON_CARVING, amount: 1});
      expect(t.p1.plants, 'the plant printed on 42').eq(1);
      // O₂ pays 2; A (lifted) does not; the Greens rule by the starting rule — +2 M€ for the TR step.
      expect(t.p1.megaCredits).eq(mcAfterPay + 2 + 2);
      expect(cell(t.game, A).tile).is.undefined;
      expect(cell(t.game, B_LAND).tile?.tileType).eq(TileType.OCEAN);
      expect(cell(t.game, B_LAND).player).is.undefined;
      // …and the landing's scene is TOLD what the move paid beyond the cell — the rating, and the table's answer to
      // it MEASURED on the mover's stock (the Greens' 2 M€): the `lastOceanBonus` law, nothing for the client to derive.
      expect(t.p1.lastTileMoveReward).deep.eq({spaceId: B_LAND, from: A, rating: 1, reactions: [{resource: Resource.MEGACREDITS, amount: 2}]});
    });

    it('at NINE oceans the move is legal and pays its TR — no gate, no «Mars is terraformed», no parameter record', () => {
      const t = table();
      maxOutOceans(t.p2);
      expect(t.game.canAddOcean()).is.false;
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.true;
      const trBefore = t.p1.terraformRating;
      const eventsBefore = t.game.events.events.length;
      const prompt = playToPrompt(t);
      const source = prompt.tileMove!.sources[0];
      prompt.process({type: 'space', spaceId: source.to[0].id, movedFrom: source.from.id});
      runAllActions(t.game);
      expect(t.p1.terraformRating).eq(trBefore + 1);
      expect(t.game.board.getOceanSpaces().length).eq(9);
      expect(t.game.events.events.slice(eventsBefore).some((e) => e.type === 'global-parameter-changed')).is.false;
    });

    it('the ruling Mars First\'s passive pays its steel for a tile on Mars — and no card: an ocean is no city', () => {
      const t = table();
      const mars = t.parliament.slotOf(PartyName.MARS)!;
      t.parliament.placeVote(t.p1, mars, 'lobby');
      t.parliament.placeVote(t.p1, mars, 'reserve');
      expect(t.parliament.hasPartyEffect(t.p1, PartyName.MARS)).is.true;
      seatOcean(t.game, A);
      t.p1.steel = 0;
      const hand = t.p1.cardsInHand.length;
      const prompt = playToPrompt(t);
      prompt.process({type: 'space', spaceId: B_OCEAN, movedFrom: A});
      runAllActions(t.game);
      expect(t.p1.steel).eq(1);
      expect(t.p1.cardsInHand.length).eq(hand);
      // The steel is the LANDING's (a placement passive, inside `addTile`) and is NOT in the move's own record — only
      // what answered the RATING is (the Greens still rule by the starting rule: their 2 M€ for the step).
      expect(t.p1.lastTileMoveReward).deep.eq({spaceId: B_OCEAN, from: A, rating: 1, reactions: [{resource: Resource.MEGACREDITS, amount: 2}]});
    });

    it('every «ocean tile placed» trigger fires: another player\'s Arctic Algae gains 2 plants — and the forecast said so first', () => {
      const t = table();
      t.p2.playedCards.push(new ArcticAlgae());
      t.p2.plants = 0;
      seatOcean(t.game, A);
      t.p1.cardsInHand.push(t.card);
      const facts = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)).facts
        .filter((f) => f.source.name === CardName.ARCTIC_ALGAE);
      expect(facts).has.length(1);
      expect(facts[0].source.channel).eq('tile-placed');
      const prompt = playToPrompt(t);
      prompt.process({type: 'space', spaceId: B_OCEAN, movedFrom: A});
      runAllActions(t.game);
      expect(t.p2.plants).eq(2);
    });

    it('the Capital recounts by the board — the player\'s own and ANOTHER player\'s: −1 beside the old cell, +1 beside the new, unchanged beside both', () => {
      const t = table();
      seatOcean(t.game, A);
      seatCapital(t.game, t.p2, CAPITAL_CELL); // beside A only
      seatCapital(t.game, t.p1, '41' as SpaceId); // beside A and B₂
      expect(t.p2.getVictoryPoints().victoryPoints).eq(1);
      expect(t.p1.getVictoryPoints().victoryPoints).eq(1);
      const prompt = playToPrompt(t);
      prompt.process({type: 'space', spaceId: B_LAND, movedFrom: A});
      runAllActions(t.game);
      expect(t.p2.getVictoryPoints().victoryPoints, 'the rival\'s Capital lost its ocean').eq(0);
      expect(t.p1.getVictoryPoints().victoryPoints, 'beside both cells — unchanged').eq(1);
    });

    it('the freed ocean reserve accepts an ocean again later — paying its TR and its bonus again', () => {
      const t = table();
      seatOcean(t.game, A);
      const prompt = playToPrompt(t);
      prompt.process({type: 'space', spaceId: B_OCEAN, movedFrom: A});
      runAllActions(t.game);
      t.p2.plants = 0;
      const trBefore = t.p2.terraformRating;
      t.game.addOcean(t.p2, cell(t.game, A));
      runAllActions(t.game);
      expect(cell(t.game, A).tile?.tileType).eq(TileType.OCEAN);
      expect(t.p2.plants).eq(2);
      expect(t.p2.terraformRating).eq(trBefore + 1);
      expect(t.game.board.getOceanSpaces().length).eq(2);
    });
  });

  it('rule 8 — ONE `tile-moved` event of an OCEAN under the card\'s own play, the log line names the tile, the TR its own line; «tiles placed» does not grow', () => {
    const t = table();
    seatOcean(t.game, A);
    const placedBefore = aggregateByPlayer(t.game.events.events).get(t.p1.color)?.tilesPlaced ?? 0;
    const logBefore = t.game.gameLog.length;

    t.p1.playCard(t.card);
    runAllActions(t.game);
    cast(t.p1.getWaitingFor(), SelectSpace);
    t.p1.process({type: 'space', spaceId: B_OCEAN, movedFrom: A});
    runAllActions(t.game);

    const moved = t.game.events.events.filter((e) => e.type === 'tile-moved');
    expect(moved).has.length(1);
    expect(moved[0].impact.tileMove).deep.eq({from: A, to: B_OCEAN, tileType: TileType.OCEAN});
    expect(moved[0].player).eq(t.p1.color);
    expect(moved[0].source).deep.include({kind: 'card', card: CardName.CANYON_CARVING});
    expect(aggregateByPlayer(t.game.events.events).get(t.p1.color)?.tilesPlaced ?? 0).eq(placedBefore);
    const lines = t.game.gameLog.slice(logBefore);
    expect(lines.filter((l) => l.message === '${0} moved an ocean tile · ${1} → ${2}')).has.length(1);
    expect(lines.some((l) => String(l.message).includes('their city'))).is.false;
    expect(lines.filter((l) => l.message === '${0} gained ${1} ${2}'), 'the TR on its own line').has.length.greaterThan(0);

    // THE JOURNAL draws it as a row of its own — the ocean and the cell it came to, named a relocation, never a placement.
    const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.CANYON_CARVING);
    expect(root).is.not.undefined;
    const rows = buildEventChildren(t.game.events.events.filter((e) => e.correlationId === root!.id), root!.id, t.p1.color);
    const row = rows.find((r) => r.source.kind === 'label' && r.source.label === 'Tile relocation');
    expect(row, `the journal's rows: ${rows.map((r) => JSON.stringify(r.source)).join(' ')}`).is.not.undefined;
    expect(row).deep.include({bucket: 'placement', space: B_OCEAN, tileLabel: 'ocean'});
    expect(rows.some((r) => r.source.kind === 'label' && r.source.label === 'Placement'), 'nothing was placed').is.false;
  });

  it('rule 4 (the degrade) — the board moved between the play and the step: a NAMED skip, never a silent nothing', () => {
    const t = table();
    const only = seatOcean(t.game, A);
    t.p1.playCard(t.card);
    // Before the queue runs, the only ocean leaves the board.
    only.tile = undefined;
    runAllActions(t.game);
    expect(t.p1.getWaitingFor()).is.undefined;
    const skips = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
    expect(skips).deep.eq([{label: OCEAN_MOVE_LABEL, reason: NO_SPACE_TO_MOVE_AN_OCEAN_REASON}]);
  });

  it('rule 9 — survives a save and a load: the played card stays played, the ocean stays moved, the TR stays paid', () => {
    const t = table();
    seatOcean(t.game, A);
    const prompt = playToPrompt(t);
    prompt.process({type: 'space', spaceId: B_LAND, movedFrom: A});
    runAllActions(t.game);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const player = live.getPlayerById(t.p1.id);
    expect(player.playedCards.asArray().map((c) => c.name)).to.include(CardName.CANYON_CARVING);
    expect(live.board.getSpaceOrThrow(B_LAND).tile?.tileType).eq(TileType.OCEAN);
    expect(live.board.getSpaceOrThrow(A).tile).is.undefined;
    expect(player.terraformRating).eq(t.p1.terraformRating);
    expect(live.board.getOceanSpaces()).has.length(1);
  });
});
