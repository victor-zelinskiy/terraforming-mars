import {expect} from 'chai';
import {AtmosphericEnhancers} from '../../../src/server/cards/prelude2/AtmosphericEnhancers';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, setOxygenLevel, setRulingParty, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {IGame} from '../../../src/server/IGame';
import {floaterCards} from '../../../src/server/cards/venusNext/floaterCards';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MAX_VENUS_SCALE} from '../../../src/common/constants';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {cast} from '../../../src/common/utils/utils';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {Celestic} from '../../../src/server/cards/venusNext/Celestic';

describe('AtmosphericEnhancers', () => {
  let card: AtmosphericEnhancers;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new AtmosphericEnhancers();
    [game, player] = testGame(1, {venusNextExtension: true});
  });

  it('canPlay', () => {
    expect(card.canPlay(player)).is.true;

    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    setVenusScaleLevel(game, MAX_VENUS_SCALE);

    expect(card.canPlay(player)).is.true;
  });

  it('canPlay, turmoil', () => {
    const [turmoilGame, turmoilPlayer] = testGame(1, {venusNextExtension: true, turmoilExtension: true});
    turmoilPlayer.megaCredits = 5;

    expect(card.canPlay(turmoilPlayer)).is.true;

    setRulingParty(turmoilGame, PartyName.REDS);

    expect(card.canPlay(turmoilPlayer)).is.false;

    turmoilPlayer.megaCredits = 6;

    expect(card.canPlay(turmoilPlayer)).is.true;
  });

  it('play - raise temperature', () => {
    cast(card.play(player), undefined);
    runAllActions(game);

    expect(game.getTemperature()).eq(-30);

    cast(player.popWaitingFor(), OrOptions).options[0].cb();
    runAllActions(game);

    expect(game.getTemperature()).eq(-26);
  });

  it('play - raise oxygen', () => {
    cast(card.play(player), undefined);
    runAllActions(game);

    expect(game.getOxygenLevel()).eq(0);

    cast(player.popWaitingFor(), OrOptions).options[1].cb();
    runAllActions(game);

    expect(game.getOxygenLevel()).eq(2);
  });

  it('play - raise Venus', () => {
    cast(card.play(player), undefined);
    runAllActions(game);

    expect(game.getVenusScaleLevel()).eq(0);

    cast(player.popWaitingFor(), OrOptions).options[2].cb();
    runAllActions(game);

    expect(game.getVenusScaleLevel()).eq(4);
  });

  it('play - cards have floaters', () => {
    cast(card.play(player), undefined);
    expect(player.cardsInHand).has.length(2);

    expect(floaterCards.has(player.cardsInHand[0].name));
    expect(floaterCards.has(player.cardsInHand[1].name));
  });
});

/**
 * P44 — ATMOSPHERIC ENHANCERS IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 2 made declarative
 * whole — ledger EQ): a THREE-WAY OR on play whose branches carry their `current → resulting` (the Executor's option
 * metadata), and a draw of 2 cards WITH A FLOATER ICON that names its rule (`floaterIcon` — one descriptor with
 * Celestic) instead of an opaque predicate's silence.
 */
describe('AtmosphericEnhancers — premium', () => {
  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
  function stack(game: IGame, topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.projectDeck.drawPile.push(...spare.map(byName), ...[...topFirst].reverse().map(byName));
  }

  /** Not a floater card → a floater HOLDER → not one → a card that only PRINTS the icon (the e2e stands seed it too). */
  const TAPE = [CardName.ANTS, CardName.DIRIGIBLES, CardName.BIRDS, CardName.AIR_RAID];
  const ROWS = ['Raise temperature 2 steps', 'Raise oxygen 2 steps', 'Raise Venus 2 steps'];

  function table(): {game: IGame, player: TestPlayer, card: AtmosphericEnhancers} {
    const [game, player] = testGame(2, {venusNextExtension: true, prelude2Expansion: true});
    return {game, player, card: new AtmosphericEnhancers()};
  }

  it('rule 1 — a prelude, Venus tag, P44, dealt with Venus, in the premium scope', () => {
    const c = new AtmosphericEnhancers();
    expect(c.type).eq(CardType.PRELUDE);
    expect(c.tags).deep.eq([Tag.VENUS]);
    expect(c.metadata.cardNumber).eq('P44');
    expect(PRELUDE2_CARD_MANIFEST.preludeCards[CardName.ATMOSPHERIC_ENHANCERS]?.compatibility).eq('venus');
  });

  it('the live OR: three printed rows in the printed order, each with its `current → resulting`, under the effect-choice marker', () => {
    const {game, player, card} = table();
    stack(game, TAPE);
    card.play(player);
    runAllActions(game);
    const or = cast(player.popWaitingFor(), OrOptions);
    expect(or.options.map((o) => o.title)).deep.eq(ROWS);
    expect(or.choiceContext?.source).deep.include({kind: 'card', card: CardName.ATMOSPHERIC_ENHANCERS});
    const meta = or.options.map((o) => (o as SelectOption).metadata);
    expect(meta[0]).deep.eq({kind: 'globalParameter', icon: 'temperature', amount: 2, global: {current: -30, resulting: -26, unit: '°C'}});
    expect(meta[1]).deep.eq({kind: 'globalParameter', icon: 'oxygen', amount: 2, global: {current: 0, resulting: 2, unit: '%'}});
    expect(meta[2]).deep.eq({kind: 'globalParameter', icon: 'venus', amount: 2, global: {current: 0, resulting: 4, unit: '%'}});
    expect(or.disabledOptions).deep.eq([]);
  });

  it('a branch at its maximum is OFFERED with the executor warning and an honest «8 → 8» — never hidden', () => {
    const {game, player, card} = table();
    setTemperature(game, MAX_TEMPERATURE);
    stack(game, TAPE);
    card.play(player);
    runAllActions(game);
    const or = cast(player.popWaitingFor(), OrOptions);
    const temperature = or.options[0] as SelectOption;
    expect(temperature.warnings).deep.eq(['maxtemp']);
    expect(temperature.metadata?.global).deep.eq({current: MAX_TEMPERATURE, resulting: MAX_TEMPERATURE, unit: '°C'});
    expect((or.options[1] as SelectOption).warnings).is.undefined;
  });

  it('the search NAMES its rule: «with a floater icon» — a holder AND a card that only prints the icon are kept, the rest discarded by name', () => {
    const {game, player, card} = table();
    stack(game, TAPE);
    card.play(player);
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES, CardName.AIR_RAID]);
    expect(game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.ANTS, CardName.BIRDS]);
    const reveal = player.cardDrawReveals[0];
    expect(reveal.source).deep.eq({type: 'card', cardName: CardName.ATMOSPHERIC_ENHANCERS});
    expect(reveal.search).deep.eq({count: 2, floaterIcon: true});
    expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).deep.eq([
      [CardName.ANTS, false], [CardName.DIRIGIBLES, true], [CardName.BIRDS, false], [CardName.AIR_RAID, true],
    ]);
    expect(floaterCards.has(CardName.AIR_RAID), 'Air Raid only PRINTS the icon').is.true;
  });

  it('the preview: three branches (runtime indices 0 · 1 · 2), each its parameter chip AND the shared search chip', () => {
    const {game, player, card} = table();
    const before = JSON.stringify(game.serialize());
    const preview = cardPlayPreview(player, card);
    expect(JSON.stringify(game.serialize()), 'the preview never mutates').eq(before);
    expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq(ROWS.map((title, i) => [i, title, true]));
    for (const branch of preview.branches) {
      expect(branch.effects.find((e) => e.icon === 'cards'), JSON.stringify(branch.title)).deep.include({direction: 'gain', amount: 2, note: 'draw', search: {count: 2, floaterIcon: true}});
    }
    expect(preview.branches[0].effects.find((e) => e.icon === 'temperature')).deep.include({current: -30, resulting: -26});
    expect(preview.branches[2].effects.find((e) => e.icon === 'venus')).deep.include({current: 0, resulting: 4});
  });

  it('under Turmoil Redux the card never burns: no TR tax on a prelude, playable with 0 M€', () => {
    const [, player] = testGame(2, {venusNextExtension: true, turmoilReduxExpansion: true, coloniesExtension: true});
    player.megaCredits = 0;
    expect(new AtmosphericEnhancers().canPlay(player)).is.true;
  });

  it('Celestic searches by the SAME descriptor — one rule, two cards', () => {
    const {game, player} = table();
    stack(game, TAPE);
    new Celestic().initialAction(player);
    expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES, CardName.AIR_RAID]);
    expect(player.cardDrawReveals[0].search).deep.eq({count: 2, floaterIcon: true});
  });
});
