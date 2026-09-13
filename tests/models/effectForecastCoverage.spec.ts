import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {MARS_BOT_CORP_IDS} from '../../src/common/automa/MarsBotCorpData';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {FORECAST_HOOK_PAIRS} from '../../src/server/models/effectForecast';

/**
 * THE EFFECT FORECAST COVERAGE GUARD — the worklist.
 *
 * Every premium-scope card that carries a LIVE trigger hook the forecast
 * family mirrors (`onCardPlayed`, `onCardPlayedByAnyPlayer`, `onProductionGain`,
 * `onResourceAdded`, `onTilePlaced`) must carry the co-located forecast twin
 * (`cardPlayedForecast` / `grantForecast` / `tilePlacedForecast`) — or hold a
 * row in `ALLOWED` with a written reason. The engine reports a hooked card
 * without a forecast as an honest `unknown`, so a gap is never silent for the
 * player; this guard is what keeps the gap list at zero. A NEW card with a
 * trigger hook fails here with its name until it decides.
 *
 * The same law for the MarsBot corporations: a corporation reacting to human
 * plays (`onHumanCardPlayed`) declares `humanCardPlayedForecast`.
 */
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);

/**
 * Cards with a live hook and NO forecast, each with the reason the forecast
 * cannot describe it. EMPTY today — a new row needs a sentence the player
 * would accept in place of the forecast.
 */
const ALLOWED: Partial<Record<CardName, string>> = {};

type Factory = new () => ICard;

function forEachInScopeCard(cb: (card: ICard, module: GameModule) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    const groups = [manifest.projectCards, manifest.corporationCards, manifest.preludeCards];
    for (const group of groups) {
      for (const name of Object.keys(group)) {
        const Factory = (group as Record<string, {Factory: Factory}>)[name]?.Factory;
        if (Factory === undefined) {
          continue;
        }
        let card: ICard;
        try {
          card = new Factory();
        } catch {
          continue;
        }
        cb(card, manifest.module);
      }
    }
  }
}

describe('effect-forecast coverage (the worklist)', () => {
  it('every in-scope card with a live trigger hook carries its forecast twin (or an ALLOWED row with a reason)', () => {
    const gaps: Array<string> = [];
    let hooked = 0;
    forEachInScopeCard((card, module) => {
      const missing: Array<string> = [];
      for (const pair of FORECAST_HOOK_PAIRS) {
        const live = (card as unknown as Record<string, unknown>)[pair.live];
        const twin = (card as unknown as Record<string, unknown>)[pair.forecast];
        if (typeof live === 'function' && typeof twin !== 'function') {
          missing.push(`${pair.live} → ${pair.forecast}`);
        }
      }
      if (FORECAST_HOOK_PAIRS.some((pair) => typeof (card as unknown as Record<string, unknown>)[pair.live] === 'function')) {
        hooked++;
      }
      if (missing.length > 0 && !(card.name in ALLOWED)) {
        gaps.push(`${card.name} [${module}]: ${missing.join(', ')}`);
      }
    });
    expect(gaps, `cards with a live trigger hook and no forecast twin — add the co-located hook (effectForecastPreviews.ts) or an ALLOWED row with a reason:\n  ${gaps.join('\n  ')}`).to.have.length(0);
    // Anti-vacuous: the sweep must have SEEN the trigger cards (24 card-played
    // reactors + 4 second-order + 14 tile triggers in scope).
    expect(hooked, 'in-scope cards with a live trigger hook').to.be.greaterThan(35);
  });

  it('no ALLOWED row is stale (its card still exists, still has the hook, still lacks the twin)', () => {
    const stale: Array<string> = [];
    for (const name of Object.keys(ALLOWED)) {
      let seen = false;
      forEachInScopeCard((card) => {
        if (card.name !== name) {
          return;
        }
        seen = true;
        const stillGap = FORECAST_HOOK_PAIRS.some((pair) => {
          const c = card as unknown as Record<string, unknown>;
          return typeof c[pair.live] === 'function' && typeof c[pair.forecast] !== 'function';
        });
        if (!stillGap) {
          stale.push(`${name}: the forecast twin exists now — drop the row`);
        }
      });
      if (!seen) {
        stale.push(`${name}: not an in-scope card`);
      }
    }
    expect(stale).to.deep.eq([]);
  });

  it('every MarsBot corporation reacting to human plays declares its forecast twin', () => {
    const gaps: Array<string> = [];
    let reacting = 0;
    for (const id of MARS_BOT_CORP_IDS) {
      const corp = AutomaCorporations.corpFor(id);
      if (corp.onHumanCardPlayed === undefined) {
        continue;
      }
      reacting++;
      if (corp.humanCardPlayedForecast === undefined) {
        gaps.push(`${id} (${corp.info.original})`);
      }
    }
    expect(gaps, `MarsBot corporations with onHumanCardPlayed and no humanCardPlayedForecast:\n  ${gaps.join('\n  ')}`).to.deep.eq([]);
    expect(reacting, 'bot corporations reacting to human plays').to.be.greaterThan(2);
  });
});
