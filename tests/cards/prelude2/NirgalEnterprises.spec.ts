import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {NirgalEnterprises} from '../../../src/server/cards/prelude2/NirgalEnterprises';
import {Briber} from '../../../src/server/milestones/Briber';
import {IGame} from '../../../src/server/IGame';
import {IMilestone} from '../../../src/server/milestones/IMilestone';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {PlayerInput} from '../../../src/server/PlayerInput';
import {CardName} from '../../../src/common/cards/CardName';
import {Tag} from '../../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../../src/common/automa/MarsBotCorpData';
import {corporationCardsFromJSON} from '../../../src/server/createCard';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {AWARD_COSTS, MILESTONE_COST} from '../../../src/common/constants';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';

/**
 * PC01 Nirgal Enterprises — the FIRST Prelude 2 corporation (`docs/PRELUDE2_ADAPTATION.md` §3.1 п. 1 + п. 6). The card is
 * declarative (30 M€, energy · plant · steel production +1, three tags); its one mechanic is NOT in the card but in the
 * engine's price (`Player.milestoneCost()` / `awardFundingCost()` by the card's name) — so this spec pins the RULE where
 * it is read: the price of a claim and of a funding is 0, everything else about milestones and awards is as for anybody.
 * Merchant's reserve under Nirgal is pinned upstream (`tests/milestones/modular/Merchant.spec.ts` «Compatible with
 * Nirgal Enterprises»), never duplicated here.
 */

/** The leaf of the action menu titled `name` (a milestone or an award), wherever it is nested. */
function menuLeaf(input: PlayerInput, name: string): SelectOption | undefined {
  if (input instanceof SelectOption && input.title === name) {
    return input;
  }
  if (input instanceof OrOptions) {
    for (const option of input.options) {
      const found = menuLeaf(option, name);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function terraformer(game: IGame): IMilestone {
  const milestone = game.milestones.find((m) => m.name.startsWith('Terraformer'));
  if (milestone === undefined) {
    throw new Error('the default board carries Terraformer');
  }
  return milestone;
}

function claim(player: TestPlayer, milestone: IMilestone): void {
  const leaf = menuLeaf(player.getActions(), milestone.name);
  if (leaf === undefined) {
    throw new Error(`${milestone.name} is not offered`);
  }
  leaf.cb(undefined);
  runAllActions(player.game);
}

function fund(player: TestPlayer, awardName: string): void {
  const leaf = menuLeaf(player.getActions(), awardName);
  if (leaf === undefined) {
    throw new Error(`${awardName} is not offered`);
  }
  leaf.cb(undefined);
  runAllActions(player.game);
}

describe('NirgalEnterprises', () => {
  let card: NirgalEnterprises;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    card = new NirgalEnterprises();
    [game, player, player2] = testGame(2);
  });

  it('is no longer held back (the first corporation of the set to cross)', () => {
    expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.NIRGAL_ENTERPRISES)).is.false;
  });

  describe('rule 1 — the start', () => {
    it('starts with 30 M€ and +1 energy · plant · steel production', () => {
      player.playCorporationCard(card);
      runAllActions(game);
      expect(player.megaCredits).eq(30);
      expect(player.production.energy).eq(1);
      expect(player.production.plants).eq(1);
      expect(player.production.steel).eq(1);
      expect(player.production.megacredits).eq(0);
    });

    it('prints three tags — energy, plant, building — and they count as the corporation\'s tags', () => {
      expect(card.tags).deep.eq([Tag.POWER, Tag.PLANT, Tag.BUILDING]);
      player.playCorporationCard(card);
      expect(player.tags.count(Tag.POWER, 'raw')).eq(1);
      expect(player.tags.count(Tag.PLANT, 'raw')).eq(1);
      expect(player.tags.count(Tag.BUILDING, 'raw')).eq(1);
    });

    it('keeps its art and lore keyed on PC01 (the number upstream marks «Renumber» stays)', () => {
      expect(card.metadata.cardNumber).eq('PC01');
      expect(fs.existsSync(path.resolve('assets/card-images/PC01.webp')), 'the art is in the project').is.true;
      const lore = JSON.parse(fs.readFileSync(path.resolve('assets/text/lore_texts.json'), 'utf-8')) as Record<string, string>;
      const ru = JSON.parse(fs.readFileSync(path.resolve('src/locales/ru/lore_texts.json'), 'utf-8')) as Record<string, string>;
      expect(lore.PC01, 'EN lore').to.be.a('string').and.match(/^Nirgal was founded/);
      expect(ru[lore.PC01], 'RU lore').to.be.a('string').and.match(/^Nirgal возникла/);
    });
  });

  describe('rule 2 — the PRICE is 0, never the condition', () => {
    beforeEach(() => {
      player.playCorporationCard(card);
      runAllActions(game);
    });

    it('a milestone costs 0 — claimable with 0 M€ in hand, and the claim spends nothing', () => {
      player.megaCredits = 0;
      player.setTerraformRating(40);
      const milestone = terraformer(game);
      expect(player.milestoneCost()).eq(0);
      expect(player.claimableMilestones().map((m) => m.name)).contains(milestone.name);
      claim(player, milestone);
      expect(game.claimedMilestones.map((c) => c.milestone.name)).deep.eq([milestone.name]);
      expect(game.claimedMilestones[0].player).eq(player);
      expect(player.megaCredits).eq(0);
    });

    it('the milestone\'s CONDITION still stands — an unmet one is not offered at 0 M€', () => {
      player.megaCredits = 0;
      player.setTerraformRating(20);
      expect(player.claimableMilestones().map((m) => m.name)).not.contains(terraformer(game).name);
    });
  });

  describe('rule 3 — «ALWAYS»: the climbing award price is 0 at every step', () => {
    beforeEach(() => {
      player.playCorporationCard(card);
      runAllActions(game);
      player.megaCredits = 0;
    });

    it('funds all three awards for 0 while the table\'s price climbs 8 → 14 → 20', () => {
      const names = game.awards.map((a) => a.name).slice(0, 3);
      names.forEach((name, i) => {
        expect(game.getAwardFundingCost(), `the table's price before funding ${i + 1}`).eq(AWARD_COSTS[i]);
        expect(player.awardFundingCost(), `Nirgal's price before funding ${i + 1}`).eq(0);
        fund(player, name);
        expect(player.megaCredits).eq(0);
      });
      expect(game.fundedAwards.map((f) => f.award.name)).deep.eq(names);
      expect(game.allAwardsFunded()).is.true;
    });

    it('a rival at the same table pays the table\'s price', () => {
      fund(player, game.awards[0].name);
      expect(player2.awardFundingCost()).eq(AWARD_COSTS[1]);
      expect(player2.milestoneCost()).eq(MILESTONE_COST);
    });
  });

  describe('the limit of three holds', () => {
    beforeEach(() => {
      player.playCorporationCard(card);
      runAllActions(game);
      player.megaCredits = 0;
    });

    it('a fourth award is never offered', () => {
      for (const award of game.awards.slice(0, 3)) {
        fund(player, award.name);
      }
      expect(menuLeaf(player.getActions(), game.awards[3].name)).is.undefined;
    });

    it('a fourth milestone is never offered', () => {
      player.setTerraformRating(40);
      // Three slots taken by somebody else: Nirgal's 0 opens no fourth.
      for (const milestone of game.milestones.slice(0, 3)) {
        game.claimedMilestones.push({player: player2, milestone});
      }
      expect(game.allMilestonesClaimed()).is.true;
      expect(player.claimableMilestones()).is.empty;
    });
  });

  describe('rule 4 — Briber keeps its own +12 (a CONDITION of the milestone, not the price)', () => {
    let briber: Briber;

    beforeEach(() => {
      player.playCorporationCard(card);
      runAllActions(game);
      briber = new Briber();
      game.milestones.push(briber);
    });

    it('Nirgal pays the 12 and nothing else', () => {
      player.megaCredits = 11;
      expect(briber.canClaim(player)).is.false;
      player.megaCredits = 12;
      expect(briber.canClaim(player)).is.true;
      claim(player, briber);
      expect(player.megaCredits).eq(0);
      expect(game.claimedMilestones.map((c) => c.milestone.name)).contains('Briber');
    });
  });

  describe('rule 6 — as a SECOND corporation (Merger)', () => {
    it('the table\'s price until Nirgal is played, 0 from that moment on', () => {
      // The first corporation is somebody else; Nirgal arrives second (the road Merger's own spec walks).
      player.playCorporationCard(corporationCardsFromJSON([CardName.TERRALABS_RESEARCH])[0]);
      runAllActions(game);
      expect(player.milestoneCost()).eq(MILESTONE_COST);
      expect(player.awardFundingCost()).eq(AWARD_COSTS[0]);
      player.playCorporationCard(card);
      runAllActions(game);
      expect(player.playedCards.corporations().map((c) => c.name)).contains(CardName.NIRGAL_ENTERPRISES);
      expect(player.milestoneCost()).eq(0);
      expect(player.awardFundingCost()).eq(0);
    });
  });

  describe('rule 7 — a one-player table has no milestones and no awards', () => {
    it('the effect never fires: nothing is offered, even at price 0', () => {
      const [soloGame, solo] = testGame(1);
      solo.playCorporationCard(card);
      runAllActions(soloGame);
      solo.setTerraformRating(40);
      expect(solo.milestoneCost()).eq(0);
      expect(soloGame.allMilestonesClaimed()).is.true;
      expect(soloGame.allAwardsFunded()).is.true;
      expect(solo.claimableMilestones()).is.empty;
      const menu = solo.getActions();
      expect(menuLeaf(menu, terraformer(soloGame).name)).is.undefined;
      expect(menuLeaf(menu, soloGame.awards[0].name)).is.undefined;
    });
  });

  describe('a Turmoil Redux table', () => {
    it('claims and funds in the action phase as usual — no party touches the price', () => {
      const [reduxGame, redux] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      redux.playCorporationCard(card);
      runAllActions(reduxGame);
      redux.megaCredits = 0;
      redux.setTerraformRating(40);
      expect(redux.milestoneCost()).eq(0);
      expect(redux.awardFundingCost()).eq(0);
      claim(redux, terraformer(reduxGame));
      fund(redux, reduxGame.awards[0].name);
      expect(reduxGame.claimedMilestones).has.length(1);
      expect(reduxGame.fundedAwards).has.length(1);
      expect(redux.megaCredits).eq(0);
    });
  });

  describe('rule 8 — MarsBot', () => {
    it('the human\'s Nirgal keeps the bot off its twin C42 (the collision key is `original`), and claims for free', () => {
      expect(marsBotCorpInfo(MarsBotCorpId.C42_NIRGAL_ENTERPRISES).original).eq(CardName.NIRGAL_ENTERPRISES);
      // The override asks for the twin; an ineligible override falls back to the random selection.
      const [botGame, human] = testAutomaGame({
        corporation: MarsBotCorpId.C42_NIRGAL_ENTERPRISES, keepInitialCardSelection: true,
      }, '-nirgal');
      human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
        ...corporationCardsFromJSON([CardName.NIRGAL_ENTERPRISES]));
      human.dealtProjectCards.splice(0, human.dealtProjectCards.length);
      human.process({type: 'initialCards', responses: [
        {type: 'card', cards: [CardName.NIRGAL_ENTERPRISES]},
        {type: 'card', cards: []},
      ]});
      runAllActions(botGame);
      human.process({type: 'card', cards: [CardName.NIRGAL_ENTERPRISES]});
      runAllActions(botGame);
      expect(human.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.NIRGAL_ENTERPRISES]);
      expect(botGame.automa!.corporation).is.not.undefined;
      expect(botGame.automa!.corporation).not.eq(MarsBotCorpId.C42_NIRGAL_ENTERPRISES);
      // The bot is the second seat: milestones and awards live, and the human's price is 0.
      expect(botGame.allMilestonesClaimed()).is.false;
      expect(human.milestoneCost()).eq(0);
      expect(human.awardFundingCost()).eq(0);
    });
  });
});
