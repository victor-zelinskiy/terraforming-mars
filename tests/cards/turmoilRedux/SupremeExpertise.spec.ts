import {expect} from 'chai';
import {SupremeExpertise} from '../../../src/server/cards/turmoilRedux/SupremeExpertise';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {OPEN_IP_TRADE_ID} from '../../../src/server/parliament/resolutions/scientists/OpenIpTrade';
import {RD_FUNDING_ID} from '../../../src/server/parliament/resolutions/scientists/RdFunding';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';
import {normalizeRequirement} from '../../../src/client/components/premiumCard/premiumCardViewModel';
import {seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR01 — SUPREME EXPERTISE: the first card to print «N tags of any one type»,
 * and the second half of the loop TR02 opens — data onto Political Science, and
 * its action turns them into a card. Every rule reading of the card file's
 * header is pinned here: the requirement is the MAXIMUM over Curator's tag
 * types, each counted as a printed tag requirement (wild tags, the Scientists'
 * wild tag and R&D Funding's science tags included; events only under
 * Odyssey); «ANY card» is one of yours that holds data, always SHOWN as a pick;
 * no holder still plays, and the preview names the loss.
 */
function reduxTable(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** `n` played cards, each printing `tags`. */
function play(player: TestPlayer, n: number, tags: Array<Tag>, type: CardType = CardType.AUTOMATED): void {
  for (let i = 0; i < n; i++) {
    player.playedCards.push(fakeCard({tags, type}));
  }
}

describe('SupremeExpertise', () => {
  let card: SupremeExpertise;
  let game: IGame;
  let player: TestPlayer;
  let parliament: Parliament;

  beforeEach(() => {
    card = new SupremeExpertise();
    [game, player, , parliament] = reduxTable();
    player.cardsInHand.push(card);
    player.megaCredits = 20;
    // The baseline every count below assumes: no party effect hands out a wild tag at a fresh table.
    expect(ParliamentHandler.wildTags(player)).eq(0);
  });

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.SUPREME_EXPERTISE);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(12);
    // The «10 [?]» sits in the MIN box — the requirement; the corner holds the only tag.
    expect(card.tags).deep.eq([Tag.SCIENCE]);
    expect(card.metadata.cardNumber).eq('TR01');
    expect(card.requirements).deep.eq([{tagsOfOneType: 10, count: 10}]);
    expect(card.resourceType, 'the card holds nothing itself').is.undefined;
    expect(card.behavior?.addResourcesToAnyCard).deep.eq({type: CardResource.DATA, count: 4});
    // No `mustHaveCard`: the card plays without a holder (rule 5).
    expect((card.behavior?.addResourcesToAnyCard as {mustHaveCard?: boolean}).mustHaveCard).is.undefined;
  });

  it('the info panel reads the printed rule — the requirement, and «4 data» (a mass noun, never «4 datas»)', () => {
    const info = buildCardInformation(card, 'turmoilRedux');
    const text = (kind: string) => info?.groups.find((g) => g.kind === kind)?.blocks.map((b) => b.text);
    expect(text('requirements')).deep.eq(['Requires 10 tags of any one type.']);
    expect(text('immediate')).deep.eq(['Add 4 data to any card.']);
  });

  it('rule 6 — flat 4 VP', () => {
    expect(card.victoryPoints).eq(4);
    expect(card.getVictoryPoints(player)).eq(4);
  });

  describe('the requirement — 10 tags of any one type (rules 1–3)', () => {
    it('9 building tags are refused, and the reason is a COUNT with the honest «now»', () => {
      play(player, 9, [Tag.BUILDING]);
      expect(player.canPlay(card)).is.false;
      const reasons = unplayableReasons(player, card);
      expect(reasons).has.lengthOf(1);
      expect(reasons[0]).deep.include({type: 'count', message: 'Requires ${0} tags of one type', params: ['10'], current: 9, requirement: true});
      expect(reasons[0].requirementKey).eq(`req:${RequirementType.TAGS_OF_ONE_TYPE}`);
    });

    it('10 building tags play', () => {
      play(player, 10, [Tag.BUILDING]);
      expect(player.canPlay(card)).is.true;
      expect(unplayableReasons(player, card)).deep.eq([]);
    });

    it('rule 2 — tags of different types never add up: 5 building + 5 science are 5', () => {
      play(player, 5, [Tag.BUILDING]);
      play(player, 5, [Tag.SCIENCE]);
      expect(player.canPlay(card)).is.false;
      expect(unplayableReasons(player, card)[0]).deep.include({current: 5});
    });

    it('rule 3 — the card\'s own science tag does not count: 9 science tags are refused', () => {
      play(player, 9, [Tag.SCIENCE]);
      expect(player.canPlay(card)).is.false;
      expect(unplayableReasons(player, card)[0]).deep.include({current: 9});
    });

    it('rule 1 — a printed wild tag joins the leading type: 9 science + 1 wild play', () => {
      play(player, 9, [Tag.SCIENCE]);
      play(player, 1, [Tag.WILD]);
      expect(player.canPlay(card)).is.true;
    });

    it('rule 2 — ten played events are face down: their tags are not in play, and the event tag is no type', () => {
      play(player, 10, [Tag.SPACE], CardType.EVENT);
      expect(player.canPlay(card)).is.false;
      expect(unplayableReasons(player, card)[0]).deep.include({current: 0});
    });

    it('rule 1 — the Scientists\' wild tag (two delegates on their resolution) counts: 9 science play', () => {
      play(player, 9, [Tag.SCIENCE]);
      expect(player.canPlay(card)).is.false;
      seatResolution(parliament, 0, OPEN_IP_TRADE_ID);
      parliament.placeVote(player, parliament.slots[0], 'lobby');
      parliament.placeVote(player, parliament.slots[0], 'reserve');
      expect(parliament.hasPartyEffect(player, PartyName.SCIENTISTS)).is.true;
      expect(ParliamentHandler.wildTags(player)).eq(1);
      expect(player.canPlay(card)).is.true;
    });

    it('rule 1 — R&D Funding\'s science tags count while the player acts (8 science + the ruling wild tag + influence 1)', () => {
      play(player, 8, [Tag.SCIENCE]);
      seatEnacted(parliament, RD_FUNDING_ID);
      // The law is the Scientists' own, so they RULE: their wild tag stands beside it.
      expect(ParliamentHandler.wildTags(player), 'the ruling wild tag').eq(1);
      parliament.agenda.set(player.id, 0);
      expect(parliament.influence(player)).eq(0);
      expect(player.canPlay(card), '8 + 1 wild = 9').is.false;
      expect(unplayableReasons(player, card)[0]).deep.include({current: 9});
      parliament.agenda.set(player.id, 1);
      expect(parliament.influence(player)).eq(1);
      expect(player.canPlay(card), '8 + 1 wild + 1 by influence = 10').is.true;
    });

    it('the chip is the printed «?» disc with its number — a minimum', () => {
      const chip = normalizeRequirement(card.requirements[0]);
      expect(chip.type).eq(RequirementType.TAGS_OF_ONE_TYPE);
      expect(chip.iconUrl).eq('assets/tags/diverse.png');
      expect(chip.value).eq(10);
      expect(chip.comparator).eq('min');
    });
  });

  describe('the play — 4 data onto ANY card of yours (rules 4–5)', () => {
    beforeEach(() => {
      play(player, 10, [Tag.SCIENCE]);
      expect(player.canPlay(card)).is.true;
    });

    it('one holder (Political Science): the pick is SHOWN, never applied behind the board — then its action draws', () => {
      const politicalScience = new PoliticalScience();
      player.playedCards.push(politicalScience);
      expect(politicalScience.canAct(player), 'no data yet').is.false;

      player.playCard(card);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.POLITICAL_SCIENCE]);
      expect(pick.title, 'one candidate reads as a confirmation').eq('Add resources to this card');
      expect(politicalScience.resourceCount, 'nothing lands before the answer').eq(0);
      pick.cb([politicalScience]);
      expect(politicalScience.resourceCount).eq(4);

      // The loop closes: TR02's action spends 3 of them for a card.
      const hand = player.cardsInHand.length;
      expect(politicalScience.canAct(player)).is.true;
      politicalScience.action(player);
      runAllActions(game);
      expect(politicalScience.resourceCount).eq(1);
      expect(player.cardsInHand.length).eq(hand + 1);
    });

    it('two holders: a choice between the two', () => {
      const politicalScience = new PoliticalScience();
      const dataHolder = fakeCard({name: 'A data holder' as CardName, resourceType: CardResource.DATA});
      player.playedCards.push(politicalScience, dataHolder);

      player.playCard(card);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.POLITICAL_SCIENCE, dataHolder.name]);
      pick.cb([dataHolder]);
      expect(dataHolder.resourceCount).eq(4);
      expect(politicalScience.resourceCount).eq(0);
    });

    it('rule 4 — an OPPONENT\'s data holder is not «any card»', () => {
      const opponent = player.opponents[0];
      const theirs = new PoliticalScience();
      opponent.playedCards.push(theirs);
      const preview = cardPlayPreview(player, card).branches[0];
      expect(preview.steps.some((s) => s.kind === 'input'), 'no pick offers their card').is.false;
      player.playCard(card);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(theirs.resourceCount).eq(0);
    });

    it('the play preview pre-collects the same pick — one candidate, still an input step', () => {
      player.playedCards.push(new PoliticalScience());
      const branch = cardPlayPreview(player, card).branches[0];
      const inputs = branch.steps.filter((s) => s.kind === 'input');
      expect(inputs).has.lengthOf(1);
      const step = inputs[0];
      if (step.kind === 'input') {
        expect(step.input.type).eq('card');
        expect(step.amount).eq(4);
      }
      expect(branch.steps.some((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning')).is.false;
    });

    it('rule 5 — no holder: the card still plays, and the preview WARNS naming the lost 4 data (no gain chip)', () => {
      const branch = cardPlayPreview(player, card).branches[0];
      const warning = branch.steps.find((s) => s.kind === 'note' && (s as {noteKind?: string}).noteKind === 'warning');
      expect(warning, 'the loss is announced before the play').is.not.undefined;
      const skipped = (warning as {skipped?: {label: string, effect?: {icon: string, amount: number, direction: string}}}).skipped;
      expect(skipped?.label).eq('Add resources to a card');
      expect(skipped?.effect).deep.include({icon: 'data', amount: 4, direction: 'gain'});
      expect(branch.effects.some((e) => e.note === 'to a card'), 'no «+4» chip for data nothing can hold').is.false;
      expect(branch.steps.some((s) => s.kind === 'input')).is.false;

      player.playCard(card);
      runAllActions(game);
      expect(player.popWaitingFor(), 'nothing to ask').is.undefined;
      expect(player.playedCards.has(CardName.SUPREME_EXPERTISE)).is.true;
    });
  });
});
