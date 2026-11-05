import {expect} from 'chai';
import {VenusAllies} from '../../../src/server/cards/prelude2/VenusAllies';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Luna} from '../../../src/server/colonies/Luna';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {Titan} from '../../../src/server/colonies/Titan';
import {Colony} from '../../../src/server/colonies/Colony';
import {IPlayer} from '../../../src/server/IPlayer';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {countedPlayEffects} from '../../../src/server/models/actionPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {runAllActions, setVenusScaleLevel} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('VenusAllies', () => {
  let card: VenusAllies;
  let player: TestPlayer;
  let game: IGame;
  beforeEach(() => {
    card = new VenusAllies();
    [game, player] = testGame(1, {venusNextExtension: true});
  });

  it('Megacredits check', () => {
    const colony1 = new Luna();
    const colony2 = new Pluto();
    colony1.colonies.push(player.id);
    game.colonies.push(colony1);
    colony2.colonies.push(player.id);
    game.colonies.push(colony2);
    card.play(player);
    expect(game.getVenusScaleLevel()).to.eq(4);
    expect(player.megaCredits).eq(8);
  });
});

/**
 * P87 — VENUS ALLIES IN THE PREMIUM SCOPE: the TWENTY-FIRST Prelude 2 card adapted IN PLACE
 * (`docs/PRELUDE2_ADAPTATION.md` §3.1, form 1 — declarative). Nothing in the rule changed: the colony count is the term
 * P68 / P79 already read (`Counter`, «Your colonies: N»), the two Venus steps are the scale's own story (the rating per
 * step stated by `withImpliedRatings`, the 16 % rating a forecast fact), the Space tag lets titanium pay.
 */
describe('VenusAllies — the declaration in the premium scope', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: VenusAllies};

  /** A two-seat Prelude 2 + Venus + Colonies table in the action phase, Venus at `venus`, the card in hand, 30 M€. */
  function table(venus = 12): Table {
    const [game, p1, p2] = testGame(2, {coloniesExtension: true, venusNextExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    setVenusScaleLevel(game, venus);
    const card = new VenusAllies();
    p1.cardsInHand.push(card);
    p1.megaCredits = 30;
    p2.megaCredits = 0;
    return {game, p1, p2, card};
  }

  /** THE TABLE: the tiles in this order, each with the given seats' cubes on it. */
  function arrangeColonies(game: IGame, rows: Array<[Colony, Array<IPlayer>]>): void {
    game.colonies = rows.map(([colony, owners]) => {
      colony.isActive = true;
      colony.colonies = owners.map((p) => p.id);
      return colony;
    });
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  const effectsOf = (t: Table) => cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects);
  const chip = (effects: ReadonlyArray<ActionEffect>, icon: string) => effects.find((e) => e.icon === icon);

  it('rule 1 — the printed card: green, 30, Venus + Space, 2 VP, no requirement; P87; Venus + Colonies; a declaration', () => {
    const c = new VenusAllies();
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(30);
    expect(c.tags).deep.eq([Tag.VENUS, Tag.SPACE]);
    expect(c.victoryPoints).eq(2);
    expect(c.requirements).deep.eq([]);
    expect(c.metadata.cardNumber).eq('P87');
    expect(c.behavior).deep.eq({global: {venus: 2}, stock: {megacredits: {colonies: {colonies: {}}, each: 4}}});
    expect(Object.prototype.hasOwnProperty.call(VenusAllies.prototype, 'bespokePlay'), 'the count is the declaration\'s').is.false;
    expect(PRELUDE2_CARD_MANIFEST.projectCards[CardName.VENUS_ALLIES]).deep.eq({Factory: VenusAllies, compatibility: ['venus', 'colonies']});
  });

  it('rule 1 — the Space tag: titanium pays, steel does not', () => {
    const t = table();
    const options = t.p1.paymentOptionsForCard(t.card);
    expect(options.titanium).is.true;
    expect(options.steel).is.false;
  });

  describe('rule 2 — 4 M€ per colony cube of the player\'s', () => {
    for (const n of [0, 1, 2, 3]) {
      it(`${n} colonies → +${4 * n} M€ (the opponent's cube is not counted)`, () => {
        const t = table();
        const tiles: Array<[Colony, Array<IPlayer>]> = [[new Luna(), [t.p2]], [new Titan(), []], [new Pluto(), []]];
        for (let i = 0; i < n; i++) {
          tiles[i][1].push(t.p1);
        }
        arrangeColonies(t.game, tiles);
        play(t);
        expect(t.p1.megaCredits).eq(30 + 4 * n);
        expect(t.p2.megaCredits).eq(0);
        expect(t.p1.tableau.has(CardName.VENUS_ALLIES)).is.true;
      });
    }
  });

  describe('rule 3 — two Venus steps, a rating per step made', () => {
    it('12 % → 16 %: +2 TR for the steps and +1 for crossing 16 % (the engine\'s bonus)', () => {
      const t = table(12);
      arrangeColonies(t.game, [[new Luna(), [t.p1]]]);
      const tr = t.p1.terraformRating;
      play(t);
      expect(t.game.getVenusScaleLevel()).eq(16);
      expect(t.p1.terraformRating).eq(tr + 3);
    });

    it('28 %: ONE step is left — 30 %, +1 TR', () => {
      const t = table(28);
      const tr = t.p1.terraformRating;
      play(t);
      expect(t.game.getVenusScaleLevel()).eq(30);
      expect(t.p1.terraformRating).eq(tr + 1);
    });

    it('30 %: no step — the scale stays, no TR; the M€ are still paid', () => {
      const t = table(30);
      arrangeColonies(t.game, [[new Luna(), [t.p1]]]);
      const tr = t.p1.terraformRating;
      play(t);
      expect(t.game.getVenusScaleLevel()).eq(30);
      expect(t.p1.terraformRating).eq(tr);
      expect(t.p1.megaCredits).eq(34);
    });
  });

  describe('rule 4 — the preview IS the execution (declarative, read-only)', () => {
    it('Venus 12 → 16, +2 TR implied, M€ 30 → 38 with the basis «Your colonies: 2»; read-only', () => {
      const t = table(12);
      arrangeColonies(t.game, [[new Luna(), [t.p1]], [new Titan(), [t.p1]]]);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(chip(effects, 'venus'), JSON.stringify(effects)).deep.include({direction: 'gain', current: 12, resulting: 16});
      expect(chip(effects, 'tr')).deep.include({amount: 2, implied: true});
      expect(chip(effects, Resource.MEGACREDITS)).deep.include({amount: 8, current: 30, resulting: 38});
      expect(chip(effects, Resource.MEGACREDITS)?.basis).deep.eq([{count: 2, label: 'Your colonies'}]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('the 16 % rating is the forecast\'s fact (the press pays +3 in all); past 16 % it is gone', () => {
      const t = table(12);
      const forecast = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card));
      expect(forecast.facts.some((f) => f.id.endsWith('venus-tr-bonus')), JSON.stringify(forecast.facts.map((f) => f.id))).is.true;
      const past = table(18);
      const later = effectForecastForPlay(past.p1, past.card, cardPlayPreview(past.p1, past.card));
      expect(later.facts.some((f) => f.id.endsWith('venus-tr-bonus')), 'already past 16 %').is.false;
    });

    it('no colonies: the M€ chip is NAMED «+0 · Your colonies: 0», never silent', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p2]]]);
      const mc = chip(effectsOf(t), Resource.MEGACREDITS);
      expect(mc).deep.include({amount: 0, current: 30, resulting: 30});
      expect(mc?.basis).deep.eq([{count: 0, label: 'Your colonies'}]);
    });

    it('the ceiling: 28 % reads 28 → 30 with ONE implied TR; 30 % reads 30 → 30 with none', () => {
      const near = effectsOf(table(28));
      expect(chip(near, 'venus')).deep.include({current: 28, resulting: 30});
      expect(chip(near, 'tr')).deep.include({amount: 1, implied: true});
      const at = effectsOf(table(30));
      expect(chip(at, 'venus')).deep.include({current: 30, resulting: 30});
      expect(chip(at, 'tr'), 'a step the ceiling cuts pays no rating').is.undefined;
    });

    it('the hand reads the same counted M€ off the server (`countedPlayEffects`)', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1, t.p1]]]);
      const counted = chip(countedPlayEffects(t.p1, t.card), Resource.MEGACREDITS);
      expect(counted?.amount).eq(8);
      expect(counted?.basis?.map((b) => b.count)).deep.eq([2]);
    });
  });

  describe('rule 5 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Venus + Colonies; absent without either', () => {
      expect(dealt({prelude2Expansion: true, venusNextExtension: true, coloniesExtension: true})).include(CardName.VENUS_ALLIES);
      expect(dealt({prelude2Expansion: true, venusNextExtension: false, coloniesExtension: true})).not.include(CardName.VENUS_ALLIES);
      expect(dealt({prelude2Expansion: true, venusNextExtension: true, coloniesExtension: false})).not.include(CardName.VENUS_ALLIES);
    });

    it('save / reload: an ordinary played card, the Venus scale kept', () => {
      const t = table(12);
      arrangeColonies(t.game, [[new Luna(), [t.p1]]]);
      play(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      expect(reloaded.getPlayerById(t.p1.id).tableau.has(CardName.VENUS_ALLIES)).is.true;
      expect(reloaded.getVenusScaleLevel()).eq(16);
    });

    it('MarsBot at the table (the card brought in by hand): the human counts only the human\'s cubes', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, venusNextExtension: true});
      game.phase = Phase.ACTION;
      arrangeColonies(game, [[new Luna(), [human, bot]], [new Titan(), [bot]]]);
      const c = new VenusAllies();
      human.cardsInHand.push(c);
      human.megaCredits = 0;
      human.playCard(c);
      runAllActions(game);
      expect(human.megaCredits).eq(4);
    });
  });
});
