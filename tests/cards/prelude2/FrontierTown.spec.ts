import {expect} from 'chai';
import {FRONTIER_TOWN_PRINTED_BONUS_MULTIPLIER, FrontierTown} from '../../../src/server/cards/prelude2/FrontierTown';
import {testGame} from '../../TestGame';
import {addOcean, churn, runAllActions, setRulingParty} from '../../TestingUtils';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {TileType} from '../../../src/common/TileType';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {BoardName} from '../../../src/common/boards/BoardName';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {cast} from '../../../src/common/utils/utils';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Space} from '../../../src/server/boards/Space';
import {Board} from '../../../src/server/boards/Board';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {Parliament} from '@/server/parliament/Parliament';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '@/server/models/unplayableReasons';
import {requiredPartyOf} from '@/server/cards/requirements/partyRequirementCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {boardCellPreview} from '@/server/boards/BoardInformationEngine';
import {DEVELOPMENT_CRAZE_ID} from '@/server/parliament/resolutions/marsFirst/DevelopmentCraze';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('FrontierTown', () => {
  const canPlayRuns = [
    {energyProduction: 0, party: PartyName.GREENS, expected: false},
    {energyProduction: 0, party: PartyName.MARS, expected: false},
    {energyProduction: 1, party: PartyName.GREENS, expected: false},
    {energyProduction: 1, party: PartyName.MARS, expected: true},
  ] as const;
  for (const run of canPlayRuns) {
    it('canPlay ' + JSON.stringify(run), () => {
      const card = new FrontierTown();
      const [game, player/* , player2 */] = testGame(2, {turmoilExtension: true});

      setRulingParty(game, run.party);
      player.production.override({energy: run.energyProduction});
      expect(card.canPlay(player)).eq(run.expected);
    });
  }

  it('play', () => {
    const card = new FrontierTown();
    const [game, player] = testGame(2, {turmoilExtension: true});

    player.production.override({energy: 1});

    const selectSpace = cast(churn(card.play(player), player), SelectSpace);

    const space = selectSpace.spaces[0];
    space.bonus = [SpaceBonus.PLANT];
    selectSpace.cb(space);
    runAllActions(game);

    expect(player.production.energy).eq(0);
    expect(space.tile?.tileType).eq(TileType.CITY);
    expect(player.plants).eq(3);
  });

  it('Does not apply to oceans ', () => {
    const card = new FrontierTown();
    const [game, player] = testGame(2, {turmoilExtension: true});

    player.production.override({energy: 1});

    const selectSpace = cast(churn(card.play(player), player), SelectSpace);

    const space = selectSpace.spaces[0];
    const oceanSpace = game.board.getAdjacentSpaces(space)[0];
    game.simpleAddTile(player, oceanSpace, {tileType: TileType.OCEAN});
    space.bonus = [SpaceBonus.PLANT];
    selectSpace.cb(space);
    runAllActions(game);

    expect(player.production.energy).eq(0);
    expect(space.tile?.tileType).eq(TileType.CITY);
    expect(player.plants).eq(3);
    expect(player.megaCredits).eq(2); // 2, not 6.
  });

  for (const run of [
    {party: PartyName.GREENS, availableOceans: 3, adjust: 17, expected: false},
    {party: PartyName.GREENS, availableOceans: 3, adjust: 18, expected: true},
    {party: PartyName.REDS, availableOceans: 3, adjust: 26, expected: false},
    {party: PartyName.REDS, availableOceans: 3, adjust: 27, expected: true},

    // This isn't how these work. Huh.
    // {party: PartyName.GREENS, availableOceans: 2, adjust: 11, expected: false},
    // {party: PartyName.GREENS, availableOceans: 2, adjust: 12, expected: true},
    // {party: PartyName.REDS, availableOceans: 2, adjust: 17, expected: false},
    // {party: PartyName.REDS, availableOceans: 2, adjust: 18, expected: true},
  ]) {
    it('Manages triple placement costs ' + JSON.stringify(run), () => {
      const card = new FrontierTown();
      const [game, player, player2] = testGame(2, {turmoilExtension: true, boardName: BoardName.HELLAS});

      const turmoil = Turmoil.getTurmoil(game);
      turmoil.sendDelegateToParty(player, PartyName.MARS, game, true);
      turmoil.sendDelegateToParty(player, PartyName.MARS, game, true);
      setRulingParty(game, run.party);
      player.production.override({energy: 1});

      const hellasOceanSpace = player.game.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
      // Every other space is reserved for the opponent.
      for (const space of player.game.board.spaces) {
        if (space.spaceType === SpaceType.LAND && space !== hellasOceanSpace) {
          space.player = player2;
        }
      }

      player.megaCredits = card.cost + run.adjust;
      while (game.board.getOceanSpaces().length > run.availableOceans) {
        addOcean(player2);
      }

      expect(player.canPlay(card)).eq(run.expected);

      if (run.expected === true) {
        player.playCard(card);
        runAllActions(game);
        const selectSpace = cast(player.popWaitingFor(), SelectSpace);

        expect(selectSpace.spaces).deep.eq([hellasOceanSpace]);
      }
    });
  }
});

describe('FrontierTown — on a Turmoil Redux table', () => {
  const M = PartyName.MARS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: FrontierTown};

  /** A two-seat Redux + Colonies + Prelude 2 table in the action phase — Mars First rules by a quiet law; p1 1 energy production, 30 M€. */
  function table(options: {craze?: boolean} = {}): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    seatEnacted(parliament, options.craze === true ? DEVELOPMENT_CRAZE_ID : quietResolutionOf(M));
    expect(parliament.rulingParty()).eq(M);
    const card = new FrontierTown();
    p1.cardsInHand.push(card);
    p1.megaCredits = 30;
    p1.production.override({energy: 1});
    return {game, p1, p2, parliament, card};
  }

  /** A candidate printing exactly two plants, away from every ocean. */
  function plantsCell(t: Table, ss: SelectSpace): Space {
    const cell = ss.spaces.find((s) => s.bonus.length === 2 && s.bonus.every((b) => b === SpaceBonus.PLANT) &&
      !t.game.board.getAdjacentSpaces(s).some((a) => Board.isOceanSpace(a)));
    expect(cell, 'a two-plant cell among the candidates').is.not.undefined;
    return cell!;
  }

  function play(t: Table): SelectSpace {
    t.p1.playCard(t.card);
    runAllActions(t.game);
    return cast(t.p1.popWaitingFor(), SelectSpace);
  }

  function stagedOf(t: Table) {
    const step = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.steps).find((s) => s.kind === 'boardPlacement');
    return step?.kind === 'boardPlacement' ? step.staged : undefined;
  }

  it('rule 1 — the printed card: automated, 11, City + Building, no VP, the Mars First plate, P74; political, marked for Redux', () => {
    const c = new FrontierTown();
    expect(c.name).eq(CardName.FRONTIER_TOWN);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(11);
    expect(c.tags).deep.eq([Tag.CITY, Tag.BUILDING]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(M);
    expect(c.placesTile).is.true;
    expect(c.metadata.cardNumber).eq('P74');
    expect(c.metadata.description).eq('Requires that Mars First is ruling or that you have 2 delegates there. Decrease your energy production 1 step. ' +
      'Place a city tile and gain its printed placement bonus 2 additional times.');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.FRONTIER_TOWN];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
    expect(FRONTIER_TOWN_PRINTED_BONUS_MULTIPLIER).eq(3);
  });

  describe('rule 2 — the requirement: MARS FIRST rules, or 2 of your delegates on its resolution; an energy production to lose', () => {
    it('a fresh table (the Greens rule), one delegate on Mars First\'s resolution: locked with the NAMED reason «1 of 2»; two open it', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      ([M, PartyName.GREENS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      const card = new FrontierTown();
      p1.cardsInHand.push(card);
      p1.megaCredits = 30;
      p1.production.override({energy: 1});
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 1,
        requirement: true, requirementKey: 'req:party',
      }]);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      expect(p1.canPlay(card), 'two delegates on its resolution').is.true;
    });

    it('Mars First rules: playable; steel pays for it (a Building tag)', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
      expect(t.p1.paymentOptionsForCard(t.card).steel).is.true;
    });

    it('no energy production: unplayable, and the hand NAMES why', () => {
      const t = table();
      t.p1.production.override({energy: 0});
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'production', message: 'No energy production'}]);
    });
  });

  describe('rule 3 — the play: the printed bonus × 3 in ONE payout, through the one multiplier thread', () => {
    it('the prompt names its card and announces the multiple (the dossier\'s numbers are the commit\'s)', () => {
      const t = table();
      const ss = play(t);
      expect(ss.sourceCard).eq(CardName.FRONTIER_TOWN);
      expect(ss.printedBonusMultiplier).eq(3);
      expect(ss.toModel().printedBonusMultiplier).eq(3);
    });

    it('a two-plant cell pays 6 plants ONCE — one grant, one record, one stock event; the energy step after the city', () => {
      const t = table();
      const ss = play(t);
      const cell = plantsCell(t, ss);
      const events = t.game.events.events.length;
      ss.cb(cell);
      expect(cell.tile?.tileType, 'the city first').eq(TileType.CITY);
      expect(t.p1.production.energy, 'the energy step waits behind the city').eq(1);
      runAllActions(t.game);
      expect(t.p1.plants).eq(6);
      expect(t.p1.production.energy).eq(0);
      const record = t.game.tilePlacements[t.game.tilePlacements.length - 1];
      expect(record.spaceId).eq(cell.id);
      expect(record.paid, 'the tile language\'s record carries the honest sum').deep.eq([{resource: 'plants', amount: 6}]);
      const plantEvents = t.game.events.events.slice(events).filter((e) => e.type === 'resource-changed' && (e.impact.stock?.plants ?? 0) > 0);
      expect(plantEvents.map((e) => e.impact.stock?.plants), 'ONE payout — never three').deep.eq([6]);
    });

    it('under Development Craze (RX10) the law repeats the payout WITH its multiple — the FAQ\'s «six times»: 12 plants', () => {
      const t = table({craze: true});
      const ss = play(t);
      const cell = plantsCell(t, ss);
      ss.cb(cell);
      runAllActions(t.game);
      expect(t.p1.plants).eq(12);
      expect(t.p1.lastPlacementLawPayout).deep.include({spaceId: cell.id, printed: true, printedMultiplier: 3});
      expect(t.p1.production.energy).eq(0);
    });
  });

  describe('rule 4 — the forecast, the staged play, the deal, save / reload', () => {
    it('the play preview: «−1 energy production» and a STAGED city carrying the multiple; read-only', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.some((e) => e.icon === 'energy' && e.note === 'production' && e.direction === 'cost' && e.amount === 1), JSON.stringify(effects)).is.true;
      expect(stagedOf(t)?.printedBonusMultiplier).eq(3);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('staged ↔ live parity: the pre-pay staged cells are the post-pay prompt\'s, and the multiple is the same', () => {
      const t = table();
      const staged = stagedOf(t);
      expect(staged).is.not.undefined;
      t.p1.playCard(t.card, {...Payment.EMPTY, megacredits: t.p1.getCardCost(t.card)});
      runAllActions(t.game);
      const ss = cast(t.p1.popWaitingFor(), SelectSpace);
      expect(ss.spaces.map((s) => s.id).sort()).deep.eq([...staged!.spaces].sort());
      expect(ss.printedBonusMultiplier).eq(staged!.printedBonusMultiplier);
      expect(ss.sourceCard).eq(staged!.sourceCard);
    });

    it('the cell\'s dossier states 6 plants for a two-plant cell and the energy step as the card\'s own fact', () => {
      const t = table();
      const ss = play(t);
      const cell = plantsCell(t, ss);
      const preview = boardCellPreview(t.p1, cell, 'city', {sourceCard: CardName.FRONTIER_TOWN, printedBonusMultiplier: 3});
      expect(preview.immediateFacts.find((f) => f.id === `printed-${SpaceBonus.PLANT}`)?.delta?.amount).eq(6);
      const facts = [...preview.costFacts, ...preview.immediateFacts, ...preview.warningFacts];
      expect(facts.some((f) => f.delta?.icon === 'energy' && f.delta.production === true), JSON.stringify(facts.map((f) => f.id))).is.true;
    });

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      const dealt = (opts: Partial<GameOptions>) => new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true})).include(CardName.FRONTIER_TOWN);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: false})).not.include(CardName.FRONTIER_TOWN);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.FRONTIER_TOWN)).is.false;
    });

    it('save / reload: the replayed play asks the same multiplied city', () => {
      const t = table();
      t.game.generation = 2;
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      const card = owner.cardsInHand.find((c) => c.name === CardName.FRONTIER_TOWN);
      expect(card, 'the card is still in hand').is.not.undefined;
      owner.playCard(card!);
      runAllActions(reloaded);
      const asked = cast(owner.getWaitingFor(), SelectSpace);
      expect(asked.sourceCard).eq(CardName.FRONTIER_TOWN);
      expect(asked.printedBonusMultiplier).eq(3);
    });
  });
});
