import {expect} from 'chai';
import {EnceladeanIncubator, MICROBES_ADDED} from '../../../src/server/cards/turmoilRedux/EnceladeanIncubator';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {IoMiningIndustries} from '../../../src/server/cards/base/IoMiningIndustries';
import {TopsoilContract} from '../../../src/server/cards/promo/TopsoilContract';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Space} from '../../../src/server/boards/Space';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';
import {MAX_OCEAN_TILES} from '../../../src/common/constants';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {playPreviewWithTableQuestions} from '../../../src/server/models/tableQuestions';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {allForecastFacts} from '../../../src/common/models/EffectForecastModel';
import {SKIP_REASON, skippedAddToCard} from '../../../src/server/cards/actionPreviews';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {replayBatch, parkedBatchTailLength} from '../../../src/server/inputs/deferredInputBatch';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {maxOutOceans, runAllActions} from '../../TestingUtils';

/**
 * TR67 — ENCELADEAN INCUBATOR: an ocean and four microbes onto ANY own card as
 * ONE declaration, Jovian + Space, a fixed 2 VP. Every rule reading of the card
 * file's header is pinned here on the real card: the face, no requirement, the
 * microbes' question FIRST (one holder still asked, a rival's card never
 * offered, no holder a named skip), the ordinary ocean (TR, the adjacency
 * money, nine oceans named before the press), the tags (Io Mining Industries,
 * titanium, EVA Mechs' mechs), the table's answer (Topsoil Contract), the
 * composer's reading and the batch landing whole, save / load.
 */
const COST = 23;
const ID = CardName.ENCELADEAN_INCUBATOR;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, card: EnceladeanIncubator};

/** A two-seat Redux table in the action phase, the card in hand, enough M€, a microbe holder on the table (unless asked otherwise). */
function table(opts: {holder?: boolean} = {}): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, aresHazards: false});
  game.phase = Phase.ACTION;
  const card = new EnceladeanIncubator();
  player.cardsInHand.push(card);
  player.megaCredits = 30;
  if (opts.holder !== false) {
    player.playedCards.push(new Tardigrades());
  }
  return {game, player, opponent, card};
}

const events = (game: IGame) => game.events.serialize().events;
const skips = (game: IGame) => events(game).filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);

function play(t: Table): void {
  t.player.playCard(t.card, Payment.of({megacredits: COST}));
  runAllActions(t.game);
}

function answerWith(t: Table, prompt: SelectSpace | SelectCard<ICard>, response: InputResponse): void {
  prompt.process(response as never);
  runAllActions(t.game);
}

/** The microbes' pick stands first: answer it onto the named card. */
function answerMicrobes(t: Table, target: CardName): SelectCard<ICard> {
  const pick = cast(t.player.popWaitingFor(), SelectCard);
  answerWith(t, pick, {type: 'card', cards: [target]});
  return pick;
}

/** The card's OWN ocean (addressed by its sourceCard): the named or the first legal reserve. */
function answerOcean(t: Table, space?: Space): Space {
  const prompt = cast(t.player.popWaitingFor(), SelectSpace);
  expect(prompt.sourceCard, 'the card\'s own placement carries its address').eq(ID);
  const cell = space ?? prompt.spaces[0];
  expect(prompt.spaces.map((s) => s.id)).includes(cell.id);
  answerWith(t, prompt, {type: 'space', spaceId: cell.id});
  return cell;
}

describe('EnceladeanIncubator', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a green AUTOMATED card for 23, Jovian + Space, 2 VP, no requirement, TR67 — in the Redux manifest without compatibility', () => {
      const c = t.card;
      expect(c.name).eq(ID);
      expect(c.type).eq(CardType.AUTOMATED);
      expect(c.cost).eq(COST);
      expect(c.tags, 'the printed order: the banded planet, then the star').deep.eq([Tag.JOVIAN, Tag.SPACE]);
      expect(c.victoryPoints).eq(2);
      expect(c.resourceType).is.undefined;
      expect(c.requirements, 'the MIN plate is empty').deep.eq([]);
      expect(c.metadata.cardNumber).eq('TR67');
      expect(c.metadata.description).eq('Place an ocean tile. Add 4 microbes to ANY card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
      expect(entry).is.not.undefined;
      expect(entry.compatibility).is.undefined;
      expect(MICROBES_ADDED).eq(4);
    });

    it('the face reads the scan: «[ocean] [microbe]×4 *» — four squares, no digit', () => {
      type Node = {type?: string, amount?: number, showDigit?: boolean, resource?: string};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows).has.length(1);
      expect(rows[0].map((n) => n.type)).deep.eq([CardRenderItemType.OCEANS, CardRenderItemType.NBSP, CardRenderItemType.RESOURCE, CardRenderSymbolType.ASTERIX]);
      const microbes = rows[0][2];
      expect(microbes.resource).eq(CardResource.MICROBE);
      expect(microbes.amount).eq(4);
      expect(microbes.showDigit, 'four printed squares, never «4 [microbe]»').is.undefined;
    });
  });

  describe('rule 1 — no requirement', () => {
    it('plays under every ruling party', () => {
      const parliament = t.game.parliament!;
      for (const party of [PartyName.REDS, PartyName.GREENS, PartyName.SCIENTISTS, PartyName.UNITY, PartyName.INDUSTRIALISTS, PartyName.MARS] as const) {
        seatEnacted(parliament, quietResolutionOf(party));
        expect(t.player.canPlay(t.card), `under ${party}`).is.not.false;
      }
    });
  });

  describe('rules 2–4 — the microbes asked first, then the ordinary ocean', () => {
    it('asks the microbes\' target BEFORE the ocean, lands 4 on the chosen card, places the ocean with its TR and adjacency money', () => {
      const decomposers = new Decomposers();
      t.player.playedCards.push(decomposers);
      // An ocean already on the board: the next one beside it pays +2 M€.
      const reserves = t.game.board.getAvailableSpacesForOcean(t.player);
      const first = reserves.find((r) => t.game.board.getAdjacentSpaces(r).some((s) => reserves.includes(s)))!;
      const neighbour = t.game.board.getAdjacentSpaces(first).find((s) => reserves.includes(s));
      first.tile = {tileType: TileType.OCEAN};
      expect(neighbour, 'an empty ocean reserve beside the seated ocean').is.not.undefined;
      // The Scientists rule: the Greens' «+2 M€ per TR» passive would ride the ocean's rating.
      seatEnacted(t.game.parliament!, quietResolutionOf(PartyName.SCIENTISTS));
      const tr = t.player.terraformRating;
      play(t);
      const mc = t.player.megaCredits;
      const pick = answerMicrobes(t, CardName.DECOMPOSERS);
      expect(pick.cards.map((c) => c.name).sort(), 'the player\'s OWN microbe holders').deep.eq([CardName.DECOMPOSERS, CardName.TARDIGRADES].sort());
      expect(decomposers.resourceCount).eq(MICROBES_ADDED);
      answerOcean(t, neighbour);
      expect(t.game.board.getSpaceOrThrow(neighbour!.id).tile?.tileType).eq(TileType.OCEAN);
      expect(t.player.terraformRating).eq(tr + 1);
      expect(t.player.megaCredits, '+2 M€ for the adjacent ocean').eq(mc + 2);
      expect(skips(t.game)).deep.eq([]);
    });

    it('one holder is still a question — never chosen for the player', () => {
      play(t);
      const pick = cast(t.player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      answerWith(t, pick, {type: 'card', cards: [CardName.TARDIGRADES]});
      expect(t.player.playedCards.get(CardName.TARDIGRADES)!.resourceCount).eq(MICROBES_ADDED);
      answerOcean(t);
    });

    it('a rival\'s microbe holder is never offered', () => {
      t.opponent.playedCards.push(new Decomposers());
      play(t);
      const pick = cast(t.player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
    });

    it('with no microbe holder the microbes are skipped BY NAME and the ocean is still placed', () => {
      t = table({holder: false});
      const tr = t.player.terraformRating;
      play(t);
      answerOcean(t);
      expect(t.player.terraformRating).eq(tr + 1);
      expect(skips(t.game).map((s) => `${s?.label}:${s?.reason}`)).deep.eq([`Add resources to a card:${SKIP_REASON.noHolder}`]);
      expect(skips(t.game)[0]?.effect).deep.eq(skippedAddToCard(CardResource.MICROBE, MICROBES_ADDED).effect);
    });

    it('nine oceans: the warning is NAMED before the press, the card plays, no placement and no TR — the microbes and the 2 VP stay', () => {
      maxOutOceans(t.player, MAX_OCEAN_TILES);
      expect(t.player.canPlay(t.card)).is.not.false;
      expect(t.card.warnings).includes('maxoceans');
      const tr = t.player.terraformRating;
      play(t);
      answerMicrobes(t, CardName.TARDIGRADES);
      expect(t.player.popWaitingFor(), 'no ocean prompt at nine').is.undefined;
      expect(t.player.terraformRating).eq(tr);
      expect(t.player.playedCards.has(ID)).is.true;
      expect(t.card.getVictoryPoints(t.player)).eq(2);
    });
  });

  describe('rule 5 — the tags', () => {
    it('the Jovian tag counts for Io Mining Industries', () => {
      const io = new IoMiningIndustries();
      t.player.playedCards.push(io);
      const before = io.getVictoryPoints(t.player);
      play(t);
      expect(io.getVictoryPoints(t.player)).eq(before + 1);
    });

    it('the Space tag: titanium pays, EVA Mechs\' mechs pay', () => {
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.titanium).is.true;
      expect(options.mechs, 'the `mechs` unit pays for a Space card').is.true;
      t.player.playedCards.push(new EvaMechs());
      expect(t.player.paymentOptionsForCard(t.card).mechs).is.true;
    });
  });

  describe('rule 6 — the table answers the microbes', () => {
    it('Topsoil Contract pays 1 M€ per microbe gained (4 M€) — and the forecast names it before the press', () => {
      t.player.playedCards.push(new TopsoilContract());
      const forecast = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card));
      expect(allForecastFacts(forecast).map((f) => f.source.name)).includes(CardName.TOPSOIL_CONTRACT);
      play(t);
      const mc = t.player.megaCredits;
      answerMicrobes(t, CardName.TARDIGRADES);
      expect(t.player.megaCredits).eq(mc + MICROBES_ADDED);
    });
  });

  describe('rule 7 — 2 VP', () => {
    it('a fixed 2 VP once played', () => {
      play(t);
      answerMicrobes(t, CardName.TARDIGRADES);
      answerOcean(t);
      expect(t.card.getVictoryPoints(t.player)).eq(2);
    });
  });

  describe('rule 8 — the composer\'s reading and the batch', () => {
    it('the preview is the declaration\'s: the microbes\' pick, then the staged ocean', () => {
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      const branch = preview.branches[0];
      expect(branch.steps.map((s) => s.kind)).deep.eq(['input', 'boardPlacement']);
      const placement = branch.steps[1];
      expect(placement.kind === 'boardPlacement' && placement.staged !== undefined, 'the ocean is staged').is.true;
      expect(branch.effects.some((e) => e.direction === 'gain' && e.icon === 'microbe' && e.amount === MICROBES_ADDED), 'the microbes\' chip').is.true;
    });

    it('without a holder the preview names the loss instead of a gain chip', () => {
      t = table({holder: false});
      const branch = cardPlayPreview(t.player, t.card).branches[0];
      expect(branch.steps.map((s) => s.kind)).deep.eq(['note', 'boardPlacement']);
      const note = branch.steps[0];
      expect(note.kind === 'note' && note.skipped?.label).eq(skippedAddToCard(CardResource.MICROBE, MICROBES_ADDED).label);
    });

    it('the batch `[play, {card}, {space, staged}]` lands whole', () => {
      const preview = playPreviewWithTableQuestions(t.player, t.card);
      const placement = preview.branches[0].steps.find((s) => s.kind === 'boardPlacement');
      const staged = placement?.kind === 'boardPlacement' ? placement.staged : undefined;
      expect(staged).is.not.undefined;
      const cell = staged!.spaces[0];
      t.player.takeAction();
      const menu = cast(t.player.getWaitingFor(), OrOptions);
      const index = menu.options.findIndex((o) => o.title === 'Play project card');
      const batch: Array<InputResponse> = [
        {type: 'or', index, response: {type: 'projectCard', card: ID, payment: Payment.of({megacredits: COST})}},
        {type: 'card', cards: [CardName.TARDIGRADES]},
        {type: 'space', spaceId: cell, stagedFor: ID} as InputResponse,
      ];
      replayBatch(t.player, batch);
      expect(parkedBatchTailLength(t.player), 'nothing parked').eq(0);
      expect(t.player.playedCards.get(CardName.TARDIGRADES)!.resourceCount).eq(MICROBES_ADDED);
      expect(t.game.board.getSpaceOrThrow(cell).tile?.tileType).eq(TileType.OCEAN);
    });

    it('the preview is pure', () => {
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.player, t.card);
      playPreviewWithTableQuestions(t.player, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('rule 10 — save / load', () => {
    it('the played card, the microbes and the ocean survive a reload', () => {
      play(t);
      answerMicrobes(t, CardName.TARDIGRADES);
      const cell = answerOcean(t);
      const copy = Game.deserialize(structuredClone(t.game.serialize()));
      const seat = copy.getPlayerById(t.player.id);
      expect(seat.playedCards.has(ID)).is.true;
      expect(seat.playedCards.get(CardName.TARDIGRADES)!.resourceCount).eq(MICROBES_ADDED);
      expect(copy.board.getSpaceOrThrow(cell.id).tile?.tileType).eq(TileType.OCEAN);
      expect(seat.playedCards.get(ID)!.getVictoryPoints(seat)).eq(2);
    });
  });
});
