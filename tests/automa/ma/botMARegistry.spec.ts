import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {awardManifest} from '../../../src/server/awards/Awards';
import {BOT_AWARD_RULES, BOT_MILESTONE_RULES} from '../../../src/server/automa/ma/botMARules';
import {BotMAProvenance} from '../../../src/server/automa/ma/BotMARule';
import {CALIBRATION_LAWS} from '../../../src/server/automa/ma/calibration';
import {describeAward, describeAwardHelper, describeMilestone} from '../../../src/server/automa/ma/botMADescribe';
import {Message} from '../../../src/common/logs/Message';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {testAutomaGame} from '../AutomaTestGame';

/**
 * THE REGISTRY GUARD — a WORKLIST (CLAUDE.md inv. 11): every milestone / award name of the manifests has its bot
 * rule in `src/server/automa/ma/botMARules.ts`, every award its Corporate Competition helper (or a `none` that says
 * why), every home rule its official analog, and every rule a text the player can read in Russian.
 */

/** Modules MarsBot does not play (`automaConflicts`) — their names get no bot rule, on purpose. */
const OUT_OF_SCOPE: ReadonlyMap<string, string> = new Map([
  ['Lunarchitect', 'The Moon'], ['One Giant Step', 'The Moon'], ['Full Moon', 'The Moon'], ['Lunar Magnate', 'The Moon'],
  ['Risktaker', 'Underworld'], ['Tunneler', 'Underworld'], ['Excavator', 'Underworld'], ['Kingpin', 'Underworld'],
]);

/**
 * Names still waiting for a bot rule — EMPTY since stage 2 of the framework, until Amazonis Planitia's BASE adaptation
 * (2026-11-06) brought its printed newcomers: no random mode offers them and no board deals them yet
 * (`PENDING_ADAPTATION_MA` in MilestoneAwardSelector), so no bot can meet them. Their rows land with the board's full
 * adaptation — then this list is empty again.
 */
const PENDING: ReadonlySet<string> = new Set([]);

/** The ONE honest zero (decision R5). */
const ZERO: ReadonlySet<string> = new Set(['Entrepreneur']);

function manifestNames(): {milestones: Array<string>, awards: Array<string>} {
  const live = (all: Record<string, {retired?: string}>) => Object.entries(all).filter(([, spec]) => spec.retired === undefined).map(([name]) => name);
  return {milestones: live(milestoneManifest.all), awards: live(awardManifest.all)};
}

function ruDictionary(): Record<string, string> {
  const dir = path.join(__dirname, '..', '..', '..', 'src', 'locales', 'ru');
  const merged: Record<string, string> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  }
  return merged;
}

/** Renders a description the way the client does (template + STRING params translated, RAW params as they are). */
function renderRu(message: Message, ru: Record<string, string>, missing: Set<string>): string {
  const template = ru[message.message];
  if (template === undefined) {
    missing.add(message.message);
  }
  return (template ?? message.message).replace(/\$\{(\d+)\}/g, (_, i) => {
    const datum = message.data[Number(i)];
    if (datum === undefined) {
      return `\${${i}}`;
    }
    if (datum.type === LogMessageDataType.STRING) {
      const value = String(datum.value);
      if (ru[value] === undefined) {
        missing.add(value);
      }
      return ru[value] ?? value;
    }
    return String(datum.value);
  });
}

describe('bot-rule registry — the worklist', () => {
  it('every milestone and award name has a bot rule (or is out of scope)', () => {
    const {milestones, awards} = manifestNames();
    const missing = [
      ...milestones.filter((n) => BOT_MILESTONE_RULES[n as keyof typeof BOT_MILESTONE_RULES] === undefined),
      ...awards.filter((n) => BOT_AWARD_RULES[n as keyof typeof BOT_AWARD_RULES] === undefined),
    ].filter((n) => !OUT_OF_SCOPE.has(n) && !PENDING.has(n)).sort();
    expect(missing, `names with no bot rule — add a row to botMARules.ts: ${missing.join(', ')}`).is.empty;
  });

  it('the PENDING and OUT_OF_SCOPE lists are honest (no row already covers a listed name)', () => {
    const covered = [...PENDING, ...OUT_OF_SCOPE.keys()].filter((n) =>
      BOT_MILESTONE_RULES[n as keyof typeof BOT_MILESTONE_RULES] !== undefined || BOT_AWARD_RULES[n as keyof typeof BOT_AWARD_RULES] !== undefined);
    expect(covered, `listed as missing but the registry covers them — drop them from the list: ${covered.join(', ')}`).is.empty;
  });

  it('the registry names only real manifest names', () => {
    const {milestones, awards} = manifestNames();
    const all = new Set([...milestones, ...awards, ...Object.keys(milestoneManifest.all), ...Object.keys(awardManifest.all)]);
    const strangers = [...Object.keys(BOT_MILESTONE_RULES), ...Object.keys(BOT_AWARD_RULES)].filter((n) => !all.has(n));
    expect(strangers).is.empty;
  });

  it('a milestone rule with a criterion of its own carries a target; the player family carries none', () => {
    const wrong: Array<string> = [];
    for (const [name, rule] of Object.entries(BOT_MILESTONE_RULES)) {
      const own = rule!.criterion.kind !== 'player' && rule!.criterion.kind !== 'zero';
      if (own !== (rule!.target !== undefined)) {
        wrong.push(name);
      }
    }
    expect(wrong).is.empty;
  });

  it('every award has a helper; a `none` helper says why', () => {
    const silent = Object.entries(BOT_AWARD_RULES)
      .filter(([, rule]) => rule!.helper.kind === 'none' && (rule!.helper as {reasonKey: string}).reasonKey.length === 0)
      .map(([name]) => name);
    expect(silent).is.empty;
  });

  it('`zero` is the ONE honest zero (decision R5) — no other name may read 0 by construction', () => {
    const zeros = [...Object.entries(BOT_MILESTONE_RULES), ...Object.entries(BOT_AWARD_RULES)]
      .filter(([, rule]) => rule!.criterion.kind === 'zero').map(([name]) => name);
    expect(zeros.sort(), 'the zero rules').deep.eq([...ZERO].sort());
  });

  it('every home rule names its official analog, and every named law exists', () => {
    const laws = new Set(CALIBRATION_LAWS.map((l) => l.id));
    const bad: Array<string> = [];
    const check = (name: string, provenance: BotMAProvenance) => {
      if (provenance.source === 'home') {
        if (provenance.analog.trim().length === 0) {
          bad.push(`${name}: no analog`);
        }
        if (provenance.law !== undefined && !laws.has(provenance.law)) {
          bad.push(`${name}: unknown law ${provenance.law}`);
        }
      }
    };
    for (const [name, rule] of Object.entries(BOT_MILESTONE_RULES)) {
      check(name, rule!.provenance);
    }
    for (const [name, rule] of Object.entries(BOT_AWARD_RULES)) {
      check(name, rule!.provenance);
    }
    expect(bad).is.empty;
  });

  it('every rule renders in Russian — no missing key, no raw ${n}', () => {
    const ru = ruDictionary();
    const missing = new Set<string>();
    const raw: Array<string> = [];
    const [game] = testAutomaGame({}, '-describe');
    const rendered: Array<string> = [];
    for (const name of Object.keys(BOT_MILESTONE_RULES)) {
      const text = renderRu(describeMilestone(milestoneManifest.createOrThrow(name), game)!, ru, missing);
      rendered.push(text);
    }
    for (const name of Object.keys(BOT_AWARD_RULES)) {
      rendered.push(renderRu(describeAward(name)!, ru, missing));
      rendered.push(renderRu(describeAwardHelper(name), ru, missing));
    }
    for (const text of rendered) {
      if (/\$\{\d+\}/.test(text)) {
        raw.push(text);
      }
    }
    expect([...missing], `RU keys missing (src/locales/ru/marsbot_ma.json): ${[...missing].join(' | ')}`).is.empty;
    expect(raw, raw.join(' | ')).is.empty;
  });

  it('the descriptions say the rule — a few pinned lines', () => {
    const [game] = testAutomaGame({}, '-describe-pin');
    const energizer = describeMilestone(milestoneManifest.createOrThrow('Energizer'), game)!;
    expect(energizer.message).eq('MarsBot: ${0} at space ${1}');
    expect(energizer.data.map((d) => d.value), 'a production criterion names the BADGE (decision R10)').deep.eq(['the energy-badge track', '6']);
    const tycoon = describeMilestone(milestoneManifest.createOrThrow('Tycoon10'), game)!;
    expect(tycoon.data.map((d) => d.value), 'a printed target reads the milestone\'s own threshold').deep.eq(['10', 'green and blue cards']);
    expect(describeAward('Thermalist')!.data.map((d) => d.value)).deep.eq(['the energy-badge track', '5']);
    expect(describeMilestone(milestoneManifest.createOrThrow('Rim Settler'), game)!.data.map((d) => d.value), 'a tag criterion names the TAG').deep.eq(['the Jovian-tag track', '6']);
    expect(describeAwardHelper('Forecaster').data.map((d) => d.value)).deep.eq(['a card with a requirement', '5']);
    expect(describeAwardHelper('Cosmic Settler').message).contains('no action');
  });
});
