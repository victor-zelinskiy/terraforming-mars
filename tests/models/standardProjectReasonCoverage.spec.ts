import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {isIStandardProjectCard} from '../../src/server/cards/IStandardProjectCard';
import {StandardProjectCard} from '../../src/server/cards/StandardProjectCard';
import {CardName} from '../../src/common/cards/CardName';

/**
 * Overrides that CANNOT block: they only `addWarning(...)` (a maxed global
 * parameter is a warning, not a gate — the project stays legal) and delegate to
 * `super.canAct`. Their only real gate is affordability, which the shared
 * explainer already names with the exact deficit.
 *
 * This is an explicit list, not a source-code sniff, so a NEW project can never
 * slip through by accident: adding a `canAct` override means deciding, here,
 * whether it can actually refuse — and if it can, writing the reason.
 */
const AFFORDABILITY_ONLY: ReadonlySet<CardName> = new Set([
  CardName.AQUIFER_STANDARD_PROJECT, // warns 'maxoceans'
  CardName.ASTEROID_STANDARD_PROJECT, // warns 'maxtemp'
  CardName.AIR_SCRAPPING_STANDARD_PROJECT, // warns 'maxvenus'
  CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT, // inherits the above
]);

/**
 * The WORKLIST guard for standard-project reasons (the analog of
 * `actionReasonCoverage`). A standard project that OVERRIDES `canAct` has a
 * bespoke gate — a free tile space, an open colony slot, moon land, corruption,
 * cards in hand — that the client cannot see. Without a co-located
 * `actionUnavailableReason` hook the screen degrades to a bare "unavailable
 * right now", which is the exact bug this subsystem exists to prevent.
 *
 * A project that does NOT override `canAct` is exempt: its only gate is
 * affordability, which the shared explainer names with the exact deficit.
 */
describe('standard-project reason coverage', () => {
  it('every standard project with a BESPOKE canAct carries a co-located reason hook', () => {
    const gaps: Array<string> = [];
    const seen = new Set<string>();
    const gated: Array<string> = [];
    for (const manifest of ALL_MODULE_MANIFESTS) {
      for (const name of Object.keys(manifest.standardProjects)) {
        const Factory = (manifest.standardProjects as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
        if (Factory === undefined) {
          continue;
        }
        let card: ICard;
        try {
          card = new Factory();
        } catch {
          continue;
        }
        if (!isIStandardProjectCard(card) || seen.has(card.name)) {
          continue;
        }
        seen.add(card.name);
        // No override at all → the only gate is affordability.
        const bespokeGate = card.canAct !== StandardProjectCard.prototype.canAct;
        if (!bespokeGate || AFFORDABILITY_ONLY.has(card.name)) {
          continue;
        }
        gated.push(card.name);
        if (typeof (card as {actionUnavailableReason?: unknown}).actionUnavailableReason !== 'function') {
          gaps.push(`${card.name} [${manifest.module}]`);
        }
      }
    }
    // Anti-vacuous floor: if the manifest key or the walk ever changes shape,
    // this guard must FAIL loudly rather than pass having inspected nothing.
    expect(seen.size, 'no standard projects were walked — the manifest key changed?').is.greaterThan(8);
    expect(gated.length, 'no bespoke-gated standard projects found — the override probe broke?').is.greaterThan(5);
    expect(gaps, `standard projects with a bespoke canAct but only the generic fallback:\n  ${gaps.join('\n  ')}`)
      .to.have.length(0);
  });
});
