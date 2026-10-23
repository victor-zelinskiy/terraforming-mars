import {expect} from 'chai';
import {MartianMediaCenter} from '../../../src/server/cards/turmoil/MartianMediaCenter';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {replayBatch, parkedBatchTailLength} from '../../../src/server/inputs/deferredInputBatch';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {DELEGATE_ICON, PARLIAMENT_VOTE_COST} from '../../../src/common/parliament/ParliamentTypes';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('MartianMediaCenter', () => {
  it('Should play', () => {
    const card = new MartianMediaCenter();
    const [game, player] = testGame(1, {turmoilExtension: true});

    expect(card.canPlay(player)).is.not.true;

    const mars = game.turmoil!.getPartyByName(PartyName.MARS);
    mars.delegates.add(player, 2);
    expect(card.canPlay(player)).is.true;

    card.play(player);
    expect(player.production.megacredits).to.eq(2);
  });

  it('the classic action: 3 M€, then upstream\'s «send a delegate» to any party — byte for byte', () => {
    const card = new MartianMediaCenter();
    const [game, player] = testGame(2, {turmoilExtension: true});
    player.playedCards.push(card);
    player.megaCredits = 10;
    expect(card.canAct(player)).is.true;
    card.action(player);
    runAllActions(game);
    expect(player.megaCredits).eq(7);
    const send = cast(player.popWaitingFor(), SelectParty);
    expect(send.votePrompt, 'the classic engine never marks a Redux vote').is.undefined;
    // The classic engine has no voting area to be empty: the address is always there.
    expect(game.politics!.delegatesHaveAnAddress()).is.true;
  });
});

/**
 * T07 — MARTIAN MEDIA CENTER ON A TURMOIL REDUX TABLE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1, adapted in place):
 * the card stays wholly declarative — the requirement walks T04's roads, the play is +2 M€ production, and the ACTION
 * «pay 3 M€ → add a delegate» is a vote from the RESERVE for 3 M€ (an ordinary vote from the reserve costs
 * `PARLIAMENT_VOTE_COST`), the lobby's cube untouched. Its preview is the STAGED door (TR15's fourth door: the
 * resolution is chosen in the Parliament before anything is sent), and an action with nowhere for its delegate to land
 * is refused by name — never «paid 3 M€ and placed nothing».
 */
describe('MartianMediaCenter — on a Turmoil Redux table', () => {
  const G = PartyName.GREENS;
  const M = PartyName.MARS;
  const I = PartyName.INDUSTRIALISTS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: MartianMediaCenter};

  /** A two-seat Redux table in the action phase with three QUIET real resolutions (Greens · Mars First · Industrialists), 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    p1.megaCredits = 20;
    return {game, p1, p2, parliament, card: new MartianMediaCenter()};
  }

  /** The same table with the card on p1's table, its action unused. */
  function owned(): Table {
    const t = table();
    t.p1.playedCards.push(t.card);
    return t;
  }

  /** Leave exactly `n` delegates in p1's reserve (the rest stand on the last slot). */
  function drainReserve(t: Table, n: number): void {
    const slot = t.parliament.slots[t.parliament.slots.length - 1];
    while (t.parliament.reserve(t.p1) > n) {
      t.parliament.placeVote(t.p1, slot, 'reserve');
    }
  }

  it('rule 1 — the printed card: blue, 7, building, Mars First\'s plate, T07; wholly declarative', () => {
    const c = new MartianMediaCenter();
    expect(c.name).eq(CardName.MARTIAN_MEDIA_CENTER);
    expect(c.type).eq(CardType.ACTIVE);
    expect(c.cost).eq(7);
    expect(c.tags).deep.eq([Tag.BUILDING]);
    expect(requiredPartyOf(c)).eq(M);
    expect(c.metadata.cardNumber).eq('T07');
    expect(c.behavior).deep.eq({production: {megacredits: 2}});
    expect(c.actionBehavior).deep.eq({spend: {megacredits: 3}, turmoil: {sendDelegates: {count: 1}}});
    for (const hook of ['bespokeCanPlay', 'bespokePlay', 'bespokeCanAct', 'bespokeAction']) {
      expect(Object.prototype.hasOwnProperty.call(MartianMediaCenter.prototype, hook), hook).is.false;
    }
  });

  describe('rule 1 — the requirement: Mars First rules, or 2 of your delegates on its resolution (T04\'s roads)', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = table();
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on its resolution: «1 of 2» — the hand chip\'s count', () => {
      const t = table();
      t.p1.cardsInHand.push(t.card);
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: M, current: 1});
    });

    it('two delegates on its resolution: playable', () => {
      const t = table();
      t.p1.cardsInHand.push(t.card);
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('Mars First rules: playable with no delegate anywhere', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(M));
      ([G, I, PartyName.REDS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      t.p1.cardsInHand.push(t.card);
      expect(t.parliament.rulingParty()).eq(M);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the play is +2 M€ production — and only that: no delegate, no question', () => {
      const t = table();
      const reserve = t.parliament.reserve(t.p1);
      t.card.play(t.p1);
      runAllActions(t.game);
      expect(t.p1.production.megacredits).eq(2);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.parliament.reserve(t.p1)).eq(reserve);
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.branches[0].effects.some((e) => e.icon === DELEGATE_ICON), 'the play places no delegate').is.false;
      expect(preview.branches[0].steps).deep.eq([]);
    });
  });

  describe('rule 2 — the action: ≥ 3 M€ ∧ a resolution up for a vote ∧ a delegate in the reserve', () => {
    it('all three: available, no reason', () => {
      const t = owned();
      expect(t.card.canAct(t.p1)).is.true;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([]);
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).includes(CardName.MARTIAN_MEDIA_CENTER);
    });

    it('2 M€: SHOWN disabled — «Need 1 more M€»', () => {
      const t = owned();
      t.p1.megaCredits = 2;
      expect(t.card.canAct(t.p1)).is.false;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([{type: 'megacredits', message: 'Need ${0} more M€', params: ['1']}]);
    });

    it('an empty voting area: refused — «No resolution is up for a vote» (never «paid 3 M€ and placed nothing»)', () => {
      const t = owned();
      t.parliament.slots = [];
      expect(t.game.politics!.delegatesHaveAnAddress()).is.false;
      expect(t.card.canAct(t.p1)).is.false;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: 'No resolution is up for a vote'}]);
    });

    it('an empty reserve: refused — the reserve COUNTED «Delegates in your reserve: 0 of 1»', () => {
      const t = owned();
      drainReserve(t, 0);
      expect(t.card.canAct(t.p1)).is.false;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([
        {type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: ['0', '1'], current: 0},
      ]);
    });

    it('ONE reason at a time, in check order: M€ → the voting area → the reserve', () => {
      const t = owned();
      t.p1.megaCredits = 2;
      drainReserve(t, 0);
      t.parliament.slots = [];
      expect(actionUnavailableReasons(t.p1, t.card)[0].message).eq('Need ${0} more M€');
      t.p1.megaCredits = 20;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: 'No resolution is up for a vote'}]);
      // …and the preview's branch carries the same first reason.
      expect(actionPreview(t.p1, t.card).branches[0]).deep.include({available: false, unavailableReason: 'No resolution is up for a vote'});
    });
  });

  describe('rule 2 — the action performed: −3 M€, ONE grant prompt, the cube from the RESERVE', () => {
    it('the price leaves first; the prompt is the grant\'s own (count 1, the card its giver, every resolution)', () => {
      const t = owned();
      t.card.action(t.p1);
      runAllActions(t.game);
      expect(t.p1.megaCredits, 'the card\'s 3 M€ — never the vote\'s ordinary price').eq(17);
      expect(20 - t.p1.megaCredits).not.eq(PARLIAMENT_VOTE_COST);
      const select = cast(t.p1.getWaitingFor(), SelectParty);
      expect(select.parties).to.have.members(t.parliament.partiesInVotingArea());
      expect(select.votePrompt).deep.include({source: 'grant', count: 1, cost: 0});
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.MARTIAN_MEDIA_CENTER}, mode: 'reward'});
    });

    it('answered: the cube lands on the chosen resolution from the RESERVE; the lobby is untouched; the ledger holds', () => {
      const t = owned();
      const reserve = t.parliament.reserve(t.p1);
      t.card.action(t.p1);
      runAllActions(t.game);
      t.p1.process({type: 'party', partyName: G});
      runAllActions(t.game);
      expect(t.parliament.votesOf(t.p1, t.parliament.slotOf(G)!)).eq(1);
      expect(t.parliament.reserve(t.p1)).eq(reserve - 1);
      expect(t.parliament.lobby.has(t.p1.id), 'the lobby\'s cube is the generation\'s free vote, not the card\'s').is.true;
      expect(t.p1.megaCredits).eq(17);
      expect(t.p1.getWaitingFor()).is.undefined;
      t.parliament.assertLedger(t.game);
    });

    it('ONE POST — the staged batch [perform the card\'s action, {party, stagedFor}] lands in one replay, nothing asked again', () => {
      const t = owned();
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
      expect(perform).gte(0);
      const batch: Array<InputResponse> = [
        {type: 'or', index: perform, response: {type: 'card', cards: [CardName.MARTIAN_MEDIA_CENTER]}},
        {type: 'party', partyName: M, stagedFor: CardName.MARTIAN_MEDIA_CENTER},
      ];
      replayBatch(t.p1, batch);
      expect(t.parliament.votesOf(t.p1, t.parliament.slotOf(M)!)).eq(1);
      expect(t.p1.megaCredits).eq(17);
      expect(t.p1.actionsThisGeneration.has(CardName.MARTIAN_MEDIA_CENTER)).is.true;
      expect(parkedBatchTailLength(t.p1)).eq(0);
      expect(t.p1.getWaitingFor() instanceof SelectParty, 'the resolution is never asked again').is.false;
    });

    it('once per generation: the used action is not offered again', () => {
      const t = owned();
      t.p1.actionsThisGeneration.add(CardName.MARTIAN_MEDIA_CENTER);
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).not.includes(CardName.MARTIAN_MEDIA_CENTER);
    });
  });

  describe('rule 3 — the action preview: the price, the reserve chip and the STAGED door', () => {
    it('−3 M€ · reserve N → N−1 · the delegateGrant door — the very prompt the action raises', () => {
      const t = owned();
      const reserve = t.parliament.reserve(t.p1);
      const preview = actionPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const branch = preview.branches[0];
      expect(branch.available).is.true;
      expect(branch.effects.find((e) => e.icon === Resource.MEGACREDITS)).deep.include({direction: 'cost', amount: 3});
      expect(branch.effects.find((e) => e.icon === DELEGATE_ICON)).deep.include({direction: 'cost', amount: 1, current: reserve, resulting: reserve - 1});
      expect(branch.steps.map((s) => s.kind), 'a DOOR before anything is sent — never the play\'s live follow-up').deep.eq(['delegateGrant']);
      const door = branch.steps[0];
      if (door.kind !== 'delegateGrant') {
        throw new Error('no delegateGrant door');
      }
      expect(door.staged.sourceCard).eq(CardName.MARTIAN_MEDIA_CENTER);
      // …field for field the live grant's model.
      t.card.action(t.p1);
      runAllActions(t.game);
      const live = t.p1.getWaitingFor()!.toModel(t.p1);
      expect({...live, choiceContext: undefined}).deep.eq({...door.staged.prompt, choiceContext: undefined});
    });

    it('an empty voting area: no door — the branch is refused with its reason', () => {
      const t = owned();
      t.parliament.slots = [];
      const branch = actionPreview(t.p1, t.card).branches[0];
      expect(branch.available).is.false;
      expect(branch.steps).deep.eq([]);
    });

    it('the preview is read-only: the game serializes identically before and after', () => {
      const t = owned();
      const before = JSON.stringify(t.game.serialize());
      actionPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  it('rule 4 — save / load: the card survives a round trip and still acts', () => {
    const t = owned();
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const card = owner.tableau.get(CardName.MARTIAN_MEDIA_CENTER) as MartianMediaCenter;
    expect(card).is.not.undefined;
    expect(card.canAct(owner)).is.true;
  });
});
