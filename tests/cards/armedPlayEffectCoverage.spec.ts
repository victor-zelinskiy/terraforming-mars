import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {armedPlayEffectsOf, oneShotEffectsOf} from '../../src/server/cards/armedPlayEffects';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';

/**
 * THE WORKLIST OF THE ONE-PLAY CLASS (TR49): every in-scope card whose code
 * reads `lastCardPlayed` is either DESCRIBED by the one reader
 * (`armedPlayEffectsOf` — its declarations or its co-located
 * `armedPlayEffect` hook) or carries a reasoned row below; every card the
 * reader describes is PAID by the engine exactly as promised (arm → the
 * discount / the shift / the waiver; disarm → nothing); and every in-scope
 * card that PRINTS «ignore global requirements» declares the waiver by KIND.
 */
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);
const SCOPE_DIRS = ['base', 'corporation', 'promo', 'venusNext', 'colonies', 'prelude', 'ares', 'delta', 'turmoilRedux'];

/** Files that read `lastCardPlayed` for something that is NOT an armed one-play effect. */
const NOT_AN_ARMED_EFFECT: Record<string, string> = {
  'promo/DoubleDown.ts': 'asks WHICH prelude was just played (New Partner) to copy it — a lookup, nothing the next card spends',
  'prelude/EccentricSponsor.ts': 'WRITES it: a fizzled sponsor disarms its own declared discount (the declaration is what the reader reads)',
};

const GLOBAL_PARAMETERS = [GlobalParameter.TEMPERATURE, GlobalParameter.OXYGEN, GlobalParameter.OCEANS, GlobalParameter.VENUS];

function forEachInScopeCard(cb: (card: ICard) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const family of [manifest.projectCards, manifest.preludeCards, manifest.corporationCards]) {
      for (const name of Object.keys(family)) {
        const Factory = (family as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
        if (Factory === undefined) {
          continue;
        }
        cb(new Factory());
      }
    }
  }
}

function classFileOf(className: string): string | undefined {
  for (const dir of SCOPE_DIRS) {
    const candidate = path.join('src/server/cards', dir, `${className}.ts`);
    if (fs.existsSync(candidate)) {
      return `${dir}/${className}.ts`;
    }
  }
  return undefined;
}

function rendersIgnoreGlobalRequirements(card: ICard): boolean {
  return JSON.stringify(card.metadata.renderData ?? {}).includes(`"${CardRenderItemType.IGNORE_GLOBAL_REQUIREMENTS}"`);
}

describe('armed one-play effect coverage (TR49 class)', () => {
  it('every in-scope file reading lastCardPlayed is described by the reader or reasoned', () => {
    const described = new Set<string>();
    forEachInScopeCard((card) => {
      if (oneShotEffectsOf(card).length > 0 || card.armedPlayEffect !== undefined) {
        const file = classFileOf(card.constructor.name);
        if (file !== undefined) {
          described.add(file);
        }
      }
    });
    const missing: Array<string> = [];
    for (const dir of SCOPE_DIRS) {
      const root = path.join('src/server/cards', dir);
      if (!fs.existsSync(root)) {
        continue;
      }
      for (const file of fs.readdirSync(root)) {
        if (!file.endsWith('.ts')) {
          continue;
        }
        const rel = `${dir}/${file}`;
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        if (!text.includes('lastCardPlayed')) {
          continue;
        }
        if (!described.has(rel) && NOT_AN_ARMED_EFFECT[rel] === undefined) {
          missing.push(rel);
        }
      }
    }
    expect(missing, 'these cards read lastCardPlayed — declare the one-play effect (`nextCardOnly`) or add `armedPlayEffect`').deep.eq([]);
  });

  it('no stale reason rows', () => {
    const stale = Object.keys(NOT_AN_ARMED_EFFECT).filter((rel) => !fs.readFileSync(path.join('src/server/cards', rel), 'utf8').includes('lastCardPlayed'));
    expect(stale).deep.eq([]);
  });

  it('PARITY: every described card is paid by the engine exactly as promised, and only while armed', () => {
    const failures: Array<string> = [];
    let checked = 0;
    forEachInScopeCard((card) => {
      const effects = oneShotEffectsOf(card);
      if (effects.length === 0) {
        return;
      }
      checked++;
      const [/* game */, player] = testGame(2);
      player.playedCards.push(card as IProjectCard);
      const target = fakeCard({cost: 40});
      const priced = () => player.getCardCostBreakdown(target).discounts.filter((d) => d.source.kind !== 'party' && d.source.kind !== 'resolution' && (d.source as {card?: CardName}).card === card.name).reduce((s, d) => s + d.amount, 0);
      const shiftOf = (p: GlobalParameter) => player.requirementBonusBreakdown(p).filter((e) => (e.source as {card?: CardName}).card === card.name).reduce((s, e) => s + e.steps, 0);
      const waived = (p: GlobalParameter) => player.globalRequirementWaiver(p) !== undefined;

      player.lastCardPlayed = card.name;
      const armed = armedPlayEffectsOf(player).map((e) => e.effect);
      if (JSON.stringify(armed) !== JSON.stringify(effects)) {
        failures.push(`${card.name}: armed ${JSON.stringify(armed)} ≠ declared ${JSON.stringify(effects)}`);
      }
      const discount = effects.reduce((s, e) => s + (e.kind === 'discount' && e.tag === undefined ? e.amount : 0), 0);
      if (priced() !== discount) {
        failures.push(`${card.name}: the price breakdown gives ${priced()}, the reader promises ${discount}`);
      }
      for (const p of GLOBAL_PARAMETERS) {
        const shift = effects.reduce((s, e) => s + (e.kind === 'requirementShift' && (e.parameter === undefined || e.parameter === p) ? e.steps : 0), 0);
        if (shiftOf(p) !== shift) {
          failures.push(`${card.name}: ${p} shift ${shiftOf(p)} ≠ promised ${shift}`);
        }
        const waive = effects.some((e) => e.kind === 'requirementWaiver' && (e.parameter === undefined || e.parameter === p));
        if (waived(p) !== waive) {
          failures.push(`${card.name}: ${p} waiver ${waived(p)} ≠ promised ${waive}`);
        }
      }

      player.lastCardPlayed = CardName.ALGAE;
      if (armedPlayEffectsOf(player).length !== 0 || priced() !== 0 || GLOBAL_PARAMETERS.some((p) => shiftOf(p) !== 0 || waived(p))) {
        failures.push(`${card.name}: still pays after another card was played`);
      }
    });
    expect(failures).deep.eq([]);
    // Special Design, Indentured Workers, Conscription, Ecology Experts, Eccentric Sponsor (+ TR49).
    expect(checked).to.be.greaterThanOrEqual(5);
  });

  it('every in-scope card that PRINTS «ignore global requirements» waives by KIND (never a number of steps)', () => {
    const offenders: Array<string> = [];
    let printed = 0;
    forEachInScopeCard((card) => {
      if (!rendersIgnoreGlobalRequirements(card)) {
        return;
      }
      printed++;
      if (card.globalParameterRequirementBonus?.waive !== true) {
        offenders.push(card.name);
      }
    });
    expect(offenders).deep.eq([]);
    expect(printed, 'the scan found the printed glyph at all (Ecology Experts)').to.be.greaterThan(0);
  });
});
