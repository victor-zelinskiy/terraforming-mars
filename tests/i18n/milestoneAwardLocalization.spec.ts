import {expect} from 'chai';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {awardManifest} from '../../src/server/awards/Awards';
import {IMilestone} from '../../src/server/milestones/IMilestone';
import {IAward} from '../../src/server/awards/IAward';
import {testGame} from '../TestGame';
import milestonesRu from '../../src/locales/ru/milestones.json';
import awardsRu from '../../src/locales/ru/awards.json';

/**
 * MILESTONE / AWARD LOCALIZATION GUARD.
 *
 * A milestone's «УСЛОВИЕ» line is the ONLY place the console tells a player what
 * they must build. It is a plain i18n lookup of the milestone's English
 * description (English text IS the key), which means a wrong Russian VALUE is
 * invisible to every other check in the repo: the key exists, the build passes,
 * the type checks pass, and the player is quietly told to do the wrong thing.
 * That is exactly how «Архитектор» (Have 3 city tags in play) shipped reading
 * «Сыграйте не менее 3 карт с меткой растения» — the right number, the right
 * shape of sentence, the WRONG TAG.
 *
 * The `scripts/i18n-audit.mjs` sweep never covered this: its target list is the
 * card directories plus deferredActions/inputs/behavior. `src/server/milestones`
 * and `src/server/awards` were outside it, so nothing at all read these two
 * locale files against the rules they claim to describe.
 *
 * This guard reads the manifests (the single source of truth for what exists)
 * and fails with the exact offender for each class of defect:
 *  - a name or description with no Russian translation;
 *  - a translation whose NUMBERS drifted from the rule;
 *  - a TAG milestone/award whose Russian names a different tag than the rule
 *    does (in either direction — missing the real tag, or naming a foreign one);
 *  - a tag rule mistranslated as counting CARDS instead of TAGS;
 *  - a Latin homoglyph hiding inside a Cyrillic word;
 *  - a stale key left behind when a rule's threshold moved.
 *
 * Player-visible UNIQUENESS across one game's offering (two MAs that read the
 * same) is the other half, and it lives with the pool policy it depends on:
 * `tests/ma/MilestoneAwardDeduplication.spec.ts`.
 */
const RU: Record<string, string> = {...milestonesRu, ...awardsRu};

/** Mirror `maDisplayName` (maArt.ts): the client strips a trailing numeric variant suffix. */
function stripTrailingDigits(name: string): string {
  return name.replace(/[0-9]+$/, '');
}

type MaEntry = {
  kind: 'milestone' | 'award',
  /** Manifest key — what a save file and a bug report call it. */
  name: string,
  /** Every English description this MA can present (Terraformer varies by expansion). */
  descriptions: ReadonlyArray<string>,
};

/**
 * Every milestone/award in the manifests — INCLUDING deprecated ones. Deprecated only means
 * "never drawn at random"; `Forester` still sits in the Amazonis board layout, and any of them
 * can come back from an old save, so their copy is still player-visible.
 */
function allEntries(): ReadonlyArray<MaEntry> {
  // Turmoil moves Terraformer's target (35 -> 26) through getDescription(game), so both games
  // are needed to collect every string a player can actually be shown.
  const [plainGame] = testGame(2);
  const [turmoilGame] = testGame(2, {turmoilExtension: true});

  const entries: Array<MaEntry> = [];
  for (const [name, spec] of Object.entries(milestoneManifest.all)) {
    const milestone: IMilestone = new spec.Factory();
    const descriptions = new Set<string>([milestone.description]);
    if (milestone.getDescription !== undefined) {
      descriptions.add(milestone.getDescription(plainGame));
      descriptions.add(milestone.getDescription(turmoilGame));
    }
    entries.push({kind: 'milestone', name, descriptions: [...descriptions]});
  }
  for (const [name, spec] of Object.entries(awardManifest.all)) {
    const award: IAward = new spec.Factory();
    entries.push({kind: 'award', name, descriptions: [award.description]});
  }
  return entries;
}

/**
 * The tag vocabulary, in both languages. Only consulted for a rule that actually says «tag» —
 * a production or tile rule mentions «energy» or «Mars» without meaning the tag, and policing
 * those would fail on correct copy.
 */
const TAG_TERMS: ReadonlyArray<{tag: string, en: RegExp, ru: RegExp}> = [
  {tag: 'building', en: /\bbuilding\b/i, ru: /здани/i},
  {tag: 'city', en: /\bcity\b/i, ru: /город/i},
  {tag: 'plant', en: /\bplant\b/i, ru: /растени/i},
  {tag: 'microbe', en: /\bmicrobe\b/i, ru: /микроб/i},
  {tag: 'animal', en: /\banimal\b/i, ru: /животн/i},
  {tag: 'science', en: /\bscience\b/i, ru: /наук/i},
  {tag: 'space', en: /\bspace\b/i, ru: /космос/i},
  {tag: 'Earth', en: /\bearth\b/i, ru: /земл/i},
  {tag: 'Jovian', en: /\bjovian\b/i, ru: /юпитер/i},
  {tag: 'Venus', en: /\bvenus\b/i, ru: /венер/i},
  {tag: 'Moon', en: /\bmoon\b/i, ru: /лун/i},
  {tag: 'power', en: /\bpower\b/i, ru: /энерг/i},
  {tag: 'Mars', en: /\bmars\b/i, ru: /марс/i},
  {tag: 'bio', en: /\bbio\b/i, ru: /биолог/i},
  {tag: 'crime', en: /\bcrime\b/i, ru: /преступ/i},
];

const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[A-Za-z]/;

describe('Milestone/Award Russian localization', () => {
  const entries = allEntries();

  it('the manifests are non-empty (a silent zero here would make every check below vacuous)', () => {
    expect(entries.filter((e) => e.kind === 'milestone').length).to.be.greaterThan(50);
    expect(entries.filter((e) => e.kind === 'award').length).to.be.greaterThan(50);
  });

  it('every name has a Russian translation', () => {
    const missing = entries
      .filter((e) => RU[e.name] === undefined && RU[stripTrailingDigits(e.name)] === undefined)
      .map((e) => `${e.kind} ${e.name}`);
    expect(missing, `untranslated milestone/award names: ${missing.join(', ')}`).to.deep.equal([]);
  });

  it('every description has a Russian translation', () => {
    const missing: Array<string> = [];
    for (const entry of entries) {
      for (const description of entry.descriptions) {
        if (RU[description] === undefined) {
          missing.push(`${entry.kind} ${entry.name}: "${description}"`);
        }
      }
    }
    expect(missing, `untranslated descriptions:\n  ${missing.join('\n  ')}`).to.deep.equal([]);
  });

  /**
   * The DISTINCT numbers, not the sequence: an English rule may compress what Russian has to spell
   * out («3 sets of automated, active and event cards» is «3 зелёных, 3 синих и 3 красных»), and
   * that expansion is more truthful, not less. A threshold that actually moved still shows up here
   * as a value present on one side only.
   */
  function numbersIn(text: string): ReadonlyArray<string> {
    return [...new Set(text.match(/\d+/g) ?? [])].sort();
  }

  it('the numbers in a description survive translation', () => {
    const drifted: Array<string> = [];
    for (const entry of entries) {
      for (const description of entry.descriptions) {
        const ru = RU[description];
        if (ru === undefined) {
          continue;
        }
        const en = numbersIn(description).join(',');
        const translated = numbersIn(ru).join(',');
        if (en !== translated) {
          drifted.push(`${entry.kind} ${entry.name}: EN [${en}] vs RU [${translated}] — "${description}" -> "${ru}"`);
        }
      }
    }
    expect(drifted, `numbers drifted between the rule and its translation:\n  ${drifted.join('\n  ')}`).to.deep.equal([]);
  });

  it('a tag rule names the SAME tag in Russian — no more, no less', () => {
    const wrong: Array<string> = [];
    for (const entry of entries) {
      for (const description of entry.descriptions) {
        const ru = RU[description];
        if (ru === undefined || !/\btags?\b/i.test(description)) {
          continue;
        }
        for (const {tag, en, ru: ruTerm} of TAG_TERMS) {
          const inRule = en.test(description);
          const inTranslation = ruTerm.test(ru);
          if (inRule === inTranslation) {
            continue;
          }
          wrong.push(inRule ?
            `${entry.kind} ${entry.name}: rule is about the ${tag} tag, translation never names it — "${description}" -> "${ru}"` :
            `${entry.kind} ${entry.name}: translation names the ${tag} tag, the rule does not — "${description}" -> "${ru}"`);
        }
      }
    }
    expect(wrong, `tag mismatches between rule and translation:\n  ${wrong.join('\n  ')}`).to.deep.equal([]);
  });

  it('a tag rule counts TAGS in Russian, not cards (one card can carry two)', () => {
    const asCards: Array<string> = [];
    for (const entry of entries) {
      for (const description of entry.descriptions) {
        const ru = RU[description];
        if (ru === undefined || !/\btags?\b/i.test(description)) {
          continue;
        }
        if (/карт\w*\s+с\s+метк/i.test(ru)) {
          asCards.push(`${entry.kind} ${entry.name}: "${description}" -> "${ru}"`);
        }
      }
    }
    expect(asCards, `tag rules translated as counting cards:\n  ${asCards.join('\n  ')}`).to.deep.equal([]);
  });

  it('no Latin homoglyph hides inside a Cyrillic word', () => {
    const offenders: Array<string> = [];
    for (const [file, dict] of [['milestones.json', milestonesRu], ['awards.json', awardsRu]] as const) {
      for (const [key, value] of Object.entries<string>(dict)) {
        for (const word of value.split(/[^\p{L}]+/u)) {
          if (CYRILLIC.test(word) && LATIN.test(word)) {
            offenders.push(`ru/${file} "${key}": "${word}" in "${value}"`);
          }
        }
      }
    }
    expect(offenders, `mixed-alphabet words:\n  ${offenders.join('\n  ')}`).to.deep.equal([]);
  });

  it('the locale files hold no stale key (a rule whose threshold moved leaves one behind)', () => {
    const live = new Set<string>(['Milestones', 'Awards']);
    for (const entry of entries) {
      live.add(entry.name);
      live.add(stripTrailingDigits(entry.name));
      entry.descriptions.forEach((description) => live.add(description));
    }
    const stale: Array<string> = [];
    for (const [file, dict] of [['milestones.json', milestonesRu], ['awards.json', awardsRu]] as const) {
      for (const key of Object.keys(dict)) {
        if (!live.has(key)) {
          stale.push(`ru/${file}: "${key}"`);
        }
      }
    }
    expect(stale, `keys no milestone/award uses any more:\n  ${stale.join('\n  ')}`).to.deep.equal([]);
  });
});
