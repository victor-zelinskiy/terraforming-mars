import {expect} from 'chai';
import {POLITICAL_ALLIANCE_RESOLUTIONS, POLITICAL_ALLIANCE_STEPS, PoliticalAllianceRedux} from '../../../src/server/cards/turmoilRedux/PoliticalAllianceRedux';
import {PoliticalAlliance} from '../../../src/server/cards/turmoil/PoliticalAlliance';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {BackroomDeal} from '../../../src/server/cards/turmoilRedux/BackroomDeal';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {newCard} from '../../../src/server/createCard';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Payment} from '../../../src/common/inputs/Payment';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {LEADERSHIP_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {replacementCardNumber} from '../../../src/common/cards/turmoilReduxReplacements';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {AgendaWalkModel} from '../../../src/common/models/ActionPreviewModel';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {toName} from '../../../src/common/utils/utils';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, testGame} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

/** The ruling Greens' answer to a walked step's rating, MEASURED by the walk (`AgendaAdvanceStep.answer` — 2 M€ per TR). */
const GREENS_ANSWER = {answer: {stock: {megacredits: 2}}};

/**
 * TR73 — POLITICAL ALLIANCE (Redux replacement of the classic X09). The card
 * file declares everything; every rule reading of its header is pinned here on
 * the real card: the printed card (two delegate figures in the MIN plate, 2 M€,
 * one Agenda step — TR73 by its registry row), the requirement read by the
 * facade's `partiesLedBy` (the leader of a resolution of the voting area — ties
 * to the earlier first delegate, neutrals never lead), the named reason, the
 * walk (the TR04 path), the deal, save / load.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: PoliticalAllianceRedux};

/** A two-seat Redux table in the action phase, three quiet resolutions up for the vote, the card in hand, 20 M€. */
function table(position = 1): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([PartyName.GREENS, PartyName.MARS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  parliament.agenda.set(p1.id, position);
  const card = new PoliticalAllianceRedux();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

function vote(t: {parliament: Parliament}, player: IPlayer, slot: number, times = 1): void {
  for (let i = 0; i < times; i++) {
    t.parliament.placeVote(player, t.parliament.slots[slot], 'reserve');
  }
}

/** p1 leads slots 0 and 1 outright. */
function leading(position = 1): Table {
  const t = table(position);
  vote(t, t.p1, 0);
  vote(t, t.p1, 1);
  return t;
}

function walkOf(t: Table): AgendaWalkModel {
  const step = cardPlayPreview(t.p1, t.card).branches[0].steps.find((s) => s.kind === 'agendaWalk');
  expect(step, 'the walk is a step of the preview').is.not.undefined;
  return (step as {kind: 'agendaWalk', walk: AgendaWalkModel}).walk;
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('PoliticalAllianceRedux', () => {
  it('the printed card: an EVENT for 2, no tags, no VP, the leadership plate «2», one Agenda-step unit; TR73, reimplementing X09', () => {
    const c = new PoliticalAllianceRedux();
    expect(c.name).eq(CardName.POLITICAL_ALLIANCE_REDUX);
    expect(c.name, 'the classic name with the `:redux` suffix').eq('Political Alliance:redux');
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost, 'the classic card cost 4').eq(2);
    expect(new PoliticalAlliance().cost).eq(4);
    expect(c.tags).deep.eq([]);
    expect(c.victoryPoints).is.undefined;
    expect(c.requirements).deep.eq([{partyLeader: 2, count: 2}]);
    expect(POLITICAL_ALLIANCE_RESOLUTIONS).eq(2);
    expect(requiredPartyOf(c), 'leadership is not a PARTY requirement (TR70\'s waiver, Think Tank\'s pool)').is.undefined;
    expect(c.behavior, 'no «+1 TR» — the classic reward is gone').is.undefined;
    const rows = (c.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
    const items = rows.flat().filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
    expect(items.map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.AGENDA_STEP, POLITICAL_ALLIANCE_STEPS]]);
    expect(POLITICAL_ALLIANCE_STEPS).eq(1);
    expect(c.metadata.cardNumber, 'the THIRD registry row').eq('TR73');
    expect(replacementCardNumber(CardName.POLITICAL_ALLIANCE)).eq('TR73');
    expect(c.metadata.reimplements, 'the art and the lore are the classic X09\'s').eq(CardName.POLITICAL_ALLIANCE);
    expect(new PoliticalAlliance().metadata.cardNumber).eq('X09');
    expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.POLITICAL_ALLIANCE_REDUX]?.compatibility).is.undefined;
    expect(newCard(CardName.POLITICAL_ALLIANCE_REDUX)).to.be.instanceOf(PoliticalAllianceRedux);
    expect(newCard(CardName.POLITICAL_ALLIANCE), 'the plain name stays the classic card').to.be.instanceOf(PoliticalAlliance);
  });

  describe('rule 1 — the leader of 2 resolutions of the voting area at once', () => {
    it('(а) more delegates than the rival on two resolutions: playable, no reason', () => {
      const t = table();
      vote(t, t.p1, 0, 2);
      vote(t, t.p2, 0);
      vote(t, t.p1, 1);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('(б) a tie goes to whoever put a delegate in FIRST — the rival first: not a lead; the player first: a lead', () => {
      const t = table();
      vote(t, t.p1, 0);
      vote(t, t.p2, 1);
      vote(t, t.p1, 1);
      expect(t.p1.canPlay(t.card), 'the rival\'s delegate came first on slot 1').is.false;
      const u = table();
      vote(u, u.p1, 0);
      vote(u, u.p1, 1);
      vote(u, u.p2, 1);
      expect(u.p1.canPlay(u.card), 'the player\'s delegate came first on slot 1').is.true;
    });

    it('(в) neutral delegates never lead among players and never stand in the way: three neutrals and one of mine — I lead', () => {
      const t = table();
      vote(t, t.p1, 0);
      t.parliament.addNeutralVote(t.parliament.slots[1]);
      t.parliament.addNeutralVote(t.parliament.slots[1]);
      t.parliament.addNeutralVote(t.parliament.slots[1]);
      vote(t, t.p1, 1);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('(г) only neutral delegates on a resolution: no player leads it', () => {
      const t = table();
      vote(t, t.p1, 0);
      t.parliament.addNeutralVote(t.parliament.slots[1]);
      expect(t.game.politics!.partiesLedBy(t.p1)).eq(1);
      expect(t.p1.canPlay(t.card)).is.false;
      const row = unplayableReasons(t.p1, t.card)[0].leadership?.trailing.find((r) => r.resolution === t.parliament.resolutionOf(t.parliament.slots[1].instance).id);
      expect(row).deep.include({leader: 'neutral', short: 1});
    });

    it('(д) the ENACTED resolution is not in the voting area — it never counts', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(PartyName.UNITY));
      vote(t, t.p1, 0);
      expect(t.parliament.enacted).is.not.undefined;
      expect(t.game.politics!.partiesLedBy(t.p1), 'only the voting area\'s slots are read').eq(1);
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('(е) MarsBot\'s delegates are an ordinary rival\'s', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.GREENS, PartyName.MARS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      const card = new PoliticalAllianceRedux();
      human.cardsInHand.push(card);
      human.megaCredits = 20;
      vote({parliament}, bot, 1);
      vote({parliament}, human, 0);
      vote({parliament}, human, 1);
      expect(human.canPlay(card), 'the bot\'s first delegate on slot 1 holds the tie').is.false;
      const row = unplayableReasons(human, card)[0].leadership?.trailing[0];
      expect(row).deep.include({short: 1, leader: {name: bot.name, color: bot.color}, tie: 'theirs'});
      vote({parliament}, human, 1);
      expect(human.canPlay(card)).is.true;
    });

    it('(ж) one of two: the NAMED reason — «now 1», the resolution led, who leads the others and how far', () => {
      const t = table();
      vote(t, t.p1, 0);
      vote(t, t.p2, 1);
      vote(t, t.p1, 1);
      const [reason] = unplayableReasons(t.p1, t.card);
      const id = (slot: number) => t.parliament.resolutionOf(t.parliament.slots[slot].instance).id;
      expect(reason).deep.eq({
        type: 'count', message: LEADERSHIP_REQUIREMENT_REASON, params: ['2'], current: 1, requirement: true, requirementKey: 'req:Party leader',
        leadership: {
          leading: [{resolution: id(0)}],
          trailing: [
            {resolution: id(1), short: 1, leader: {name: t.p2.name, color: t.p2.color}, tie: 'theirs'},
            {resolution: id(2), short: 1},
          ],
        },
      });
    });

    it('(з) TR70 Backroom Deal waives PARTY requirements — never this one', () => {
      const t = table();
      vote(t, t.p1, 0);
      const deal = new BackroomDeal();
      t.p1.cardsInHand.push(deal);
      t.p1.playCard(deal, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('checked at the play only — the reading is live: a delegate placed now turns the requirement on', () => {
      const t = table();
      vote(t, t.p1, 0);
      expect(t.p1.canPlay(t.card)).is.false;
      vote(t, t.p1, 2);
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rules 4–5 — one Agenda step, synchronous; preview = execution', () => {
    it('from 1: the marker walks to 2 and pays that step\'s TR; one record; the cost is 2 M€', () => {
      const t = leading(1);
      const tr = t.p1.terraformRating;
      const walk = walkOf(t);
      expect(walk.steps.map((s) => s.to), 'the preview walks one step').deep.eq([2]);
      t.p1.playCard(t.card, Payment.of({megacredits: 2}));
      expect(t.parliament.agendaOf(t.p1), 'synchronous — before any deferred action runs').eq(2);
      runAllActions(t.game);
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.parliament.lastAdvance).deep.include({player: t.p1.id, from: 1, to: 2, reason: 'card', card: CardName.POLITICAL_ALLIANCE_REDUX});
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 2, bonus: 'tr', ...GREENS_ANSWER}]);
      expect(walk.steps.map((s) => s.to), 'the preview promised exactly the walk the play made').deep.eq(t.parliament.lastAdvance?.steps?.map((s) => s.to));
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.POLITICAL_ALLIANCE_REDUX);
    });

    it('the preview is pure — the marker never moves before the press', () => {
      const t = leading(1);
      cardPlayPreview(t.p1, t.card);
      expect(t.parliament.agendaOf(t.p1)).eq(1);
    });

    it('the end of the track cuts honestly: from the last step the card walks none, and the preview says so first', () => {
      const t = leading(12);
      const walk = walkOf(t);
      expect(walk.steps, 'nothing to walk').deep.eq([]);
      t.p1.playCard(t.card, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      expect(t.parliament.agendaOf(t.p1)).eq(12);
      expect([...t.p1.tableau].map((c) => c.name), 'the event happened, the cost was paid').includes(CardName.POLITICAL_ALLIANCE_REDUX);
    });
  });

  describe('the deal: the replacement on a Redux table, the classic card on a classic one, never both', () => {
    const REDUX = {turmoilReduxExpansion: true, turmoilExtension: false, coloniesExtension: true};
    const CLASSIC = {turmoilReduxExpansion: false, turmoilExtension: true, coloniesExtension: true};

    it('Redux: TR73 is dealt, the classic X09 is removed by the manifest\'s `cardsToRemove`', () => {
      const names = new GameCards(options(REDUX)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.POLITICAL_ALLIANCE_REDUX);
      expect(names).to.not.contain(CardName.POLITICAL_ALLIANCE);
      expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.POLITICAL_ALLIANCE)).is.true;
    });

    it('classic Turmoil: the classic card is dealt, the replacement is not', () => {
      const names = new GameCards(options(CLASSIC)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.POLITICAL_ALLIANCE);
      expect(names).to.not.contain(CardName.POLITICAL_ALLIANCE_REDUX);
    });

    it('the premium scope covers the replacement and never the replaced classic card', () => {
      expect(inPremiumScope({module: 'turmoilRedux', name: CardName.POLITICAL_ALLIANCE_REDUX})).is.true;
      expect(inPremiumScope({module: 'turmoil', name: CardName.POLITICAL_ALLIANCE})).is.false;
    });
  });

  it('save / reload: the played event stays in the tableau, the marker where the walk left it', () => {
    const t = leading(1);
    t.p1.playCard(t.card, Payment.of({megacredits: 2}));
    runAllActions(t.game);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.get(CardName.POLITICAL_ALLIANCE_REDUX)).to.be.instanceOf(PoliticalAllianceRedux);
    expect(reloaded.parliament!.agendaOf(owner)).eq(2);
  });
});
