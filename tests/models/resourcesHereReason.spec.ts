import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard} from '../../src/server/cards/ICard';
import {Behavior} from '../../src/server/behavior/Behavior';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardResource} from '../../src/common/CardResource';
import {RESOURCES_HERE_SHORT_GENERIC, resourcesHereShortMessage} from '../../src/server/cards/actionReasons';
import {resolvePluralGroups} from '../../src/client/i18n/pluralForms';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';

/**
 * PL-197 — «N of M <resource> on this card»: a declared price «spend M from
 * here» the card cannot cover names the count, the need AND the resource (TR57
 * Mining Mechs reads «1 of 2 mechs on this card»), never a bare «not enough».
 * The guard walks every in-scope card whose DECLARATIVE action spends
 * `resourcesHere` (an `or`'s variants included) and fails with the cards whose
 * resource has no row of its own — the worklist of the class. Each template's
 * RU translation exists and its plural group reads the need's form in both
 * languages.
 */
const SCOPE = PREMIUM_SCOPE_MODULES;

function spendsHere(behavior: Behavior | undefined): boolean {
  if (behavior === undefined) {
    return false;
  }
  if (typeof behavior.spend?.resourcesHere === 'number') {
    return true;
  }
  return (behavior.or?.behaviors ?? []).some((b) => spendsHere(b));
}

function inScopeSpenders(): Array<{card: ICard, module: GameModule}> {
  const out: Array<{card: ICard, module: GameModule}> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.includes(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const Factory = (group as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
        if (Factory === undefined || !inPremiumScope({module: manifest.module, name}, SCOPE)) {
          continue;
        }
        const card = new Factory();
        if (isIActionCard(card) && spendsHere(card.actionBehavior)) {
          out.push({card, module: manifest.module});
        }
      }
    }
  }
  return out;
}

function ruDictionary(): Record<string, string> {
  const dir = path.resolve('src/locales/ru');
  const all: Record<string, string> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  }
  return all;
}

describe('PL-197 — the «resources here» reason names the count, the need and the resource', () => {
  const spenders = inScopeSpenders();

  it('the walk finds the class (TR38, TR40, TR45, TR57, Deuterium Export, …)', () => {
    const names = spenders.map((s) => s.card.name);
    expect(spenders.length, names.join(', ')).is.greaterThan(12);
    expect(names).to.include.members(['Mining Mechs', 'Forestry Mechs', 'Biological Simulations', 'Composting Initiative', 'Deuterium Export']);
  });

  it('every in-scope declarative holder reads its OWN resource — never the counted generic', () => {
    const generic = spenders
      .filter((s) => resourcesHereShortMessage(s.card.resourceType) === RESOURCES_HERE_SHORT_GENERIC)
      .map((s) => `${s.card.name} [${s.module}] — ${s.card.resourceType ?? 'no resource type'}`);
    expect(generic, `holders without a named row in actionReasons.RESOURCES_HERE_SHORT:\n  ${generic.join('\n  ')}`).deep.eq([]);
  });

  it('every template the class can say has its RU translation', () => {
    const ru = ruDictionary();
    const templates = new Set([RESOURCES_HERE_SHORT_GENERIC, ...spenders.map((s) => resourcesHereShortMessage(s.card.resourceType))]);
    const missing = [...templates].filter((t) => ru[t] === undefined);
    expect(missing).deep.eq([]);
  });

  it('the plural group agrees with the NEED in both languages — «0 of 1 mech» · «1 of 2 mechs» · «из 1 меха» · «из 2 мехов» · «из 5 мехов»', () => {
    const ru = ruDictionary();
    const render = (template: string, have: number, need: number, lang: string) =>
      resolvePluralGroups(template.replace('${0}', String(have)).replace('${1}', String(need)), lang);
    const mech = resourcesHereShortMessage(CardResource.MECH);
    expect(render(mech, 0, 1, 'en')).eq('0 of 1 mech on this card');
    expect(render(mech, 1, 2, 'en')).eq('1 of 2 mechs on this card');
    expect(render(ru[mech], 0, 1, 'ru')).eq('0 из 1 меха на этой карте');
    expect(render(ru[mech], 1, 2, 'ru')).eq('1 из 2 мехов на этой карте');
    expect(render(ru[mech], 3, 5, 'ru')).eq('3 из 5 мехов на этой карте');
    const microbe = resourcesHereShortMessage(CardResource.MICROBE);
    expect(render(ru[microbe], 1, 2, 'ru')).eq('1 из 2 бактерий на этой карте');
    const data = resourcesHereShortMessage(CardResource.DATA);
    expect(render(data, 1, 2, 'en')).eq('1 of 2 data on this card');
    expect(render(ru[data], 1, 2, 'ru')).eq('1 из 2 единиц данных на этой карте');
    // No template keeps a raw group after rendering, in either language.
    for (const template of new Set(spenders.map((s) => resourcesHereShortMessage(s.card.resourceType)))) {
      for (const need of [1, 2, 3, 5, 11, 21]) {
        expect(render(template, 0, need, 'en'), template).not.to.match(/[{|}]/);
        expect(render(ru[template], 0, need, 'ru'), ru[template]).not.to.match(/[{|}]/);
      }
    }
  });
});
