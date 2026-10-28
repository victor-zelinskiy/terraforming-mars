import {expect} from 'chai';
import {REDS_CAMPAIGN_CARDS, REDS_CAMPAIGN_MEGACREDITS, RedsCampaign} from '../../../src/server/cards/turmoilRedux/RedsCampaign';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from '../../../src/server/cards/turmoilRedux/PopularSupportCampaign';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {GameCards} from '../../../src/server/GameCards';
import {Game} from '../../../src/server/Game';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {NeutralRallyModel} from '../../../src/common/models/ActionPreviewModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {PARLIAMENT_NEUTRAL_DELEGATES, REDUX_PARTIES} from '../../../src/common/parliament/ParliamentTypes';
import {endGenerationThroughParliament, quietResolutionOf, quietWinnerIndex, seatQuiet, seatResolution} from '../../parliament/parliamentArrange';

/**
 * TRP4 — REDS CAMPAIGN: the third of the six Prelude campaigns — and the first that asks NOTHING (the M€, the drawn card
 * and the support ride the play's own answer). Every rule reading of the card file's header (and of
 * `PopularSupportCampaign`'s) is pinned here; the preview's promise is held to the play.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RedsCampaign};
const REDS = PartyName.REDS;

function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.PRELUDES;
  const parliament = game.parliament!;
  const card = new RedsCampaign();
  p1.preludeCardsInHand.push(card);
  return {game, p1, p2, parliament, card};
}

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, coloniesExtension: true, ...overrides};
}

function skips(t: Table) {
  return t.game.events.events.filter((e) => e.type === 'effect-skipped');
}

/** Play the Prelude and run the whole queue — nothing is asked. */
function play(t: Table): void {
  cast(t.card.play(t.p1), undefined);
  runAllActions(t.game);
}

function previewOf(t: Table) {
  return cardPlayPreview(t.p1, t.card).branches[0];
}

function rallyOf(t: Table): NeutralRallyModel {
  const step = previewOf(t).steps.find((s) => s.kind === 'neutralRally');
  expect(step, 'the support is a SHOW step of the preview').is.not.undefined;
  return (step as {kind: 'neutralRally', rally: NeutralRallyModel}).rally;
}

describe('RedsCampaign', () => {
  describe('the card as printed', () => {
    it('is a PRELUDE with the Mars tag, no VP, TRP4 — printing «18 M€ · a card · 3 neutral delegates [Reds]» in that order', () => {
      const card = new RedsCampaign();
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.MARS]);
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([]);
      expect(card.metadata.cardNumber).eq('TRP4');
      expect(card).instanceOf(PopularSupportCampaign);
      expect(card.campaignParty).eq(REDS);
      expect(card.behavior).deep.eq({stock: {megacredits: REDS_CAMPAIGN_MEGACREDITS}, drawCard: REDS_CAMPAIGN_CARDS});
      expect(card.startingMegaCredits, 'the Prelude\'s M€ worth').eq(18);
      expect([REDS_CAMPAIGN_MEGACREDITS, REDS_CAMPAIGN_CARDS, CAMPAIGN_SUPPORT]).deep.eq([18, 1, 3]);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter(isICardRenderItem) as Array<ICardRenderItem>;
      expect(items.map((i) => i.type)).deep.eq([
        CardRenderItemType.MEGACREDITS, CardRenderItemType.CARDS, CardRenderItemType.NEUTRAL_DELEGATE, CardRenderItemType.PARTY_SEAL,
      ]);
      expect(items[0].amount).eq(18);
      expect(items[1].amount).eq(1);
      expect(items[2].amount).eq(3);
      expect(items[3].party).eq(REDS);
    });
  });

  describe('deck wiring — a Prelude of the Redux manifest, dealt only beside the Prelude expansion', () => {
    it('is registered under `preludeCards` with the Prelude mark only (no Colonies mark on the scan)', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.REDS_CAMPAIGN]?.compatibility).eq('prelude');
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.REDS_CAMPAIGN]).is.undefined;
    });

    it('joins the prelude deck with Redux + Preludes on, and never otherwise', () => {
      const names = (o: Partial<GameOptions>) => new GameCards(options(o)).getPreludeCards().map((c) => c.name);
      expect(names({turmoilReduxExpansion: true, preludeExtension: true})).contains(CardName.REDS_CAMPAIGN);
      expect(names({turmoilReduxExpansion: true, preludeExtension: false})).not.contains(CardName.REDS_CAMPAIGN);
      expect(names({turmoilReduxExpansion: false, preludeExtension: true})).not.contains(CardName.REDS_CAMPAIGN);
    });
  });

  describe('nothing is asked: the M€, the drawn card and the support ride the play\'s own answer — the support last', () => {
    it('+18 M€, one card into the hand, three neutrals in the Reds\' area — one record, no recount; no prompt', () => {
      const t = table();
      const megacredits = t.p1.megaCredits;
      const hand = t.p1.cardsInHand.length;
      expect(t.card.canPlay(t.p1)).is.true;
      play(t);
      expect(t.p1.megaCredits - megacredits, 'the printed 18 M€, no recount on top').eq(18);
      expect(t.p1.cardsInHand.length - hand, 'one card drawn').eq(1);
      expect(t.parliament.popularSupportOf(REDS)).eq(3);
      for (const party of REDUX_PARTIES.filter((p) => p !== REDS)) {
        expect(t.parliament.popularSupportOf(party), `${party}'s area`).eq(0);
      }
      const record = t.parliament.lastRally!;
      expect(record).deep.include({player: t.p1.id, card: CardName.REDS_CAMPAIGN, recount: false, megacredits: 0});
      expect(record.votes).deep.eq([]);
      expect(record.missing).deep.eq([]);
      expect(record.support).deep.eq([{party: REDS, current: 0, gained: 3, resulting: 3, printed: 3}]);
      expect(t.parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES - 3);
      expect(t.p1.getWaitingFor(), 'nothing is asked').is.undefined;
      expect(skips(t)).is.empty;
      t.parliament.assertLedger(t.game);
    });

    it('the journal tells the support AFTER the draw (the printed order)', () => {
      const t = table();
      const from = t.game.gameLog.length;
      play(t);
      const lines = t.game.gameLog.slice(from).map((entry) => entry.message);
      const support = lines.findIndex((m) => m === '${0} gain ${1} neutral delegate(s) in Popular Support (${2}/${3})');
      const draw = lines.findIndex((m) => /drew/i.test(m));
      expect(support, `the support line (${lines.join(' | ')})`).is.greaterThan(-1);
      expect(draw, `the draw line (${lines.join(' | ')})`).is.greaterThan(-1);
      expect(support, 'the support comes last').is.greaterThan(draw);
    });
  });

  describe('rule 1 — the Reds\' resolution up for a vote takes NONE of the three: they WAIT in the area', () => {
    it('with the Reds\' card in the voting area the cubes go to the area; the card\'s votes do not move', () => {
      const t = table();
      seatResolution(t.parliament, 0, quietResolutionOf(REDS));
      const slot = t.parliament.slotOf(REDS)!;
      const votesBefore = slot.votes.length;
      play(t);
      expect(slot.votes.length, 'no vote on the standing card').eq(votesBefore);
      expect(t.parliament.neutralVotes(slot)).eq(0);
      expect(t.parliament.popularSupportOf(REDS)).eq(3);
      expect(t.parliament.lastRally!.votes).deep.eq([]);
    });

    it('…and they become votes only on a Reds card the REFRESH deals — never on the standing one, whatever the sitting decides', () => {
      const t = table();
      const winner = quietWinnerIndex(t.parliament);
      seatQuiet(t.parliament, winner);
      if (t.parliament.resolutionOf(t.parliament.slots[winner].instance).party !== REDS) {
        seatResolution(t.parliament, (winner + 1) % t.parliament.slots.length, quietResolutionOf(REDS));
      }
      t.parliament.placeVote(t.p2, t.parliament.slots[winner], 'lobby');
      for (let i = 0; i < t.parliament.slots.length; i++) {
        if (i !== winner) {
          seatQuiet(t.parliament, i);
        }
      }
      const standing = t.parliament.slotOf(REDS)!.instance;
      play(t);
      expect(t.parliament.popularSupportOf(REDS)).eq(3);
      t.game.phase = Phase.ACTION;
      for (const player of [t.p1, t.p2]) {
        player.preludeCardsInHand = [];
      }

      endGenerationThroughParliament(t.game);

      const dealt = t.parliament.slotOf(REDS);
      if (t.parliament.rulingParty() === REDS) {
        expect(t.parliament.enacted).eq(standing);
        expect(dealt, 'the ruler\'s party is never dealt').is.undefined;
        expect(t.parliament.popularSupportOf(REDS)).eq(3);
      } else if (dealt !== undefined) {
        expect(dealt.instance).not.eq(standing);
        expect(t.parliament.neutralVotes(dealt)).eq(3);
        expect(t.parliament.popularSupportOf(REDS)).eq(0);
      } else {
        expect(t.parliament.popularSupportOf(REDS)).eq(3);
      }
    });
  });

  describe('rule 2 of the campaign — the area holds three', () => {
    it('a full area takes none — a NAMED skip; the M€ and the card still come', () => {
      const t = table();
      t.parliament.addPopularSupport(REDS, 3);
      expect(rallyOf(t).support[0]).deep.include({current: 3, gained: 0, limit: 'area'});
      const megacredits = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - megacredits).eq(18);
      expect(t.parliament.popularSupportOf(REDS)).eq(3);
      expect(skips(t)).has.lengthOf(1);
    });
  });

  describe('the preview == the play', () => {
    it('chips: +18 M€, the card, «+3 [neutral] · to Popular Support»; the support\'s SHOW step is the last step', () => {
      const t = table();
      const branch = previewOf(t);
      expect(branch.effects.some((e) => e.icon === 'megacredits' && e.amount === 18), 'the M€ chip').is.true;
      expect(branch.effects.some((e) => e.icon === 'cards' && e.amount === 1), 'the card chip').is.true;
      expect(branch.effects.find((e) => e.icon === 'neutral-delegate')).deep.include({amount: 3, note: 'to Popular Support'});
      expect(branch.steps[branch.steps.length - 1]?.kind).eq('neutralRally');
      const rally = rallyOf(t);
      expect(rally).deep.include({recount: false, megacredits: 0});
      play(t);
      expect(t.parliament.lastRally!.support).deep.eq(rally.support);
      expect(t.parliament.lastRally!.inUse).deep.eq(rally.inUse);
    });
  });

  describe('save / load', () => {
    it('the area survives a reload; the record (a presentation ring) does not', () => {
      const t = table();
      play(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      expect(reloaded.parliament!.popularSupportOf(REDS)).eq(3);
      expect(reloaded.parliament!.lastRally).is.undefined;
    });
  });
});
