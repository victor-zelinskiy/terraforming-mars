import {expect} from 'chai';
import * as fs from 'fs';
import {CardName} from '../../../src/common/cards/CardName';
import {Expansion} from '../../../src/common/cards/GameModule';
import {Tag} from '../../../src/common/cards/Tag';
import {BonusCardId, MARS_BOT_CORP_IDS, MarsBotCorpId} from '../../../src/common/automa/AutomaTypes';
import {CORP_SECTION_LABEL, buildMarsBotCorpView, corpOwningBonusCard, marsBotCorpInfo} from '../../../src/common/automa/MarsBotCorpData';

/**
 * The printed MarsBot corporation data — transcribed from the official cards
 * (C01–C04 / C45, RB-B "Adding Corporations"). These specs pin the DATA so
 * a future edit that drifts from the physical cards fails loudly.
 */
/** Every i18n key the RU locale defines, across all of its files (nested included). */
function ruLocaleKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (node: unknown) => {
    if (node === null || typeof node !== 'object') {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      keys.add(key);
      walk(value);
    }
  };
  for (const file of fs.readdirSync('src/locales/ru')) {
    if (file.endsWith('.json')) {
      walk(JSON.parse(fs.readFileSync(`src/locales/ru/${file}`, 'utf8')));
    }
  }
  return keys;
}

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

  it('a white-marker corporation always names what its markers remind of', () => {
    // The pair is the contract: markers without a legend would be an
    // unexplained decoration on the mat (C04 is the first to paint any).
    for (const id of MARS_BOT_CORP_IDS) {
      const info = marsBotCorpInfo(id);
      expect(info.whiteMarkerTracks === undefined, `${id}`).eq(info.markerLegend === undefined);
      expect((info.whiteMarkerTracks ?? []).length === 0, `${id}`).eq(info.markerLegend === undefined);
    }
    expect(marsBotCorpInfo(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS).whiteMarkerTracks)
      .deep.eq([Tag.BUILDING, Tag.EVENT]);
  });

  it('a printed module condition is never a module MarsBot games cannot have', () => {
    // C16 is the first corporation to print one («use this corporation only
    // when playing with Prelude»). A condition naming a module the automa
    // validator REJECTS would make that corporation permanently unreachable —
    // a silent dead entry in the pool, which is exactly what this guard is
    // here to fail on. The POC's playable set is Corporate Era + Prelude +
    // Venus Next + Colonies.
    const playable: ReadonlyArray<Expansion> = ['corpera', 'prelude', 'venus', 'colonies'];
    for (const id of MARS_BOT_CORP_IDS) {
      const required = marsBotCorpInfo(id).requiresModules;
      if (required === undefined) {
        continue;
      }
      expect(required, `${id}: an empty condition should simply be absent`).is.not.empty;
      for (const module of required) {
        expect(playable, `${id} requires ${module}, which no MarsBot game can enable`).contains(module);
      }
    }
    expect(marsBotCorpInfo(MarsBotCorpId.C16_VALLEY_TRUST).requiresModules).deep.eq(['prelude']);
    expect(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR).requiresModules).is.undefined;
  });

  it('corpOwningBonusCard maps B23 to Ecoline and nothing else', () => {
    expect(corpOwningBonusCard(BonusCardId.B23_RAPID_SPROUTING)?.id).eq(MarsBotCorpId.C02_ECOLINE);
    expect(corpOwningBonusCard(BonusCardId.B22_SETTLERS)?.id, 'B22 now belongs to C18')
      .eq(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES);
    expect(corpOwningBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND), 'still unowned').is.undefined;
    expect(corpOwningBonusCard(BonusCardId.B01_METEOR_SHOWER)).is.undefined;
  });

  it('every printed line, cube legend and marker legend has a RU translation', () => {
    // THE WORKLIST: a corporation ships one string the RU locale never got and
    // the mat renders it in English, in the middle of a Russian screen — the
    // C16 cube legend did exactly that, and only a screenshot caught it (the
    // i18n audit checks duplicates and structure, not source-string coverage).
    // Every text this data feeds the UI is listed here BY NAME when missing.
    const keys = ruLocaleKeys();
    const missing: Array<string> = [];
    for (const id of MARS_BOT_CORP_IDS) {
      const info = marsBotCorpInfo(id);
      const check = (text: string | undefined, where: string) => {
        if (text !== undefined && text.length > 0 && !keys.has(text)) {
          missing.push(`${id} (${where}): "${text}"`);
        }
      };
      info.sections.forEach((section) => section.lines.forEach((line) => check(line.text, section.kind)));
      Object.entries(info.cubeLegend ?? {}).forEach(([cube, text]) => check(text, `cubeLegend.${cube}`));
      check(info.markerLegend, 'markerLegend');
    }
    expect(missing, `untranslated MarsBot corporation strings:\n${missing.join('\n')}`).is.empty;
  });

  it('every section kind has a kicker label', () => {
    for (const id of MARS_BOT_CORP_IDS) {
      for (const section of marsBotCorpInfo(id).sections) {
        expect(CORP_SECTION_LABEL[section.kind], `${id}/${section.kind}`).is.a('string').and.not.empty;
      }
    }
  });
});
