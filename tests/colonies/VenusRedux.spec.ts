import {expect} from 'chai';
import {cast, toName} from '@/common/utils/utils';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {formatMessage, runAllActions, setVenusScaleLevel} from '../TestingUtils';
import {
  VenusRedux, VENUS_REDUX_FIRST_POSITION_LEVY, VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON, VENUS_REDUX_NO_FLOATER_HOLDER_REASON,
} from '../../src/server/colonies/VenusRedux';
import {PlaceDelegatesOnResolution} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {CardResource} from '../../src/common/CardResource';
import {Resource} from '../../src/common/Resource';
import {tradeBenefitAt, tradeBenefitTypes, tradeFixedIncome} from '../../src/common/colonies/ColonyMetadata';
import {isTurmoilReduxAddition} from '../../src/common/colonies/AllColonies';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {ColonyDealer} from '../../src/server/colonies/ColonyDealer';
import {ColonyDeserializer} from '../../src/server/colonies/ColonyDeserializer';
import {ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {getColonyModule} from '../../src/server/colonies/ColonyManifest';
import {buildColonyTradePreview} from '../../src/server/colonies/colonyTradePreview';
import {SeededRandom} from '../../src/common/utils/Random';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {Parliament} from '../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {PARLIAMENT_DELEGATES_PER_PLAYER, REDUX_PARTIES, ReduxParty} from '../../src/common/parliament/ParliamentTypes';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {colonySource} from '../../src/server/inputs/choiceContext';
import {Phase} from '../../src/common/Phase';
import {MAX_VENUS_SCALE} from '../../src/common/constants';
import {Server} from '../../src/server/models/ServerModel';
import {seatEnacted} from '../parliament/parliamentArrange';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';

/**
 * VENUS — the Turmoil Redux ADDITION tile. The rulebook's paragraph, one `it`
 * per sentence: «Add 2 delegates to a resolution» (the build), «Draw a card.
 * Then discard a card» (the colony bonus), «Terraform Venus 1 step, and gain
 * the bonus indicated by the colony marker» (every trade — the empty 2nd and
 * the levying 1st included), the two refusals («the extra 4 M€» at the 1st,
 * «a card that can accept floater resources» at 3–5), «remember to consider
 * marker-advancing effects», «Venus starts active and any player can place a
 * colony on it» — and the retirement of the community tile of that name.
 */
describe('VenusRedux', () => {
  let venus: VenusRedux;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;
  let parliament: Parliament;

  beforeEach(() => {
    venus = new VenusRedux();
    [game, player, player2] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true});
    game.phase = Phase.ACTION;
    game.colonies = [venus];
    const p = game.parliament;
    if (p === undefined) {
      throw new Error('no parliament');
    }
    parliament = p;
    // The Greens' STARTING RULE pays 2 M€ per TR step, and the tile's fixed
    // income is a TR step — real, and the Parliament's business, not the
    // tile's. A quiet Mars First government keeps the M€ arithmetic below the
    // tile's own; one `it` restores the Greens to show the interplay.
    seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
  });

  /** A card that holds FLOATERS — the rule's «a card that can accept floater resources». */
  function giveFloaterHolder(p: TestPlayer): Dirigibles {
    const card = new Dirigibles();
    p.playedCards.push(card);
    return card;
  }

  /** The delegate prompt a build or a trade raised — the vote step's own input, marked as a GRANT. */
  function popGrant(p: TestPlayer, count: number, printed = count): SelectParty {
    const prompt = cast(p.popWaitingFor(), SelectParty);
    expect(prompt.votePrompt).to.deep.eq({source: 'grant', cost: 0, count, printed});
    expect(prompt.choiceContext?.source).to.deep.eq(colonySource(ColonyName.VENUS_REDUX));
    expect(prompt.parties).to.deep.eq(parliament.partiesInVotingArea());
    return prompt;
  }

  function logLine(text: string): string | undefined {
    return game.gameLog.map((m) => formatMessage(m)).find((line) => line.includes(text));
  }

  describe('the printed tile', () => {
    it('starts active — any player can place a colony on it', () => {
      expect(venus.isActive).is.true;
      expect(player.colonies.getPlayableColonies()).to.include(venus);
      expect(player2.colonies.getPlayableColonies()).to.include(venus);
    });

    it('placement bonus: 2 delegates to a resolution, in every berth', () => {
      expect(venus.metadata.build.type).to.eq(ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION);
      expect(venus.metadata.build.quantity).to.deep.eq([2, 2, 2]);
    });

    it('colony bonus: draw 1 card, then discard 1 card', () => {
      expect(venus.metadata.colony.type).to.eq(ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE);
    });

    it('trade income: Venus 1 step on EVERY trade, plus the marker\'s bonus: −4 M€ · nothing · 1 · 1 · 2 floaters · 1 · 2 delegates', () => {
      const fixed = tradeFixedIncome(venus.metadata);
      expect(fixed).to.deep.eq({description: 'Increase Venus 1 step', type: ColonyBenefit.INCREASE_VENUS_SCALE, quantity: 1});
      const read = [0, 1, 2, 3, 4, 5, 6].map((position) => tradeBenefitAt(venus.metadata, position));
      expect(read.map((r) => r.type)).to.deep.eq([
        ColonyBenefit.LOSE_RESOURCES, ColonyBenefit.LOSE_RESOURCES,
        ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.ADD_RESOURCES_TO_CARD,
        ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION, ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION,
      ]);
      expect(read.map((r) => r.quantity)).to.deep.eq([VENUS_REDUX_FIRST_POSITION_LEVY, 0, 1, 1, 2, 1, 2]);
      expect(read[0].resource).to.eq(Resource.MEGACREDITS);
      expect(venus.metadata.cardResource).to.eq(CardResource.FLOATER);
      expect(tradeBenefitTypes(venus.metadata)).to.deep.eq([
        ColonyBenefit.LOSE_RESOURCES, ColonyBenefit.ADD_RESOURCES_TO_CARD, ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION,
      ]);
    });

    it('is a Turmoil Redux ADDITION in the manifest (no base twin), with the tile\'s own lore', () => {
      expect(getColonyModule(ColonyName.VENUS_REDUX)).to.eq('turmoilRedux');
      expect(isTurmoilReduxAddition(ColonyName.VENUS_REDUX)).is.true;
      expect(isTurmoilReduxAddition(ColonyName.PLUTO_REDUX)).is.false;
      expect(venus.metadata.lore).to.match(/^Venus' atmosphere makes it a pressure-cooker/);
    });
  });

  describe('«Terraform Venus 1 step, and gain the bonus indicated by the colony marker» — every position', () => {
    it('the fixed step is a REAL terraforming step: under the Greens’ starting rule it pays their 2 M€ too, and the journal names them', () => {
      parliament.enacted = undefined; // the empty government seat = the Greens' starting rule (rulebook p.8)
      player.megaCredits = 0;
      venus.trackPosition = 1;
      const tr = player.terraformRating;
      const before = game.gameLog.length;
      venus.trade(player);
      runAllActions(game);
      expect(game.getVenusScaleLevel()).to.eq(2);
      expect(player.terraformRating).to.eq(tr + 1);
      expect(player.megaCredits).to.eq(2);
      const lines = game.gameLog.slice(before).map((m) => formatMessage(m));
      expect(lines.some((line) => /because of Greens/.test(line)), lines.join('\n')).is.true;
    });

    it('the 1st position: Venus +1 step and 4 M€ are paid (the fee already paid before the trade)', () => {
      player.megaCredits = 20;
      venus.trackPosition = 0;
      venus.trade(player);
      runAllActions(game);
      expect(game.getVenusScaleLevel()).to.eq(2);
      expect(player.megaCredits).to.eq(16);
      expect(player.colonyTradeManifest?.tradeIncomeFixed).to.deep.eq({benefit: ColonyBenefit.INCREASE_VENUS_SCALE, quantity: 1});
      expect(player.colonyTradeManifest?.tradeIncome).to.deep.eq({benefit: ColonyBenefit.LOSE_RESOURCES, quantity: 4, resource: Resource.MEGACREDITS});
    });

    it('the 2nd position pays NOTHING but Venus still rises — a zero income, never a refusal', () => {
      player.megaCredits = 0;
      venus.trackPosition = 1;
      expect(venus.tradeIncomeBlockedReason(player, 1)).is.undefined;
      expect(venus.tradeBlockedReason(player)).is.undefined;
      const before = game.gameLog.length;
      venus.trade(player);
      runAllActions(game);
      expect(game.getVenusScaleLevel()).to.eq(2);
      expect(player.megaCredits).to.eq(0);
      // No «−0 M€» line: nothing was taken, nothing is journaled for it.
      const lines = game.gameLog.slice(before).map((m) => formatMessage(m));
      expect(lines.some((line) => /lost 0|spent 0|−0|-0 /.test(line)), lines.join('\n')).is.false;
      expect(player.getWaitingFor()).is.undefined;
    });

    it('the 3rd, 4th and 5th positions pay 1, 1 and 2 floaters to a card of the trader\'s', () => {
      const holder = giveFloaterHolder(player);
      for (const [position, floaters] of [[2, 1], [3, 1], [4, 2]] as const) {
        venus.visitor = undefined;
        venus.trackPosition = position;
        const before = holder.resourceCount;
        venus.trade(player);
        runAllActions(game);
        expect(holder.resourceCount, `position ${position + 1}`).to.eq(before + floaters);
      }
      expect(game.getVenusScaleLevel()).to.eq(6);
    });

    it('the 6th position pays 1 delegate, the 7th 2 — to a resolution the player CHOOSES', () => {
      venus.trackPosition = 5;
      venus.trade(player);
      runAllActions(game);
      expect(game.getVenusScaleLevel()).to.eq(2);
      const one = popGrant(player, 1);
      const party = parliament.partiesInVotingArea()[0];
      const slot = parliament.slotOf(party);
      if (slot === undefined) {
        throw new Error('no slot');
      }
      const reserve = parliament.reserve(player);
      one.cb(party);
      expect(parliament.votesOf(player, slot)).to.eq(1);
      expect(parliament.reserve(player)).to.eq(reserve - 1);
      expect(logLine('added 1 delegate(s) from the reserve')).is.not.undefined;

      venus.visitor = undefined;
      venus.trackPosition = 6;
      venus.trade(player);
      runAllActions(game);
      const two = popGrant(player, 2);
      two.cb(party);
      expect(parliament.votesOf(player, slot)).to.eq(3);
      expect(parliament.reserve(player)).to.eq(reserve - 3);
    });

    it('the fixed step is paid FIRST, then the marker\'s bonus (the printed order is the journal\'s)', () => {
      giveFloaterHolder(player);
      venus.trackPosition = 4;
      const before = game.gameLog.length;
      venus.trade(player);
      runAllActions(game);
      const lines = game.gameLog.slice(before).map((m) => formatMessage(m));
      const venusAt = lines.findIndex((line) => line.includes('raised'));
      const floatersAt = lines.findIndex((line) => /floater/i.test(line));
      expect(venusAt, lines.join('\n')).to.be.greaterThan(-1);
      expect(floatersAt, lines.join('\n')).to.be.greaterThan(venusAt);
    });

    it('a Venus scale at its maximum is NAMED, never a silent nothing', () => {
      setVenusScaleLevel(game, MAX_VENUS_SCALE);
      venus.trackPosition = 1;
      venus.trade(player);
      runAllActions(game);
      expect(game.getVenusScaleLevel()).to.eq(MAX_VENUS_SCALE);
      expect(logLine('already at its maximum')).is.not.undefined;
    });
  });

  describe('«if it is at its 1st position and you do not have the extra 4 M€, you cannot trade» — the first refusal', () => {
    it('the extra 4 M€ are judged OVER the fee the paying path takes', () => {
      venus.trackPosition = 0;
      player.megaCredits = 3;
      expect(venus.tradeIncomeBlockedReason(player, 0)).to.eq(VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON);
      player.megaCredits = 4;
      expect(venus.tradeIncomeBlockedReason(player, 0)).is.undefined;
      // The M€ path takes 9 first: 12 M€ is one short, 13 is enough.
      player.megaCredits = 12;
      expect(venus.tradeIncomeBlockedReason(player, 0, {feeMegacredits: 9})).to.eq(VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON);
      expect(venus.tradeBlockedReason(player, {feeMegacredits: 9})).to.eq(VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON);
      player.megaCredits = 13;
      expect(venus.tradeBlockedReason(player, {feeMegacredits: 9})).is.undefined;
      // A path paid in energy takes no M€: the 4 stand on their own.
      player.megaCredits = 4;
      expect(venus.tradeBlockedReason(player, {feeMegacredits: 0})).is.undefined;
    });

    it('the trade OFFER lists Venus DISABLED with that reason when only the M€ path could pay and it leaves no 4 M€', () => {
      player.megaCredits = 12;
      venus.trackPosition = 0;
      expect(player.colonies.bestTradeTerms()).to.deep.eq({bonusTradeOffset: 0, feeMegacredits: 9});
      expect(player.colonies.tradeBlockedReason()).to.eq(VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON);
      expect(player.colonies.coloniesTradeAction()).is.undefined;
      expect(ColoniesHandler.blockedColonies(game, player, player.colonies.bestTradeTerms()).map((b) => b.reason))
        .to.deep.eq([VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON]);
      // …and the server PUBLISHES it to the seat's model (the dossier, the tile and the wheel read this one reason).
      expect(Server.getPlayerModel(player).thisPlayer.colonyTradeBlocks).to.deep.eq([{colony: ColonyName.VENUS_REDUX, reason: VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON}]);
    });

    it('with 13 M€ the offer stands and the trade takes 9 + 4', () => {
      player.megaCredits = 13;
      venus.trackPosition = 0;
      const trade = cast(player.colonies.coloniesTradeAction(), AndOptions);
      const pick = cast(trade.options[1], SelectColony);
      expect(pick.colonies.map(toName)).to.deep.eq([ColonyName.VENUS_REDUX]);
      expect(pick.disabledColonies).to.deep.eq([]);
      const howToPay = cast(trade.options[0], OrOptions);
      trade.process({type: 'and', responses: [
        {type: 'or', index: howToPay.options.length - 1, response: {type: 'option'}},
        {type: 'colony', colonyName: ColonyName.VENUS_REDUX},
      ]}, player);
      runAllActions(game);
      expect(player.megaCredits).to.eq(0);
      expect(game.getVenusScaleLevel()).to.eq(2);
    });

    it('an energy path lifts the refusal the M€ path would meet — and the CHOSEN path re-judges at the submit', () => {
      player.megaCredits = 12;
      player.energy = 3;
      venus.trackPosition = 0;
      // The best terms: the energy path takes no M€.
      expect(player.colonies.bestTradeTerms().feeMegacredits).to.eq(0);
      const trade = cast(player.colonies.coloniesTradeAction(), AndOptions);
      const pick = cast(trade.options[1], SelectColony);
      expect(pick.colonies.map(toName)).to.deep.eq([ColonyName.VENUS_REDUX]);
      const howToPay = cast(trade.options[0], OrOptions);
      const mcIndex = howToPay.options.findIndex((o) => formatMessage(o.title).includes('M€'));
      expect(mcIndex).to.be.greaterThan(-1);
      // Paying in M€ would leave 3 — refused BEFORE anything is paid.
      expect(() => trade.process({type: 'and', responses: [
        {type: 'or', index: mcIndex, response: {type: 'option'}},
        {type: 'colony', colonyName: ColonyName.VENUS_REDUX},
      ]}, player)).to.throw(VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON);
      expect(player.megaCredits).to.eq(12);
      expect(player.energy).to.eq(3);
    });
  });

  describe('«if it is at position 3-5 and you do not have a card that can accept floater resources, you cannot trade» — the second refusal', () => {
    it('positions 3–5 with no floater card are refused BY NAME — a DIFFERENT reason than the 1st position\'s', () => {
      for (const position of [2, 3, 4]) {
        expect(venus.tradeIncomeBlockedReason(player, position), `position ${position + 1}`).to.eq(VENUS_REDUX_NO_FLOATER_HOLDER_REASON);
      }
      expect(VENUS_REDUX_NO_FLOATER_HOLDER_REASON).to.not.eq(VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON);
      venus.trackPosition = 3;
      expect(venus.tradeBlockedReason(player)).to.eq(VENUS_REDUX_NO_FLOATER_HOLDER_REASON);
      expect(player.colonies.tradeBlockedReason()).to.eq(VENUS_REDUX_NO_FLOATER_HOLDER_REASON);
    });

    it('positions 2, 6 and 7 never refuse', () => {
      player.megaCredits = 0;
      for (const position of [1, 5, 6]) {
        expect(venus.tradeIncomeBlockedReason(player, position), `position ${position + 1}`).is.undefined;
      }
    });

    it('a floater holder lifts the refusal, and the payout uses the SAME candidate set the refusal read', () => {
      expect(new AddResourcesToCard(player, CardResource.FLOATER, {count: 1}).getCards()).to.deep.eq([]);
      const holder = giveFloaterHolder(player);
      expect(new AddResourcesToCard(player, CardResource.FLOATER, {count: 1}).getCards()).to.deep.eq([holder]);
      venus.trackPosition = 3;
      expect(venus.tradeBlockedReason(player)).is.undefined;
    });

    it('a bulk trade that reaches the refused colony is a NAMED skip, never a payout into nothing', () => {
      venus.trackPosition = 3;
      const before = game.gameLog.length;
      venus.trade(player);
      runAllActions(game);
      const skipped = game.gameLog.slice(before).find((m) => m.message.startsWith('${0} cannot trade with ${1}: ${2}'));
      expect(skipped).is.not.undefined;
      expect(skipped?.data[2].value).to.eq(VENUS_REDUX_NO_FLOATER_HOLDER_REASON);
      expect(game.getVenusScaleLevel(), 'not even the fixed step is paid on a refused trade').to.eq(0);
    });
  });

  describe('«remember to consider marker-advancing effects» — the offset, both ways', () => {
    it('+1 from the 5th lands on the 6th (delegates): no floater card needed, the advance is FORCED', () => {
      venus.trackPosition = 4;
      player.colonies.tradeOffset = 1;
      expect(venus.tradeBlockedReason(player)).is.undefined;
      expect(venus.tradeTrackPlan(player)).to.deep.eq({current: 4, max: 5, steps: 1, minSteps: 1, ask: false});
      venus.trade(player);
      runAllActions(game);
      popGrant(player, 1);
    });

    it('+1 from the 2nd lands on the 3rd (floaters): without a floater card the trade STAYS on the empty 2nd', () => {
      venus.trackPosition = 1;
      player.colonies.tradeOffset = 1;
      expect(venus.tradeTrackPlan(player)).to.deep.eq({current: 1, max: 2, steps: 0, minSteps: 0, ask: false});
      expect(venus.tradeBlockedReason(player)).is.undefined;
    });

    it('+1 from the 1st with no spare 4 M€ skips the levy: the only legal landing is the empty 2nd', () => {
      player.megaCredits = 2;
      venus.trackPosition = 0;
      player.colonies.tradeOffset = 1;
      expect(venus.tradeTrackPlan(player)).to.deep.eq({current: 0, max: 1, steps: 1, minSteps: 1, ask: false});
      venus.trade(player);
      runAllActions(game);
      expect(player.megaCredits).to.eq(2);
      expect(game.getVenusScaleLevel()).to.eq(2);
    });

    it('with a floater card an offset spanning floaters → delegates ASKS (different kinds)', () => {
      giveFloaterHolder(player);
      venus.trackPosition = 4;
      player.colonies.tradeOffset = 1;
      expect(venus.tradeTrackPlan(player)).to.deep.eq({current: 4, max: 5, steps: 1, minSteps: 0, ask: true});
    });

    it('the preview plans from the same plan (a forced advance to the delegates, the step named)', () => {
      venus.trackPosition = 4;
      player.colonies.tradeOffset = 1;
      const preview = buildColonyTradePreview(player, venus);
      expect(preview.track).to.deep.eq({current: 4, effective: 5, steps: 1, willAsk: false});
      expect(preview.followUps).to.deep.eq([{kind: 'note', role: 'tradeReward', note: 'placeDelegatesOnResolution'}]);
    });
  });

  describe('«Add 2 delegates to a resolution» — the placement bonus and the vote step', () => {
    it('building asks WHICH resolution, and the two delegates leave the reserve for it', () => {
      const reserve = parliament.reserve(player);
      venus.addColony(player);
      runAllActions(game);
      const prompt = popGrant(player, 2);
      const party = parliament.partiesInVotingArea()[1];
      const slot = parliament.slotOf(party);
      if (slot === undefined) {
        throw new Error('no slot');
      }
      prompt.cb(party);
      expect(parliament.votesOf(player, slot)).to.eq(2);
      expect(parliament.reserve(player)).to.eq(reserve - 2);
      // The lobby's free delegate is never a bonus's to spend.
      expect(parliament.lobby.has(player.id)).is.true;
      expect(venus.colonies).to.deep.eq([player.id]);
    });

    it('the server projects the GRANT\'s count for the vote step (two cubes, not one)', () => {
      venus.addColony(player);
      runAllActions(game);
      // The prompt STANDS (not popped): the model reads the viewer's pending grant.
      const prompt = cast(player.getWaitingFor(), SelectParty);
      expect(prompt.votePrompt?.count).to.eq(2);
      const model = getParliamentModel(game, player);
      const slot = parliament.slots[0];
      const projection = model?.viewer?.vote.projections.find((p) => p.instance === slot.instance);
      expect(projection?.votesAfter).to.eq(slot.votes.length + 2);
      // Without a grant standing, the projection is the vote's one delegate.
      player.popWaitingFor();
      const plain = getParliamentModel(game, player)?.viewer?.vote.projections.find((p) => p.instance === slot.instance);
      expect(plain?.votesAfter).to.eq(slot.votes.length + 1);
    });

    it('a reserve short of the printed count places what it holds and NAMES the shortfall', () => {
      // Six of the seven delegates already on resolutions, one in the lobby: the reserve holds none…
      const slot = parliament.slots[0];
      for (let i = 0; i < PARLIAMENT_DELEGATES_PER_PLAYER - 2; i++) {
        slot.votes.push({owner: player.id, seq: ++parliament.voteSeq});
      }
      expect(parliament.reserve(player)).to.eq(1);
      venus.addColony(player);
      runAllActions(game);
      const prompt = popGrant(player, 1, 2);
      expect(logLine('has only 1 of the 2 delegates in reserve')).is.not.undefined;
      prompt.cb(parliament.resolutionOf(slot.instance).party);
      expect(parliament.reserve(player)).to.eq(0);
    });

    it('with NO delegate left in reserve the bonus names itself and asks nothing', () => {
      const slot = parliament.slots[0];
      for (let i = 0; i < PARLIAMENT_DELEGATES_PER_PLAYER - 1; i++) {
        slot.votes.push({owner: player.id, seq: ++parliament.voteSeq});
      }
      expect(parliament.reserve(player)).to.eq(0);
      venus.addColony(player);
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      expect(logLine('all their delegates are in play')).is.not.undefined;
    });

    it('with no resolution up for a vote the bonus names itself and asks nothing', () => {
      parliament.slots = [];
      venus.addColony(player);
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      expect(logLine('no resolution is up for a vote')).is.not.undefined;
    });

    it('a game with no Mars Parliament names it too (the deferred action on its own)', () => {
      const [plain, p] = testGame(2, {coloniesExtension: true});
      const action = new PlaceDelegatesOnResolution(p, 2, colonySource(ColonyName.VENUS_REDUX));
      expect(action.execute()).is.undefined;
      expect(plain.gameLog.map((m) => formatMessage(m)).some((line) => line.includes('no Mars Parliament'))).is.true;
    });

    it('the answer re-reads the reserve: a party that left the table is refused, never placed', () => {
      venus.addColony(player);
      runAllActions(game);
      const prompt = popGrant(player, 2);
      expect(() => prompt.process({type: 'party', partyName: partyNotOnTable(parliament)})).to.throw();
    });
  });

  describe('the ADDITION tile', () => {
    const options = {...DEFAULT_GAME_OPTIONS, coloniesExtension: true, turmoilExtension: false, communityCardsOption: false};

    it('is dealt with Turmoil Redux AND Venus Next, beside the base tiles', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, venusNextExtension: true});
      dealer.drawColonies(4);
      const all = [...dealer.colonies, ...dealer.discardedColonies].map(toName);
      expect(all).to.include(ColonyName.VENUS_REDUX);
      expect(all).to.include(ColonyName.PLUTO_REDUX);
      expect(all).to.not.include('Venus');
      expect(all).to.have.lengthOf(12);
    });

    it('is never dealt without the expansion', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: false, venusNextExtension: true});
      dealer.drawColonies(4);
      expect([...dealer.colonies, ...dealer.discardedColonies].map(toName)).to.not.include(ColonyName.VENUS_REDUX);
    });

    it('is never dealt without Venus Next — its fixed income terraforms Venus (a project decision)', () => {
      const dealer = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, venusNextExtension: false});
      dealer.drawColonies(4);
      const all = [...dealer.colonies, ...dealer.discardedColonies].map(toName);
      expect(all).to.not.include(ColonyName.VENUS_REDUX);
      expect(all).to.include(ColonyName.PLUTO_REDUX);
    });

    it('a hand-picked «Venus Redux» is honoured with the expansion and DROPPED without it (no twin to fall back to)', () => {
      const list = [ColonyName.VENUS_REDUX, ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS, ColonyName.LUNA];
      const withRedux = new ColonyDealer(new SeededRandom(1), {...options, turmoilReduxExpansion: true, venusNextExtension: true, customColoniesList: list});
      withRedux.drawColonies(1);
      expect(withRedux.colonies.map(toName)).to.include(ColonyName.VENUS_REDUX);
      const without = new ColonyDealer(new SeededRandom(1), {...options, venusNextExtension: true, customColoniesList: list});
      without.drawColonies(1);
      expect(without.colonies.map(toName)).to.have.members([ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS, ColonyName.LUNA]);
    });

    it('a game created with both expansions can seat the tile', () => {
      const [g] = testGame(2, {
        coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true,
        customColoniesList: [ColonyName.VENUS_REDUX, ColonyName.LUNA, ColonyName.IO, ColonyName.CERES, ColonyName.TITAN],
      });
      expect(g.colonies.map(toName)).to.include(ColonyName.VENUS_REDUX);
    });
  });

  describe('serialization and the retired community tile', () => {
    it('round-trips through the deserializer with its state and its rules', () => {
      venus.colonies = [player.id];
      venus.trackPosition = 3;
      venus.visitor = player2.id;
      const [restored] = ColonyDeserializer.deserializeAndFilter([venus.serialize()]);
      expect(restored).to.be.instanceOf(VenusRedux);
      expect(restored.name).to.eq(ColonyName.VENUS_REDUX);
      expect(restored.colonies).to.deep.eq([player.id]);
      expect(restored.trackPosition).to.eq(3);
      expect(restored.visitor).to.eq(player2.id);
      expect(restored.tradeIncomeBlockedReason(player, 3)).to.eq(VENUS_REDUX_NO_FLOATER_HOLDER_REASON);
    });

    it('an old save holding the retired community «Venus» loads without it (dropped with a warning, never mutated into this tile)', () => {
      const retired = {name: 'Venus' as ColonyName, colonies: [player.id], isActive: true, trackPosition: 2, visitor: undefined};
      expect(ColonyDeserializer.deserializeAndFilter([retired, venus.serialize()]).map(toName)).to.deep.eq([ColonyName.VENUS_REDUX]);

      const [g] = testGame(2, {coloniesExtension: true});
      const serialized = g.serialize();
      serialized.colonies[0].name = 'Venus' as ColonyName;
      const restored = Game.deserialize(serialized);
      expect(restored.colonies.map(toName)).to.not.include('Venus');
      expect(restored.colonies).to.have.lengthOf(serialized.colonies.length - 1);
    });
  });
});

/** A Redux party with no resolution in the voting area right now (the test's illegal answer). */
function partyNotOnTable(parliament: Parliament): ReduxParty {
  const onTable = new Set(parliament.partiesInVotingArea());
  const off = REDUX_PARTIES.find((party) => !onTable.has(party));
  if (off === undefined) {
    throw new Error('every party is on the table');
  }
  return off;
}
