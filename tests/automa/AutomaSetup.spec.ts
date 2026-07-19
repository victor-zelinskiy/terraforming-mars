import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardName} from '../../src/common/cards/CardName';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {isCardBannedForAutoma} from '../../src/server/automa/AutomaBans';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

function automaOf(game: IGame): AutomaState {
  expect(game.automa).is.not.undefined;
  return game.automa!;
}

/** Every bonus card of the game: the deck + the ones shuffled into the action deck. */
function allBonusCards(automa: AutomaState): Array<BonusCardId> {
  const inActionDeck = automa.actionDeck
    .filter((c): c is {kind: 'bonus', id: BonusCardId} => c.kind === 'bonus')
    .map((c) => c.id);
  return [...automa.bonusDeck, ...inActionDeck];
}

describe('AutomaSetup', () => {
  it('seats MarsBot as a real second player', () => {
    const [game, human, bot] = testAutomaGame();
    expect(game.players).has.length(2);
    expect(bot.isMarsBot).is.true;
    expect(human.isMarsBot).is.false;
    expect(bot.name).eq('MarsBot');
    expect(bot.color).is.not.eq(human.color);
    expect(game.first.id).eq(human.id);
    expect(game.isSoloMode()).is.false;
  });

  it('MarsBot starts with 20 TR, an empty M€ supply and no cards', () => {
    const [/* game */, /* human */, bot] = testAutomaGame();
    expect(bot.terraformRating).eq(20);
    expect(bot.megaCredits).eq(0);
    expect(bot.dealtCorporationCards).is.empty;
    expect(bot.dealtProjectCards).is.empty;
    expect(bot.dealtPreludeCards).is.empty;
    expect(bot.cardsInHand).is.empty;
    expect(bot.getWaitingFor()).is.undefined;
  });

  it('the human keeps the ordinary 20 TR + full setup (not the solo 14 TR path)', () => {
    const [game, human] = testAutomaGame({keepInitialCardSelection: true});
    expect(human.terraformRating).eq(20);
    expect(human.dealtCorporationCards).has.length(2);
    expect(human.dealtProjectCards).has.length(10);
    expect(human.getWaitingFor()).is.not.undefined;
    // No neutral solo tiles: the board starts empty.
    expect(game.board.spaces.every((space) => space.tile === undefined)).is.true;
  });

  it('the start-of-game draft variants NORMALIZE off — never an error (the fork template ships prelude draft ON)', () => {
    // With one human there is nobody to pass to and MarsBot never joins the
    // starting picks, so the variants degenerate into the standard setup:
    // 2 corporations + 4 preludes + 10 project cards, pay 3 M€ per card.
    const [game, human, bot] = testAutomaGame({
      preludeExtension: true,
      initialDraftVariant: true,
      preludeDraftVariant: true,
      ceosDraftVariant: true,
      keepInitialCardSelection: true,
    });
    expect(game.gameOptions.initialDraftVariant).is.false;
    expect(game.gameOptions.preludeDraftVariant).is.false;
    expect(game.gameOptions.ceosDraftVariant).is.false;
    expect(game.phase).is.not.eq('initial_drafting');
    // The human's standard deal, untouched.
    expect(human.dealtCorporationCards).has.length(2);
    expect(human.dealtPreludeCards).has.length(4);
    expect(human.dealtProjectCards).has.length(10);
    expect(human.getWaitingFor()).is.not.undefined;
    // MarsBot never takes prelude cards — its compensation is 3 extra project
    // cards in the action deck (3 + 3 with Prelude, + the top bonus card).
    expect(bot.dealtPreludeCards).is.empty;
    expect(bot.dealtCorporationCards).is.empty;
    const automa = automaOf(game);
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(6);
    expect(automa.actionDeck.filter((c) => c.kind === 'bonus')).has.length(1);
  });

  it('base bonus deck is B01–B08; one card of it starts inside the action deck', () => {
    const [game] = testAutomaGame();
    const automa = automaOf(game);
    expect(allBonusCards(automa).sort()).deep.eq([
      BonusCardId.B01_METEOR_SHOWER,
      BonusCardId.B02_INVASIVE_SPECIES,
      BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
      BonusCardId.B04_OVERACHIEVEMENT,
      BonusCardId.B05_EXPEDITED_CONSTRUCTION,
      BonusCardId.B06_LOBBYISTS,
      BonusCardId.B07_LOCAL_NEURAL_INSTANCE,
      BonusCardId.B08_CORPORATE_COMPETITION,
    ]);
    expect(automa.bonusDeck).has.length(7);
    expect(automa.recurringBonusCards).is.empty;
    expect(automa.setAsideBonusCards).is.empty;
  });

  it('base starting action deck is 4 cards: 3 projects + 1 bonus', () => {
    const [game] = testAutomaGame();
    const automa = automaOf(game);
    expect(automa.actionDeck).has.length(4);
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(3);
    expect(automa.actionDeck.filter((c) => c.kind === 'bonus')).has.length(1);
  });

  it('Prelude: MarsBot gets 3 extra project cards instead of prelude cards', () => {
    const [game, /* human */, bot] = testAutomaGame({preludeExtension: true});
    const automa = automaOf(game);
    expect(automa.actionDeck).has.length(7); // 3 + 3 + 1 bonus
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(6);
    expect(bot.dealtPreludeCards).is.empty;
  });

  it('Venus Next: B15 replaces B06; Government Intervention recurs and is in the FIRST action deck', () => {
    const [game] = testAutomaGame({venusNextExtension: true});
    const automa = automaOf(game);
    const bonusCards = allBonusCards(automa);
    expect(bonusCards).contains(BonusCardId.B15_LOBBYISTS_VENUS);
    expect(bonusCards).does.not.contain(BonusCardId.B06_LOBBYISTS);
    expect(automa.recurringBonusCards).deep.eq([BonusCardId.B16_GOVERNMENT_INTERVENTION]);
    // Adding Expansions p.2: B16 joins the action deck "including on the first round".
    expect(automa.actionDeck.some((c) => c.kind === 'bonus' && c.id === BonusCardId.B16_GOVERNMENT_INTERVENTION)).is.true;
    expect(automa.actionDeck).has.length(5); // 3 projects + 1 bonus + B16
    // The Venus track joined the board.
    expect(automa.board.tracks).has.length(8);
  });

  it('Colonies: B17 replaces B05, B18 joins the deck, B19/B20 are set aside', () => {
    const [game] = testAutomaGame({coloniesExtension: true});
    const automa = automaOf(game);
    const bonusCards = allBonusCards(automa);
    expect(bonusCards).contains(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES);
    expect(bonusCards).contains(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    expect(bonusCards).does.not.contain(BonusCardId.B05_EXPEDITED_CONSTRUCTION);
    expect(automa.setAsideBonusCards).deep.eq([BonusCardId.B19_SHIPPING_LINES, BonusCardId.B20_EXTENDED_SHIPPING_LINES]);
    // 5 colony tiles on the table for a 2-player layout.
    expect(game.colonies).has.length(5);
  });

  it('the full POC set (CorpEra+Prelude+Venus+Colonies): 9-card bonus pool, 8-card action deck', () => {
    const [game] = testAutomaGame({
      corporateEra: true,
      preludeExtension: true,
      venusNextExtension: true,
      coloniesExtension: true,
    });
    const automa = automaOf(game);
    // The bonus POOL excludes B16 — Government Intervention is a recurring card that
    // cycles through the ACTION deck, never through the bonus deck.
    const bonusPool = allBonusCards(automa).filter((id) => !automa.recurringBonusCards.includes(id));
    expect(bonusPool.sort()).deep.eq([
      BonusCardId.B01_METEOR_SHOWER,
      BonusCardId.B02_INVASIVE_SPECIES,
      BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
      BonusCardId.B04_OVERACHIEVEMENT,
      BonusCardId.B07_LOCAL_NEURAL_INSTANCE,
      BonusCardId.B08_CORPORATE_COMPETITION,
      BonusCardId.B15_LOBBYISTS_VENUS,
      BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES,
      BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD,
    ]);
    // 3 + 3 (prelude) + 1 bonus + B16.
    expect(automa.actionDeck).has.length(8);
  });

  it('Brutal: one more starting project card', () => {
    const [game] = testAutomaGame({difficulty: 'brutal'});
    expect(automaOf(game).actionDeck).has.length(5); // 4 projects + 1 bonus
    expect(automaOf(game).actionDeck.filter((c) => c.kind === 'project')).has.length(4);
  });

  describe('rejects unsupported setups loudly', () => {
    const cases: ReadonlyArray<[string, object]> = [
      ['Turmoil', {turmoilExtension: true}],
      ['Prelude 2', {prelude2Expansion: true}],
      // NOTE: PROMO is SUPPORTED (official FAQ p.11: generic adapters + the
      // LawSuit / St. Joseph / ADS per-card rules + the Mons Insurance ban) —
      // covered positively below + in AutomaPromoCards.spec.ts.
      ['community cards', {communityCardsOption: true}],
      // NOTE: ARES is SUPPORTED (house rules: neighborhood bonuses → 1 M€ per
      // unit, hazard avoidance + the random-track consequence) — covered
      // positively below + in AutomaAres.spec.ts.
      ['The Moon', {moonExpansion: true}],
      ['Pathfinders', {pathfindersExpansion: true}],
      ['CEOs', {ceoExtension: true}],
      ['Star Wars', {starWarsExpansion: true}],
      ['Underworld', {underworldExpansion: true}],
      // NOTE: the Delta Project is SUPPORTED (Solo Delta Project reference
      // card) — covered positively in AutomaDeltaProject.spec.ts.
      ['random MA', {randomMA: RandomMAOptionType.LIMITED}],
      ['solo TR', {soloTR: true}],
      ['two corps', {twoCorpsVariant: true}],
      ['solar phase / WGT', {solarPhaseOption: true}],
      ['Venus completion requirement', {requiresVenusTrackCompletion: true}],
      // NOTE: the ALTERNATE Venus board is SUPPORTED (its bonus spaces resolve
      // as fixed bot gains) — covered positively below + in AutomaResolver.spec.ts.
      ['shuffled map', {shuffleMapOption: true}],
      ['banned cards', {bannedCards: ['Birds']}],
      ['a non-Tharsis board', {boardName: BoardName.HELLAS}],
    ];
    for (const [label, options] of cases) {
      it(label, () => {
        expect(() => testAutomaGame(options as object)).to.throw(/MarsBot \(Automa\) does not support/);
      });
    }
  });

  it('accepts promo cards; Mons Insurance is banned from the official-solo deck (FAQ p.11)', () => {
    const [game, human] = testAutomaGame({promoCardsOption: true});
    expect(game.gameOptions.promoCardsOption).is.true;
    expect(game.automa).is.not.undefined;
    // The predicate-based official-solo ban: the corp never enters the game —
    // neither the draw pile nor the human's dealt corporations.
    const corpNames = [
      ...game.corporationDeck.drawPile.map((c) => c.name),
      ...human.dealtCorporationCards.map((c) => c.name),
    ];
    expect(corpNames).does.not.contain('Mons Insurance');
    expect(corpNames.length).is.greaterThan(0);
  });

  it('the Mons Insurance ban is predicate-based — an ordinary game keeps the corporation', () => {
    const automaOptions = {...DEFAULT_GAME_OPTIONS, automa: {difficulty: 'normal' as const}};
    expect(isCardBannedForAutoma(CardName.MONS_INSURANCE, DEFAULT_GAME_OPTIONS)).is.false;
    expect(isCardBannedForAutoma(CardName.MONS_INSURANCE, automaOptions)).is.true;
    expect(isCardBannedForAutoma(CardName.BIRDS, automaOptions)).is.false;
  });

  it('accepts Ares (house rules: adjacency bonuses as M€, hazard avoidance + track consequence)', () => {
    const [game] = testAutomaGame({aresExtension: true, aresHazards: true});
    expect(game.gameOptions.aresExtension).is.true;
    expect(game.automa).is.not.undefined;
    expect(game.aresData).is.not.undefined;
    // The bot is a real player — it MUST be in the Ares milestone tallies.
    const bot = game.players.find((p) => p.isMarsBot);
    expect(game.aresData!.milestoneResults.some((e) => e.id === bot!.id)).is.true;
  });

  it('accepts the alternate Venus board (bonus spaces resolve as fixed bot gains)', () => {
    const [game] = testAutomaGame({venusNextExtension: true, altVenusBoard: true});
    expect(game.gameOptions.altVenusBoard).is.true;
    expect(game.automa).is.not.undefined;
  });

  it('rejects an automa game with two human players', () => {
    const p1 = TestPlayer.BLUE.newPlayer({name: 'p1'});
    const p2 = TestPlayer.RED.newPlayer({name: 'p2'});
    expect(() => Game.newInstance('game-2h', [p1, p2], p1, 's-2h', {automa: {difficulty: 'normal'}}))
      .to.throw(/exactly one human player/);
  });

  it('an ordinary game is untouched: no automa state, no bot', () => {
    const p1 = TestPlayer.BLUE.newPlayer({name: 'p1'});
    const game = Game.newInstance('game-ord', [p1], p1, 's-ord', {});
    expect(game.automa).is.undefined;
    expect(game.players.some((p) => p.isMarsBot)).is.false;
    expect(p1.terraformRating).eq(14); // The real solo path still applies.
  });
});

describe('Automa game flow (phase guards)', () => {
  it('the human finishing research alone starts the action phase (MarsBot needs no input)', () => {
    const [game, human] = testAutomaGame();
    game.playerIsFinishedWithResearchPhase(human);
    expect(game.phase).eq('action');
    expect(game.activePlayer.id).eq(human.id);
  });

  it('MarsBot with an empty action deck passes; the generation then flows through research', () => {
    const [game, human, bot] = testAutomaGame();
    const automa = automaOf(game);
    game.playerIsFinishedWithResearchPhase(human);

    automa.actionDeck = []; // Force the official "no cards → passes for the round".
    const bonusCardsBefore = automa.bonusDeck.length;
    game.playerHasPassed(human);
    game.playerIsFinishedTakingActions();

    // Bot passed → everyone passed → production (bot skips it) → generation 2 research.
    expect(game.generation).eq(2);
    expect(game.phase).eq('research');
    // MarsBot rebuilt a 4-card action deck (3 projects + 1 bonus) without prompts.
    expect(automa.actionDeck).has.length(4);
    expect(automa.bonusDeck).has.length(bonusCardsBefore - 1);
    expect(bot.getWaitingFor()).is.undefined;
    // The human is drawing cards as usual.
    expect(human.getWaitingFor()).is.not.undefined;
    // Production did not touch the bot.
    expect(bot.megaCredits).eq(0);
    expect(bot.heat).eq(0);
  });

  it('MarsBot never has a pending prompt at any point of the flow', () => {
    const [game, human, bot] = testAutomaGame();
    game.playerIsFinishedWithResearchPhase(human);
    expect(bot.getWaitingFor()).is.undefined;
    expect(bot.needsToDraft ?? false).is.false;
  });
});
