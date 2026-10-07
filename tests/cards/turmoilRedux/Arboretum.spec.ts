import {expect} from 'chai';
import {
  ARBORETUM_GREENERY_TITLE, ARBORETUM_NO_HOLDER_WARNING, ARBORETUM_TARGET_TITLE, Arboretum, NO_SPACE_FOR_GREENERY_REASON,
} from '../../../src/server/cards/turmoilRedux/Arboretum';
import {ADJACENT_CITY_UNIT} from '../../../src/server/cards/adjacentCityPayout';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Space} from '../../../src/server/boards/Space';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {boardCellPreview} from '../../../src/server/boards/BoardInformationEngine';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {TileType} from '../../../src/common/TileType';
import {MAX_OXYGEN_LEVEL} from '../../../src/common/constants';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {BoardFact} from '../../../src/common/boards/BoardInformationFacts';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addCity, formatMessage, runAllActions, setOxygenLevel} from '../../TestingUtils';

/**
 * TR21 — ARBORETUM: a greenery, then 1 data on ANY card for each city beside
 * the tile — the first card reward THE CELL DECIDES (`cards/adjacentCityPayout.ts`).
 * Every rule reading of the card file's header is pinned here.
 */
const M = PartyName.MARS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: Arboretum};

/** A two-seat Redux table, three QUIET resolutions on the floor and Mars First's quiet one ENACTED (the requirement met, the party effect on), 40 M€. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([PartyName.GREENS, M, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  seatEnacted(parliament, quietResolutionOf(M));
  p1.megaCredits = 40;
  return {game, p1, p2, card: new Arboretum()};
}

/** A free, bonus-less interior land cell with six free land neighbours — the centre the cities are seated around. */
function hub(game: IGame): Space {
  const board = game.board;
  const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
  const found = board.spaces.find((s) => free(s) && s.bonus.length === 0 &&
    board.getAdjacentSpaces(s).length === 6 && board.getAdjacentSpaces(s).every(free));
  if (found === undefined) {
    throw new Error('no hub on this board');
  }
  return found;
}

/** Play the card for real (the requirement gate is past) and answer the target step, when one is asked. */
function play(t: Table, target?: ICard): SelectSpace {
  t.p1.playCard(t.card);
  runAllActions(t.game);
  let wf = t.p1.popWaitingFor();
  if (wf instanceof SelectCard) {
    expect(target, 'the play asked for a target').is.not.undefined;
    wf.cb([target!]);
    runAllActions(t.game);
    wf = t.p1.popWaitingFor();
  } else {
    expect(target, 'the play asked for no target').is.undefined;
  }
  return cast(wf, SelectSpace);
}

function placeOn(t: Table, prompt: SelectSpace, space: Space): void {
  const cell = prompt.spaces.find((s) => s.id === space.id);
  expect(cell, `${space.id} is a legal greenery cell`).is.not.undefined;
  prompt.cb(cell!);
  runAllActions(t.game);
}

function stepsOf(t: Table): ReadonlyArray<ActionPreviewStep> {
  return cardPlayPreview(t.p1, t.card).branches[0].steps;
}

function placementOf(steps: ReadonlyArray<ActionPreviewStep>) {
  return steps.find((s): s is Extract<ActionPreviewStep, {kind: 'boardPlacement'}> => s.kind === 'boardPlacement');
}

/** Every fact the dossier states about the cell for this card's staged greenery. */
function dossierOf(t: Table, space: Space): Array<BoardFact> {
  const preview = boardCellPreview(t.p1, space, 'greenery', {tileType: TileType.GREENERY, sourceCard: CardName.ARBORETUM});
  return [...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts, ...preview.warningFacts,
    ...preview.futureScoringFacts, ...preview.ruleFacts, ...(preview.progressFacts ?? [])];
}

function cardFact(facts: ReadonlyArray<BoardFact>, suffix: string): BoardFact | undefined {
  return facts.find((f) => f.id === `card-${CardName.ARBORETUM}-${suffix}`);
}

describe('Arboretum', () => {
  it('registers with source-backed metadata (the scan: 12 · Plant, Building · green · Mars First · 1 VP)', () => {
    const card = new Arboretum();
    expect(card.name).eq(CardName.ARBORETUM);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(12);
    expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.PLANT, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR21');
    expect(requiredPartyOf(card), 'the MIN plate holds the Mars First emblem').eq(M);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'the VP badge on the Mars disc').eq(1);
    expect(card.tr, 'the oxygen step the greenery makes — priced for the Reds, never a second step').deep.eq({oxygen: 1});
    expect(card.behavior, 'a declarative greenery would lose the cell').is.undefined;
    expect(card.resourceType).is.undefined;
    // The face: one row «[greenery with O₂]  X [data]*».
    type Node = {is?: string, type?: string, text?: string, secondaryTag?: string};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(1);
    expect(rows[0].map((n) => n.type ?? n.is)).deep.eq([
      CardRenderItemType.GREENERY, CardRenderItemType.NBSP, CardRenderItemType.NBSP, CardRenderItemType.TEXT, CardRenderItemType.RESOURCE, '*']);
    expect(rows[0][0].secondaryTag, 'the red O₂ dot').eq('oxygen');
    expect(rows[0][3].text).eq('X');
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with the TR15 class\'s NAMED reason', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.GREENS, M, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      p1.megaCredits = 40;
      const card = new Arboretum();
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Mars First rules: playable', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });
  });

  describe('rule 2 — an ordinary greenery, and the oxygen is PART of it', () => {
    it('raises oxygen one step: +1 TR for the step, +1 TR for the Redux greenery tile', () => {
      const t = table();
      const centre = hub(t.game);
      const oxygen = t.game.getOxygenLevel();
      const tr = t.p1.terraformRating;
      placeOn(t, play(t), centre);
      expect(centre.tile?.tileType).eq(TileType.GREENERY);
      expect(centre.player).eq(t.p1);
      expect(t.game.getOxygenLevel() - oxygen, 'ONE step — the engine\'s, never a second').eq(1);
      expect(t.p1.terraformRating - tr).eq(2);
    });

    it('at maximum oxygen: no step and no step TR — the greenery still lands and its tile still pays 1 TR', () => {
      const t = table();
      setOxygenLevel(t.game, MAX_OXYGEN_LEVEL);
      const centre = hub(t.game);
      const tr = t.p1.terraformRating;
      placeOn(t, play(t), centre);
      expect(centre.tile?.tileType).eq(TileType.GREENERY);
      expect(t.game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      expect(t.p1.terraformRating - tr).eq(1);
    });

    it('the cell\'s bonus and Mars First\'s +1 steel per tile on Mars are paid', () => {
      const t = table();
      const centre = hub(t.game);
      centre.bonus = [SpaceBonus.STEEL, SpaceBonus.STEEL];
      const steel = t.p1.steel;
      placeOn(t, play(t), centre);
      expect(t.p1.steel - steel, '2 printed + 1 Mars First').eq(3);
    });

    it('the cells are the engine\'s greenery cells — beside one\'s own tile when possible; the live title is the engine\'s', () => {
      const t = table();
      const centre = hub(t.game);
      const own = t.game.board.getAdjacentSpaces(centre)[0];
      addCity(t.p1, own.id);
      // No data holder: the target step asks nobody, the greenery is the first question.
      const prompt = play(t);
      expect(prompt.title).eq(ARBORETUM_GREENERY_TITLE);
      expect(prompt.sourceCard, 'the staged tail\'s address').eq(CardName.ARBORETUM);
      expect(prompt.spaces.map((s) => s.id)).to.have.members(t.game.board.getAvailableSpacesForGreenery(t.p1).map((s) => s.id));
      expect(prompt.spaces.every((s) => t.game.board.getAdjacentSpaces(s).some((n) => n.player === t.p1))).is.true;
    });

    it('no legal cell: unplayable with the engine\'s own reason', () => {
      const t = table();
      for (const space of t.game.board.getAvailableSpacesOnLand(t.p1)) {
        space.tile = {tileType: TileType.CITY};
      }
      expect(t.p1.canPlay(t.card)).is.false;
      expect(t.card.unplayableReason(t.p1)).deep.eq({type: 'placement', message: NO_SPACE_FOR_GREENERY_REASON});
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'placement', message: NO_SPACE_FOR_GREENERY_REASON}]);
    });
  });

  describe('rules 3–5 — 1 data per adjacent city (any owner, a stack per tier), all of it on ONE chosen card', () => {
    function arrange(t: Table): {centre: Space, ring: ReadonlyArray<Space>, holder: VectorComputations} {
      const centre = hub(t.game);
      const holder = new VectorComputations();
      holder.resourceCount = 2;
      t.p1.playedCards.push(holder);
      return {centre, ring: t.game.board.getAdjacentSpaces(centre), holder};
    }

    it('one adjacent city (another player\'s) — +1 data on the chosen card', () => {
      const t = table();
      const {centre, ring, holder} = arrange(t);
      addCity(t.p2, ring[0].id);
      placeOn(t, play(t, holder), centre);
      expect(holder.resourceCount).eq(3);
    });

    it('three adjacent cities, own and another player\'s — +3', () => {
      const t = table();
      const {centre, ring, holder} = arrange(t);
      addCity(t.p1, ring[0].id);
      addCity(t.p2, ring[2].id);
      addCity(t.p2, ring[4].id);
      placeOn(t, play(t, holder), centre);
      expect(holder.resourceCount).eq(5);
    });

    it('a stack of two counts per tier — 2 data from one cell', () => {
      const t = table();
      const {centre, ring, holder} = arrange(t);
      addCity(t.p1, ring[1].id);
      ring[1].stackHeight = 2;
      placeOn(t, play(t, holder), centre);
      expect(holder.resourceCount).eq(4);
    });

    it('the Capital and an Ocean City are cities', () => {
      const t = table();
      const board = t.game.board;
      const holder = new VectorComputations();
      t.p1.playedCards.push(holder);
      // A free land cell beside an ocean area: an Ocean City on the ocean area, the Capital on a land neighbour.
      const cell = board.getAvailableSpacesOnLand(t.p1).find((s) => s.bonus.length === 0 &&
        board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.OCEAN && n.tile === undefined) &&
        board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.LAND && n.tile === undefined && n.id !== board.noctisCitySpaceId))!;
      const ocean = board.getAdjacentSpaces(cell).find((n) => n.spaceType === SpaceType.OCEAN && n.tile === undefined)!;
      const land = board.getAdjacentSpaces(cell).find((n) => n.spaceType === SpaceType.LAND && n.tile === undefined && n.id !== board.noctisCitySpaceId)!;
      ocean.tile = {tileType: TileType.OCEAN_CITY};
      ocean.player = t.p2;
      land.tile = {tileType: TileType.CAPITAL, card: CardName.CAPITAL};
      land.player = t.p2;
      placeOn(t, play(t, holder), cell);
      expect(holder.resourceCount).eq(2);
    });

    it('a NEUTRAL solo city is a city too', () => {
      const [game, p1] = testGame(1, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      // The solo setup's own pending question (the colony table) is not this card's.
      runAllActions(game);
      p1.popWaitingFor();
      const card = new Arboretum();
      const holder = new VectorComputations();
      p1.playedCards.push(holder);
      const neutral = game.board.getCities().find((s) => s.player?.color === 'neutral')!;
      expect(neutral, 'the solo setup seats neutral cities').is.not.undefined;
      const cell = game.board.getAdjacentSpaces(neutral).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
        game.board.getAvailableSpacesForGreenery(p1).includes(s))!;
      const before = game.board.getAdjacentSpaces(cell).filter((s) => s.tile !== undefined && [TileType.CITY, TileType.CAPITAL].includes(s.tile.tileType)).length;
      p1.playCard(card);
      runAllActions(game);
      cast(p1.popWaitingFor(), SelectCard).cb([holder]);
      runAllActions(game);
      const prompt = cast(p1.popWaitingFor(), SelectSpace);
      prompt.cb(prompt.spaces.find((s) => s.id === cell.id)!);
      runAllActions(game);
      expect(holder.resourceCount).eq(before);
      expect(before).is.greaterThan(0);
    });

    it('rule 5 — the target is asked even with ONE holder, and all N land on it', () => {
      const t = table();
      const {centre, ring, holder} = arrange(t);
      addCity(t.p2, ring[0].id);
      addCity(t.p2, ring[3].id);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const pick = cast(t.p1.popWaitingFor(), SelectCard);
      expect(pick.cards).deep.eq([holder]);
      expect(pick.title).eq(ARBORETUM_TARGET_TITLE);
      expect(pick.resourceGainPrompt?.amount, 'no number before the cell').is.undefined;
      expect(pick.resourceGainPrompt?.amountBasis).deep.eq({per: 'adjacent-city'});
      expect(pick.resourceGainPrompt?.cardResource).eq('data');
      expect(pick.choiceContext?.source).deep.eq({kind: 'card', card: CardName.ARBORETUM});
      pick.cb([holder]);
      runAllActions(t.game);
      placeOn(t, cast(t.p1.popWaitingFor(), SelectSpace), centre);
      expect(holder.resourceCount).eq(4);
    });

    it('two holders — the data goes to the one chosen, never spread', () => {
      const t = table();
      const {centre, ring, holder} = arrange(t);
      const other = new PoliticalScience();
      t.p1.playedCards.push(other);
      addCity(t.p2, ring[0].id);
      addCity(t.p2, ring[3].id);
      placeOn(t, play(t, other), centre);
      expect(other.resourceCount).eq(2);
      expect(holder.resourceCount).eq(2);
    });
  });

  describe('rule 6 — the target is asked BEFORE the cell, and only when some legal cell can pay', () => {
    it('no legal cell has a city beside it: no target step, the greenery is asked at once', () => {
      const t = table();
      t.p1.playedCards.push(new VectorComputations());
      const prompt = play(t);
      expect(prompt.title).eq(ARBORETUM_GREENERY_TITLE);
      const steps = stepsOf(t);
      expect(steps.map((s) => s.kind), 'the preview asks nothing either').deep.eq(['boardPlacement']);
    });

    it('the preview\'s target step comes BEFORE the cell, carries no amount and the basis', () => {
      const t = table();
      const {centre} = {centre: hub(t.game)};
      addCity(t.p2, t.game.board.getAdjacentSpaces(centre)[0].id);
      t.p1.playedCards.push(new VectorComputations());
      const steps = stepsOf(t);
      expect(steps.map((s) => s.kind)).deep.eq(['input', 'boardPlacement']);
      const target = steps[0] as Extract<ActionPreviewStep, {kind: 'input'}>;
      expect(target.amount).is.undefined;
      expect(target.vpBox).is.undefined;
      expect(target.cardResource).eq('data');
      const model = target.input as SelectCardModel;
      expect(model.title).eq(ARBORETUM_TARGET_TITLE);
      expect(model.resourceGainPrompt?.amount).is.undefined;
      expect(model.resourceGainPrompt?.amountBasis).deep.eq({per: 'adjacent-city'});
      expect(model.cards.map((c) => c.name)).deep.eq([CardName.VECTOR_COMPUTATIONS]);
    });
  });

  describe('rules 7–8 — zero is the rule, a missing holder is a named loss', () => {
    it('N = 0: nothing added, no skip recorded, the journal says why', () => {
      const t = table();
      const holder = new VectorComputations();
      t.p1.playedCards.push(holder);
      const centre = hub(t.game);
      const events = t.game.events.events.length;
      placeOn(t, play(t), centre);
      expect(holder.resourceCount).eq(0);
      expect(t.game.events.events.slice(events).filter((e) => e.type === 'effect-skipped')).is.empty;
      expect(t.game.gameLog.map(formatMessage)).to.include(`${CardName.ARBORETUM}: no city adjacent to the tile — nothing to add`);
    });

    it('N > 0 with no data holder: playable, the composer warns, the payout records a NAMED skip with its size', () => {
      const t = table();
      const centre = hub(t.game);
      const ring = t.game.board.getAdjacentSpaces(centre);
      addCity(t.p2, ring[0].id);
      addCity(t.p2, ring[3].id);
      expect(t.p1.canPlay(t.card)).is.true;
      const steps = stepsOf(t);
      expect(steps.map((s) => s.kind)).deep.eq(['note', 'boardPlacement']);
      const note = steps[0] as Extract<ActionPreviewStep, {kind: 'note'}>;
      expect(note.noteKind).eq('warning');
      expect(note.text).eq(ARBORETUM_NO_HOLDER_WARNING);
      expect(note.skipped?.label).eq('Add resources to a card');
      const events = t.game.events.events.length;
      placeOn(t, play(t), centre);
      const skipped = t.game.events.events.slice(events).filter((e) => e.type === 'effect-skipped');
      expect(skipped).has.length(1);
      expect(skipped[0].impact.skipped).deep.include({label: 'Add resources to a card', reason: 'No eligible card'});
      expect(skipped[0].impact.skipped?.effect).deep.include({icon: 'data', amount: 2});
    });
  });

  it('rule 9 — the composer\'s forecast names Martian Fiber WITHOUT a number (the cell decides it): deferred, no chip', () => {
    const t = table();
    const fiber = new MartianFiber();
    t.p1.playedCards.push(fiber);
    t.p1.cardsInHand.push(t.card);
    addCity(t.p2, t.game.board.getAdjacentSpaces(hub(t.game))[0].id);
    const facts = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)).facts
      .filter((f) => f.source.name === CardName.MARTIAN_FIBER);
    expect(facts).has.length(1);
    expect(facts[0].certainty).eq('deferred');
    expect(facts[0].timing).eq('after-placement');
    expect(facts[0].effects, 'a number before the cell would be a guess').deep.eq([]);
    expect(facts[0].source.channel).eq('resource-added');
  });

  it('rule 9 — Martian Fiber pays +1 M€ per data, and the dossier says so on the cell', () => {
    const t = table();
    const fiber = new MartianFiber();
    t.p1.playedCards.push(fiber);
    const centre = hub(t.game);
    const ring = t.game.board.getAdjacentSpaces(centre);
    addCity(t.p2, ring[0].id);
    addCity(t.p2, ring[2].id);
    addCity(t.p2, ring[4].id);
    const facts = dossierOf(t, centre);
    const reaction = facts.find((f) => f.reaction === true && f.source?.id === CardName.MARTIAN_FIBER);
    expect(reaction?.delta).deep.include({icon: 'megacredits', amount: 3, direction: 'gain'});
    const mc = t.p1.megaCredits;
    placeOn(t, play(t, fiber), centre);
    expect(fiber.resourceCount).eq(3);
    expect(t.p1.megaCredits - mc, 'exactly what the dossier promised').eq(3);
    expect(t.game.cardAdjacencyPayouts.at(-1)?.reactions, 'what the table answered, MEASURED for the scene').deep.eq({megacredits: 3});
  });

  describe('rule 10 — the journal: one line and one event with the reason; the record the scene reads', () => {
    it('«… for 3 adjacent cities», a `basis` on the event, a payout record naming every neighbour and its tiers', () => {
      const t = table();
      const centre = hub(t.game);
      const ring = t.game.board.getAdjacentSpaces(centre);
      const holder = new VectorComputations();
      holder.resourceCount = 1;
      t.p1.playedCards.push(holder);
      addCity(t.p2, ring[0].id);
      addCity(t.p1, ring[3].id);
      ring[3].stackHeight = 2;
      const events = t.game.events.events.length;
      placeOn(t, play(t, holder), centre);
      const added = t.game.events.events.slice(events).filter((e) => e.type === 'card-resource-changed' &&
        e.impact.cardResources?.some((c) => c.target === CardName.VECTOR_COMPUTATIONS));
      expect(added, 'ONE event for the whole payout').has.length(1);
      expect(added[0].impact.cardResources?.[0]).deep.eq({
        cardResource: CardResource.DATA, target: CardName.VECTOR_COMPUTATIONS, amount: 3, basis: {count: 3, unitKey: ADJACENT_CITY_UNIT},
      });
      expect(added[0].source).deep.include({kind: 'card', card: CardName.ARBORETUM});
      const lines = t.game.gameLog.map(formatMessage).filter((l) => l.includes('adjacent {city|cities}'));
      expect(lines).deep.eq([`${t.p1.color} added 3 Data to ${CardName.VECTOR_COMPUTATIONS} for 3 adjacent {city|cities}`]);
      const record = t.game.cardAdjacencyPayouts.at(-1);
      expect(record).deep.include({
        cause: 'adjacent-cities', color: t.p1.color, card: CardName.ARBORETUM, spaceId: centre.id, basis: {per: 'adjacent-city'},
        target: CardName.VECTOR_COMPUTATIONS, resource: CardResource.DATA, amount: 3, before: 1,
      });
      expect(record?.neighbours).to.have.deep.members([{spaceId: ring[0].id, units: 1}, {spaceId: ring[3].id, units: 2}]);
    });

    it('N = 0 publishes no record', () => {
      const t = table();
      t.p1.playedCards.push(new VectorComputations());
      placeOn(t, play(t), hub(t.game));
      expect(t.game.cardAdjacencyPayouts).is.empty;
    });
  });

  describe('the dossier — the card hook names the paying cells', () => {
    it('a paying cell: «+N data · for N adjacent cities», the cities as `spaces`, landing on the chosen card', () => {
      const t = table();
      t.p1.playedCards.push(new VectorComputations());
      const centre = hub(t.game);
      const ring = t.game.board.getAdjacentSpaces(centre);
      addCity(t.p2, ring[1].id);
      addCity(t.p1, ring[4].id);
      ring[4].stackHeight = 2;
      const fact = cardFact(dossierOf(t, centre), 'adjacent-cities');
      expect(fact?.delta).deep.eq({icon: 'data', amount: 3, direction: 'gain'});
      expect(fact?.title).eq('For ${0} adjacent {city|cities}');
      expect(fact?.params).deep.eq(['3']);
      expect(fact?.spaces).to.have.members([ring[1].id, ring[4].id]);
      expect(fact?.landsOnChosenCard).deep.eq({resource: 'data'});
    });

    it('a cell with no city beside it: a rule line, no gain, no lit cell', () => {
      const t = table();
      t.p1.playedCards.push(new VectorComputations());
      const facts = dossierOf(t, hub(t.game));
      const rule = cardFact(facts, 'no-cities');
      expect(rule?.timing).eq('rule');
      expect(rule?.title).eq('No adjacent cities — no data from this tile');
      expect(cardFact(facts, 'adjacent-cities')).is.undefined;
    });

    it('a paying cell with no holder: the loss, with its size, as a warning', () => {
      const t = table();
      const centre = hub(t.game);
      addCity(t.p2, t.game.board.getAdjacentSpaces(centre)[0].id);
      const lost = cardFact(dossierOf(t, centre), 'lost');
      expect(lost?.severity).eq('warning');
      expect(lost?.timing).eq('warning');
      expect(lost?.delta).deep.include({icon: 'data', amount: 1});
    });

    it('the preview and the hook are READ-ONLY', () => {
      const t = table();
      t.p1.playedCards.push(new VectorComputations(), new MartianFiber());
      const centre = hub(t.game);
      addCity(t.p2, t.game.board.getAdjacentSpaces(centre)[0].id);
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.p1, t.card);
      effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card));
      dossierOf(t, centre);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  it('staged ⇔ live parity: the same cells, the same reasons, the same title, the tile and the tail\'s address', () => {
    const t = table();
    const centre = hub(t.game);
    addCity(t.p1, t.game.board.getAdjacentSpaces(centre)[0].id);
    const holder = new VectorComputations();
    t.p1.playedCards.push(holder);
    const staged = placementOf(stepsOf(t))?.staged;
    expect(staged).is.not.undefined;
    expect(staged?.title).eq(ARBORETUM_GREENERY_TITLE);
    expect(staged?.placementType).eq('greenery');
    expect(staged?.sourceCard).eq(CardName.ARBORETUM);
    const prompt = play(t, holder);
    expect(staged?.spaces).to.have.members(prompt.spaces.map((s) => s.id));
    expect(staged?.illegalSpaces).deep.eq(prompt.illegalSpaces);
    expect(staged?.tileType).eq(prompt.tileType);
  });

  it('a reload between the plays never carries a chosen target over (the step lives on its own instance)', () => {
    const t = table();
    const centre = hub(t.game);
    const ring = t.game.board.getAdjacentSpaces(centre);
    const holder = new VectorComputations();
    t.p1.playedCards.push(holder);
    addCity(t.p2, ring[0].id);
    placeOn(t, play(t, holder), centre);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const vc = reloaded.getPlayerById(t.p1.id).tableau.get(CardName.VECTOR_COMPUTATIONS);
    expect(vc?.resourceCount, 'the data survives the save').eq(1);
    expect(reloaded.getPlayerById(t.p1.id).tableau.has(CardName.ARBORETUM)).is.true;
    expect(reloaded.cardAdjacencyPayouts, 'the scene\'s record is presentation only').is.empty;
  });
});
