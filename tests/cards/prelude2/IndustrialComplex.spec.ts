import {expect} from 'chai';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {INDUSTRIAL_COMPLEX_PRICE, IndustrialComplex} from '../../../src/server/cards/prelude2/IndustrialComplex';
import {runAllActions, testGame} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {newCorporationCard} from '../../../src/server/createCard';
import {Units} from '../../../src/common/Units';
import {SelectPayment} from '../../../src/server/inputs/SelectPayment';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {computePreludeOutlooks} from '../../../src/server/preludes/preludeOutlook';
import {Loan} from '../../../src/server/cards/prelude/Loan';
import {Manutech} from '../../../src/server/cards/venusNext/Manutech';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {Message} from '../../../src/common/logs/Message';

const ONE_EACH = Units.of({megacredits: 1, steel: 1, titanium: 1, plants: 1, energy: 1, heat: 1});

describe('IndustrialComplex', () => {
  let card: IndustrialComplex;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new IndustrialComplex();
    [game, player] = testGame(2);
  });

  function seat(corps: ReadonlyArray<CardName>) {
    for (const corp of corps) {
      if (corp === CardName.HELION) {
        player.canUseHeatAsMegaCredits = true;
      }
      if (corp === CardName.LUNA_TRADE_FEDERATION) {
        player.canUseTitaniumAsMegacredits = true;
      }
      if (corp === CardName.MANUTECH) {
        // The fork's spelling: a CORPORATION is played as one (upstream pushed it into `playedCards`).
        player.playCorporationCard(newCorporationCard(corp)!);
      }
    }
  }

  // ── The upstream table (adapted: Manutech as a real corporation) ──
  const runs = [
    {
      stock: {megacredits: 17}, production: {}, corps: [],
      canPlay: false,
    },
    {
      stock: {megacredits: 18}, production: {}, corps: [],
      canPlay: true,
      payment: undefined,
      expected: {production: {}, stock: {}},
    },
    {
      stock: {megacredits: 18}, production: {steel: 1}, corps: [],
      canPlay: true,
      payment: undefined,
      expected: {production: {}, stock: {}},
    },
    {
      stock: {megacredits: 17}, production: {}, corps: [CardName.MANUTECH],
      canPlay: true,
      payment: undefined,
      expected: {production: {}, stock: {...ONE_EACH, megacredits: 0}},
    },
    {
      stock: {megacredits: 17}, production: {megacredits: 1}, corps: [CardName.MANUTECH],
      canPlay: false,
    },
    {
      stock: {megacredits: 17, heat: 1}, production: {}, corps: [CardName.HELION],
      canPlay: true,
      payment: {megacredits: 17, heat: 1},
      expected: {production: {}, stock: {}},
    },
    {
      stock: {megacredits: 17, titanium: 1}, production: {}, corps: [CardName.LUNA_TRADE_FEDERATION],
      canPlay: true,
      payment: {megacredits: 16, titanium: 1},
      expected: {production: {}, stock: {megacredits: 1}},
    },
    {
      stock: {megacredits: 18}, production: {megacredits: -5}, corps: [],
      canPlay: true,
      payment: undefined,
      expected: {production: {}, stock: {}},
    },
  ] as const;

  for (const run of runs) {
    it('canPlay ' + JSON.stringify(run), () => {
      seat(run.corps);
      player.stock.override(run.stock);
      player.production.override(run.production);
      expect(card.canPlay(player)).eq(run.canPlay);
    });

    if (run.canPlay === true) { // Skipping the ones that fizzle.
      it('play ' + JSON.stringify(run), () => {
        seat(run.corps);
        player.stock.override(run.stock);
        player.production.override(run.production);
        cast(card.play(player), undefined);
        runAllActions(game);
        if (run.payment) {
          const selectPayment = cast(player.popWaitingFor(), SelectPayment);
          selectPayment.cb(Payment.of({...run.payment}));
          runAllActions(game);
        }

        // If not specified, the stock is zero.
        expect(player.stock.asUnits(), 'stock does not match').deep.eq(Units.of(run.expected.stock));
        // If not specified, the production is one.
        expect(player.production.asUnits(), 'production does not match').deep.eq({...ONE_EACH, ...run.expected.production});
      });
    }
  }

  // ── The fork's readings ──
  const effectsOf = () => cardPlayPreview(player, card).branches.flatMap((b) => b.effects);
  const stepsOf = () => cardPlayPreview(player, card).branches.flatMap((b) => b.steps);
  const production = (effects: ReadonlyArray<ActionEffect>) => effects.filter((e) => e.note === 'production');

  it('is off the hold-back list (adapted)', () => {
    expect(PRELUDE2_CARDS_HELD_BACK).not.include(CardName.INDUSTRIAL_COMPLEX);
  });

  it('preview — all six lines at zero: six chips `0 → 1`, the price chip LAST (execution order), no note; read-only', () => {
    player.stock.override({megacredits: 40});
    player.production.override({});
    const before = JSON.stringify(game.serialize());
    const effects = effectsOf();
    expect(production(effects).map((e) => [e.icon, e.current, e.resulting, e.amount])).deep.eq(
      ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'].map((r) => [r, 0, 1, 1]));
    expect(effects[effects.length - 1]).deep.include({direction: 'cost', icon: 'megacredits', amount: INDUSTRIAL_COMPLEX_PRICE, current: 40, resulting: 22});
    expect(stepsOf(), 'M€ only — the payment auto-pays, nothing to ask').deep.eq([]);
    expect(JSON.stringify(game.serialize()), 'the preview never mutates').eq(before);
  });

  it('preview — M€ production −5 reads the honest +6; a line at 1 or more is NAMED unchanged', () => {
    player.stock.override({megacredits: 40});
    player.production.override({megacredits: -5, steel: 2, titanium: 1});
    const effects = production(effectsOf());
    expect(effects[0]).deep.include({icon: 'megacredits', current: -5, resulting: 1, amount: 6});
    expect(effects.map((e) => e.icon)).deep.eq(['megacredits', 'plants', 'energy', 'heat']);
    const note = stepsOf().find((s) => s.kind === 'note');
    expect(note, 'the unchanged lines are a note').not.undefined;
    const text = (note as {text: Message}).text;
    expect(text.message).eq('Unchanged: ${0} ${1}, ${2} ${3}');
    expect(text.data.map((d) => d.value)).deep.eq(['steel', '2', 'titanium', '1']);
  });

  it('preview — Helion with heat: the payment step is pre-collected (the bill the server will ask)', () => {
    seat([CardName.HELION]);
    player.stock.override({megacredits: 17, heat: 3});
    const payment = stepsOf().find((s) => s.kind === 'input');
    expect(payment, 'the bill is asked').not.undefined;
    expect((payment as {input: {amount: number}}).input.amount).eq(INDUSTRIAL_COMPLEX_PRICE);
  });

  it('the live bill names its asker (`cause`) — Helion', () => {
    seat([CardName.HELION]);
    player.stock.override({megacredits: 17, heat: 1});
    card.play(player);
    runAllActions(game);
    const selectPayment = cast(player.popWaitingFor(), SelectPayment);
    expect(selectPayment.choiceContext?.source).deep.eq({kind: 'card', card: CardName.INDUSTRIAL_COMPLEX});
  });

  it('a price held back BEFORE the play (P45 Board of Directors\' 12 M€) is honoured — `canAffordOptions.cost`', () => {
    player.stock.override({megacredits: 25});
    expect(card.canPlay(player)).is.true;
    expect(card.canPlay(player, {cost: 12}), '12 + 18 > 25').is.false;
    player.stock.override({megacredits: 30});
    expect(card.canPlay(player, {cost: 12})).is.true;
  });

  it('Manutech\'s refund is the FULL delta: M€ production −5 → 1 pays 6, so 12 M€ suffice', () => {
    seat([CardName.MANUTECH]);
    player.stock.override({megacredits: 12});
    player.production.override({megacredits: -5});
    expect(card.canPlay(player), '12 + 6 = 18').is.true;
    player.stock.override({megacredits: 11});
    expect(card.canPlay(player)).is.false;
  });

  it('a shortfall is NAMED with its amount', () => {
    player.stock.override({megacredits: 10});
    expect(card.unplayableReason(player)).deep.eq({type: 'megacredits', message: 'Need ${0} more M€', params: ['8']});
    player.stock.override({megacredits: 18});
    expect(card.unplayableReason(player)).undefined;
  });

  it('order — the card waits for MONEY: Loan in hand is the enabler, alone it burns («noEffect» with the need named)', () => {
    player.stock.override({megacredits: 10});
    const loan = new Loan();
    expect(computePreludeOutlooks(player, [card], [card, loan]).get(CardName.INDUSTRIAL_COMPLEX))
      .deep.eq({state: 'deferred', certainty: 'possible', enablers: [CardName.LOAN], need: 'cash'});
    expect(computePreludeOutlooks(player, [card], [card]).get(CardName.INDUSTRIAL_COMPLEX))
      // A burn names its cause — the card's own hook (P59 · FV).
      .deep.eq({state: 'noEffect', need: 'cash', reason: {type: 'megacredits', message: 'Need ${0} more M€', params: ['8']}});
  });

  it('Manutech answers EACH raised line (six `production-gain` effects) and «Сработает» promises all six', () => {
    player.playCorporationCard(new Manutech());
    player.production.override({}); // Manutech's own steel production off: every line at 0.
    player.stock.override({megacredits: 18});
    const forecast = effectForecastForPlay(player, card, cardPlayPreview(player, card));
    const manutech = forecast.facts.filter((f) => f.source.name === CardName.MANUTECH);
    expect(manutech.flatMap((f) => f.effects.map((e) => `${e.icon}+${e.amount}`))).deep.eq(
      ['megacredits+1', 'steel+1', 'titanium+1', 'plants+1', 'energy+1', 'heat+1']);

    card.play(player);
    runAllActions(game);
    expect(player.stock.asUnits()).deep.eq(Units.of({...ONE_EACH, megacredits: 1}));
  });

  it('the journal: one line per raised production line and one for the price', () => {
    player.stock.override({megacredits: 18});
    player.production.override({steel: 2});
    const before = game.gameLog.length;
    card.play(player);
    runAllActions(game);
    const lines = game.gameLog.slice(before).map((l) => l.message);
    expect(lines.filter((m) => m.includes('production')).length, lines.join(' | ')).eq(5);
    expect(lines).include('${0} loses ${1} M€ for ${2}');
  });

  it('Turmoil Redux — the ruling Greens answer the plant and heat lines with M€ production on top: M€ production ends at 3', () => {
    const [reduxGame, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    expect(reduxGame.parliament!.rulingParty(), 'a fresh Redux table opens with the Greens').eq(PartyName.GREENS);
    p1.stock.override({megacredits: 18});
    p1.production.override({});
    card.play(p1);
    runAllActions(reduxGame);
    expect(p1.production.megacredits, '0 → 1 by the card, +1 for plants, +1 for heat').eq(3);
    expect(p1.production.plants).eq(1);
    expect(p1.production.heat).eq(1);
    expect(p1.megaCredits).eq(0);
  });
});
