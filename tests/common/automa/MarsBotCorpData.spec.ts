import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {Tag} from '../../../src/common/cards/Tag';
import {BonusCardId, MARS_BOT_CORP_IDS, MarsBotCorpId} from '../../../src/common/automa/AutomaTypes';
import {CORP_SECTION_LABEL, buildMarsBotCorpView, corpOwningBonusCard, marsBotCorpInfo} from '../../../src/common/automa/MarsBotCorpData';

/**
 * The printed MarsBot corporation data — transcribed from the official cards
 * (C01 / C02 / C45, RB-B "Adding Corporations"). These specs pin the DATA so
 * a future edit that drifts from the physical cards fails loudly.
 */
describe('MarsBotCorpData', () => {
  it('every implemented corporation has a definition whose id round-trips', () => {
    for (const id of MARS_BOT_CORP_IDS) {
      const info = marsBotCorpInfo(id);
      expect(info.id).eq(id);
      expect(info.cardNumber).eq(id); // The enum VALUE is the printed card number.
      expect(info.original).is.not.undefined;
      expect(info.sections.length).to.be.greaterThan(0);
    }
  });

  it('C01 Credicor: most-expensive priority, no tags, no resource, no corp cards', () => {
    const info = marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR);
    expect(info.original).eq(CardName.CREDICOR);
    expect(info.draftPriority).deep.eq({type: 'mostExpensive'});
    expect(info.startingTags).is.empty;
    expect(info.resource).is.undefined;
    expect(info.corpBonusCards).is.empty;
    expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'effect']);
  });

  it('C02 Ecoline: no priority, plant resource, owns B23, one before-action-phase box', () => {
    const info = marsBotCorpInfo(MarsBotCorpId.C02_ECOLINE);
    expect(info.original).eq(CardName.ECOLINE);
    expect(info.draftPriority).is.undefined;
    expect(info.startingTags).is.empty;
    expect(info.resource).eq('plant');
    expect(info.corpBonusCards).deep.eq([BonusCardId.B23_RAPID_SPROUTING]);
    expect(info.sections.map((s) => s.kind)).deep.eq(['beforeActionPhase']);
  });

  it('C45 Spire: most-tags priority, Earth starting tag, science resource, all three boxes', () => {
    const info = marsBotCorpInfo(MarsBotCorpId.C45_SPIRE);
    expect(info.original).eq(CardName.SPIRE);
    expect(info.draftPriority).deep.eq({type: 'mostTags'});
    expect(info.startingTags).deep.eq([Tag.EARTH]);
    expect(info.resource).eq('science');
    expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'effect', 'beforeActionPhase']);
  });

  it('the view builder is a faithful projection of the info', () => {
    for (const id of MARS_BOT_CORP_IDS) {
      const info = marsBotCorpInfo(id);
      const view = buildMarsBotCorpView(id);
      expect(view.original).eq(info.original);
      expect(view.startingTags).deep.eq(info.startingTags);
      expect(view.resource).eq(info.resource);
      expect(view.sections).deep.eq(info.sections);
    }
  });

  it('no HUMAN corporation rule leaks into any section text', () => {
    // The human cards' signature numbers/rules must never appear on the bot
    // faces: 57 M€ / 36 M€ / 50 M€ starts, draw 4 discard 3, greenery for 7
    // plants, standard-project discounts.
    const forbidden = [/57/, /36 M/, /50 M/, /[Ss]tart with/, /draw 4/i, /discard 3/i, /7 plants/, /standard project/i];
    for (const id of MARS_BOT_CORP_IDS) {
      for (const section of marsBotCorpInfo(id).sections) {
        for (const line of section.lines) {
          for (const pattern of forbidden) {
            expect(pattern.test(line.text), `${id}: "${line.text}" matches ${pattern}`).is.false;
          }
        }
      }
    }
  });

  it('corpOwningBonusCard maps B23 to Ecoline and nothing else', () => {
    expect(corpOwningBonusCard(BonusCardId.B23_RAPID_SPROUTING)?.id).eq(MarsBotCorpId.C02_ECOLINE);
    expect(corpOwningBonusCard(BonusCardId.B22_SETTLERS)).is.undefined;
    expect(corpOwningBonusCard(BonusCardId.B01_METEOR_SHOWER)).is.undefined;
  });

  it('every section kind has a kicker label', () => {
    for (const id of MARS_BOT_CORP_IDS) {
      for (const section of marsBotCorpInfo(id).sections) {
        expect(CORP_SECTION_LABEL[section.kind], `${id}/${section.kind}`).is.a('string').and.not.empty;
      }
    }
  });
});
