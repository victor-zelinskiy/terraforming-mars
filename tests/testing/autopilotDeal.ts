/*
 * THE DEAL OF THE AUTOPILOT (FREEZE ZERO, stage 6 — total coverage, the cards axis; the owner, 2026-11-26: «покрывал
 * АБСОЛЮТНО все игровые ситуации»). A random deal brings a card to the pilot's hand when chance does; here the cards of
 * the premium scope (`common/cards/premiumScope.ts` — the set the coverage specs enumerate) come to the opening hand IN
 * TURN: game `n` deals the next five projects of the scope's list whose module its table plays, the next corporation
 * and the next two preludes — on the top of their decks (`customProjectCards` / `customCorporationsList` /
 * `customPreludes`: the first seat's deal). Over the games every card of the scope is dealt. One rotation for both
 * pilots — the browser's (`tests/e2e/console-autopilot.spec.ts`) and the bottle's (`bottleServerHost.bootPilotTable`).
 */
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';
import {CardName} from '../../src/common/cards/CardName';
import UNPLAYED_JSON from '../client/bottle/autopilotCardsUnplayed.json';

/** A card of the scope: its name, its module and the OTHER modules it needs (its factory's `compatibility`). */
export type ScopeCard = {name: CardName, module: string, needs: ReadonlyArray<string>};
export type Deal = {projects: Array<CardName>, corporations: Array<CardName>, preludes: Array<CardName>};

export const SCOPE_CARDS = ((): {projects: Array<ScopeCard>, corporations: Array<ScopeCard>, preludes: Array<ScopeCard>} => {
  const out = {projects: [] as Array<ScopeCard>, corporations: [] as Array<ScopeCard>, preludes: [] as Array<ScopeCard>};
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!PREMIUM_SCOPE_MODULES.includes(manifest.module)) {
      continue;
    }
    for (const [into, cards] of [[out.projects, manifest.projectCards], [out.corporations, manifest.corporationCards], [out.preludes, manifest.preludeCards]] as const) {
      for (const name of Object.keys(cards) as Array<CardName>) {
        // (Delta Project is the module's global subsystem, never a prelude a seat is dealt — the creator refuses it.)
        if (inPremiumScope({module: manifest.module, name}) && name !== CardName.DELTA_PROJECT) {
          const compatibility = (cards as Record<string, {compatibility?: string | ReadonlyArray<string>} | undefined>)[name]?.compatibility;
          into.push({name, module: manifest.module, needs: compatibility === undefined ? [] : typeof compatibility === 'string' ? [compatibility] : [...compatibility]});
        }
      }
    }
  }
  return out;
})();

/**
 * The next `count` cards of `list` from game `n`'s window whose module the table plays — and whose OTHER modules too
 * (CI's game 418: TR27 Aurora Station, a Redux card needing Venus, dealt to a table without it; the server leaves such
 * a card out now — `GameCards.addCustomCards` — and the window's slot would have gone to nothing).
 */
export function dealWindow(list: ReadonlyArray<ScopeCard>, n: number, count: number, on: ReadonlySet<string>): Array<CardName> {
  const out: Array<CardName> = [];
  for (let k = 0; k < list.length && out.length < count; k++) {
    const card = list[(n * count + k) % list.length];
    if (on.has(card.module) && card.needs.every((module) => on.has(module))) {
      out.push(card.name);
    }
  }
  return out;
}

/**
 * THE LEDGER's CARDS (stage 6 — the autopilot's own ledger, `tests/client/bottle/autopilotUnwalked.json`): cards whose
 * flow no whole game had opened and no fixture can stand on (a prelude is played in the START, which a fixture cannot
 * leave owed): Early Colonization's colony track raised in the start (`scene:colony-track-raise`), Astra Mechanica's
 * return of played events (`scene:played-card-return`). One game in three deals the next of them the table can play
 * FIRST, ahead of the rotation's window. …and the input-type axis' last gap, `resources` (a free split of standard
 * resources — no dealt game of a pass asked it): Philares, whose every tile placed next to its own pays one of the
 * owner's choice — one game in six (offset from the cards', so the corporation's rotation keeps five of its six).
 */
export const LEDGER_CARDS: {projects: ReadonlyArray<CardName>, preludes: ReadonlyArray<CardName>, corporations: ReadonlyArray<CardName>} = {
  projects: [CardName.ASTRA_MECHANICA],
  preludes: [CardName.EARLY_COLONIZATION],
  corporations: [CardName.PHILARES],
};

/**
 * THE CARDS NO WHOLE GAME HAS PLAYED YET (the cards axis' worklist — `tests/client/bottle/autopilotCardsUnplayed.json`,
 * written by `npx tsx scripts/autopilot-cards.mts <monkey-report.json …> --never <that file>` over every pass): the
 * deal's `unplayed` source deals THEM in turn, the table's modules permitting — the rotation over the whole scope gives
 * a card to the hand once in a hundred games, and the fixed CI range (537 – 584) deals the same windows every night.
 */
export const UNPLAYED_CARDS = ((): {projects: Array<ScopeCard>, corporations: Array<ScopeCard>, preludes: Array<ScopeCard>} => {
  // (A card the ledger DECLARES — a `why` — is not dealt: its reason says no game of the pilot can play it.)
  const names = new Set((UNPLAYED_JSON as Array<{name: string, why?: string}>).filter((row) => (row.why ?? '') === '').map((row) => row.name));
  const keep = (list: ReadonlyArray<ScopeCard>) => list.filter((card) => names.has(card.name));
  return {projects: keep(SCOPE_CARDS.projects), corporations: keep(SCOPE_CARDS.corporations), preludes: keep(SCOPE_CARDS.preludes)};
})();

/** Where a deal takes its cards: the whole scope in turn, or the cards no game has played yet (`UNPLAYED_CARDS`). */
export type DealSource = 'scope' | 'unplayed';

/** The ledger's card of `list` for game `n` — one game in `every` (at `n % every === at`), the next one the table plays (or none). */
function ledgerCard(names: ReadonlyArray<CardName>, list: ReadonlyArray<ScopeCard>, n: number, on: ReadonlySet<string>, every = 3, at = 0): Array<CardName> {
  const playable = names.map((name) => list.find((c) => c.name === name))
    .filter((c): c is ScopeCard => c !== undefined && on.has(c.module) && c.needs.every((module) => on.has(module)));
  return n % every === at && playable.length > 0 ? [playable[Math.floor(n / every) % playable.length].name] : [];
}

/**
 * Game `n`'s deal over the modules its table plays (the scope's keys — `base`, `corpera`, …; classic `turmoil` rides
 * with `turmoilRedux`). `prelude` — the table deals preludes at all.
 */
export function dealFor(n: number, modules: ReadonlySet<string>, prelude: boolean, source: DealSource = 'scope'): Deal {
  const on = new Set([...modules, ...(modules.has('turmoilRedux') ? ['turmoil'] : [])]);
  if (source === 'unplayed') {
    // (The unplayed first, the scope's window behind them: a table whose modules hold none of a family still gets a deal.)
    const fill = (first: Array<CardName>, window: Array<CardName>, count: number) => [...first, ...window.filter((name) => !first.includes(name))].slice(0, count);
    // (…and the window is taken over the cards THIS table can play: scanned over the whole list, a table without the
    // modules at the window's place wrapped to the same base cards game after game — the bottle's games 15, 16 and 26
    // dealt one set of five.)
    const playable = (list: ReadonlyArray<ScopeCard>) => list.filter((card) => on.has(card.module) && card.needs.every((module) => on.has(module)));
    return {
      projects: fill(dealWindow(playable(UNPLAYED_CARDS.projects), n, 5, on), dealWindow(SCOPE_CARDS.projects, n, 5, on), 5),
      corporations: fill(dealWindow(playable(UNPLAYED_CARDS.corporations), n, 1, on), dealWindow(SCOPE_CARDS.corporations, n, 1, on), 1),
      preludes: prelude ? fill(dealWindow(playable(UNPLAYED_CARDS.preludes), n, 2, on), dealWindow(SCOPE_CARDS.preludes, n, 2, on), 2) : [],
    };
  }
  const projectFirst = ledgerCard(LEDGER_CARDS.projects, SCOPE_CARDS.projects, n, on);
  const preludeFirst = prelude ? ledgerCard(LEDGER_CARDS.preludes, SCOPE_CARDS.preludes, n, on) : [];
  const rest = (first: Array<CardName>, window: Array<CardName>, count: number) => [...first, ...window.filter((name) => !first.includes(name))].slice(0, count);
  return {
    projects: rest(projectFirst, dealWindow(SCOPE_CARDS.projects, n, 5, on), 5),
    corporations: rest(ledgerCard(LEDGER_CARDS.corporations, SCOPE_CARDS.corporations, n, on, 6, 1), dealWindow(SCOPE_CARDS.corporations, n, 1, on), 1),
    preludes: prelude ? rest(preludeFirst, dealWindow(SCOPE_CARDS.preludes, n, 2, on), 2) : [],
  };
}

/**
 * THE SCENARIO TABLES — one list for both pilots (`console-autopilot.spec.ts` · SCENARIO, `autopilot.bottle.ts`): a
 * fixture (`tests/e2e/fixtures/<name>.json`, generated by `generate.ts`) standing on a choice no dealt game reached in a
 * whole pass (the input-type bar's gaps), played from there to its end. `auto` — one game in four (`n % 4 === 3`: a CI pass of 48 plays every scenario,
 * never a campaign's game), the list in turn; `always` · `off`.
 *   · `scenario-delta` — Dutch Mountains' stage reward (`deltaStageReward`), Modular Floodgates' blockade (`deltaBlockade`),
 *     Corporate Espionage's push back (`deltaEspionage`);
 *   · `scenario-choices` — Applied Science's standard resource (`resource`), Energy Market's and Insulation's «how much»
 *     (`amount`);
 *   · `scenario-parliament` — the Parliament played FROM THE HAND (the kernel's flow axis: the Agenda walk, the neutral
 *     rally, the support discard, the delegate removal and exchange, the staged vote, the census vote): Minority
 *     Representation, Nationalist Movement, Red Lawyers, Political Donation, Party Sanctions, Banned Delegate:redux,
 *     Recruitment:redux in the hand, Martian Census (3 data) in play — blue in the chair, the Reds ruling;
 *   · `scenario-colonies` — the colonies of Turmoil Redux (the Nova City scene, the track's move, the bonus ledger's
 *     payout, the fleet's dock, the colony steps inside a hand play): Nova City, Colony Sponsors, Fringe Colony,
 *     Exclusive Colony in the hand, Habitat Science (4 data) and Water Hauling in play — generation 4, Unity's access;
 *   · `scenario-board` — the board's own scenes and the hazard thresholds (`aresGlobalParameters`): Butterfly Effect,
 *     Ecological Experiment, Astra Mechanica (two events to return) and Mars Nomads in the hand — Redux + Ares + Promo;
 *   · `scenario-opening` — Lotus Innovations with its FIRST ACTION owed (the start's rail scene), Colony Sponsors in the
 *     hand beside blue's colony on Luna, Tharsis Alliance in play;
 *   · `scenario-banner` — Septem Tribus:redux with its first action owed (the banner's cube), the Reds' Diverted
 *     Research enacted (RX35 — the standard project's pick of the data card), Martian Census with 2 data;
 *   · `scenario-bot-attack` — solo against MarsBot, its next card B02 Invasive Species over a TIE of blue's microbe cards
 *     (Nitrite Reducing Bacteria, Regolith Eaters): the attack is a question.
 */
export const AUTOPILOT_SCENARIOS = [
  'scenario-delta', 'scenario-choices', 'scenario-parliament', 'scenario-colonies', 'scenario-board', 'scenario-opening', 'scenario-banner',
  'scenario-bot-attack',
] as const;
export type AutopilotScenario = typeof AUTOPILOT_SCENARIOS[number];
/** What a scenario is FOR — the cards the pilot steers to (their actions on the grid of «Действия карт»). */
export const SCENARIO_TARGETS: Readonly<Record<AutopilotScenario, ReadonlyArray<string>>> = {
  'scenario-delta': [CardName.DUTCH_MOUNTAINS, CardName.MODULAR_FLOODGATES, CardName.CORPORATE_ESPIONAGE],
  'scenario-choices': [CardName.APPLIED_SCIENCE, CardName.ENERGY_MARKET, CardName.INSULATION],
  'scenario-parliament': [
    CardName.MINORITY_REPRESENTATION, CardName.NATIONALIST_MOVEMENT, CardName.PARTY_SANCTIONS, CardName.POLITICAL_DONATION,
    CardName.BANNED_DELEGATE_REDUX, CardName.RECRUITMENT_REDUX, CardName.RED_LAWYERS, CardName.MARTIAN_CENSUS,
  ],
  'scenario-colonies': [CardName.NOVA_CITY, CardName.COLONY_SPONSORS, CardName.FRINGE_COLONY, CardName.EXCLUSIVE_COLONY, CardName.HABITAT_SCIENCE,
    CardName.WATER_HAULING],
  // (Ecological Experiment first: the Scientists rule only until the first sitting.)
  'scenario-board': [CardName.ECOLOGICAL_EXPERIMENT, CardName.ASTRA_MECHANICA, CardName.BUTTERFLY_EFFECT, CardName.MARS_NOMADS],
  'scenario-opening': [CardName.COLONY_SPONSORS],
  'scenario-banner': [CardName.AQUIFER_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT, CardName.GREENERY_STANDARD_PROJECT, CardName.MARTIAN_CENSUS],
  'scenario-bot-attack': [CardName.REGOLITH_EATERS],
};

/** Game `n`'s scenario under `mode`, or undefined (a table of its own). */
export function scenarioFor(n: number, mode: string): AutopilotScenario | undefined {
  return mode === 'always' || (mode === 'auto' && n % 4 === 3) ? AUTOPILOT_SCENARIOS[Math.floor(n / 4) % AUTOPILOT_SCENARIOS.length] : undefined;
}

/** The modules a table plays, read off its game options (the engine's `expansions`, or the flags it is derived from). */
export function modulesOfOptions(options: Record<string, unknown>): Set<string> {
  const expansions = options.expansions as Record<string, boolean> | undefined;
  const flags: Record<string, unknown> = expansions ?? {
    corpera: options.corporateEra, venus: options.venusNextExtension, colonies: options.coloniesExtension, prelude: options.preludeExtension,
    prelude2: options.prelude2Expansion, promo: options.promoCardsOption, ares: options.aresExtension, deltaProject: options.deltaProjectExpansion,
    turmoilRedux: options.turmoilReduxExpansion,
  };
  return new Set(['base', ...Object.entries(flags).filter(([, on]) => on === true).map(([module]) => module)]);
}
