import {expect} from 'chai';
import * as fs from 'fs';
import {ClientCard} from '../../src/common/cards/ClientCard';
import {CardInfoBlock} from '../../src/common/cards/CardInformation';
import {CardRequirementDescriptor} from '../../src/common/cards/CardRequirementDescriptor';
import {RequirementType} from '../../src/common/cards/RequirementType';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {NormalizedRequirement, normalizeRequirement} from '../../src/client/components/premiumCard/premiumCardViewModel';

/*
 * REQUIREMENT PROSE ↔ REQUIREMENT GRAPHIC — the agreement audit.
 *
 * A card states its requirement TWICE on the premium face: as the chip in the
 * requirements bar («⩽ 1 [colony]», drawn from `normalizeRequirement`) and as
 * the «ТРЕБОВАНИЕ» line in the rules panel (drawn from the generated
 * `metadata.information`). Both derive from the SAME
 * `CardRequirementDescriptor`, so they can only disagree through a hole in one
 * of the two derivations — and when they do, the player is told two different
 * rules on one screen and has no way to know which one the engine enforces.
 *
 * That shipped: «Первое поселение» (Pioneer Settlement, `{colonies: 1, max}`)
 * drew «⩽ 1» and read «Требуется не менее 1 колонии» — the exact opposite
 * rule. «Geological Survey» («Requires 5 or fewer greeneries on Mars») was in
 * the same state. The cause was structural, not per-card: the prose generator
 * honoured `max` for FIVE requirement types and silently dropped it for every
 * other one, so the next `max` descriptor on any other type would have shipped
 * inverted too.
 *
 * This spec is the standing worklist for that whole class: it re-derives BOTH
 * sides for every in-scope card and fails with the exact list of cards whose
 * two statements disagree on comparator, magnitude, scope or subject — plus
 * the RU rendering of each, since a translation can invert a correct English
 * key just as thoroughly («не менее» for «at most»).
 */

const SCOPE_MODULES = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);
const SCOPE_TYPES = new Set<CardType>([CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT, CardType.PRELUDE, CardType.CORPORATION]);

function scopeCards(): Array<ClientCard> {
  const cards: Array<ClientCard> = JSON.parse(fs.readFileSync('src/genfiles/cards.json', 'utf8'));
  return cards.filter((c) => SCOPE_MODULES.has(c.module) && SCOPE_TYPES.has(c.type) && (c.requirements ?? []).length > 0);
}

function ruDictionary(): Map<string, string> {
  const dict = new Map<string, string>();
  for (const file of fs.readdirSync('src/locales/ru')) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const json = JSON.parse(fs.readFileSync(`src/locales/ru/${file}`, 'utf8'));
    for (const [key, value] of Object.entries(json)) {
      dict.set(key, String(value));
    }
  }
  return dict;
}

/**
 * One requirement as the player meets it: the chip(s) the bar draws and the
 * single rule line that describes them.
 *
 * Usually 1:1. The ONE exception is the `cities {nextTo}` + `oceans` PAIR,
 * which is a single indivisible condition («a city adjacent to an ocean»)
 * drawn as one composite chip and described by one composite line — the
 * generator folds it (`buildCardInformation`, `req:city-next-to-ocean`) and
 * this pairing folds it the same way.
 */
type Statement = {
  card: ClientCard;
  chips: Array<NormalizedRequirement>;
  descriptors: Array<CardRequirementDescriptor>;
  block: CardInfoBlock | undefined;
  composite: boolean;
};

function statementsOf(card: ClientCard): Array<Statement> {
  const blocks = (card.metadata.information?.groups ?? []).find((g) => g.kind === 'requirements')?.blocks ?? [];
  const descriptors = card.requirements ?? [];
  const statements: Array<Statement> = [];
  for (let i = 0; i < descriptors.length; i++) {
    const descriptor = descriptors[i];
    const next = descriptors[i + 1];
    const composite = descriptor.cities !== undefined && descriptor.nextTo === true && next !== undefined && next.oceans !== undefined;
    const group = composite ? [descriptor, next] : [descriptor];
    statements.push({
      card,
      descriptors: group,
      chips: group.map(normalizeRequirement),
      block: blocks[statements.length],
      composite,
    });
    if (composite) {
      i++;
    }
  }
  return statements;
}

function allStatements(): Array<Statement> {
  return scopeCards().flatMap(statementsOf);
}

/** How the bar's `≥` / `≤` may be spelled in the rule line. */
const EN_MAX = /\bat most\b|\bno more than\b|\bor fewer\b|\bor less\b/i;
const EN_MIN = /\bat least\b|\bor more\b/i;
const RU_MAX = /не более|не выше|не больше/;
const RU_MIN = /не менее|не ниже|не меньше/;

/** The SUBJECT each requirement type counts, as it must read in the rule line. */
const EN_SUBJECT: Readonly<Record<string, RegExp>> = {
  [RequirementType.OXYGEN]: /oxygen/i,
  [RequirementType.TEMPERATURE]: /temperature/i,
  [RequirementType.VENUS]: /venus/i,
  [RequirementType.TR]: /terraform rating/i,
  [RequirementType.OCEANS]: /ocean/i,
  [RequirementType.CITIES]: /city|cities/i,
  [RequirementType.GREENERIES]: /greener/i,
  [RequirementType.COLONIES]: /colon/i,
  [RequirementType.FLOATERS]: /floater/i,
  [RequirementType.RESOURCE_TYPES]: /resource type/i,
  [RequirementType.PRODUCTION]: /production/i,
  [RequirementType.REMOVED_PLANTS]: /plants were removed/i,
  [RequirementType.DELTA_POSITION]: /hydronetwork/i,
  [RequirementType.PARTY_LEADERS]: /party leader/i,
  [RequirementType.CHAIRMAN]: /chairman/i,
  [RequirementType.PARTY]: /party/i,
};

function label(statement: Statement): string {
  return `${statement.card.name}[${statement.card.module}] ${JSON.stringify(statement.descriptors)}`;
}

describe('requirement prose agrees with the requirement graphic', function() {
  const statements = allStatements();

  it('the scope is actually covered (the worklist is not silently empty)', () => {
    // ~170 requirement statements across the eight premium modules. A collapse
    // here means the genfiles or the scope filter broke, not that the cards
    // became clean.
    expect(statements.length, 'requirement statements in scope').to.be.gte(150);
    expect(new Set(statements.map((s) => s.card.name)).size, 'cards with requirements').to.be.gte(100);
  });

  it('every chip the bar draws has exactly one rule line, and no line is orphaned', () => {
    const offenders: Array<string> = [];
    for (const card of scopeCards()) {
      const drawn = statementsOf(card);
      const blocks = (card.metadata.information?.groups ?? []).find((g) => g.kind === 'requirements')?.blocks ?? [];
      if (drawn.length !== blocks.length) {
        offenders.push(`${card.name}[${card.module}]: bar draws ${drawn.length} requirement(s), rules panel prints ${blocks.length} line(s)`);
      }
    }
    expect(offenders, `requirement bar and rule text disagree on COUNT:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('the rule line states the SAME comparator as the bar (⩽ is never read as «at least»)', () => {
    // THE flagship of this spec — the Pioneer Settlement inversion.
    const offenders: Array<string> = [];
    for (const statement of statements) {
      const text = statement.block?.text ?? '';
      const max = statement.chips.some((chip) => chip.comparator === 'max');
      if (max && !EN_MAX.test(text)) {
        offenders.push(`${label(statement)}: bar draws ⩽ but the line reads «${text}»`);
      }
      if (!max && EN_MAX.test(text)) {
        offenders.push(`${label(statement)}: bar draws ⩾ but the line reads «${text}»`);
      }
      if (max && EN_MIN.test(text)) {
        offenders.push(`${label(statement)}: a ⩽ requirement reads as a minimum — «${text}»`);
      }
    }
    expect(offenders, `requirement comparator inverted between graphic and text:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('the rule line states the same MAGNITUDE the chip prints', () => {
    const offenders: Array<string> = [];
    for (const statement of statements) {
      // A composite («a city adjacent to an ocean») prints no number on either
      // side — both halves are the implicit 1.
      if (statement.composite) {
        continue;
      }
      const chip = statement.chips[0];
      if (chip.isBinary) {
        continue; // plants-removed / chairman / party draw no number
      }
      const text = statement.block?.text ?? '';
      const numbers = (text.match(/-?\d+/g) ?? []).map(Number);
      if (!numbers.includes(chip.value)) {
        offenders.push(`${label(statement)}: chip prints ${chip.value}, the line reads «${text}»`);
      }
    }
    expect(offenders, `requirement magnitude differs between graphic and text:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('the rule line states the same SCOPE — «(any player)» exactly when the chip is all-players', () => {
    const offenders: Array<string> = [];
    for (const statement of statements) {
      const text = statement.block?.text ?? '';
      const all = statement.chips.some((chip) => chip.all);
      const says = /any player/i.test(text);
      // The plants-removed requirement is inherently about every player and
      // carries no `all` flag — its subject sentence names the scope itself.
      if (statement.chips.some((chip) => chip.type === RequirementType.REMOVED_PLANTS)) {
        continue;
      }
      if (all !== says) {
        offenders.push(`${label(statement)}: chip all=${all}, the line reads «${text}»`);
      }
    }
    expect(offenders, `requirement scope differs between graphic and text:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('the rule line names the SUBJECT the chip pictures (icon and noun agree)', () => {
    const offenders: Array<string> = [];
    for (const statement of statements) {
      const text = statement.block?.text ?? '';
      for (const chip of statement.chips) {
        const subject = chip.type === RequirementType.TAG ?
          new RegExp(`\\b${chip.tag as Tag}\\b`, 'i') :
          EN_SUBJECT[chip.type];
        expect(subject, `${label(statement)}: no subject pattern for requirement type '${chip.type}'`).to.not.eq(undefined);
        if (!subject.test(text)) {
          offenders.push(`${label(statement)}: chip pictures ${chip.type}${chip.tag !== undefined ? `/${chip.tag}` : ''}, the line reads «${text}»`);
        }
      }
    }
    expect(offenders, `requirement subject differs between graphic and text:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('the RU rendering keeps the comparator (a translation can invert a correct key)', () => {
    // The player reads the translation, not the key. «Требуется не менее 1
    // колонии» beside a «⩽ 1» chip is the same defect one layer down.
    const ru = ruDictionary();
    const offenders: Array<string> = [];
    for (const statement of statements) {
      const en = statement.block?.text;
      if (en === undefined) {
        continue;
      }
      const translated = ru.get(en);
      if (translated === undefined) {
        offenders.push(`${label(statement)}: no RU translation for «${en}»`);
        continue;
      }
      const max = EN_MAX.test(en);
      const min = EN_MIN.test(en);
      if (max && (!RU_MAX.test(translated) || RU_MIN.test(translated))) {
        offenders.push(`${label(statement)}: «${en}» → «${translated}» (max lost)`);
      }
      if (min && (!RU_MIN.test(translated) || RU_MAX.test(translated))) {
        offenders.push(`${label(statement)}: «${en}» → «${translated}» (min lost)`);
      }
    }
    expect(offenders, `RU requirement text does not match its English comparator:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('pins the two cards this audit was opened for', () => {
    const pinned: ReadonlyArray<[string, string]> = [
      ['Pioneer Settlement', 'Requires at most 1 colony.'],
      ['Geological Survey', 'Requires at most 5 greenery tiles (any player).'],
    ];
    for (const [name, text] of pinned) {
      const statement = statements.find((s) => s.card.name === name);
      expect(statement, `${name} not in scope`).to.not.eq(undefined);
      expect(statement!.chips[0].comparator, `${name} chip`).to.eq('max');
      expect(statement!.block?.text, `${name} rule line`).to.eq(text);
    }
  });
});
