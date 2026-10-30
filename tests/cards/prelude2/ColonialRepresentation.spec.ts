import {expect} from 'chai';
import {ColonialRepresentation} from '../../../src/server/cards/prelude2/ColonialRepresentation';
import {PartyName} from '../../../src/common/turmoil/PartyName';
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
import {Parliament} from '../../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../../src/server/parliament/SerializedParliament';
import {COLONIAL_AFFAIRS_ID} from '../../../src/server/parliament/resolutions/unity/ColonialAffairs';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {influenceAtAgenda, resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {grantEligibility} from '../../../src/common/parliament/seatGrant';
import {runAllActions} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';

describe('ColonialRepresentation', () => {
  let card: ColonialRepresentation;
  let player: TestPlayer;
  let game: IGame;
  beforeEach(() => {
    card = new ColonialRepresentation();
    [game, player] = testGame(1, {turmoilExtension: true});
  });

  it('Influence check', () => {
    game.turmoil!.sendDelegateToParty(player, PartyName.SCIENTISTS, game);
    game.turmoil!.sendDelegateToParty(player, PartyName.SCIENTISTS, game);
    game.turmoil!.sendDelegateToParty(player, PartyName.SCIENTISTS, game);
    card.play(player);
    expect(game.turmoil!.getInfluence(player)).to.eq(3);
  });

  it('Megacredits check', () => {
    const colony1 = new Luna();
    const colony2 = new Pluto();
    colony1.colonies.push(player.id);
    game.colonies.push(colony1);
    colony2.colonies.push(player.id);
    game.colonies.push(colony2);

    card.play(player);
    expect(player.megaCredits).eq(6);
  });
});

/**
 * P71 — COLONIAL REPRESENTATION IN THE PREMIUM SCOPE: the NINTH Prelude 2 card adapted IN PLACE, the fifth POLITICAL
 * one and the first whose payoff is READ IN THE SITTING'S RESULTS (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 5).
 * The rules did not change: `behavior.turmoil.influenceBonus` goes through the political facade with the card's
 * name as its giver (T05's class — `PoliticalOps.addInfluenceBonus(player, 1, card.name)`), `Parliament.influence`
 * is the Career's level plus every bonus, and the M€ are a counted stock gain over the player's colony cubes. The
 * work was the marker, and the results screen that is the one place the +1 is seen at work (Colonial Affairs'
 * k = 2 + ⌊influence / 2⌋ — ledger CY).
 */
describe('ColonialRepresentation — on a Turmoil Redux table', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: ColonialRepresentation};

  /** A two-seat Redux table (Colonies on — Redux requires it) in the action phase, the card in hand, 20 M€; p1's Career at step 1 (level 1). */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new ColonialRepresentation();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    const parliament = game.parliament!;
    parliament.agenda.set(p1.id, 1);
    expect(parliament.influence(p1), 'the track alone: step 1 → level 1').eq(1);
    return {game, p1, p2, parliament, card};
  }

  /** THE TABLE: the tiles in this order, each with the given seats' cubes on it (activated — a cube can only stand on an active tile). */
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

  function reload(game: IGame): IGame {
    return Game.deserialize(structuredClone(game.serialize()));
  }

  it('rule 1 — the printed card: blue, 10, no tags, no VP, no requirement; P71; Colonies + Turmoil, marked Redux', () => {
    const c = new ColonialRepresentation();
    expect(c.type).eq(CardType.ACTIVE);
    expect(c.cost).eq(10);
    expect(c.tags).deep.eq([]);
    expect(c.victoryPoints).is.undefined;
    expect(c.requirements).deep.eq([]);
    expect(c.behavior?.turmoil).deep.eq({influenceBonus: 1});
    expect(c.metadata.cardNumber).eq('P71');
    expect(PRELUDE2_CARD_MANIFEST.projectCards[CardName.COLONIAL_REPRESENTATION]).deep.include({
      compatibility: ['colonies', 'turmoil'], politics: 'redux',
    });
  });

  it('rule 1 — paid with M€ only: no tag takes steel or titanium', () => {
    const t = table();
    const options = t.p1.paymentOptionsForCard(t.card);
    expect(options.steel).is.false;
    expect(options.titanium).is.false;
  });

  describe('rule 2 — +1 influence beyond the Career, with its giver', () => {
    it('the bonus is 1, its source is the card, the influence is the track\'s level + 1; the Career does not move', () => {
      const t = table();
      play(t);
      expect(t.parliament.influenceBonusOf(t.p1)).eq(1);
      expect(t.parliament.influenceSourcesOf(t.p1)).deep.eq([{amount: 1, source: CardName.COLONIAL_REPRESENTATION}]);
      expect(t.parliament.influence(t.p1)).eq(influenceAtAgenda(1) + 1).eq(2);
      expect(t.parliament.agendaOf(t.p1), 'a bonus is not a step of the Career').eq(1);
      expect(t.p1.tableau.has(CardName.COLONIAL_REPRESENTATION)).is.true;
    });

    it('the journal: ONE facade line naming the giver and the whole influence before → after, and ONE `influence-changed` event', () => {
      const t = table();
      const from = t.game.events.events.length;
      play(t);
      const lines = t.game.gameLog.filter((entry) => entry.message === '${0} gained +${1} influence from ${2} (${3} → ${4})');
      expect(lines.map((l) => l.data.map((d) => d.value))).deep.eq([[t.p1.color, '1', CardName.COLONIAL_REPRESENTATION, '1', '2']]);
      const events = t.game.events.events.slice(from).filter((e) => e.type === 'influence-changed');
      expect(events.map((e) => e.impact.influence)).deep.eq([{before: 1, after: 2, amount: 1}]);
      expect(events[0].source).deep.include({card: CardName.COLONIAL_REPRESENTATION});
    });

    it('the opponent\'s influence is untouched', () => {
      const t = table();
      const before = t.parliament.influence(t.p2);
      play(t);
      expect(t.parliament.influence(t.p2)).eq(before);
      expect(t.parliament.influenceSourcesOf(t.p2)).deep.eq([]);
    });

    it('the seat model carries the FINAL influence and its source', () => {
      const t = table();
      play(t);
      const mine = getParliamentModel(t.game, t.p1)!.players.find((p) => p.color === t.p1.color)!;
      expect(mine).deep.include({agenda: 1, influence: 2});
      expect(mine.influenceSources).deep.eq([{amount: 1, source: CardName.COLONIAL_REPRESENTATION}]);
    });

    it('a seat the Parliament does not count (MarsBot under `none`) holds the bonus and applies none of it', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'none'});
      game.politics!.addInfluenceBonus(bot, 1, CardName.COLONIAL_REPRESENTATION);
      expect(game.parliament!.influenceBonusOf(bot), 'stored').eq(1);
      expect(game.parliament!.influence(bot), 'not applied').eq(0);
    });
  });

  describe('rule 3 — 3 M€ per colony cube of the player\'s', () => {
    it('no colonies: 0 M€ (the card is still played, the influence still given)', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p2]]]);
      play(t);
      expect(t.p1.megaCredits, '`playCard` pays no price — the gain alone').eq(20);
      expect(t.parliament.influence(t.p1)).eq(2);
    });

    it('two colonies (Luna · Pluto): +6 M€; the opponent\'s cubes are not counted', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1, t.p2]], [new Pluto(), [t.p1]], [new Titan(), [t.p2]]]);
      play(t);
      expect(t.p1.megaCredits, '`playCard` pays no price — the gain alone').eq(26);
    });

    it('a tile carrying TWO of the player\'s cubes counts twice (as `ColoniesHandler` counts them)', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1, t.p1]]]);
      play(t);
      expect(t.p1.megaCredits).eq(20 + 6);
    });
  });

  describe('rule 4 — the FINAL influence is APPLIED: Colonial Affairs k 2 → 3, a grant line «influence 2+»', () => {
    /** Colonial Affairs up for the vote with p2's delegate on it (p2 wins; p1 is paid by its own influence, its Career unmoved). */
    function colonialSitting(t: Table): void {
      seatResolution(t.parliament, 0, resolutionInstanceId(COLONIAL_AFFAIRS_ID, 0));
      t.parliament.placeVote(t.p2, t.parliament.slots[0], 'lobby');
      arrangeColonies(t.game, [[new Luna(), [t.p1]]]);
    }

    function lunaRecord(t: Table): SerializedEnactOutcome | undefined {
      const outcomes = t.parliament.phase?.summary?.outcomes ?? t.parliament.lastPhase?.outcomes ?? [];
      return outcomes.find((o) => o.player === t.p1.id && o.step === 'colony:Luna');
    }

    it('without the card: Career 1 → k = 2, Luna pays 4 M€', () => {
      const t = table();
      colonialSitting(t);
      endGenerationThroughParliament(t.game);
      settleParliamentGates(t.game);
      expect(lunaRecord(t)).deep.include({amount: 4, influence: 1, multiplier: 2});
    });

    it('with the card: Career 1 + 1 → k = 3, Luna pays 6 M€', () => {
      const t = table();
      colonialSitting(t);
      play(t);
      endGenerationThroughParliament(t.game);
      settleParliamentGates(t.game);
      expect(lunaRecord(t)).deep.include({amount: 6, influence: 2, multiplier: 3});
    });

    it('a threshold grant «the winner and every player with influence 2+» reaches the seat the card lifted over its line', () => {
      const t = table();
      const recipients = {kind: 'threshold', winner: true, influenceAtLeast: 2} as const;
      expect(grantEligibility(recipients, {winner: false, influence: t.parliament.influence(t.p1)})).eq('none');
      play(t);
      expect(grantEligibility(recipients, {winner: false, influence: t.parliament.influence(t.p1)})).eq('influence');
    });
  });

  describe('rule 5 — the preview, the deal, save / reload, MarsBot', () => {
    it('the play preview: «influence 1 → 2» and «+6 M€», read-only', () => {
      const t = table();
      arrangeColonies(t.game, [[new Luna(), [t.p1]], [new Pluto(), [t.p1]]]);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.find((e) => e.icon === 'influence'), JSON.stringify(effects)).deep.include({direction: 'gain', amount: 1, current: 1, resulting: 2});
      expect(effects.find((e) => e.icon === 'megacredits' && e.direction === 'gain'), JSON.stringify(effects)).deep.include({amount: 6});
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      const dealt = (opts: Partial<GameOptions>) => new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true})).include(CardName.COLONIAL_REPRESENTATION);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: false})).not.include(CardName.COLONIAL_REPRESENTATION);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.COLONIAL_REPRESENTATION)).is.false;
    });

    it('save / reload: the bonus survives with its source, the influence is read the same', () => {
      const t = table();
      play(t);
      const reloaded = reload(t.game);
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(reloaded.parliament!.influenceSourcesOf(owner)).deep.eq([{amount: 1, source: CardName.COLONIAL_REPRESENTATION}]);
      expect(reloaded.parliament!.influence(owner)).eq(2);
      expect(owner.tableau.has(CardName.COLONIAL_REPRESENTATION)).is.true;
    });

    it('MarsBot at the table (the card brought in by hand): the human plays it, the bonus is the human\'s', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const c = new ColonialRepresentation();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      const before = game.parliament!.influence(human);
      human.playCard(c);
      runAllActions(game);
      expect(game.parliament!.influence(human)).eq(before + 1);
      expect(game.parliament!.influenceBonusOf(bot)).eq(0);
    });
  });
});
