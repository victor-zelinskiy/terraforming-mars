import {expect} from 'chai';
import {RedAppeasement} from '@/server/cards/prelude2/RedAppeasement';
import {PartyName} from '@/common/turmoil/PartyName';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {setRulingParty} from '../../TestingUtils';
import {runAllActions} from '../../TestingUtils';
import {cast} from '@/common/utils/utils';
import {SummitLogistics} from '@/server/cards/prelude2/SummitLogistics';
import {BackroomDeal} from '@/server/cards/turmoilRedux/BackroomDeal';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {Parliament} from '@/server/parliament/Parliament';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectProjectCardToPlay} from '@/server/inputs/SelectProjectCardToPlay';
import {Payment} from '@/common/inputs/Payment';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '@/server/models/unplayableReasons';
import {requiredPartyOf} from '@/server/cards/requirements/partyRequirementCards';
import {armedPlayEffectsOf} from '@/server/cards/armedPlayEffects';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Phase} from '@/common/Phase';
import {ResolutionId} from '@/common/parliament/ParliamentTypes';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('RedAppeasement', () => {
  let card: RedAppeasement;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new RedAppeasement();
    [game, player, player2] = testGame(3, {turmoilExtension: true});
  });

  for (const run of [
    {redsRuling: false, anyPassed: false, expected: false},
    {redsRuling: true, anyPassed: true, expected: false},
    {redsRuling: true, anyPassed: false, expected: true},
  ] as const) {
    it('canPlay ' + JSON.stringify(run), () => {
      setRulingParty(game, run.redsRuling ? PartyName.REDS : PartyName.GREENS);
      if (run.anyPassed) {
        player2.pass();
      }

      expect(card.canPlay(player)).to.eq(run.expected);
    });
  }

  it('play', () => {
    setRulingParty(game, PartyName.REDS);

    card.play(player);

    expect(player.production.megacredits).to.eq(2);
    expect(game.getPassedPlayers()).includes(player.color);
  });
});

/**
 * P80 — RED APPEASEMENT IN THE PREMIUM SCOPE: the fourth Prelude 2 card adapted IN PLACE, the second POLITICAL one (the
 * Reds) and the FIRST whose PLAY IS A PASS (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 2 + 5). The rules did not change:
 * the party half of the requirement reads the facade (the Reds rule, or 2 of the player's delegates on their
 * resolution), the bespoke half is upstream's «no player has passed», the production is `behavior`, the pass is
 * `bespokePlay → player.pass()` — and the action loop hands the turn on by itself. The work was the marker, the NAMED
 * reason for the bespoke half, the play preview's structural `passes` mark and the honest face.
 */
describe('RedAppeasement — on a Turmoil Redux table', () => {
  const R = PartyName.REDS;
  const PASSED_REASON = 'Already passed this generation: ${0}';

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RedAppeasement};

  /** A two-seat Redux + Prelude 2 table in the action phase, the card in p1's hand, three quiet resolutions up for the vote. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new RedAppeasement();
    p1.cardsInHand.push(card);
    const parliament = game.parliament!;
    ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    return {game, p1, p2, parliament, card};
  }

  /** The Reds rule: their quiet resolution (Heat Capture — a Building-tag discount, nothing for this card) stands enacted. */
  function redsRuling(): Table {
    const t = table();
    seatEnacted(t.parliament, quietResolutionOf(R));
    expect(t.parliament.rulingParty()).eq(R);
    return t;
  }

  /** p1 plays the card through the REAL action loop: the menu's «play project card» answered by `process`. */
  function playThroughMenu(t: Table): void {
    t.p1.takeAction();
    const menu = cast(t.p1.getWaitingFor(), OrOptions);
    const index = menu.options.findIndex((o) => o instanceof SelectProjectCardToPlay);
    expect(index, 'the play option is on the menu').gte(0);
    t.p1.process({type: 'or', index, response: {type: 'projectCard', card: CardName.RED_APPEASEMENT, payment: Payment.EMPTY}});
    runAllActions(t.game);
  }

  const reasonsOf = (t: Table) => unplayableReasons(t.p1, t.card);

  /** TR70 Backroom Deal PLAYED by p1 (2 M€): its party waiver and discount armed for the next card — the real arm. */
  function armBackroomDeal(t: Table): void {
    t.p1.megaCredits = 2;
    const deal = new BackroomDeal();
    t.p1.cardsInHand.push(deal);
    t.p1.playCard(deal, Payment.of({megacredits: 2}));
    runAllActions(t.game);
    expect(t.p1.lastCardPlayed).eq(CardName.BACKROOM_DEAL);
  }

  it('rule 1 — the printed card: an event, 0, no tags, no VP, the Reds\' plate with its footnote, P80; political, marked for Redux', () => {
    const c = new RedAppeasement();
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(0);
    expect(c.tags).deep.eq([]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(R);
    expect(c.metadata.cardNumber).eq('P80');
    expect(c.metadata.requirementFootnote, 'the print\'s «*» beside the plate').is.true;
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.RED_APPEASEMENT];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
    const json = JSON.stringify(c.metadata.renderData);
    expect(json, 'the rule lives in `description`, not in a `plainText` row').not.include('Requires that');
    expect(String(c.metadata.description)).include('This counts as passing');
  });

  describe('rule 2 — the requirement: the Reds\' two roads AND no other player has passed', () => {
    it('neither road: unplayable with the party\'s own reason «0 of 2» — and no generic «unmet conditions»', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.false;
      const reasons = reasonsOf(t);
      expect(reasons[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, party: R, current: 0, requirement: true});
      expect(reasons.map((r) => r.message)).not.include('Card is unavailable due to unmet conditions');
    });

    it('the Reds rule, nobody passed: playable', () => {
      const t = redsRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(reasonsOf(t)).deep.eq([]);
    });

    it('two delegates on their resolution, nobody passed: playable (the second road)', () => {
      const t = table();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the Reds rule but p2 has passed: unplayable, and the reason NAMES p2 — never the generic line', () => {
      const t = redsRuling();
      t.p2.pass();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(reasonsOf(t)).deep.eq([{type: 'rule', message: PASSED_REASON, params: [t.p2.name]}]);
    });

    it('neither road AND p2 passed: both reasons, the party first', () => {
      const t = table();
      t.p2.pass();
      expect(reasonsOf(t).map((r) => r.type)).deep.eq(['party', 'rule']);
    });

    it('several seats passed: ONE line naming each of them in generation order', () => {
      const [game, p1, p2, p3] = testGame(3, {turmoilExtension: true, prelude2Expansion: true});
      game.phase = Phase.ACTION;
      setRulingParty(game, R);
      const c = new RedAppeasement();
      p3.pass();
      p2.pass();
      expect(unplayableReasons(p1, c).filter((r) => r.type === 'rule')).deep.eq([
        {type: 'rule', message: PASSED_REASON, params: [`${p2.name}, ${p3.name}`]},
      ]);
    });

    it('a party waiver armed (TR70 Backroom Deal) lifts the PARTY half only — a pass still stands', () => {
      const t = table();
      armBackroomDeal(t);
      expect(t.p1.canPlay(t.card), 'the waiver opens the Reds\' half').is.true;
      t.p2.pass();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(reasonsOf(t)).deep.eq([{type: 'rule', message: PASSED_REASON, params: [t.p2.name]}]);
    });
  });

  describe('rule 3 — the play: +2 M€ production, THEN the pass; the loop hands the turn on', () => {
    it('production +2 and p1 among the passed; the turn goes to p2', () => {
      const t = redsRuling();
      const production = t.p1.production.megacredits;
      expect(t.game.activePlayer.id).eq(t.p1.id);
      playThroughMenu(t);
      expect(t.p1.production.megacredits - production).eq(2);
      expect(t.game.getPassedPlayers()).deep.eq([t.p1.color]);
      expect(t.game.activePlayer.id, 'p1 passed — p2 acts').eq(t.p2.id);
      expect(t.p1.cardsInHand.map((c) => c.name)).not.include(CardName.RED_APPEASEMENT);
      expect(t.p1.tableau.has(CardName.RED_APPEASEMENT), 'an event — on the events pile').is.true;
    });

    it('the journal: ONE play — «played», the production, then «passed»', () => {
      const t = redsRuling();
      const from = t.game.events.events.length;
      const logFrom = t.game.gameLog.length;
      playThroughMenu(t);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color);
      const production = mine.find((e) => (e.impact?.production?.megacredits ?? 0) === 2);
      expect(production, JSON.stringify(mine.map((e) => e.type))).is.not.undefined;
      const lines = t.game.gameLog.slice(logFrom).map((l) => l.message);
      const played = lines.indexOf('${0} played ${1}');
      const passed = lines.indexOf('${0} passed');
      expect(played, JSON.stringify(lines)).gte(0);
      expect(passed, JSON.stringify(lines)).gt(played);
    });

    it('an armed «next card only» effect is SPENT by this play — not lost, not carried into the next generation', () => {
      const t = table();
      armBackroomDeal(t);
      expect(armedPlayEffectsOf(t.p1).length).gt(0);
      playThroughMenu(t);
      expect(t.p1.production.megacredits, 'the waiver let it through').eq(2);
      expect(t.p1.lastCardPlayed, 'the pass clears the slot — nothing armed survives').is.undefined;
      expect(armedPlayEffectsOf(t.p1)).deep.eq([]);
    });

    it('an armed LAW waiver (RX36) is cleared by the pass', () => {
      const t = redsRuling();
      t.p1.armedLawWaiver = 'RX36' as ResolutionId;
      playThroughMenu(t);
      expect(t.p1.armedLawWaiver).is.undefined;
    });
  });

  describe('rule 4 — the forecast before the press: the production chip AND the structural «this play passes»', () => {
    it('the play preview: «M€ production 0 → 2», `passes: true`; read-only', () => {
      const t = redsRuling();
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.passes).eq(true);
      const effects = preview.branches.flatMap((b) => b.effects);
      const production = effects.find((e) => e.note === 'production' && e.icon === 'megacredits');
      expect(production, JSON.stringify(effects)).deep.include({direction: 'gain', amount: 2, current: 0, resulting: 2});
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('`passes` is the hook\'s alone: a declarative play never carries it', () => {
      const t = redsRuling();
      const other = new SummitLogistics();
      t.p1.cardsInHand.push(other);
      expect(cardPlayPreview(t.p1, other).passes).is.undefined;
    });
  });

  describe('rule 5 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true})).include(CardName.RED_APPEASEMENT);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: false})).not.include(CardName.RED_APPEASEMENT);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.RED_APPEASEMENT)).is.false;
    });

    it('save / reload after the play: p1 is still a seat that passed, its production kept', () => {
      const t = redsRuling();
      playThroughMenu(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      expect(reloaded.getPassedPlayers()).deep.eq([t.p1.color]);
      expect(reloaded.getPlayerById(t.p1.id).production.megacredits).eq(2);
    });

    it('MarsBot passed (its action deck ran out — rulebook p.5): the reason names the BOT', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      seatEnacted(parliament, quietResolutionOf(R));
      const c = new RedAppeasement();
      human.cardsInHand.push(c);
      expect(human.canPlay(c)).is.true;
      // The controller's own move at an empty action deck (`AutomaController` — «it passes for the round»).
      game.playerHasPassed(bot);
      expect(human.canPlay(c)).is.false;
      expect(unplayableReasons(human, c)).deep.eq([{type: 'rule', message: PASSED_REASON, params: [bot.name]}]);
    });
  });
});
