import {expect} from 'chai';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {
  CENSUS_ADD_TITLE, CENSUS_DATA_COST, CENSUS_SHORT_DATA_REASON, CENSUS_VOTE_TITLE, censusGrant, DATA_CENSUS,
} from '../../../src/server/cards/turmoilRedux/censusAction';
import {POLITICAL_DONATION_NO_DELEGATE_REASON, POLITICAL_DONATION_NO_RESOLUTION_REASON} from '../../../src/server/cards/turmoilRedux/PoliticalDonation';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {Priority} from '../../../src/server/deferredActions/Priority';
import {IDeferredAction} from '../../../src/server/deferredActions/DeferredAction';
import {BoardType} from '../../../src/server/boards/BoardType';
import {ImmigrantCity} from '../../../src/server/cards/base/ImmigrantCity';
import {GanymedeColony} from '../../../src/server/cards/base/GanymedeColony';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {TileType} from '../../../src/common/TileType';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {cast} from '../../../src/common/utils/utils';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addCity, addGreenery, addOcean, runAllActions} from '../../TestingUtils';

/**
 * TR15 — MARTIAN CENSUS: the set's FIRST card with a PARTY REQUIREMENT, the
 * first trigger on «a city ON MARS» by ANY player, and the first blue ACTION
 * that places a delegate (a staged vote from «Действия карт»). Every rule
 * reading of the card file's header is pinned here; the action's shared half
 * (`censusAction.ts`, TR24's too) is pinned through this card.
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: MartianCensus};

/** A two-seat Redux table with three QUIET real resolutions (Greens · Mars First · Industrialists) — the Greens rule by the starting rule. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new MartianCensus();
  return {game, p1, p2, parliament, card};
}

/** The same table with the card on p1's table (the action / the effect). */
function owned(): Table {
  const t = table();
  t.p1.playedCards.push(t.card);
  return t;
}

/** The deferred actions standing in the queue (the queue is private — the spec reads it to pin the priority). */
function queued(game: IGame): ReadonlyArray<IDeferredAction<unknown>> {
  return (game.deferredActions as unknown as {queue: Array<IDeferredAction<unknown>>}).queue;
}

describe('MartianCensus', () => {
  it('registers with source-backed metadata (the scan: 6 · Mars · blue · Mars First · data · no VP)', () => {
    const card = new MartianCensus();
    expect(card.name).eq(CardName.MARTIAN_CENSUS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(6);
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.metadata.cardNumber).eq('TR15');
    expect(card.resourceType).eq(CardResource.DATA);
    expect(requiredPartyOf(card), 'the MIN plate holds the Mars First emblem — a requirement, not a tag').eq(M);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(CENSUS_DATA_COST).eq(3);
    // The graphic, in the scan's reading order: the effect (ANY player's city · «on Mars» asterisk : data),
    // then A («→ data») · OR · B («3 data → delegate») — each printed row describing itself.
    type Node = {is?: string, type?: string, amount?: number, anyPlayer?: boolean, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows.map((row) => row[0].is === 'effect' ? 'box' : row[0].type)).deep.eq(['box', 'box', 'OR', 'box']);
    const [effect, a, , b] = rows.map((row) => row[0]);
    const cause = (box: Node) => (box.rows?.[0] ?? []) as Array<Node>;
    const result = (box: Node) => (box.rows?.[2] ?? []) as Array<Node | string>;
    expect(cause(effect)[0]).deep.include({type: CardRenderItemType.CITY, anyPlayer: true});
    expect(cause(effect)[1]).deep.include({is: 'symbol', type: '*'});
    expect(result(effect)).deep.include('Effect: Whenever ANY player places a city on Mars, add a data resource to this card.');
    expect((result(a)[0] as Node).type).eq(CardRenderItemType.RESOURCE);
    expect(result(a)).deep.include('Action: Add 1 data resource here.');
    expect(cause(b)[0]).deep.include({type: CardRenderItemType.RESOURCE, amount: 3});
    expect(result(b)[0]).deep.include({type: CardRenderItemType.DELEGATES, amount: 1});
    expect(result(b)).deep.include('Action: Spend 3 data from here to add a delegate to a resolution.');
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with a NAMED reason — the party, and the delegates on its resolution «0 of 2»', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
      expect(PARTY_REQUIREMENT_REASON).eq('Requires ${0} to be ruling or ${1} of your delegates on the resolution of that party');
    });

    it('one delegate on its resolution: still unplayable, «1 of 2»', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: M, current: 1});
    });

    it('two delegates on its resolution: playable', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('Mars First rules: playable with no delegate anywhere', () => {
      const t = table();
      t.p1.megaCredits = 20;
      seatEnacted(t.parliament, quietResolutionOf(M));
      expect(t.parliament.rulingParty()).eq(M);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('its resolution is not up for a vote: the road is CLOSED — `partyOffVote`, never a count to chase', () => {
      const t = table();
      t.p1.megaCredits = 20;
      seatResolution(t.parliament, 1, quietResolutionOf(PartyName.UNITY));
      expect(t.parliament.partiesInVotingArea()).not.includes(M);
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: M, current: 0, partyOffVote: true});
    });

    it('a party effect GRANTED by a card is not a road (FAQ p.19)', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.parliament.grantPartyEffect(t.p1, M, 'Council Seat');
      expect(t.parliament.access(t.p1, M).hasEffect, 'the effect is held').is.true;
      expect(t.p1.canPlay(t.card), 'the requirement is not').is.false;
    });

    it('the classic engine keeps upstream\'s faceless line — and no rule-block key', () => {
      const [, player] = testGame(2, {turmoilExtension: true});
      const card = new MartianCensus();
      player.megaCredits = 20;
      player.cardsInHand.push(card);
      const reasons = unplayableReasons(player, card).filter((r) => r.type === 'party');
      expect(reasons).deep.eq([{type: 'party', message: 'Requires a specific political situation', requirement: true}]);
    });

    it('checked at the PLAY only: once on the table, the action works whoever rules', () => {
      const t = owned();
      expect(t.parliament.rulingParty()).not.eq(M);
      expect(t.card.canAct(t.p1)).is.true;
      t.card.action(t.p1);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });
  });

  describe('rule 2 — ANY player\'s city ON MARS adds 1 data here', () => {
    it('the owner\'s own city on Mars: +1', () => {
      const t = owned();
      addCity(t.p1);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });

    it('an opponent\'s city on Mars: +1, queued as the OPPONENT_TRIGGER', () => {
      const t = owned();
      addCity(t.p2);
      const mine = queued(t.game).filter((action) => action.player === t.p1);
      expect(mine.map((action) => action.priority)).deep.eq([Priority.OPPONENT_TRIGGER]);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });

    for (const slot of [SpaceName.GANYMEDE_COLONY, SpaceName.PHOBOS_SPACE_HAVEN]) {
      it(`an off-Mars city (${slot === SpaceName.GANYMEDE_COLONY ? 'Ganymede' : 'Phobos'}): nothing`, () => {
        const t = owned();
        const space = t.game.board.getSpaceOrThrow(slot);
        expect(space.spaceType).eq(SpaceType.COLONY);
        t.game.addCity(t.p1, space);
        runAllActions(t.game);
        expect(t.card.resourceCount).eq(0);
      });
    }

    it('the class «a tile pays a card»: ONE record per city, the placed cell the sender — the board plays it', () => {
      const t = owned();
      t.card.resourceCount = 2;
      const space = addCity(t.p2);
      runAllActions(t.game);
      const record = t.game.cardAdjacencyPayouts.at(-1);
      expect(record).deep.include({
        cause: 'tile-placed', color: t.p1.color, card: CardName.MARTIAN_CENSUS, spaceId: space.id,
        target: CardName.MARTIAN_CENSUS, amount: 1, before: 2,
      });
      expect(record?.neighbours).deep.eq([{spaceId: space.id, units: 1}]);
    });

    it('the Capital is a city: +1', () => {
      const t = owned();
      const space = t.game.board.getAvailableSpacesForCity(t.p2)[0];
      t.game.addTile(t.p2, space, {tileType: TileType.CAPITAL});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });

    it('a city tier stacked on one\'s own city (Skyscrapers — «you are placing a tile»): +1 more', () => {
      const t = owned();
      const space = addCity(t.p1);
      runAllActions(t.game);
      t.game.addCityTier(t.p1, space);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });

    it('a greenery or an ocean: nothing', () => {
      const t = owned();
      addGreenery(t.p1);
      addOcean(t.p1);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });

    it('the Moon is not Mars: a city-typed tile on the lunar board answers nothing', () => {
      const t = owned();
      const space = addCity(t.p2);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
      t.card.onTilePlaced(t.p1, t.p2, space, BoardType.MOON);
      runAllActions(t.game);
      expect(t.card.resourceCount, 'the same cell reported under the Moon board').eq(1);
    });
  });

  describe('the forecast twin — what a city play promises, and the live fan-out keeps it', () => {
    function forecastOf(player: TestPlayer, target: ImmigrantCity | GanymedeColony) {
      return effectForecastForPlay(player, target, cardPlayPreview(player, target))
        .facts.filter((f) => f.source.name === CardName.MARTIAN_CENSUS);
    }

    it('an opponent\'s Mars city play: one deferred fact on the owner\'s card, «+1 data (2 → 3)» — and the play lands there', () => {
      const t = owned();
      t.card.resourceCount = 2;
      t.p2.production.override({energy: 1});
      t.p2.megaCredits = 40;
      const city = new ImmigrantCity();
      t.p2.cardsInHand.push(city);
      const facts = forecastOf(t.p2, city);
      expect(facts).has.length(1);
      expect(facts[0].certainty).eq('deferred');
      expect(facts[0].recipient).deep.eq({kind: 'player', color: t.p1.color});
      expect(facts[0].sequence).eq(Priority.OPPONENT_TRIGGER);
      expect(facts[0].effects[0]).deep.include({direction: 'gain', icon: 'data', amount: 1, current: 2, resulting: 3});
      addCity(t.p2);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(3);
    });

    it('an off-Mars city play (Ganymede Colony): no fact — and the live play adds nothing', () => {
      const t = owned();
      t.p1.megaCredits = 40;
      const colony = new GanymedeColony();
      t.p1.cardsInHand.push(colony);
      expect(forecastOf(t.p1, colony)).deep.eq([]);
      t.p1.playCard(colony);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });
  });

  describe('rule 3–6 — the action: +1 data, OR 3 data → a delegate on a resolution', () => {
    it('A alone while B is refused: no prompt — the action IS +1 data', () => {
      const t = owned();
      t.card.resourceCount = 2;
      expect(t.card.action(t.p1), 'one live option is the whole action').is.undefined;
      expect(t.card.resourceCount).eq(3);
    });

    it('B is refused by ONE reason, in order: the data on the card, then the voting area, then the reserve', () => {
      const t = owned();
      t.card.resourceCount = 2;
      const reasonOf = () => actionPreview(t.p1, t.card).branches[1];
      expect(reasonOf().available).is.false;
      expect(reasonOf().unavailableReason).eq(CENSUS_SHORT_DATA_REASON);
      expect(reasonOf().unavailableReasonParams).deep.eq(['2']);
      expect(CENSUS_SHORT_DATA_REASON).eq('${0} of 3 data on this card');
      // Data enough, nothing up for a vote — and an empty reserve on top: the AREA is named.
      t.card.resourceCount = 3;
      while (t.parliament.reserve(t.p1) > 0) {
        t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      }
      const area = [...t.parliament.slots];
      t.parliament.slots = [];
      expect(reasonOf().unavailableReason).eq(POLITICAL_DONATION_NO_RESOLUTION_REASON);
      t.parliament.slots = area;
      expect(reasonOf().unavailableReason, 'a cube in the lobby does not lift it').eq(POLITICAL_DONATION_NO_DELEGATE_REASON);
      expect(t.parliament.lobby.has(t.p1.id)).is.true;
    });

    it('a refused B is SHOWN, never hidden: two branches, A then B', () => {
      const t = owned();
      const preview = actionPreview(t.p1, t.card);
      expect(preview.branches.map((b) => b.title)).deep.eq([CENSUS_ADD_TITLE, CENSUS_VOTE_TITLE]);
      expect(preview.branches.map((b) => b.available)).deep.eq([true, false]);
      expect(preview.branches[0].effects[0]).deep.include({direction: 'gain', icon: 'data', amount: 1, current: 0, resulting: 1});
    });

    it('B at 3 data: an OrOptions with the card as its giver; B raises the SHARED grant (the card is its giver), A is +1', () => {
      const t = owned();
      t.card.resourceCount = 3;
      const or = cast(t.card.action(t.p1), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([CENSUS_ADD_TITLE, CENSUS_VOTE_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.MARTIAN_CENSUS});
      cast(or.options[1], SelectOption).cb(undefined);
      runAllActions(t.game);
      const select = cast(t.p1.getWaitingFor(), SelectParty);
      expect(select.votePrompt).deep.include({source: 'grant', cost: 0, count: 1, printed: 1});
      expect(select.votePrompt?.support, 'no Popular Support on the census').is.undefined;
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.MARTIAN_CENSUS}, mode: 'reward'});
      expect(t.card.resourceCount, 'nothing spent before the answer').eq(3);
    });

    it('B answered: the data leave and the cube lands in ONE answer — from the RESERVE, the lobby untouched', () => {
      const t = owned();
      const {game, p1, parliament, card} = t;
      card.resourceCount = 4;
      const reserve = parliament.reserve(p1);
      const or = cast(card.action(p1), OrOptions);
      cast(or.options[1], SelectOption).cb(undefined);
      runAllActions(game);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(parliament.votesOf(p1, parliament.slots[1])).eq(1);
      expect(parliament.reserve(p1)).eq(reserve - 1);
      expect(parliament.lobby.has(p1.id), 'the lobby\'s cube is not the card\'s to spend').is.true;
      expect(p1.totalDelegatesPlaced).eq(1);
      parliament.assertLedger(game);
    });

    it('rule 5 — the card\'s delegate is ordinary: a second one on Mars First\'s resolution opens its effect AND its requirement', () => {
      const t = owned();
      const {p1, parliament, card} = t;
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      card.resourceCount = 3;
      const or = cast(card.action(p1), OrOptions);
      cast(or.options[1], SelectOption).cb(undefined);
      runAllActions(t.game);
      p1.process({type: 'party', partyName: M});
      expect(parliament.access(p1, M)).deep.include({byDelegates: true, satisfiesRequirement: true});
    });

    it('«paid and placed nothing» is impossible: a reserve emptied between the ask and the answer charges NOTHING', () => {
      const t = owned();
      const {p1, parliament, card, game} = t;
      card.resourceCount = 3;
      const or = cast(card.action(p1), OrOptions);
      cast(or.options[1], SelectOption).cb(undefined);
      runAllActions(game);
      while (parliament.reserve(p1) > 0) {
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
      }
      const before = parliament.votesOf(p1, parliament.slots[1]);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(parliament.votesOf(p1, parliament.slots[1])).eq(before);
      expect(card.resourceCount, 'the price was never charged').eq(3);
    });

    it('…and so is a price the card no longer holds at the answer: no data, no cube', () => {
      const t = owned();
      const {p1, parliament, card, game} = t;
      card.resourceCount = 3;
      const or = cast(card.action(p1), OrOptions);
      cast(or.options[1], SelectOption).cb(undefined);
      runAllActions(game);
      card.resourceCount = 2;
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(parliament.votesOf(p1)).eq(0);
      expect(card.resourceCount).eq(2);
    });

    it('the preview: B carries the data leaving, the delegate leaving the reserve and the DOOR — the very prompt the action raises', () => {
      const t = owned();
      const {p1, card, game} = t;
      card.resourceCount = 3;
      const preview = actionPreview(p1, card);
      const b = preview.branches[1];
      expect(b.available).is.true;
      expect(preview.branches.map((x) => x.index), 'two live options → OrOptions indices in order').deep.eq([0, 1]);
      expect(b.effects[0]).deep.include({direction: 'cost', icon: 'data', amount: 3, current: 3, resulting: 0});
      expect(b.effects[1]).deep.include({direction: 'cost', icon: 'delegate', amount: 1});
      const door = b.steps.find((s) => s.kind === 'delegateGrant');
      if (door === undefined || door.kind !== 'delegateGrant') {
        throw new Error('no delegateGrant door on B');
      }
      expect(door.staged.sourceCard).eq(CardName.MARTIAN_CENSUS);
      expect(door.staged.prompt).deep.eq(censusGrant(p1, card, DATA_CENSUS).previewSelectParty());
      // …field for field the live grant's model.
      const or = cast(card.action(p1), OrOptions);
      cast(or.options[1], SelectOption).cb(undefined);
      runAllActions(game);
      const live = p1.getWaitingFor()!.toModel(p1);
      expect(live.type).eq('party');
      expect({...live, choiceContext: undefined}).deep.eq({...door.staged.prompt, choiceContext: undefined});
    });

    it('the preview is read-only: the game serializes identically before and after', () => {
      const t = owned();
      t.card.resourceCount = 3;
      const before = JSON.stringify(t.game.serialize());
      actionPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });

    it('rule 6 — once per generation: the used action is not offered again', () => {
      const t = owned();
      const {p1, game} = t;
      p1.actionsThisGeneration.add(CardName.MARTIAN_CENSUS);
      expect(p1.getPlayableActionCards().map((c) => c.name)).not.includes(CardName.MARTIAN_CENSUS);
      game.phase = Phase.ACTION;
      p1.actionsThisGeneration.clear();
      expect(p1.getPlayableActionCards().map((c) => c.name)).includes(CardName.MARTIAN_CENSUS);
    });
  });

  it('rule 7 — data here are ordinary card resources: a data holder for «data on ANY card»', () => {
    const t = owned();
    expect(t.p1.getResourceCards(CardResource.DATA).map((c) => c.name)).includes(CardName.MARTIAN_CENSUS);
  });

  it('save / load: the stored data survive a round trip, and the card still acts', () => {
    const t = owned();
    t.card.resourceCount = 5;
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const again = reloaded.getPlayerById(t.p1.id);
    const census = again.tableau.get(CardName.MARTIAN_CENSUS);
    expect(census?.resourceCount).eq(5);
    expect((census as MartianCensus).canAct(again)).is.true;
  });
});
