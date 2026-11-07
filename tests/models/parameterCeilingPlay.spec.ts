import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {isPreludeCard} from '../../src/server/cards/prelude/IPreludeCard';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';
import {CardName} from '../../src/common/cards/CardName';
import {TRSource} from '../../src/common/cards/TRSource';
import {Warning} from '../../src/common/cards/Warning';
import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {TileType} from '../../src/common/TileType';
import {getBehaviorExecutor} from '../../src/server/behavior/BehaviorExecutor';
import {Counter} from '../../src/server/behavior/Counter';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {SKIPPED_LABEL} from '../../src/server/cards/actionPreviews';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';

/*
 * THE CEILING BEFORE THE PRESS — a card played into a global parameter at its maximum is TOLD so.
 *
 * The rules let a card be played when its ocean / temperature / oxygen / Venus can no longer move (Flooding at nine
 * oceans: 7 M€ for −1 VP and nothing else), so the play sheet must NAME what the card loses before the press — or the
 * player plays it «by accident» and gets nothing they expected. The declaration does it by construction
 * (`Executor.canExecute`'s `max*` warnings, `stepsForBehavior`'s named ocean skip, a scale chip reading
 * `current → current`); a BESPOKE play does it by hand, and this guard is the worklist that finds the one that forgot
 * (Flooding, 2026-11-07 — its preview still promised the ocean and its attack).
 *
 * The walk: every in-scope project / prelude card whose PLAY declares the parameter in its rating source (`tr` /
 * `computeTr` / the behavior's — the declaration the Reds already require), with that parameter at its maximum, the
 * other three at the start AND at their maxima, without and with Turmoil Redux (a card's requirements decide which
 * tables can play it). Wherever the card is playable:
 *  ① it carries the parameter's warning — the engine's own `max*` vocabulary;
 *  ② its play preview promises no ocean placement the board has no room for and NAMES the lost ocean
 *     (`SKIPPED_LABEL.placeOcean` — the composer's skipped-effect strip; the hand's `CardModel.warnings` is not read
 *     by the play sheet, so a warning alone tells the console player nothing);
 *  ③ no chip of the parameter promises a move it cannot make (`current → resulting` with resulting ≠ current).
 */

type Param = 'oceans' | 'temperature' | 'oxygen' | 'venus';
const PARAMS: ReadonlyArray<Param> = ['oceans', 'temperature', 'oxygen', 'venus'];
const WARNING: Record<Param, Warning> = {oceans: 'maxoceans', temperature: 'maxtemp', oxygen: 'maxoxygen', venus: 'maxvenus'};
const CHIP_ICONS: Record<Param, ReadonlyArray<string>> = {oceans: ['oceans', 'ocean'], temperature: ['temperature'], oxygen: ['oxygen'], venus: ['venus']};

/**
 * A GREENERY's oxygen is not the card's raise: the tile still lands at 14 % (its VP, its neighbours; under Turmoil
 * Redux the tile pays its own rating — `ParliamentHandler.onGreeneryPlaced`), and the engine never warns a greenery
 * (`Executor.canExecute` warns `global.oxygen` only). A declaration says so by itself (`greenery` without
 * `global.oxygen`); a bespoke greenery placer is a row here, with its reason.
 */
const GREENERY_OXYGEN: ReadonlyMap<CardName, string> = new Map([
  [CardName.PROJECT_EDEN, 'P58 places a greenery among its three tiles — the declared oxygen is that tile\'s step'],
  [CardName.ARBORETUM, 'TR places a greenery — the declared oxygen is the tile\'s own step (the card\'s own note)'],
]);

type Candidate = {name: CardName, Factory: new () => ICard, params: ReadonlyArray<Param>};

function declaredSource(card: ICard, player: TestPlayer): TRSource {
  if (card.tr !== undefined) {
    return card.tr;
  }
  const computed = card.computeTr?.(player);
  if (computed !== undefined) {
    return computed;
  }
  return card.behavior !== undefined ? getBehaviorExecutor().toTRSource(card.behavior, new Counter(player, card)) : {};
}

function greeneryOxygen(card: ICard): boolean {
  if (GREENERY_OXYGEN.has(card.name)) {
    return true;
  }
  const b = card.behavior;
  return b !== undefined && b.greenery !== undefined && (b.global?.oxygen ?? 0) <= 0;
}

function candidates(): Array<Candidate> {
  const [, probe] = testGame(2, {venusNextExtension: true, coloniesExtension: true});
  const out: Array<Candidate> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!PREMIUM_SCOPE_MODULES.includes(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const Factory = (group as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
        if (Factory === undefined || !inPremiumScope({module: manifest.module, name})) {
          continue;
        }
        const card = new Factory();
        const source = declaredSource(card, probe);
        const params = PARAMS.filter((p) => (source[p] ?? 0) > 0 && !(p === 'oxygen' && greeneryOxygen(card)));
        if (params.length > 0) {
          out.push({name: card.name, Factory, params});
        }
      }
    }
  }
  return out;
}

/** A rich seat at the ceiling of `param` — the other parameters at the start or at their maxima. */
function table(param: Param, othersAtMax: boolean, redux: boolean): {player: TestPlayer} {
  const [game, player] = testGame(2, {
    venusNextExtension: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: true, turmoilReduxExpansion: redux,
  });
  const maxed = othersAtMax ? PARAMS : [param];
  if (maxed.includes('oceans')) {
    maxOutOceans(player);
  }
  if (maxed.includes('temperature')) {
    setTemperature(game, game.max.temperature);
  }
  if (maxed.includes('oxygen')) {
    setOxygenLevel(game, game.max.oxygen);
  }
  if (maxed.includes('venus')) {
    setVenusScaleLevel(game, game.max.venus);
  }
  player.megaCredits = 300;
  player.titanium = 30;
  player.steel = 30;
  player.plants = 30;
  player.heat = 30;
  player.energy = 30;
  player.production.override({megacredits: 5, steel: 5, titanium: 5, plants: 5, energy: 5, heat: 5});
  return {player};
}

function playable(player: TestPlayer, card: IProjectCard): boolean {
  card.clearWarnings();
  if (isPreludeCard(card)) {
    return card.canPlay(player, {cost: 0}) !== false;
  }
  return player.canPlay(card);
}

/** What the card tells the player at the ceiling — empty when it tells the whole truth. */
function defects(param: Param, player: TestPlayer, card: IProjectCard): Array<string> {
  const out: Array<string> = [];
  if (!Array.from(card.warnings).includes(WARNING[param])) {
    out.push(`no «${WARNING[param]}» warning`);
  }
  const preview = cardPlayPreview(player, card);
  const steps: Array<ActionPreviewStep> = preview.branches.flatMap((b) => b.steps);
  if (param === 'oceans') {
    if (steps.some((s) => s.kind === 'boardPlacement' && (s.placementType === 'ocean' || s.tileType === TileType.OCEAN))) {
      out.push('the preview promises an ocean placement');
    }
    const named = steps.some((s) => s.kind === 'note' && s.noteKind === 'warning' && s.skipped?.label === SKIPPED_LABEL.placeOcean);
    if (!named) {
      out.push('the preview does not name the lost ocean');
    }
  }
  for (const chip of preview.branches.flatMap((b) => b.effects)) {
    if (CHIP_ICONS[param].includes(chip.icon) && chip.current !== undefined && chip.resulting !== undefined && chip.current !== chip.resulting) {
      out.push(`a ${param} chip promises ${chip.current} → ${chip.resulting}`);
    }
  }
  return out;
}

describe('a card played into a parameter at its ceiling is told so (the ceiling before the press)', function() {
  // ~3 s on the laptop: four fresh tables per declared parameter of ~57 cards, and it grows with every card shipped.
  // eslint-disable-next-line no-invalid-this
  this.timeout(60_000);
  const all = candidates();

  it('the walk is broad — every in-scope card that declares an ocean / temperature / oxygen / Venus raise', () => {
    // Floor: raise when the scope widens, never lower.
    expect(all.length).gte(57);
    expect(all.map((c) => c.name)).to.include.members([CardName.FLOODING, CardName.ICE_CAP_MELTING, CardName.ASTEROID]);
  });

  it('every greenery exemption names a card that declares the oxygen it exempts', () => {
    const [, probe] = testGame(2, {venusNextExtension: true, coloniesExtension: true});
    for (const name of GREENERY_OXYGEN.keys()) {
      const manifest = ALL_MODULE_MANIFESTS.find((m) => (m.projectCards as Record<string, unknown>)[name] !== undefined ||
        (m.preludeCards as Record<string, unknown>)[name] !== undefined);
      expect(manifest, `${name}: not a project / prelude card`).is.not.undefined;
      const group = {...manifest!.projectCards, ...manifest!.preludeCards} as Record<string, {Factory: new () => ICard}>;
      const card = new group[name].Factory();
      expect(declaredSource(card, probe).oxygen ?? 0, `${name}: declares no oxygen — the row is not needed`).gt(0);
    }
  });

  it('wherever such a card is playable at the ceiling, it names what it loses', () => {
    const failures: Array<string> = [];
    for (const candidate of all) {
      for (const param of candidate.params) {
        for (const redux of [false, true]) {
          for (const othersAtMax of [false, true]) {
            const {player} = table(param, othersAtMax, redux);
            const card = new candidate.Factory() as IProjectCard;
            player.cardsInHand.push(card);
            if (!playable(player, card)) {
              continue;
            }
            const found = defects(param, player, card);
            if (found.length > 0) {
              failures.push(`${candidate.name} · ${param} at max (others ${othersAtMax ? 'at max' : 'at start'}${redux ? ', Redux' : ''}): ${found.join('; ')}`);
            }
          }
        }
      }
    }
    expect(failures, `cards that play into a maxed parameter without saying so:\n  ${failures.join('\n  ')}`).deep.eq([]);
  });
});
