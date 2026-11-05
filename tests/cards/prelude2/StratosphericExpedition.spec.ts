import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {StratosphericExpedition} from '../../../src/server/cards/prelude2/StratosphericExpedition';
import {JovianLanterns} from '../../../src/server/cards/colonies/JovianLanterns';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {Tag} from '../../../src/common/cards/Tag';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {FloatingHabs} from '../../../src/server/cards/venusNext/FloatingHabs';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Phase} from '../../../src/common/Phase';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {skippedAddToCard} from '../../../src/server/cards/actionPreviews';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('StratosphericExpedition', () => {
  let card: StratosphericExpedition;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new StratosphericExpedition();
    [game, player] = testGame(1, {venusNextExtension: true});
  });

  it('Should play', () => {
    const jovianLanterns = new JovianLanterns();
    const searchForLife = new SearchForLife();
    player.playedCards.push(jovianLanterns, searchForLife);
    const action = card.play(player);

    runAllActions(game);

    cast(action, undefined);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.cb([jovianLanterns]);

    expect(player.cardsInHand).has.lengthOf(2);
    expect(jovianLanterns.resourceCount).eq(2);
    player.cardsInHand.forEach((card) => expect(card.tags.indexOf(Tag.VENUS)).not.to.eq(-1));
  });
});

/**
 * P84 — STRATOSPHERIC EXPEDITION IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 1 — declarative):
 * ONE press, TWO effects of different nature — 2 floaters on ONE holder the player chooses (always asked, even with
 * one holder; none → a NAMED loss, the play stands), then the search for 2 Venus cards (P76's tape). The card file did
 * not change; every rule of the reading is pinned here.
 */
describe('StratosphericExpedition — premium', () => {
  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
  function stack(game: IGame, topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.projectDeck.drawPile.push(...spare.map(byName), ...[...topFirst].reverse().map(byName));
  }

  /** Not Venus → Venus → not Venus → Venus: the tape the e2e stand seeds too (`STRATO_TAPE`). */
  const TAPE = [CardName.ANTS, CardName.VENUSIAN_INSECTS, CardName.BIRDS, CardName.AERIAL_MAPPERS];

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: StratosphericExpedition};

  /** A two-seat Venus table in the action phase, the card in p1's hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {venusNextExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new StratosphericExpedition();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, card};
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  it('rule 1 — the printed card: an event, 12 M€, Venus + Space, 1 VP, no requirement, P84, dealt with Venus, not political', () => {
    const c = new StratosphericExpedition();
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(12);
    expect(c.tags).deep.eq([Tag.VENUS, Tag.SPACE]);
    expect(c.victoryPoints).eq(1);
    expect(c.requirements).deep.eq([]);
    expect(c.metadata.cardNumber).eq('P84');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.STRATOSPHERIC_EXPEDITION];
    expect(spec?.compatibility).eq('venus');
    expect(spec?.politics, 'not a political card').is.undefined;
  });

  it('rule 1 — paid with titanium (a Space tag) and floaters (a Venus tag), never steel', () => {
    const t = table();
    const options = t.p1.paymentOptionsForCard(t.card);
    expect(options.titanium).is.true;
    expect(options.steel).is.false;
    expect(options.floaters).is.true;
  });

  describe('rule 2 — 2 floaters on ONE chosen holder, then 2 Venus cards', () => {
    it('two holders: the question names both; the answer takes exactly 2; the tape keeps the two Venus cards, the rest is discarded BY NAME in reveal order', () => {
      const t = table();
      const dirigibles = new Dirigibles();
      const habs = new FloatingHabs();
      t.p1.playedCards.push(dirigibles, habs);
      dirigibles.resourceCount = 3;
      stack(t.game, TAPE);
      play(t);
      const pick = cast(t.p1.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES, CardName.FLOATING_HABS]);
      pick.cb([habs]);
      runAllActions(t.game);
      expect(habs.resourceCount).eq(2);
      expect(dirigibles.resourceCount, 'the other holder is untouched').eq(3);
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.VENUSIAN_INSECTS, CardName.AERIAL_MAPPERS]);
      expect(t.game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.ANTS, CardName.BIRDS]);
      expect(t.p1.playedCards.get(CardName.STRATOSPHERIC_EXPEDITION), 'the event lands on the played pile').is.not.undefined;
    });

    it('ONE holder: still ASKED (no auto-select) — the composer seeds it, the server keeps the question', () => {
      const t = table();
      const dirigibles = new Dirigibles();
      t.p1.playedCards.push(dirigibles);
      stack(t.game, TAPE);
      play(t);
      const pick = cast(t.p1.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES]);
      pick.cb([dirigibles]);
      runAllActions(t.game);
      expect(dirigibles.resourceCount).eq(2);
    });

    it('NO holder: the play stands, the floaters are a NAMED loss (`effect-skipped`), the search still runs', () => {
      const t = table();
      stack(t.game, TAPE);
      play(t);
      expect(t.p1.popWaitingFor()).is.undefined;
      const skips = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
      expect(skips).has.length(1);
      expect(skips[0]).deep.include(skippedAddToCard(CardResource.FLOATER, 2));
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.VENUSIAN_INSECTS, CardName.AERIAL_MAPPERS]);
      expect(t.p1.playedCards.get(CardName.STRATOSPHERIC_EXPEDITION)).is.not.undefined;
    });

    it('ONE reveal batch sourced by the card: the search rule and its tape', () => {
      const t = table();
      stack(t.game, TAPE);
      play(t);
      expect(t.p1.cardDrawReveals).has.length(1);
      const reveal = t.p1.cardDrawReveals[0];
      expect(reveal.source).deep.eq({type: 'card', cardName: CardName.STRATOSPHERIC_EXPEDITION});
      expect(reveal.search).deep.eq({count: 2, tag: Tag.VENUS});
      expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).deep.eq([
        [CardName.ANTS, false], [CardName.VENUSIAN_INSECTS, true], [CardName.BIRDS, false], [CardName.AERIAL_MAPPERS, true],
      ]);
    });
  });

  describe('rule 3 — the preview IS the play, read-only', () => {
    it('a holder on the table: the target step «2 floaters → a card» (asked), the search chip', () => {
      const t = table();
      t.p1.playedCards.push(new Dirigibles());
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
      expect(preview.kind).eq('declarative');
      const steps = preview.branches.flatMap((b) => b.steps);
      const target = steps.find((s) => s.kind === 'input');
      expect(target, JSON.stringify(steps)).is.not.undefined;
      expect(target).deep.include({amount: 2, cardResource: 'floater'});
      expect((target as {input?: {cards?: Array<{name: string}>, resourceGainPrompt?: unknown}}).input?.cards?.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES]);
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.find((e) => e.icon === 'cards')).deep.include({direction: 'gain', amount: 2, note: 'draw', search: {count: 2, tag: Tag.VENUS}});
    });

    it('no holder: the warning NAMES the loss in the words the live record writes; the card stays playable', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.true;
      const steps = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.steps);
      const warning = steps.find((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning');
      expect((warning as {skipped?: unknown} | undefined)?.skipped, JSON.stringify(steps)).deep.eq(skippedAddToCard(CardResource.FLOATER, 2));
    });
  });

  describe('rule 4 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Venus; absent without either', () => {
      expect(dealt({prelude2Expansion: true, venusNextExtension: true})).include(CardName.STRATOSPHERIC_EXPEDITION);
      expect(dealt({prelude2Expansion: false, venusNextExtension: true})).not.include(CardName.STRATOSPHERIC_EXPEDITION);
      expect(dealt({prelude2Expansion: true, venusNextExtension: false})).not.include(CardName.STRATOSPHERIC_EXPEDITION);
    });

    it('save / reload: the event on the played pile, the floaters on the holder, the found cards in the hand', () => {
      const t = table();
      const dirigibles = new Dirigibles();
      t.p1.playedCards.push(dirigibles);
      stack(t.game, TAPE);
      play(t);
      cast(t.p1.popWaitingFor(), SelectCard).cb([dirigibles]);
      runAllActions(t.game);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.playedCards.get(CardName.STRATOSPHERIC_EXPEDITION)).is.not.undefined;
      expect(owner.playedCards.get(CardName.DIRIGIBLES)?.resourceCount).eq(2);
      expect(owner.cardsInHand.map((c) => c.name)).deep.eq([CardName.VENUSIAN_INSECTS, CardName.AERIAL_MAPPERS]);
    });

    it('a MarsBot table PLAYS Prelude 2 (the full inclusion, 2026-11-05) — the option is no conflict, its cards in the deck', () => {
      const [game] = testAutomaGame({venusNextExtension: true, prelude2Expansion: true});
      expect(game.gameOptions.prelude2Expansion).is.true;
      expect([...game.projectDeck.drawPile, ...game.projectDeck.discardPile].map((c) => c.name)).to.include(CardName.STRATOSPHERIC_EXPEDITION);
    });
  });
});
