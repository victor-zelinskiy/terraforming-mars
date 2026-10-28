import {expect} from 'chai';
import {GREENS_CAMPAIGN_PLANT_PRODUCTION, GREENS_CAMPAIGN_TR, GreensCampaign} from '../../../src/server/cards/turmoilRedux/GreensCampaign';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from '../../../src/server/cards/turmoilRedux/PopularSupportCampaign';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {GREENS_MEGACREDITS_PER_TR} from '../../../src/server/parliament/parties/PartyEffects';
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
import {ICardRenderItem, ItemType, isICardRenderItem, isICardRenderProductionBox} from '../../../src/common/cards/render/Types';
import {NeutralRallyModel} from '../../../src/common/models/ActionPreviewModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {PARLIAMENT_NEUTRAL_DELEGATES, REDUX_PARTIES} from '../../../src/common/parliament/ParliamentTypes';
import {endGenerationThroughParliament, quietResolutionOf, quietWinnerIndex, seatQuiet, seatResolution} from '../../parliament/parliamentArrange';

/**
 * TRP5 — GREENS CAMPAIGN: the fourth of the six Prelude campaigns — and the first whose party RULES at the start (the
 * Greens, by default, the ENACTED slot empty). Every rule reading of the card file's header (and of
 * `PopularSupportCampaign`'s) is pinned here; the preview's promise is held to the play.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: GreensCampaign};
const GREENS = PartyName.GREENS;

function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.PRELUDES;
  const parliament = game.parliament!;
  const card = new GreensCampaign();
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

describe('GreensCampaign', () => {
  describe('the card as printed', () => {
    it('is a PRELUDE with the Plant and Microbe tags, no VP, TRP5 — printing «2 TR · plant production · 3 neutral delegates [Greens]»', () => {
      const card = new GreensCampaign();
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.PLANT, Tag.MICROBE]);
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([]);
      expect(card.metadata.cardNumber).eq('TRP5');
      expect(card).instanceOf(PopularSupportCampaign);
      expect(card.campaignParty).eq(GREENS);
      expect(card.behavior).deep.eq({tr: GREENS_CAMPAIGN_TR, production: {plants: GREENS_CAMPAIGN_PLANT_PRODUCTION}});
      expect([GREENS_CAMPAIGN_TR, GREENS_CAMPAIGN_PLANT_PRODUCTION, CAMPAIGN_SUPPORT]).deep.eq([2, 1, 3]);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const row = rows[0].filter((i) => typeof i !== 'string');
      expect(row.some((i) => isICardRenderProductionBox(i)), 'a production box').is.true;
      const items = row.filter(isICardRenderItem) as Array<ICardRenderItem>;
      expect(items[0]).deep.include({type: CardRenderItemType.TR, amount: 2});
      expect(items.find((i) => i.type === CardRenderItemType.NEUTRAL_DELEGATE)?.amount).eq(3);
      expect(items.find((i) => i.type === CardRenderItemType.PARTY_SEAL)?.party).eq(GREENS);
    });
  });

  describe('deck wiring — a Prelude of the Redux manifest, dealt only beside the Prelude expansion', () => {
    it('is registered under `preludeCards` with the Prelude mark only (no Colonies mark on the scan)', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.GREENS_CAMPAIGN]?.compatibility).eq('prelude');
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.GREENS_CAMPAIGN]).is.undefined;
    });

    it('joins the prelude deck with Redux + Preludes on, and never otherwise', () => {
      const names = (o: Partial<GameOptions>) => new GameCards(options(o)).getPreludeCards().map((c) => c.name);
      expect(names({turmoilReduxExpansion: true, preludeExtension: true})).contains(CardName.GREENS_CAMPAIGN);
      expect(names({turmoilReduxExpansion: true, preludeExtension: false})).not.contains(CardName.GREENS_CAMPAIGN);
      expect(names({turmoilReduxExpansion: false, preludeExtension: true})).not.contains(CardName.GREENS_CAMPAIGN);
    });
  });

  describe('nothing is asked: the rating, the production and the support ride the play\'s own answer — the support last', () => {
    it('+2 TR, +1 plant production, three neutrals in the Greens\' area — one record, no recount; no prompt', () => {
      const t = table();
      const tr = t.p1.terraformRating;
      expect(t.card.canPlay(t.p1)).is.true;
      play(t);
      expect(t.p1.terraformRating - tr).eq(2);
      expect(t.p1.production.plants).eq(1);
      expect(t.parliament.popularSupportOf(GREENS)).eq(3);
      for (const party of REDUX_PARTIES.filter((p) => p !== GREENS)) {
        expect(t.parliament.popularSupportOf(party), `${party}'s area`).eq(0);
      }
      const record = t.parliament.lastRally!;
      expect(record).deep.include({player: t.p1.id, card: CardName.GREENS_CAMPAIGN, recount: false, megacredits: 0});
      expect(record.votes).deep.eq([]);
      expect(record.missing).deep.eq([]);
      expect(record.support).deep.eq([{party: GREENS, current: 0, gained: 3, resulting: 3, printed: 3}]);
      expect(t.parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES - 3);
      expect(t.p1.getWaitingFor(), 'nothing is asked').is.undefined;
      expect(skips(t)).is.empty;
      t.parliament.assertLedger(t.game);
    });

    it('rule 3 — the ruling Greens ANSWER the play: 2 M€ per TR step and +1 M€ production for the plant production', () => {
      const t = table();
      expect(t.parliament.rulingParty(), 'the Greens rule by default at the start').eq(GREENS);
      const megacredits = t.p1.megaCredits;
      const mcProduction = t.p1.production.megacredits;
      play(t);
      expect(t.p1.megaCredits - megacredits, 'the table\'s answer to the rating').eq(GREENS_MEGACREDITS_PER_TR * 2);
      expect(t.p1.production.megacredits - mcProduction, 'the table\'s answer to the plant production').eq(1);
    });
  });

  describe('rule 2 — THE RULER\'S OWN AREA: the Greens rule at the start, their area fills all the same and WAITS', () => {
    it('the Greens rule by default (ENACTED empty): the three land in their area — no exception for the ruler', () => {
      const t = table();
      expect(t.parliament.enacted).is.undefined;
      expect(t.parliament.rulingParty()).eq(GREENS);
      play(t);
      expect(t.parliament.popularSupportOf(GREENS)).eq(3);
    });
  });

  describe('rule 1 — the Greens\' resolution up for a vote takes NONE of the three: they WAIT in the area', () => {
    it('with the Greens\' card in the voting area the cubes go to the area; the card\'s votes do not move', () => {
      const t = table();
      seatResolution(t.parliament, 0, quietResolutionOf(GREENS));
      const slot = t.parliament.slotOf(GREENS)!;
      const votesBefore = slot.votes.length;
      play(t);
      expect(slot.votes.length, 'no vote on the standing card').eq(votesBefore);
      expect(t.parliament.neutralVotes(slot)).eq(0);
      expect(t.parliament.popularSupportOf(GREENS)).eq(3);
      expect(t.parliament.lastRally!.votes).deep.eq([]);
    });

    it('…and they become votes only on a Greens card the REFRESH deals — never on the standing one, whatever the sitting decides', () => {
      const t = table();
      const winner = quietWinnerIndex(t.parliament);
      seatQuiet(t.parliament, winner);
      if (t.parliament.resolutionOf(t.parliament.slots[winner].instance).party !== GREENS) {
        seatResolution(t.parliament, (winner + 1) % t.parliament.slots.length, quietResolutionOf(GREENS));
      }
      t.parliament.placeVote(t.p2, t.parliament.slots[winner], 'lobby');
      for (let i = 0; i < t.parliament.slots.length; i++) {
        if (i !== winner) {
          seatQuiet(t.parliament, i);
        }
      }
      const standing = t.parliament.slotOf(GREENS)?.instance;
      play(t);
      expect(t.parliament.popularSupportOf(GREENS)).eq(3);
      t.game.phase = Phase.ACTION;
      for (const player of [t.p1, t.p2]) {
        player.preludeCardsInHand = [];
      }

      endGenerationThroughParliament(t.game);

      const dealt = t.parliament.slotOf(GREENS);
      if (t.parliament.rulingParty() === GREENS) {
        expect(dealt, 'the ruler\'s party is never dealt').is.undefined;
        expect(t.parliament.popularSupportOf(GREENS)).eq(3);
      } else if (dealt !== undefined) {
        expect(dealt.instance).not.eq(standing);
        expect(t.parliament.neutralVotes(dealt)).eq(3);
        expect(t.parliament.popularSupportOf(GREENS)).eq(0);
      } else {
        expect(t.parliament.popularSupportOf(GREENS)).eq(3);
      }
    });
  });

  describe('rule 2 of the campaign — the area holds three', () => {
    it('a full area takes none — a NAMED skip; the rating and the production still come', () => {
      const t = table();
      t.parliament.addPopularSupport(GREENS, 3);
      expect(rallyOf(t).support[0]).deep.include({current: 3, gained: 0, limit: 'area'});
      const tr = t.p1.terraformRating;
      play(t);
      expect(t.p1.terraformRating - tr).eq(2);
      expect(t.p1.production.plants).eq(1);
      expect(t.parliament.popularSupportOf(GREENS)).eq(3);
      expect(skips(t)).has.lengthOf(1);
    });
  });

  describe('the preview == the play', () => {
    it('chips: the TR, +1 plant production, «+3 [neutral] · to Popular Support»; the support\'s SHOW step is the last step', () => {
      const t = table();
      const branch = previewOf(t);
      expect(branch.effects.some((e) => e.icon === 'tr' && e.amount === 2), 'the TR chip').is.true;
      expect(branch.effects.some((e) => e.icon === 'plants' && e.amount === 1), 'the plant production chip').is.true;
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
      expect(reloaded.parliament!.popularSupportOf(GREENS)).eq(3);
      expect(reloaded.parliament!.lastRally).is.undefined;
    });
  });
});
