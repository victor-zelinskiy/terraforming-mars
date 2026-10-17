import {expect} from 'chai';
import {
  FLOATERS_ON_PLAY, FLOATERS_PER_GREENERY, FLOATING_BIODOMES_FLOATER_TITLE, FLOATING_BIODOMES_GREENERY_TITLE, FloatingBiodomes,
  PLANTS_PER_FLOATER, VENUS_REQUIRED,
} from '../../../src/server/cards/turmoilRedux/FloatingBiodomes';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {TitanShuttles} from '../../../src/server/cards/colonies/TitanShuttles';
import {Herbivores} from '../../../src/server/cards/base/Herbivores';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {MorningStarInc} from '../../../src/server/cards/venusNext/MorningStarInc';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {MAX_OXYGEN_LEVEL} from '../../../src/common/constants';
import {Payment} from '../../../src/common/inputs/Payment';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {effectForecastForAction} from '../../../src/server/models/effectForecast';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {holderActionGoodOf} from '../../../src/server/cards/holderActionGood';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {StagedPlacementModel} from '../../../src/common/models/ActionPreviewModel';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions, setOxygenLevel, setVenusScaleLevel} from '../../TestingUtils';

/**
 * TR69 — FLOATING BIODOMES: the set's second floater holder and the first
 * `or`-action of the Local Shading class whose B pays a TILE. Every rule
 * reading of the card file's header is pinned here: the Venus plate, the
 * play's two floaters, the two variants and what the ENGINE answers for each
 * configuration, A's target filter (a Venus card — this one included, always
 * asked), B's greenery raising the oxygen ONCE (and nothing at the maximum),
 * the staged greenery the declarative builder hands the composer, the
 * holder's TILE role, the payments and the triggers, save / load.
 */
const COST = 10;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, card: FloatingBiodomes};

/** A two-seat Redux + Venus table in the action phase, the Venus scale at 10 %. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  setVenusScaleLevel(game, VENUS_REQUIRED);
  return {game, player, opponent, card: new FloatingBiodomes()};
}

/** The card on the player's table with `floaters` here and the player at `plants`. */
function owned(t: Table, floaters: number, plants: number): Table {
  t.player.playedCards.push(t.card);
  t.card.resourceCount = floaters;
  t.player.plants = plants;
  return t;
}

/** The blue card's action from the action menu, every deferred step run. */
function act(t: Table): void {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name)).to.include(CardName.FLOATING_BIODOMES);
  door.cb([t.card]);
  runAllActions(t.game);
}

/** The staged payload of the preview's greenery step, with its branch. */
function stagedGreenery(t: Table): {branchIndex: number, staged: StagedPlacementModel} | undefined {
  for (const branch of actionPreview(t.player, t.card).branches) {
    for (const step of branch.steps) {
      if (step.kind === 'boardPlacement' && step.staged !== undefined) {
        return {branchIndex: branch.index, staged: step.staged};
      }
    }
  }
  return undefined;
}

describe('FloatingBiodomes', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 10, Plant + Venus, a floater holder, no VP, the Venus 10 % plate, TR69 — in the Redux manifest gated on Venus', () => {
      const card = t.card;
      expect(card.name).eq(CardName.FLOATING_BIODOMES);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.PLANT, Tag.VENUS]);
      expect(card.resourceType).eq(CardResource.FLOATER);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(card.requirements).has.length(1);
      expect(card.requirements[0]).deep.include({venus: VENUS_REQUIRED});
      expect(card.metadata.cardNumber).eq('TR69');
      expect(card.metadata.description).eq('Requires Venus 10%. Add 2 floater resources to this card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.FLOATING_BIODOMES];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'the Venus «V» at the bottom left').eq('venus');
      expect([FLOATERS_ON_PLAY, PLANTS_PER_FLOATER, FLOATERS_PER_GREENERY]).deep.eq([2, 1, 3]);
      // ONE declaration: no hook of its own — the preview, the reasons and the staged tile are the builder's.
      expect((card as ICard).actionPreview, 'no preview hook — the declaration stages its own tile').is.undefined;
      expect((card as ICard).actionUnavailableReason, 'no reason of its own').is.undefined;
      expect((card as ICard).onCardPlayed, 'no trigger').is.undefined;
    });

    it('the ACTION is ONE DECLARATION of the Local Shading class: an `or` of two titled variants in the printed order — B a TILE, no oxygen step beside it', () => {
      const action = t.card.actionBehavior;
      expect(action?.or?.autoSelect).is.true;
      expect(action?.or?.behaviors.map((b) => b.title)).deep.eq([FLOATING_BIODOMES_FLOATER_TITLE, FLOATING_BIODOMES_GREENERY_TITLE]);
      expect(action?.or?.behaviors[0]).deep.eq({
        spend: {plants: 1}, addResourcesToAnyCard: {type: CardResource.FLOATER, count: 1, tag: Tag.VENUS}, title: FLOATING_BIODOMES_FLOATER_TITLE,
      });
      expect(action?.or?.behaviors[1]).deep.eq({spend: {resourcesHere: 3}, greenery: {}, title: FLOATING_BIODOMES_GREENERY_TITLE});
      expect(action?.or?.behaviors[1].global, 'the greenery raises its own oxygen — a declared step would be a second').is.undefined;
      expect(Object.keys(action ?? {}), 'nothing beside the `or`').deep.eq(['or']);
    });

    it('the structured text prints the requirement, the two action rows of the `or` and the play\'s own line', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => [b.kind, b.text])).deep.eq([
        ['requirement', 'Requires Venus terraforming of at least 10%.'],
        ['action', 'Action: Pay 1 plant to add a floater resource to ANY Venus card.'],
        ['action', 'Action: Spend 3 floaters from here to place a greenery tile and increase oxygen 1 step.'],
        ['immediate', 'Add 2 floaters to this card.'],
      ]);
    });
  });

  describe('rule 1 — the requirement: the Venus scale at 10 % or more, at the play only', () => {
    beforeEach(() => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
    });

    it('Venus 8 %: refused with the scale\'s reason and its «now»; 10 %: playable', () => {
      setVenusScaleLevel(t.game, 8);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'globalParameter', globalParameter: 'venus', message: 'Requires Venus ${0}%', params: ['10'], current: 8, requirement: true,
      });
      setVenusScaleLevel(t.game, 10);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('Morning Star Inc. bends the Venus plate by its two steps: playable at 6 %', () => {
      setVenusScaleLevel(t.game, 6);
      expect(t.player.canPlay(t.card)).is.false;
      const corp = new MorningStarInc();
      corp.play(t.player);
      t.player.playedCards.push(corp);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('the ACTION works at any Venus: the plate is the play\'s', () => {
      t.player.cardsInHand.length = 0;
      owned(t, 0, 1);
      setVenusScaleLevel(t.game, 0);
      expect(t.card.canAct(t.player)).is.true;
    });
  });

  describe('rule 2 — the play: two floaters HERE, and the tags the card wears', () => {
    it('played for 10 M€: 2 floaters on this card, nothing asked', () => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = COST;
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(FLOATERS_ON_PLAY);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('a VENUS card: Dirigibles\' floaters pay for it (3 M€ each); a PLANT card: Decomposers takes a microbe', () => {
      const dirigibles = new Dirigibles();
      dirigibles.resourceCount = 3;
      const decomposers = new Decomposers();
      t.player.playedCards.push(dirigibles, decomposers);
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 1;
      expect(t.player.paymentOptionsForCard(t.card).floaters, 'the floater lane opens on a Venus card').is.true;
      expect(t.player.canPlay(t.card), '3 floaters (9 M€) + 1 M€').is.true;
      t.player.playCard(t.card, Payment.of({floaters: 3, megacredits: 1}));
      runAllActions(t.game);
      expect(dirigibles.resourceCount, 'the price left Dirigibles').eq(0);
      expect(t.card.resourceCount, 'the play\'s own floaters, untouched by the price').eq(FLOATERS_ON_PLAY);
      expect(decomposers.resourceCount, 'the plant tag woke Decomposers').eq(1);
    });
  });

  describe('rule 3 — ONE action, two variants, their availability (what the `or` engine answers)', () => {
    it('both live: an OrOptions in the printed order, marked as this card\'s effect choice; the preview\'s two branches index it', () => {
      owned(t, 3, 1);
      expect(t.card.action(t.player)).is.undefined;
      runAllActions(t.game);
      const or = cast(t.player.popWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([FLOATING_BIODOMES_FLOATER_TITLE, FLOATING_BIODOMES_GREENERY_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.FLOATING_BIODOMES});
      expect(or.choiceContext?.mode).eq('effect-choice');
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[0, true], [1, true]]);
    });

    it('A alone (plants, 2 floaters): no OrOptions — the action IS «1 plant → a floater», and the target is asked at once', () => {
      owned(t, 2, 1);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, true], [-1, false]]);
      t.card.action(t.player);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name), 'this card is a Venus floater holder').deep.eq([CardName.FLOATING_BIODOMES]);
    });

    it('B alone (3 floaters, no plants): no OrOptions — the board asks for the greenery\'s cell', () => {
      owned(t, 3, 0);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, false], [-1, true]]);
      t.card.action(t.player);
      runAllActions(t.game);
      cast(t.player.popWaitingFor(), SelectSpace);
    });

    it('both dead: the plants first, the floater count second — both named, both branches SHOWN', () => {
      owned(t, 2, 0);
      expect(t.card.canAct(t.player)).is.false;
      const reasons = actionUnavailableReasons(t.player, t.card);
      expect(reasons.map((r) => r.message)).deep.eq(['Not enough plants', '${0} of ${1} {floater|floaters} on this card']);
      expect(reasons[1]).deep.include({type: 'count', params: ['2', '3'], current: 2});
      const branches = actionPreview(t.player, t.card).branches;
      expect(branches.map((b) => b.available)).deep.eq([false, false]);
      expect(branches[0].unavailableReason).eq('Not enough plants');
      expect(branches[1].unavailableReasonParams, '«2 of 3 floaters» (PL-197)').deep.eq(['2', '3']);
      expect(branches[1].effects[0], 'the refused variant still shows its price').deep.include({icon: 'floater', amount: 3, current: 2});
    });
  });

  describe('rule 4 — A: 1 plant → a floater onto ANY Venus card, this one included, always asked', () => {
    it('the candidates are the Venus floater holders (this card, Dirigibles) — never a non-Venus one (Titan Shuttles)', () => {
      owned(t, 0, 1);
      const dirigibles = new Dirigibles();
      t.player.playedCards.push(dirigibles, new TitanShuttles());
      act(t);
      const pick = cast(t.player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.FLOATING_BIODOMES, CardName.DIRIGIBLES]);
      pick.cb([dirigibles]);
      runAllActions(t.game);
      expect([t.player.plants, dirigibles.resourceCount, t.card.resourceCount]).deep.eq([0, 1, 0]);
      expect(t.player.actionsThisGeneration.has(CardName.FLOATING_BIODOMES)).is.true;
    });

    it('the preview\'s A carries the plant cost and the target step (the pick always asked — one candidate too)', () => {
      owned(t, 0, 1);
      const [a] = actionPreview(t.player, t.card).branches;
      expect(a.effects[0]).deep.include({direction: 'cost', icon: 'plants', amount: 1, current: 1, resulting: 0});
      expect(a.effects[1]).deep.include({direction: 'gain', icon: 'floater', amount: 1, note: 'to a card'});
      expect(a.steps.map((s) => s.kind)).deep.eq(['input']);
    });
  });

  describe('rule 5 — B: 3 floaters → a greenery that raises the oxygen ONCE', () => {
    it('floaters 3 → 0, a greenery of the player\'s on the chosen cell, oxygen +1 ONCE; TR +2 — the oxygen step and the Redux greenery tile', () => {
      owned(t, 3, 0);
      const oxygen = t.game.getOxygenLevel();
      const tr = t.player.terraformRating;
      act(t);
      const select = cast(t.player.popWaitingFor(), SelectSpace);
      const space = select.spaces[0];
      select.cb(space);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
      expect(space.tile?.tileType).eq(TileType.GREENERY);
      expect(space.player).eq(t.player);
      expect(t.game.getOxygenLevel(), 'one step — the tile\'s own').eq(oxygen + 1);
      expect(t.player.terraformRating, 'the oxygen step + the greenery tile\'s own TR (the Redux greenery revision)').eq(tr + 2);
    });

    it('at the oxygen MAXIMUM: the tile is still placed, the oxygen does not rise — the tile\'s own TR stays; the action is NOT futile', () => {
      owned(t, 3, 0);
      setOxygenLevel(t.game, MAX_OXYGEN_LEVEL);
      const tr = t.player.terraformRating;
      expect(actionFutility(t.player, t.card), 'a greenery\'s tile is a yield at any oxygen').is.undefined;
      act(t);
      const select = cast(t.player.popWaitingFor(), SelectSpace);
      const space = select.spaces[0];
      select.cb(space);
      runAllActions(t.game);
      expect(space.tile?.tileType).eq(TileType.GREENERY);
      expect(t.game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      expect(t.player.terraformRating, 'only the Redux greenery tile\'s own TR').eq(tr + 1);
    });

    it('no legal cell: B is refused with the PLACEMENT reason', () => {
      owned(t, 3, 0);
      t.game.board.getAvailableSpacesForType = () => [];
      const branches = actionPreview(t.player, t.card).branches;
      expect(branches[1].available).is.false;
      expect(actionUnavailableReasons(t.player, t.card).map((r) => r.message)).to.include('No space available for the tile');
    });
  });

  describe('rule 6 — the greenery is STAGED from the composer (D5), the declaration\'s own', () => {
    it('B carries the staged board payload, A none; the staged prompt mirrors the live PlaceGreeneryTile byte for byte', () => {
      owned(t, 3, 1);
      const found = stagedGreenery(t);
      expect(found, 'the greenery stages').is.not.undefined;
      expect(found!.branchIndex, 'B is the SECOND runtime option').eq(1);
      const preview = actionPreview(t.player, t.card);
      expect(preview.branches[0].steps.some((s) => s.kind === 'boardPlacement'), 'A places nothing').is.false;
      expect(found!.staged.tileType).eq(TileType.GREENERY);
      expect(found!.staged.sourceCard).eq(CardName.FLOATING_BIODOMES);
      // The live prompt: B answered, the greenery's SelectSpace.
      t.card.action(t.player);
      runAllActions(t.game);
      cast(t.player.popWaitingFor(), OrOptions).options[1].cb(undefined);
      runAllActions(t.game);
      const live = cast(t.player.popWaitingFor(), SelectSpace);
      expect(found!.staged.spaces.slice().sort(), 'the same legal cells')
        .deep.eq(live.spaces.map((s) => s.id).slice().sort());
    });

    it('a staged answer is ONE POST: [B, the cell] lands the greenery with nothing asked after', () => {
      owned(t, 3, 1);
      const found = stagedGreenery(t)!;
      const cellId = found.staged.spaces[0];
      t.card.action(t.player);
      runAllActions(t.game);
      cast(t.player.getWaitingFor(), OrOptions);
      t.player.process({type: 'or', index: found.branchIndex, response: {type: 'option'}});
      runAllActions(t.game);
      t.player.process({type: 'space', spaceId: cellId});
      runAllActions(t.game);
      expect(t.game.board.getSpaceOrThrow(cellId).tile?.tileType).eq(TileType.GREENERY);
      expect(t.player.getWaitingFor()).is.undefined;
    });
  });

  describe('rule 7 — the holder\'s ROLE: three floaters here buy a TILE', () => {
    it('the action good is {spend 3 → a greenery tile} (A spends plants, not floaters — ignored)', () => {
      expect(holderActionGoodOf(t.card)).deep.eq({spend: FLOATERS_PER_GREENERY, good: {kind: 'tile', tile: 'greenery'}});
    });
  });

  describe('rule 9 — the table answers the greenery: the forecast files it under B', () => {
    it('Herbivores (a greenery the player places → +1 animal) answers B, never A', () => {
      owned(t, 3, 1);
      t.player.playedCards.push(new Herbivores());
      const forecast = effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      const onA = (forecast.byBranch?.[0] ?? []).filter((f) => f.source.kind === 'card' && f.source.name === CardName.HERBIVORES);
      const onB = (forecast.byBranch?.[1] ?? []).filter((f) => f.source.kind === 'card' && f.source.name === CardName.HERBIVORES);
      expect(onA, JSON.stringify(forecast)).is.empty;
      expect(onB, JSON.stringify(forecast)).is.not.empty;
    });
  });

  describe('save / reload', () => {
    it('the stored floaters and the spent action survive serialization', () => {
      owned(t, 4, 0);
      t.player.actionsThisGeneration.add(CardName.FLOATING_BIODOMES);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      const card = again.playedCards.get(CardName.FLOATING_BIODOMES) as IProjectCard | undefined;
      expect(card?.resourceCount).eq(4);
      expect(again.actionsThisGeneration.has(CardName.FLOATING_BIODOMES)).is.true;
    });
  });
});
