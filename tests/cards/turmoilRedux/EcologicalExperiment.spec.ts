import {expect} from 'chai';
import {
  DATA_ADDED, EcologicalExperiment, OCEANS_AT_MAX_NOT_LOWERED_REASON, REMOVAL_REASON,
} from '../../../src/server/cards/turmoilRedux/EcologicalExperiment';
import {Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {Capital} from '../../../src/server/cards/base/Capital';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Space} from '../../../src/server/boards/Space';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {SpaceId} from '../../../src/common/Types';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../../src/common/constants';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {playPreviewWithTableQuestions} from '../../../src/server/models/tableQuestions';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {allForecastFacts} from '../../../src/common/models/EffectForecastModel';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {SKIP_REASON, STAYS_AT_MAXIMUM_NOTE, THEN_PHASE, NET_PHASE, REMOVE_ANY_OCEAN_NOTE, OCEAN_REMOVAL_NEXT_STEP} from '../../../src/server/cards/actionPreviews';
import {REMOVE_OCEAN_TITLE} from '../../../src/server/deferredActions/RemoveOceanTile';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {replayBatch, parkedBatchTailLength} from '../../../src/server/inputs/deferredInputBatch';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../../TestingUtils';

/**
 * TR47 — ECOLOGICAL EXPERIMENT: the Scientists' plate over the set's first
 * «UP AND BACK». Every rule reading of the card file's header is pinned here
 * on the real card: the face, the plate's two roads, the raise as ONE
 * declaration (the data pick first, the staged ocean), the fall as the card's
 * tail (the removal asked, the lowering with the player as author, everything
 * the raise gave standing), the three tables (below the maximum / at it / the
 * cascade), the record the board scene plays, the composer's two phases, the
 * batch landing whole, the journal, save / load. The class itself —
 * `Game.lowerParameters`, `RemoveOceanTile`, the ring — is pinned card-free
 * in tests/game/ParameterSwing.spec.ts.
 */
const S = PartyName.SCIENTISTS;
const COST = 18;
const ID = CardName.ECOLOGICAL_EXPERIMENT;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: EcologicalExperiment};

/** A two-seat Redux table in the action phase, the Scientists RULING by an enacted card, the card in hand, a data holder on the table. */
function table(opts: {holder?: boolean} = {}): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, aresHazards: false});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  const card = new EcologicalExperiment();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  if (opts.holder !== false) {
    player.playedCards.push(new Supercomputer());
  }
  return {game, player, opponent, parliament, card};
}

/** An ocean seated WITHOUT the parameter's train — the arrangement, never the rule. */
function seatOcean(space: Space): Space {
  space.tile = {tileType: TileType.OCEAN};
  space.player = undefined;
  return space;
}

/** N plain oceans on the first ocean reserves, seated. */
function seatOceans(t: Table, n: number): Array<Space> {
  const reserves = t.game.board.getAvailableSpacesForOcean(t.player).slice(0, n);
  return reserves.map((s) => seatOcean(s));
}

const holder = (t: Table) => t.player.playedCards.get(CardName.SUPERCOMPUTER) as IProjectCard;

function play(t: Table): void {
  t.player.playCard(t.card, Payment.of({megacredits: COST}));
  runAllActions(t.game);
}

/**
 * THE PROMPTS ARE ANSWERED AS THE ROUTE ANSWERS THEM: the pending input is taken off the player (`popWaitingFor`),
 * processed, and the queue drained to the next prompt — never a second drain over a prompt still standing (that pops
 * the actions queued BEHIND it and overwrites the prompt: the removal's step waits at the back of the line).
 */
function answerWith(t: Table, prompt: SelectSpace | SelectCard<ICard>, response: InputResponse): void {
  prompt.process(response as never);
  runAllActions(t.game);
}

/** The data pick stands first: answer it onto the Supercomputer. */
function answerData(t: Table): void {
  const pick = cast(t.player.popWaitingFor(), SelectCard);
  expect(pick.cards.map((c) => c.name), 'the data holders — the player\'s own').includes(CardName.SUPERCOMPUTER);
  expect(pick.cards.every((c) => t.player.playedCards.has(c.name)), 'never a rival\'s card').is.true;
  answerWith(t, pick, {type: 'card', cards: [CardName.SUPERCOMPUTER]});
}

/** The card's OWN ocean (addressed by its sourceCard): the first legal reserve. Returns the cell. */
function answerOcean(t: Table): Space {
  const prompt = cast(t.player.popWaitingFor(), SelectSpace);
  expect(prompt.sourceCard, 'the card\'s own placement carries its address').eq(ID);
  expect(prompt.placementEffect ?? 'tile').eq('tile');
  const cell = prompt.spaces[0];
  answerWith(t, prompt, {type: 'space', spaceId: cell.id});
  return cell;
}

function removalPrompt(t: Table): SelectSpace {
  const prompt = cast(t.player.popWaitingFor(), SelectSpace);
  expect(prompt.placementEffect, 'the removal, marked').eq('remove');
  return prompt;
}

function answerRemoval(t: Table, prompt: SelectSpace, spaceId: string): void {
  answerWith(t, prompt, {type: 'space', spaceId: spaceId as SpaceId});
}

function expectTurnGoesOn(t: Table): void {
  expect(t.player.getWaitingFor(), 'no prompt of the card stands').is.undefined;
}

const events = (game: IGame) => game.events.serialize().events;
const skips = (game: IGame) => events(game).filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
const lowerings = (game: IGame) => events(game).filter((e) => e.type === 'global-parameter-changed' && (e.impact.globalParameter?.steps ?? 0) < 0);
const logs = (game: IGame) => game.gameLog.map((m) => formatMessage(m));

describe('EcologicalExperiment', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a red EVENT for 18, Science + Plant, no VP, the SCIENTISTS\' plate, TR47 — in the Redux manifest without compatibility', () => {
      const c = t.card;
      expect(c.name).eq(ID);
      expect(c.type).eq(CardType.EVENT);
      expect(c.cost).eq(COST);
      expect(c.tags).deep.eq([Tag.SCIENCE, Tag.PLANT]);
      expect(c.victoryPoints).is.undefined;
      expect(c.resourceType).is.undefined;
      expect(requiredPartyOf(c), 'the MIN plate holds the Scientists\' flask — a requirement, not a tag').eq(S);
      expect(c.metadata.cardNumber).eq('TR47');
      expect(c.metadata.description).eq('Requires the Scientists to be ruling or that you have 2 delegates there. Increase each Mars global parameter 1 step, and add 3 data resources to ANY card. Then decrease each Mars global parameter that isn\'t at maximum by 1 step. (Remove any ocean you like; keep the TR you gained.)');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
      expect(entry).is.not.undefined;
      expect(entry.compatibility).is.undefined;
      expect(DATA_ADDED).eq(3);
    });

    it('the face reads the scan: «[O₂] [t°] [ocean] 3[data]*» then «THEN − [O₂] [t°] [ocean]» — two rows under the budget', () => {
      type Node = {type?: string, amount?: number, showDigit?: boolean, text?: string, isUppercase?: boolean, resource?: string};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows).has.length(2);
      const kinds = (row: Array<Node>) => row.map((n) => n.type);
      expect(kinds(rows[0])).deep.eq([CardRenderItemType.OXYGEN, CardRenderItemType.TEMPERATURE, CardRenderItemType.OCEANS, CardRenderItemType.NBSP, CardRenderItemType.RESOURCE, CardRenderSymbolType.ASTERIX]);
      const data = rows[0][4];
      expect(data.resource).eq(CardResource.DATA);
      expect(data.amount, 'a digit and ONE data square').eq(3);
      expect(data.showDigit).is.true;
      expect(kinds(rows[1])).deep.eq([CardRenderItemType.TEXT, CardRenderItemType.NBSP, CardRenderSymbolType.MINUS, CardRenderItemType.OXYGEN, CardRenderItemType.TEMPERATURE, CardRenderItemType.OCEANS]);
      expect(rows[1][0].text).eq('THEN');
      expect(rows[1][0].isUppercase).is.true;
      const minus = rows[1].slice(3);
      expect(minus.every((n) => n.amount === 1), 'the fall draws the three Mars parameters once each').is.true;
    });

    it('the card information carries the two rows of the printed text, each with its tokens', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      expect(blocks).deep.eq([
        'Requires Scientists to be ruling or that you have 2 delegates on its resolution.',
        'Increase each Mars global parameter 1 step and add 3 data to ANY card.',
        'Decrease each Mars global parameter that isn\'t at maximum 1 step (remove any ocean you like). Keep the TR you gained.',
      ]);
      // Each row is described by its own block (the fall anchored on its printed «THEN», never on a free node of the
      // raise's row — `cardInformation` § «undescribed mechanic»).
      const rows = new Set(info?.groups.flatMap((g) => g.blocks.map((b) => b.graphicId)).filter((id) => id?.startsWith('g:')));
      expect(rows.size, `the two printed rows are both described: ${[...rows].join(' · ')}`).eq(2);
    });
  });

  describe('rule 1 — the requirement is the Scientists\' plate', () => {
    it('plays under the Scientists ruling (an enacted card); not under the Reds with no cube; with 2 own cubes on the Scientists\' resolution', () => {
      expect(t.player.canPlay(t.card)).is.not.false;
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.parliament.rulingParty()).eq(PartyName.REDS);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card).map((r) => r.message)).includes(PARTY_REQUIREMENT_REASON);
      seatResolution(t.parliament, 1, quietResolutionOf(S));
      const slot = t.parliament.slotOf(S)!;
      t.parliament.placeVote(t.player, slot, 'lobby');
      t.parliament.placeVote(t.player, slot, 'reserve');
      expect(t.player.canPlay(t.card), 'two of the player\'s own delegates there').is.not.false;
    });
  });

  describe('rules 2–8 — below the maximum: up, the data, the ocean, THEN the question, the fall in its answer', () => {
    it('raises each Mars parameter, asks the data first, places the ocean, asks which ocean to remove, lowers the rest — everything the raise gave stays', () => {
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      const seated = seatOceans(t, 3);
      const tr = t.player.terraformRating;
      play(t);
      answerData(t);
      expect(holder(t).resourceCount, 'the data landed before the board').eq(3);
      // The raise happened synchronously at the play: temperature and oxygen up, each a TR step.
      expect(t.game.getTemperature()).eq(-10);
      expect(t.game.getOxygenLevel()).eq(5);
      const placed = answerOcean(t);
      expect(t.game.board.getOceanSpaces()).has.length(4);
      expect(t.player.terraformRating, 'three steps, three TR').eq(tr + 3);
      // THEN — the question: every plain ocean, the one just placed included; the card names itself; nothing chosen for the player.
      const prompt = removalPrompt(t);
      expect(prompt.placementType).eq('ocean-removal');
      expect(prompt.tileType).eq(TileType.OCEAN);
      expect(prompt.title).eq(REMOVE_OCEAN_TITLE);
      expect(prompt.placementContext).deep.eq({cancellable: false, reason: REMOVAL_REASON, source: {kind: 'card', card: ID}});
      expect(prompt.sourceCard, 'a removal carries no staged-cell address').is.undefined;
      expect(prompt.spaces.map((s) => s.id).sort()).deep.eq([...seated.map((s) => s.id), placed.id].sort());
      expect(t.game.getTemperature(), 'nothing falls before the answer').eq(-10);
      expect(t.game.parameterSwings, 'no record before the fall').deep.eq([]);
      // The answer: the just-placed ocean leaves; the temperature and the oxygen come down with it.
      answerRemoval(t, prompt, placed.id);
      expect(placed.tile).is.undefined;
      expect(t.game.board.getOceanSpaces()).has.length(3);
      expect(t.game.getTemperature()).eq(-12);
      expect(t.game.getOxygenLevel()).eq(4);
      expect(t.player.terraformRating, 'the TR stays').eq(tr + 3);
      expect(holder(t).resourceCount, 'the data stays').eq(3);
      expectTurnGoesOn(t);
      // The lowering's events name THE PLAYER; the removal names the actor; nothing was skipped.
      const down = lowerings(t.game);
      expect(down.map((e) => `${e.impact.globalParameter?.parameter}:${e.impact.globalParameter?.steps}:${e.player}`)).deep.eq([
        `${GlobalParameter.TEMPERATURE}:-1:${t.player.color}`, `${GlobalParameter.OXYGEN}:-1:${t.player.color}`,
      ]);
      const removed = events(t.game).filter((e) => e.type === 'tile-removed');
      expect(removed).has.length(1);
      expect(removed[0].player).eq(t.player.color);
      expect(skips(t.game)).deep.eq([]);
      // The RECORD — the raise's legs, the fall's, the ocean removed, the rating measured.
      expect(t.game.parameterSwings).has.length(1);
      const swing = t.game.parameterSwings[0];
      expect(swing).deep.include({source: {card: ID}, player: t.player.color, rating: tr + 3, removed: {space: placed.id, tile: TileType.OCEAN}});
      expect(swing.up).deep.eq([
        {parameter: 'temperature', before: -12, after: -10, tr: 1, claimed: []},
        {parameter: 'oxygen', before: 4, after: 5, tr: 1, claimed: []},
        {parameter: 'oceans', before: 3, after: 4, tr: 1, claimed: []},
      ]);
      expect(swing.down).deep.eq([
        {parameter: 'oceans', before: 4, after: 3},
        {parameter: 'temperature', before: -10, after: -12},
        {parameter: 'oxygen', before: 5, after: 4},
      ]);
      // The journal says the TR stays, and names the removal with its actor.
      expect(logs(t.game).filter((l) => /lowered .* 1 step .* the TR stays/.test(l))).has.length(2);
      expect(logs(t.game).some((l) => /removed ocean tile/.test(l) || /removed/.test(l))).is.true;
    });

    it('a rival\'s ocean, the ocean under a TR44 city — every plain ocean is a candidate; the city stays when its water is taken', () => {
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      const [a, b] = seatOceans(t, 2);
      t.game.addTile(t.opponent, b, {tileType: TileType.CITY}, {overOcean: true});
      runAllActions(t.game);
      play(t);
      answerData(t);
      answerOcean(t);
      const prompt = removalPrompt(t);
      expect(prompt.spaces.map((s) => s.id)).includes(a.id);
      expect(prompt.spaces.map((s) => s.id), 'the ocean under the rival\'s city').includes(b.id);
      answerRemoval(t, prompt, b.id);
      expect(b.tile?.tileType, 'the city stays').eq(TileType.CITY);
      expect(b.tile?.covers).is.undefined;
      expect(b.player).eq(t.opponent);
      expect(t.game.parameterSwings[0].removed).deep.eq({space: b.id, tile: TileType.OCEAN});
    });

    it('a Capital beside the removed ocean is a point poorer at the end — a fact on the removal\'s event, never a VP mutation', () => {
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      const [ocean] = seatOceans(t, 1);
      const beside = t.game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === 'land' && s.tile === undefined)!;
      t.game.addTile(t.opponent, beside, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      t.opponent.playedCards.push(new Capital());
      play(t);
      answerData(t);
      answerOcean(t);
      answerRemoval(t, removalPrompt(t), ocean.id);
      const removed = events(t.game).find((e) => e.type === 'tile-removed');
      const change = removed?.impact.adjacencyVp?.find((c) => c.player === t.opponent.color);
      expect(change, 'the rival\'s Capital is named on the removal\'s event').is.not.undefined;
      expect(change!.after, 'one ocean fewer beside it').eq(change!.before - 1);
    });
  });

  describe('rule 4 — at the maximum: the raise tops the planet out, no question, the fall names every parameter that stays', () => {
    it('temperature +6, oxygen 13, eight oceans: three steps up (+3 TR), nothing comes down, each skip named', () => {
      setTemperature(t.game, 6);
      setOxygenLevel(t.game, 13);
      maxOutOceans(t.player, 8);
      const tr = t.player.terraformRating;
      play(t);
      answerData(t);
      answerOcean(t);
      expectTurnGoesOn(t);
      expect(t.game.getTemperature()).eq(MAX_TEMPERATURE);
      expect(t.game.getOxygenLevel()).eq(MAX_OXYGEN_LEVEL);
      expect(t.game.board.getOceanSpaces()).has.length(9);
      expect(t.player.terraformRating).eq(tr + 3);
      expect(skips(t.game).map((s) => s?.reason)).deep.eq([
        OCEANS_AT_MAX_NOT_LOWERED_REASON, 'Temperature is at its maximum — not lowered', 'Oxygen is at its maximum — not lowered',
      ]);
      expect(lowerings(t.game)).deep.eq([]);
      const swing = t.game.parameterSwings[0];
      expect(swing.up.map((l) => `${l.parameter}:${l.before}→${l.after}:${l.tr}`)).deep.eq(['temperature:6→8:1', 'oxygen:13→14:1', 'oceans:8→9:1']);
      expect(swing.down).deep.eq([
        {parameter: 'oceans', atMax: true, at: 9},
        {parameter: 'temperature', atMax: true, at: MAX_TEMPERATURE},
        {parameter: 'oxygen', atMax: true, at: MAX_OXYGEN_LEVEL},
      ]);
      expect(swing.removed).is.undefined;
    });

    it('a parameter at its maximum BEFORE the play neither rises nor falls, pays no TR, and is named', () => {
      setTemperature(t.game, MAX_TEMPERATURE);
      setOxygenLevel(t.game, 4);
      seatOceans(t, 2);
      const tr = t.player.terraformRating;
      play(t);
      answerData(t);
      answerOcean(t);
      const prompt = removalPrompt(t);
      answerRemoval(t, prompt, prompt.spaces[0].id);
      expect(t.game.getTemperature()).eq(MAX_TEMPERATURE);
      expect(t.game.getOxygenLevel()).eq(4);
      expect(t.player.terraformRating, 'oxygen and the ocean only').eq(tr + 2);
      expect(skips(t.game).map((s) => s?.reason)).deep.eq(['Temperature is at its maximum — not lowered']);
      const swing = t.game.parameterSwings[0];
      expect(swing.up.map((l) => l.parameter)).deep.eq(['oxygen', 'oceans']);
      expect(swing.down[1]).deep.eq({parameter: 'temperature', atMax: true, at: MAX_TEMPERATURE});
    });
  });

  describe('rule 2 — the cascade: 0 °C places a bonus ocean (live, first), 8 % raises the temperature a step; the fall reads the peak', () => {
    it('temperature −2, oxygen 7, five oceans: +5 TR, the bonus ocean asked ahead of the card\'s, the removal from seven, back to 0 °C / 7 % / six', () => {
      setTemperature(t.game, -2);
      setOxygenLevel(t.game, 7);
      maxOutOceans(t.player, 5);
      const tr = t.player.terraformRating;
      play(t);
      answerData(t);
      // THE INTERPOSER: the 0 °C bonus ocean stands first — the scale's own prompt, with no card address.
      const bonus = cast(t.player.popWaitingFor(), SelectSpace);
      expect(bonus.sourceCard, 'the bonus ocean is the scale\'s, not the card\'s').is.undefined;
      expect(bonus.placementContext?.source).deep.eq({kind: 'system', name: 'Temperature bonus step'});
      answerWith(t, bonus, {type: 'space', spaceId: bonus.spaces[0].id});
      answerOcean(t);
      expect(t.game.getTemperature(), '−2 → 0 (the card) → +2 (the 8 % step)').eq(2);
      expect(t.game.getOxygenLevel()).eq(8);
      expect(t.game.board.getOceanSpaces()).has.length(7);
      expect(t.player.terraformRating).eq(tr + 5);
      const prompt = removalPrompt(t);
      expect(prompt.spaces).has.length(7);
      answerRemoval(t, prompt, prompt.spaces[0].id);
      expect(t.game.getTemperature()).eq(0);
      expect(t.game.getOxygenLevel()).eq(7);
      expect(t.game.board.getOceanSpaces()).has.length(6);
      expect(t.player.terraformRating, 'five TR stay').eq(tr + 5);
      expect(t.game.scaleBonusClaims.get('temperature-0'), 'the 0 °C claim stands through the fall').eq(t.player.color);
      expect(t.game.scaleBonusClaims.get('oxygen-8')).eq(t.player.color);
      const swing = t.game.parameterSwings[0];
      expect(swing.up).deep.eq([
        {parameter: 'temperature', before: -2, after: 2, tr: 2, claimed: ['temperature-0']},
        {parameter: 'oxygen', before: 7, after: 8, tr: 1, claimed: ['oxygen-8']},
        {parameter: 'oceans', before: 5, after: 7, tr: 2, claimed: []},
      ]);
      expect(swing.down).deep.eq([
        {parameter: 'oceans', before: 7, after: 6},
        {parameter: 'temperature', before: 2, after: 0},
        {parameter: 'oxygen', before: 8, after: 7},
      ]);
    });
  });

  describe('rule 3 — the data', () => {
    it('with no data holder the data is skipped BY NAME and the play goes on', () => {
      t = table({holder: false});
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      seatOceans(t, 1);
      play(t);
      // No pick: straight to the ocean.
      answerOcean(t);
      removalPrompt(t);
      expect(skips(t.game).map((s) => `${s?.label}:${s?.reason}`)).deep.eq([`Add resources to a card:${SKIP_REASON.noHolder}`]);
    });

    it('Martian Fiber answers the data (+1 M€ per data onto any own card)', () => {
      t.player.playedCards.push(new MartianFiber());
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      seatOceans(t, 1);
      play(t);
      const mc = t.player.megaCredits;
      answerData(t);
      expect(t.player.megaCredits).eq(mc + 3);
    });
  });

  describe('rule 9 — the tags wake the table', () => {
    it('the Plant tag: Decomposers takes a microbe', () => {
      const decomposers = new Decomposers();
      t.player.playedCards.push(decomposers);
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      seatOceans(t, 1);
      play(t);
      expect(decomposers.resourceCount).eq(1);
    });
  });

  describe('rule 10 — the composer\'s reading and the batch', () => {
    it('the preview: the declaration\'s first half, THEN the fall from the peak, the net rating; the data pick and the staged ocean as steps, the removal named in «ДАЛЕЕ»', () => {
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      seatOceans(t, 3);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      const branch = preview.branches[0];
      const chips = branch.effects.map((e) => `${e.direction}:${e.icon}:${e.current ?? ''}→${e.resulting ?? ''}${e.implied ? ':implied' : ''}${e.phase !== undefined ? `:${e.phase}` : ''}${e.note !== undefined ? `:${e.note}` : ''}`);
      // The raise (with each step's implied rating, the data), then the fall opening «THEN», then the net.
      expect(chips.slice(-4)).deep.eq([
        `cost:oxygen:5→4:${THEN_PHASE}`,
        'cost:temperature:-10→-12',
        `cost:oceans:4→3:${REMOVE_ANY_OCEAN_NOTE}`,
        `gain:tr:${t.player.terraformRating}→${t.player.terraformRating + 3}:implied:${NET_PHASE}`,
      ]);
      // The ocean of the raise is the STAGED STEP's (no chip of its own — the declaration's rule); its rating is in the net.
      expect(chips.filter((c) => c.startsWith('gain:tr:') && c.includes(':implied')).map((c) => c.split(':')[2]), 'one implied rating per scale step, plus the net').deep.eq(['→', '→', `${t.player.terraformRating}→${t.player.terraformRating + 3}`]);
      expect(chips.some((c) => c.startsWith('gain:temperature:-12→-10'))).is.true;
      expect(chips.some((c) => c.startsWith('gain:oxygen:4→5'))).is.true;
      expect(chips.some((c) => c.startsWith('gain:data'))).is.true;
      const kinds = branch.steps.map((s) => s.kind);
      expect(kinds).deep.eq(['input', 'boardPlacement', 'note']);
      const placement = branch.steps[1];
      expect(placement.kind === 'boardPlacement' && placement.staged !== undefined, 'the ocean is staged').is.true;
      const note = branch.steps[2];
      expect(note.kind === 'note' && note.text === OCEAN_REMOVAL_NEXT_STEP).is.true;
    });

    it('at the maximum the fall reads «stays at maximum» three times and hands on no board step', () => {
      setTemperature(t.game, 6);
      setOxygenLevel(t.game, 13);
      maxOutOceans(t.player, 8);
      const branch = cardPlayPreview(t.player, t.card).branches[0];
      const fall = branch.effects.filter((e) => e.direction === 'cost');
      expect(fall.map((e) => e.note)).deep.eq([STAYS_AT_MAXIMUM_NOTE, STAYS_AT_MAXIMUM_NOTE, STAYS_AT_MAXIMUM_NOTE]);
      expect(branch.steps.map((s) => s.kind)).deep.eq(['input', 'boardPlacement']);
    });

    it('the forecast names the cascade before the press: the 0 °C ocean and the 8 % temperature step', () => {
      setTemperature(t.game, -2);
      setOxygenLevel(t.game, 7);
      maxOutOceans(t.player, 5);
      const preview = cardPlayPreview(t.player, t.card);
      const forecast = effectForecastForPlay(t.player, t.card, preview);
      const reasons = allForecastFacts(forecast).map((f) => f.reason);
      expect(reasons).includes('Crossing 0 °C places an ocean tile');
      expect(reasons).includes('Crossing 8 % oxygen raises the temperature a step');
    });

    it('the batch `[play, {card}, {space, staged}]` lands whole — the removal is the one honest follow-up', () => {
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      seatOceans(t, 2);
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
        {type: 'card', cards: [CardName.SUPERCOMPUTER]},
        {type: 'space', spaceId: cell, stagedFor: ID} as InputResponse,
      ];
      replayBatch(t.player, batch);
      expect(parkedBatchTailLength(t.player), 'nothing parked').eq(0);
      expect(holder(t).resourceCount).eq(3);
      expect(t.game.board.getSpaceOrThrow(cell).tile?.tileType).eq(TileType.OCEAN);
      const prompt = removalPrompt(t);
      expect(prompt.spaces).has.length(3);
      answerRemoval(t, prompt, cell);
      expectTurnGoesOn(t);
      expect(t.game.getTemperature()).eq(-12);
    });
  });

  describe('rules 13–14 — save / load', () => {
    it('the scales and the board survive a reload; the swing\'s record does not (presentation only)', () => {
      setTemperature(t.game, -12);
      setOxygenLevel(t.game, 4);
      seatOceans(t, 1);
      play(t);
      answerData(t);
      const placed = answerOcean(t);
      answerRemoval(t, removalPrompt(t), placed.id);
      const copy = Game.deserialize(structuredClone(t.game.serialize()));
      expect(copy.getTemperature()).eq(-12);
      expect(copy.getOxygenLevel()).eq(4);
      expect(copy.board.getOceanSpaces()).has.length(1);
      expect(copy.getPlayerById(t.player.id).terraformRating).eq(t.player.terraformRating);
      expect(copy.parameterSwings).deep.eq([]);
    });
  });
});
