import {expect} from 'chai';
import {OldMiningColony} from '@/server/cards/prelude2/OldMiningColony';
import {Research} from '@/server/cards/base/Research';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {Callisto} from '@/server/colonies/Callisto';
import {Ceres} from '@/server/colonies/Ceres';
import {Miranda} from '@/server/colonies/Miranda';
import {Pluto} from '@/server/colonies/Pluto';
import {IGame} from '@/server/IGame';
import {ICard} from '@/server/cards/ICard';
import {SelectCard} from '@/server/inputs/SelectCard';
import {SelectColony} from '@/server/inputs/SelectColony';
import {cast} from '@/common/utils/utils';
import {CardName} from '@/common/cards/CardName';
import {Biolab} from '@/server/cards/prelude/Biolab';
import {MartianIndustries} from '@/server/cards/prelude/MartianIndustries';
import {computePreludeOutlooks} from '@/server/preludes/preludeOutlook';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {Priority} from '@/server/deferredActions/Priority';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';

describe('OldMiningColony', () => {
  let card: OldMiningColony;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new OldMiningColony();
    [game, player] = testGame(2, {coloniesExtension: true});
    game.colonies = [new Callisto(), new Ceres(), new Miranda()];
  });

  it('is adapted — dealt and covered', () => {
    expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.OLD_MINING_COLONY)).is.false;
  });

  it('canPlay', () => {
    expect(card.canPlay(player)).is.false;

    player.cardsInHand.push(new Research());
    expect(card.canPlay(player)).is.true;
  });

  it('Should play', () => {
    const research = new Research();
    const tardigrades = new Tardigrades();
    player.cardsInHand.push(research, tardigrades);

    card.play(player);
    runAllActions(game);
    expect(player.production.titanium).to.eq(1);

    const selectColony = cast(player.popWaitingFor(), SelectColony);
    const colony = selectColony.colonies[0];
    selectColony.cb(colony);
    runAllActions(game);

    expect(colony.colonies).includes(player.id);

    const selectCard = cast(player.popWaitingFor(), SelectCard<ICard>);
    selectCard.cb([research]);

    expect(player.cardsInHand).has.lengthOf(1);
    expect(player.cardsInHand[0]).to.eq(tardigrades);
  });

  // The printed order IS the queue's: the build (BUILD_COLONY) is asked before the discard (DISCARD_CARDS).
  it('asks the colony FIRST and the discard SECOND — and the discard names this card as its source', () => {
    expect(Priority.BUILD_COLONY).lessThan(Priority.DISCARD_CARDS);
    player.cardsInHand.push(new Research(), new Tardigrades());
    card.play(player);
    runAllActions(game);

    const selectColony = cast(player.popWaitingFor(), SelectColony);
    expect(player.cardsInHand, 'nothing discarded before the build').has.lengthOf(2);
    selectColony.cb(selectColony.colonies[0]);
    runAllActions(game);

    const discard = cast(player.popWaitingFor(), SelectCard<ICard>);
    expect(discard.discardPrompt?.source).deep.eq({kind: 'card', card: CardName.OLD_MINING_COLONY});
  });

  // One card left → the engine discards it without a question, and RECORDS it (never a silent loss).
  it('discards the last card in hand automatically — no prompt, the discard recorded `auto`', () => {
    const research = new Research();
    player.cardsInHand.push(research);
    const recorded: Array<{count: number, auto: boolean}> = [];
    const events = game.events;
    const original = events.recordCardsDiscarded.bind(events);
    events.recordCardsDiscarded = (p, count, opts) => {
      recorded.push({count, auto: opts?.auto === true});
      return original(p, count, opts);
    };

    card.play(player);
    runAllActions(game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    selectColony.cb(selectColony.colonies[0]);
    runAllActions(game);

    expect(player.popWaitingFor(), 'no discard prompt').is.undefined;
    expect(player.cardsInHand).is.empty;
    expect(game.projectDeck.discardPile).includes(research);
    expect(recorded).deep.eq([{count: 1, auto: true}]);
  });

  // Pluto's build draws 2 BEFORE the discard reads the hand — one card in hand becomes a pick of three.
  it('a colony on Pluto draws 2 first — then the discard asks over all three', () => {
    game.colonies = [new Pluto()];
    player.cardsInHand.push(new Research());

    card.play(player);
    runAllActions(game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    selectColony.cb(selectColony.colonies[0]);
    runAllActions(game);

    const discard = cast(player.popWaitingFor(), SelectCard<ICard>);
    expect(discard.cards).has.lengthOf(3);
    expect(discard.discardPrompt?.colonyBonus, 'the card\'s own discard, not a colony bonus').is.undefined;
  });

  describe('the preview', () => {
    const stepKinds = (c: OldMiningColony, p: TestPlayer) =>
      (c.cardPlayPreview(p).branches[0].steps ?? []).map((s) => s.kind === 'note' ? `note:${s.text}` : s.kind);

    it('lists the two steps in execution order — the colony, then the hand pick', () => {
      player.cardsInHand.push(new Research(), new Tardigrades());
      expect(stepKinds(card, player)).deep.eq(['boardPlacement', 'input']);
      const pick = card.cardPlayPreview(player).branches[0].steps?.find((s) => s.kind === 'input');
      const marker = (pick as {input?: {discardPrompt?: {source?: unknown, min?: number}}} | undefined)?.input?.discardPrompt;
      expect(marker?.source).deep.eq({kind: 'card', card: CardName.OLD_MINING_COLONY});
    });

    it('names the automatic discard with one card in hand', () => {
      player.cardsInHand.push(new Research());
      expect(stepKinds(card, player)).deep.eq(['boardPlacement', 'note:The last card in hand is discarded automatically']);
    });

    it('says a Pluto build draws first', () => {
      game.colonies = [new Pluto(), new Callisto()];
      player.cardsInHand.push(new Research());
      expect(stepKinds(card, player)).deep.eq([
        'boardPlacement',
        'note:A colony on Pluto draws 2 cards first — then you choose the card to discard',
        'note:The last card in hand is discarded automatically',
      ]);
    });

    it('carries the titanium production chip', () => {
      player.cardsInHand.push(new Research());
      const effects = card.cardPlayPreview(player).branches[0].effects;
      expect(JSON.stringify(effects), 'the declarative titanium production rides the behaviour chip').contains('titanium');
    });
  });

  describe('why it cannot be played', () => {
    it('an empty hand is named', () => {
      expect(card.unplayableReason(player)).deep.eq({type: 'rule', message: 'No card in hand to discard'});
      player.cardsInHand.push(new Research());
      expect(card.unplayableReason(player)).is.undefined;
    });

    it('a table with no colony to build on cannot play it either', () => {
      player.cardsInHand.push(new Research());
      for (const colony of game.colonies) {
        colony.isActive = false;
      }
      expect(card.canPlay(player)).is.false;
    });
  });

  // ORDER: a prelude that DRAWS fixes the empty hand — advised, and guaranteed (a playable draw delivers).
  it('waits for a prelude that draws — `cardInHand`, guaranteed, every enabler named', () => {
    const biolab = new Biolab();
    const industries = new MartianIndustries();
    player.preludeCardsInHand.push(card, biolab, industries);

    expect(computePreludeOutlooks(player, [card], player.preludeCardsInHand).get(CardName.OLD_MINING_COLONY))
      .deep.eq({state: 'deferred', certainty: 'guaranteed', enablers: [CardName.BIOLAB], need: 'cardInHand'});
    expect(computePreludeOutlooks(player, [card], [card, industries]).get(CardName.OLD_MINING_COLONY))
      .deep.eq({state: 'noEffect', need: 'cardInHand'});
  });
});
