import {expect} from 'chai';
import {Donation} from '../../../src/server/cards/prelude/Donation';
import {GalileanMining} from '../../../src/server/cards/prelude/GalileanMining';
import {HugeAsteroid} from '../../../src/server/cards/prelude/HugeAsteroid';
import {WGProject} from '../../../src/server/cards/prelude2/WGProject';
import {SmeltingPlant} from '../../../src/server/cards/prelude/SmeltingPlant';
import {IGame} from '../../../src/server/IGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {runAllActions} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {IPreludeCard} from '../../../src/server/cards/prelude/IPreludeCard';
import {BusinessEmpire} from '../../../src/server/cards/prelude/BusinessEmpire';
import {cast} from '../../../src/common/utils/utils';
import {Phase} from '@/common/Phase';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Payment} from '@/common/inputs/Payment';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {OrOptions} from '@/server/inputs/OrOptions';
import {Server} from '@/server/models/ServerModel';
import {cardPlayPreview, previewableCard} from '@/server/models/cardPlayPreview';
import {CHAIRMAN_REQUIREMENT_REASON, unplayableReasons} from '@/server/models/unplayableReasons';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {MetalsCompany} from '@/server/cards/prelude/MetalsCompany';
import {Supplier} from '@/server/cards/prelude/Supplier';
import {ValleyTrust} from '@/server/cards/prelude/ValleyTrust';
import {NewPartner} from '@/server/cards/promo/NewPartner';
import {Merger} from '@/server/cards/promo/Merger';
import {DoubleDown} from '@/server/cards/promo/DoubleDown';

describe('WGProject', () => {
  let card: WGProject;
  let player: TestPlayer;
  let game: IGame;
  let smeltingPlant: IPreludeCard;
  let donation: IPreludeCard;
  let hugeAsteroid: IPreludeCard;
  let galileanMining: IPreludeCard;
  let businessEmpire: IPreludeCard;

  beforeEach(() => {
    card = new WGProject();
    [game, player] = testGame(2, {preludeExtension: true, turmoilExtension: true});
    smeltingPlant = new SmeltingPlant();
    donation = new Donation();
    hugeAsteroid = new HugeAsteroid();
    galileanMining = new GalileanMining();
    businessEmpire = new BusinessEmpire();
  });

  it('canPlay', () => {
    expect(card.canPlay(player)).is.not.true;
    game.turmoil!.chairman = player;
    expect(card.canPlay(player)).is.true;
  });

  it('canPlay - not enough preludes', () => {
    game.turmoil!.chairman = player;
    game.preludeDeck.drawPile.length = 2;
    expect(card.canPlay(player)).is.false;
  });

  it('Should play with at least 1 playable prelude', () => {
    game.preludeDeck.drawPile.push(smeltingPlant, businessEmpire, donation);

    const selectCard = cast(card.play(player), SelectCard<IPreludeCard>);

    expect(selectCard.cards).deep.eq([donation, businessEmpire, smeltingPlant]);

    selectCard.cb([donation]);

    expect(player.playedCards.asArray()).deep.eq([donation]);
    expect(game.preludeDeck.discardPile).to.have.members([businessEmpire, smeltingPlant]);
  });

  it('Can play with no playable preludes drawn', () => {
    player.megaCredits = 0;
    // Both of these cards cost MC which the player does not have, and so
    // if the player plays this they will have to fizzle one of the cards.
    game.preludeDeck.drawPile.push(hugeAsteroid, businessEmpire, galileanMining);

    const selectCard = cast(card.play(player), SelectCard<IPreludeCard>);

    expect(selectCard.cards).deep.eq([galileanMining, businessEmpire, hugeAsteroid]);

    selectCard.cb([galileanMining]);
    runAllActions(game);

    expect(player.megaCredits).eq(15);
    expect(player.playedCards.length).eq(0);
    expect(game.preludeDeck.discardPile).to.have.members([galileanMining, businessEmpire, hugeAsteroid]);
  });
});

describe('WGProject — on a Turmoil Redux table (P91: a prelude played in the middle of the game)', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: WGProject};

  /** A two-seat Redux + Colonies + Prelude + Prelude 2 table in the action phase, generation 3 — p1 is the chairman,
   *  WG Project in hand, 20 M€; the top of the prelude deck seeded with `top` (the first one is drawn first). */
  function table(top: Array<IPreludeCard> = [], megaCredits = 20): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    game.generation = 3;
    game.parliament!.chairman = p1.id;
    const card = new WGProject();
    p1.cardsInHand.push(card);
    p1.megaCredits = megaCredits;
    // `drawN` pops from the END of the draw pile.
    game.preludeDeck.drawPile.push(...[...top].reverse());
    return {game, p1, p2, card};
  }

  /** Plays the card from hand at its price (9 M€) and returns the prelude pick it asks. */
  function play(t: Table): SelectCard<IPreludeCard> {
    t.p1.playCard(t.card, Payment.of({megacredits: 9}));
    runAllActions(t.game);
    return cast(t.p1.popWaitingFor(), SelectCard<IPreludeCard>);
  }

  it('the printed card: automated, 9, an Earth tag, the chairman\'s requirement, P91; political, marked for Redux; off the hold-back list', () => {
    const c = new WGProject();
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(9);
    expect(c.tags).deep.eq([Tag.EARTH]);
    expect(c.metadata.cardNumber).eq('P91');
    expect(c.requirements).to.have.length(1);
    expect(JSON.stringify(c.requirements[0])).to.include('"chairman":true');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.WG_PROJECT];
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
    expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.WG_PROJECT)).is.false;
    const dealt = (opts: Partial<GameOptions>) => new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((x) => x.name);
    expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: true})).include(CardName.WG_PROJECT);
  });

  it('the requirement reads the Parliament: not the chairman → locked with the chairman\'s reason naming who sits', () => {
    const t = table();
    expect(t.card.canPlay(t.p1)).is.true;
    t.game.parliament!.chairman = t.p2.id;
    expect(t.card.canPlay(t.p1)).is.false;
    const reasons = unplayableReasons(t.p1, t.card);
    const chair = reasons.find((r) => r.message === CHAIRMAN_REQUIREMENT_REASON);
    expect(chair?.chairmanNow).deep.eq({name: t.p2.name, color: t.p2.color});
  });

  it('a short prelude deck (draw pile + discard < 3) is a NAMED reason, never a bare «unavailable»', () => {
    const t = table();
    t.game.preludeDeck.drawPile.length = 1;
    t.game.preludeDeck.discardPile.length = 1;
    expect(t.card.canPlay(t.p1)).is.false;
    expect(t.card.unplayableReason(t.p1)?.message).eq('Fewer than 3 preludes left in the prelude deck');
    t.game.preludeDeck.discardPile.push(new Donation());
    expect(t.card.unplayableReason(t.p1)).is.undefined;
  });

  it('the pick is a DECK PICK over the prelude deck in `play` mode, sourced by WG Project — never the start marker', () => {
    const t = table([new MetalsCompany(), new Donation(), new Supplier()]);
    const pick = play(t);
    expect(pick.startGamePrompt, 'a start marker raises the START workspace over the hand').is.undefined;
    expect(pick.deckPickPrompt).deep.eq({revealed: 3, min: 1, max: 1, origin: 'prelude', mode: 'play', source: {kind: 'card', card: CardName.WG_PROJECT}});
    expect(pick.cards.map((c) => c.name)).to.have.members([CardName.METALS_COMPANY, CardName.DONATION, CardName.SUPPLIER]);
    const model = pick.toModel(t.p1);
    expect(model.deckPickPrompt?.mode).eq('play');
    for (const c of model.cards) {
      expect(c.preludeOutlook, `${c.name} carries its verdict`).deep.eq({state: 'playable'});
    }
  });

  it('every candidate of the live pick is previewable (the console\'s result chips under each face) — and nothing else', () => {
    const t = table([new MetalsCompany(), new Donation(), new Supplier()]);
    t.p1.playCard(t.card, Payment.of({megacredits: 9}));
    runAllActions(t.game);
    expect(previewableCard(t.p1, CardName.DONATION)?.name).eq(CardName.DONATION);
    expect(previewableCard(t.p1, CardName.METALS_COMPANY)?.name).eq(CardName.METALS_COMPANY);
    expect(previewableCard(t.p1, CardName.GALILEAN_MINING), 'not offered').is.undefined;
  });

  it('the model counts the prelude deck and its discard pile (the console\'s deck object)', () => {
    const t = table();
    const before = t.game.preludeDeck.drawPile.length;
    const pick = play(t);
    const model = Server.getGameModel(t.game);
    expect(model.preludeDeckSize).eq(before - 3);
    expect(model.preludeDiscardSize).eq(0);
    pick.cb([pick.cards[0]]);
    runAllActions(t.game);
    expect(Server.getGameModel(t.game).preludeDiscardSize).eq(2);
  });

  it('the answer PLAYS the prelude (its own root, «played» in the journal) and discards the other two with ONE public line naming them', () => {
    const donation = new Donation();
    const metals = new MetalsCompany();
    const supplier = new Supplier();
    const t = table([metals, donation, supplier]);
    const pick = play(t);
    pick.cb([donation]);
    runAllActions(t.game);
    expect(t.p1.playedCards.asArray().map((c) => c.name)).to.have.members([CardName.WG_PROJECT, CardName.DONATION]);
    expect(t.p1.megaCredits, '20 − 9 + 21').eq(32);
    expect(t.game.preludeDeck.discardPile).to.have.members([metals, supplier]);
    expect(t.p1.lastCardPlayed).eq(CardName.DONATION);
    const discardLine = t.game.gameLog.find((m) => m.message === '${0} discards preludes ${1}');
    expect(discardLine, 'the discard pile is face up — public').is.not.undefined;
    expect(discardLine!.data[1].value).to.have.members([CardName.METALS_COMPANY, CardName.SUPPLIER]);
  });

  it('a prelude that cannot resolve is SHOWN burning (its verdict on the candidate) and burning it pays 15 M€ sourced by the burnt card', () => {
    const hugeAsteroid = new HugeAsteroid();
    const t = table([hugeAsteroid, new Donation(), new Supplier()], 9);
    const pick = play(t);
    expect(t.p1.megaCredits).eq(0);
    const model = pick.toModel(t.p1);
    expect(model.cards.find((c) => c.name === CardName.HUGE_ASTEROID)?.preludeOutlook?.state, 'the burn is visible BEFORE the press').eq('noEffect');
    const from = t.game.events.events.length;
    pick.cb([hugeAsteroid]);
    runAllActions(t.game);
    expect(t.p1.megaCredits).eq(15);
    expect(t.p1.playedCards.asArray().map((c) => c.name)).deep.eq([CardName.WG_PROJECT]);
    expect(t.game.preludeDeck.discardPile).to.have.length(3);
    expect(t.game.gameLog.some((m) => m.message === '${0} fizzled. ${1} gains 15 M€.')).is.true;
    const gain = t.game.events.events.slice(from).find((e) => e.type === 'resource-changed' && e.player === t.p1.color && e.impact.stock?.megacredits === 15);
    expect(gain?.source, 'the 15 M€ are born on the burnt prelude').deep.include({kind: 'card', card: CardName.HUGE_ASTEROID});
  });

  it('a prelude the pick plays that draws preludes itself (New Partner) asks the SAME deck pick, sourced by New Partner', () => {
    const t = table([new NewPartner(), new Donation(), new Supplier(), new MetalsCompany(), new SmeltingPlant()]);
    const pick = play(t);
    pick.cb([pick.cards.find((c) => c.name === CardName.NEW_PARTNER)!]);
    runAllActions(t.game);
    const nested = cast(t.p1.popWaitingFor(), SelectCard<IPreludeCard>);
    expect(nested.startGamePrompt).is.undefined;
    expect(nested.deckPickPrompt).deep.eq({revealed: 2, min: 1, max: 1, origin: 'prelude', mode: 'play', source: {kind: 'card', card: CardName.NEW_PARTNER}});
  });

  it('Merger played mid-game: the corporation pick names Merger (a card choice) — never the start marker', () => {
    const t = table([new Merger(), new Donation(), new Supplier()], 80);
    const pick = play(t);
    pick.cb([pick.cards.find((c) => c.name === CardName.MERGER)!]);
    runAllActions(t.game);
    const corp = cast(t.p1.popWaitingFor(), SelectCard);
    expect(corp.startGamePrompt).is.undefined;
    expect(corp.choiceContext?.source).deep.eq({kind: 'card', card: CardName.MERGER});
  });

  it('Double Down played mid-game: the copy pick names Double Down — never the start marker', () => {
    const t = table([new DoubleDown(), new Donation(), new Supplier()]);
    t.p1.playedCards.push(new MetalsCompany());
    const pick = play(t);
    pick.cb([pick.cards.find((c) => c.name === CardName.DOUBLE_DOWN)!]);
    runAllActions(t.game);
    const copy = cast(t.p1.popWaitingFor(), SelectCard<IPreludeCard>);
    expect(copy.startGamePrompt).is.undefined;
    expect(copy.deckPickPrompt).is.undefined;
    expect(copy.choiceContext?.source).deep.eq({kind: 'card', card: CardName.DOUBLE_DOWN});
  });

  it('THE START IS UNTOUCHED: Valley Trust\'s first action (generation 1, the action phase) keeps the start marker — and so does the New Partner it plays', () => {
    const [game, player] = testGame(2, {preludeExtension: true, skipInitialCardSelection: true});
    player.playedCards.push(new ValleyTrust());
    player.pendingInitialActions.push(new ValleyTrust());
    game.preludeDeck.drawPile.push(new Donation(), new Supplier(), new MetalsCompany(), new SmeltingPlant(), new NewPartner());
    game.phase = Phase.ACTION;
    player.takeAction();
    const first = cast(player.popWaitingFor(), OrOptions);
    first.options[0].cb();
    runAllActions(game);
    const pick = cast(player.popWaitingFor(), SelectCard<IPreludeCard>);
    expect(pick.startGamePrompt).deep.eq({kind: 'preludeSelection', preludeMode: 'draw'});
    expect(pick.deckPickPrompt).is.undefined;
    pick.cb([pick.cards.find((c) => c.name === CardName.NEW_PARTNER)!]);
    runAllActions(game);
    const nested = cast(player.popWaitingFor(), SelectCard<IPreludeCard>);
    expect(nested.startGamePrompt, 'a prelude played from a start pick is still the start').deep.eq({kind: 'preludeSelection', preludeMode: 'draw'});
    expect(game.gameLog.some((m) => m.message === '${0} discards preludes ${1}'), 'the start discards silently, as before').is.false;
  });

  it('the play preview is an honest NOTE (nothing is computable before the reveal); read-only', () => {
    const t = table();
    const before = JSON.stringify(t.game.serialize());
    const preview = cardPlayPreview(t.p1, t.card);
    expect(preview.preSteps ?? []).to.have.length(0);
    expect(JSON.stringify(preview)).to.include('After confirming, draw 3 Prelude cards and choose one to play; the other two are discarded.');
    expect(JSON.stringify(t.game.serialize())).eq(before);
  });

  it('save / reload in the middle of the pick: the prompt is rebuilt from the action start; the card is still in hand', () => {
    const t = table([new MetalsCompany(), new Donation(), new Supplier()]);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const card = owner.cardsInHand.find((c) => c.name === CardName.WG_PROJECT);
    expect(card).is.not.undefined;
    owner.playCard(card!, Payment.of({megacredits: 9}));
    runAllActions(reloaded);
    const asked = cast(owner.getWaitingFor(), SelectCard<IPreludeCard>);
    expect(asked.deckPickPrompt?.origin).eq('prelude');
    expect(asked.deckPickPrompt?.source?.card).eq(CardName.WG_PROJECT);
  });
});
