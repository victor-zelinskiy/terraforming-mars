import {expect} from 'chai';
import {runAllActions} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {SpecialPermit} from '../../../src/server/cards/prelude2/SpecialPermit';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Message} from '../../../src/common/logs/Message';
import {IGame} from '../../../src/server/IGame';
import {cast} from '../../../src/common/utils/utils';
import {PartyName} from '@/common/turmoil/PartyName';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Parliament} from '@/server/parliament/Parliament';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '@/server/models/unplayableReasons';
import {requiredPartyOf} from '@/server/cards/requirements/partyRequirementCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {BotanicalExperience} from '@/server/cards/pathfinders/BotanicalExperience';
import {Decomposers} from '@/server/cards/base/Decomposers';
import {MediaGroup} from '@/server/cards/base/MediaGroup';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('SpecialPermit', () => {
  let card: SpecialPermit;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  let player3: TestPlayer;
  let player4: TestPlayer;

  beforeEach(() => {
    card = new SpecialPermit();
    [game, player, player2, player3, player4] = testGame(4);
  });

  it('canPlay: requires opponent has at least 4 plants', () => {
    player2.plants = 3;
    expect(card.bespokeCanPlay(player)).is.false;

    player2.plants = 4;
    expect(card.bespokeCanPlay(player)).is.true;
  });

  it('canPlay: false when opponent plants are protected', () => {
    player2.plants = 4;
    player2.plantsAreProtected = () => true;
    expect(card.bespokeCanPlay(player)).is.false;
  });

  it('Play', () => {
    player.plants = 0;
    player2.plants = 4;

    card.play(player);
    runAllActions(game);
    const orOptions = cast(player.popWaitingFor(), OrOptions);

    expect(orOptions.options).has.lengthOf(1);
    orOptions.options[0].cb();
    expect(player.plants).to.equal(4);
    expect(player2.plants).to.equal(0);
  });

  it('Play: solo mode', () => {
    const [game, player] = testGame(1);
    player.plants = 0;

    card.play(player);
    runAllActions(game);

    expect(player.popWaitingFor()).is.undefined;
    expect(player.plants).to.equal(4);
  });

  it('Play: only players with 4+ plants are presented as targets', () => {
    player.plants = 1;
    player2.plants = 2;
    player3.plants = 4;
    player4.plants = 4;

    card.play(player);
    runAllActions(game);
    const orOptions = cast(player.popWaitingFor(), OrOptions);

    expect(orOptions.options).has.length(2);
    expect((orOptions.options[0].title as Message).data[2].value).eq(player3.color);
    expect((orOptions.options[1].title as Message).data[2].value).eq(player4.color);

    orOptions.options[0].cb();

    expect(player.plants).to.equal(5);
    expect(player2.plants).to.equal(2);
    expect(player3.plants).to.equal(0);
    expect(player4.plants).to.equal(4);
  });
});

/**
 * P82 — SPECIAL PERMIT IN THE PREMIUM SCOPE: the TWELFTH Prelude 2 card adapted IN PLACE, the eighth POLITICAL one and the
 * series' FIRST ATTACK (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 3 + 5). The rules did not change: the Greens' requirement
 * read through the facade, then «steal 4 plants from another player» — a MANDATORY steal whose target is ALWAYS asked
 * (invariant 3, one candidate too). The fork layer: the Redux marker, the text in the Redux voice, the attack's CAUSE
 * (the prompt names its card — Air Raid's shape) and the play preview (the target step + «+4 plants»).
 */
describe('SpecialPermit — on a Turmoil Redux table', () => {
  const G = PartyName.GREENS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, p3: TestPlayer, parliament: Parliament, card: SpecialPermit};

  /** A three-seat Redux + Colonies + Prelude 2 table in the action phase — p2 6 plants, p3 3 (the near miss), the card in hand. */
  function table(): Table {
    const [game, p1, p2, p3] = testGame(3, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new SpecialPermit();
    p1.cardsInHand.push(card);
    p1.megaCredits = 10;
    p2.plants = 6;
    p3.plants = 3;
    return {game, p1, p2, p3, parliament: game.parliament!, card};
  }

  /** Three QUIET resolutions up for the vote — the Greens' in slot 0 — and the REDS' law enacted: the card is locked. */
  function lockedTable(): Table {
    const t = table();
    ([G, PartyName.MARS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
    expect(t.parliament.rulingParty()).eq(PartyName.REDS);
    return t;
  }

  function play(t: Table): OrOptions {
    t.p1.playCard(t.card);
    runAllActions(t.game);
    return cast(t.p1.popWaitingFor(), OrOptions);
  }

  const titlePlayer = (o: {title: unknown}) => (o.title as Message).data[2]?.value;

  it('rule 1 — the printed card: an event, 5, a Plant tag, no VP, the Greens\' plate, P82; political, marked for Redux', () => {
    const c = new SpecialPermit();
    expect(c.name).eq(CardName.SPECIAL_PERMIT);
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(5);
    expect(c.tags).deep.eq([Tag.PLANT]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(G);
    expect(c.metadata.cardNumber).eq('P82');
    expect(c.metadata.description).eq('Requires that Greens are ruling or that you have 2 delegates there. Steal 4 plants from another player.');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.SPECIAL_PERMIT];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
  });

  describe('rule 2 — the requirement: the GREENS rule, or 2 of your delegates on their resolution', () => {
    it('a fresh Redux table opens with the Greens ruling — playable from the first turn', () => {
      const t = table();
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Reds rule, one delegate on the Greens\' resolution: locked with the NAMED reason «1 of 2»', () => {
      const t = lockedTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 1,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('the Reds rule, two delegates on the Greens\' resolution: playable', () => {
      const t = lockedTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('paid with M€ only — no steel, no titanium', () => {
      const t = table();
      const options = t.p1.paymentOptionsForCard(t.card);
      expect(options.steel).is.false;
      expect(options.titanium).is.false;
    });
  });

  describe('rule 3 — the targets: opponents with 4 unprotected plants', () => {
    it('nobody holds 4: unplayable, and the hand NAMES why (never a bare «unavailable»)', () => {
      const t = table();
      t.p2.plants = 3;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'target', message: 'No player to steal 4 plants from'}]);
    });

    it('protected plants are no target; Botanical Experience needs 8', () => {
      const t = table();
      t.p2.plantsAreProtected = () => true;
      expect(t.card.bespokeCanPlay(t.p1)).is.false;
      const u = table();
      u.p2.playedCards.push(new BotanicalExperience());
      u.p2.plants = 7;
      expect(u.card.bespokeCanPlay(u.p1)).is.false;
      u.p2.plants = 8;
      expect(u.card.bespokeCanPlay(u.p1)).is.true;
    });

    it('solo without a bot: +4 plants, no question', () => {
      const [game, player] = testGame(1, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
      game.phase = Phase.ACTION;
      runAllActions(game);
      player.popWaitingFor(); // the solo table's own opening prompt (the colony pick) — not this card's
      const card = new SpecialPermit();
      expect(card.bespokeCanPlay(player)).is.true;
      expect(card.unplayableReason(player)).is.undefined;
      const plants = player.plants;
      player.playCard(card);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(player.plants - plants).eq(4);
    });
  });

  describe('rule 4 — the play: ONE attack prompt naming its card, the target always shown', () => {
    it('the prompt carries the card as its cause (attack mode); ONE candidate is still a question; the near miss is shown disabled', () => {
      const t = table();
      const orOptions = play(t);
      expect(orOptions.choiceContext?.source.card).eq(CardName.SPECIAL_PERMIT);
      expect(orOptions.choiceContext?.mode).eq('attack');
      expect(orOptions.options).has.length(1);
      expect(titlePlayer(orOptions.options[0])).eq(t.p2.color);
      const disabled = orOptions.disabledOptions;
      expect(disabled.map((d) => (d.metadata as {player?: {color: string}} | undefined)?.player?.color)).deep.eq([t.p3.color]);
      expect(disabled[0].reason).eq('Not enough to steal');
    });

    it('the answer moves 4: the thief +4, the target −4, the rest untouched', () => {
      const t = table();
      const plants = t.p1.plants;
      play(t).options[0].cb();
      runAllActions(t.game);
      expect(t.p1.plants - plants).eq(4);
      expect(t.p2.plants).eq(2);
      expect(t.p3.plants).eq(3);
      expect(t.p1.playedCards.some((c) => c.name === CardName.SPECIAL_PERMIT)).is.true;
    });

    it('the plant-tagged event wakes the table: Decomposers (+1 microbe) and Media Group (+3 M€) record their reactions, caused by P82', () => {
      const t = table();
      const decomposers = new Decomposers();
      const mediaGroup = new MediaGroup();
      t.p1.playedCards.push(decomposers, mediaGroup);
      const mc = t.p1.megaCredits;
      play(t).options[0].cb();
      runAllActions(t.game);
      expect(decomposers.resourceCount).eq(1);
      expect(t.p1.megaCredits - mc, '+3 from Media Group (`playCard` takes no payment)').eq(3);
      const reactions = t.game.cardReactions.filter((r) => r.owner === t.p1.color && (r.card === CardName.DECOMPOSERS || r.card === CardName.MEDIA_GROUP));
      expect(reactions.map((r) => r.card)).to.have.members([CardName.DECOMPOSERS, CardName.MEDIA_GROUP]);
      for (const r of reactions) {
        expect(r.cause?.card, r.card).eq(CardName.SPECIAL_PERMIT);
      }
    });
  });

  describe('rule 5 — the forecast, the deal, save / reload, MarsBot', () => {
    it('the play preview: the target step (the same picker) and «+4 plants»; read-only', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind).eq('bespoke');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.find((e) => e.direction === 'gain' && e.icon === 'plants'), JSON.stringify(effects)).deep.include({amount: 4});
      const steps = preview.branches.flatMap((b) => b.steps ?? []);
      expect(steps, 'one step: the target').has.length(1);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      const dealt = (opts: Partial<GameOptions>) => new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true})).include(CardName.SPECIAL_PERMIT);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: false})).not.include(CardName.SPECIAL_PERMIT);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.SPECIAL_PERMIT)).is.false;
    });

    it('save / reload: the save point is the action start (the deferred steal is never serialized) — the replayed play asks the same question', () => {
      const t = table();
      t.game.generation = 2;
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      const card = owner.cardsInHand.find((c) => c.name === CardName.SPECIAL_PERMIT);
      expect(card, 'the card is still in hand').is.not.undefined;
      owner.playCard(card!);
      runAllActions(reloaded);
      const asked = cast(owner.getWaitingFor(), OrOptions);
      expect(asked.choiceContext?.source.card).eq(CardName.SPECIAL_PERMIT);
      expect(asked.options.map(titlePlayer)).deep.eq([t.p2.color]);
    });

    it('MarsBot is a seat of the table: its plant storage + M€ supply is the attackable stock, asked like any rival', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      bot.megaCredits = 0;
      game.automa!.shippingStorage[ColonyName.GANYMEDE] = 0;
      const c = new SpecialPermit();
      human.cardsInHand.push(c);
      human.megaCredits = 10;
      expect(c.bespokeCanPlay(human), 'nothing to steal').is.false;
      game.automa!.shippingStorage[ColonyName.GANYMEDE] = 2;
      bot.megaCredits = 5;
      expect(c.bespokeCanPlay(human), '2 plants + 5 M€ proxy').is.true;
      const plants = human.plants;
      human.playCard(c);
      runAllActions(game);
      const asked = cast(human.popWaitingFor(), OrOptions);
      expect(asked.choiceContext?.source.card).eq(CardName.SPECIAL_PERMIT);
      expect(asked.options.map(titlePlayer)).deep.eq([bot.color]);
      asked.options[0].cb();
      runAllActions(game);
      expect(human.plants - plants).eq(4);
      expect(game.automa!.shippingStorage[ColonyName.GANYMEDE]).eq(0);
    });
  });
});
