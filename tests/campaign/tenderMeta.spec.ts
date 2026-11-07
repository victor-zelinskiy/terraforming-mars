import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {TENDER_IDS, TENDER_NAME_KEY, TenderTier, TenderWindow} from '../../src/common/campaign/tenders';
import {
  TENDER_GLYPH_PATH, TENDER_TIER_KEY, TENDER_WINDOW_KEY, tenderChevrons, tenderMeta, tenderMetaIds,
} from '../../src/client/console/campaign/tenderMeta';

/**
 * THE TENDER REGISTRY GUARD — a tender is one id with one row in the rule
 * (`common/campaign/tenders.ts`), one row in the presentation registry and a
 * RUSSIAN line for every key it prints (the name, the rule, the lore, the
 * window and the tier words). A new tender with a hole anywhere is red here,
 * never «${0}» on the TV.
 */
describe('the tender presentation registry', () => {
  const ru: Record<string, string> = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/locales/ru/campaign.json'), 'utf8'));
  const translated = (key: string) => typeof ru[key] === 'string' && ru[key].length > 0;

  it('every tender has a row with its name, rule, lore, a fixed lot number and a glyph', () => {
    expect(tenderMetaIds()).deep.eq(TENDER_IDS);
    const lots = new Set<number>();
    for (const id of TENDER_IDS) {
      const meta = tenderMeta(id);
      expect(meta.id).eq(id);
      expect(meta.nameKey).eq(TENDER_NAME_KEY[id]);
      expect(meta.ruleKey, `${id} rule`).to.be.a('string').and.not.empty;
      expect(meta.loreKey, `${id} lore`).to.be.a('string').and.not.empty;
      expect(lots.has(meta.lot), `${id} shares a lot number`).is.false;
      lots.add(meta.lot);
      expect(TENDER_GLYPH_PATH[meta.glyph], `${id} glyph`).to.be.a('string').and.not.empty;
    }
  });

  it('every printed key has its Russian line (campaign.json)', () => {
    const missing: Array<string> = [];
    for (const id of TENDER_IDS) {
      const meta = tenderMeta(id);
      for (const key of [meta.nameKey, meta.ruleKey, meta.loreKey]) {
        if (!translated(key)) {
          missing.push(`${id}: ${key}`);
        }
      }
    }
    for (const key of [...Object.values(TENDER_WINDOW_KEY), ...Object.values(TENDER_TIER_KEY)]) {
      if (!translated(key)) {
        missing.push(key);
      }
    }
    for (const key of ['Tender', 'Tenders', 'Bidding', 'Tender register', 'Terraforming Committee', 'Lot ${0}', 'Not executed',
      'Withdrawn', 'Executed', 'Bought back', 'Pick order', 'Lot drawn', 'without a tender', 'Your pick', '${0} is picking…',
      'The bidding is over', 'The Register deals the table…', 'Take the tender', 'Inspect the tender', 'Close the reader',
      'the tender bidding is on', 'picking a tender…', 'Waiting for the tender bidding', 'Pick your tender', 'Tender compensation']) {
      if (!translated(key)) {
        missing.push(key);
      }
    }
    expect(missing, `untranslated tender keys:\n${missing.join('\n')}`).is.empty;
  });

  it('the rank by form: three chevrons for the decisive, two notable, one minor, a die for the gamble', () => {
    const chevrons: Record<TenderTier, number> = {decisive: 3, notable: 2, minor: 1, gamble: 0};
    for (const tier of Object.keys(chevrons) as Array<TenderTier>) {
      expect(tenderChevrons(tier)).eq(chevrons[tier]);
    }
    const windows: Array<TenderWindow> = ['legacy', 'start'];
    for (const w of windows) {
      expect(TENDER_WINDOW_KEY[w]).to.be.a('string');
    }
  });
});
