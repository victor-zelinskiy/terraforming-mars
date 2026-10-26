import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {CardType} from '../../src/common/cards/CardType';
import {CardName} from '../../src/common/cards/CardName';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';
import {cardPlacesTile} from '../../src/server/cards/cardPlacesTile';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {testGame} from '../TestGame';
import {Phase} from '../../src/common/Phase';

/**
 * THE «A GREEN CARD THAT PLACES A TILE» WORKLIST (Turmoil Redux TR80 Hartlan
 * Heating — «after you play a green project card that places a tile»).
 *
 * The class is ONE printed predicate — `cards/cardPlacesTile.cardPlacesTile`:
 * a declarative `behavior.tile` / `city` / `greenery` / `ocean`, or the
 * co-located `placesTile: true` a bespoke placement declares beside its
 * `bespokePlay`. The live hook, the forecast twin and this guard all read it,
 * so the promise before the press and the gain after it agree by
 * construction. What this guard adds is the OTHER witness: the card's own
 * play preview. For EVERY green (AUTOMATED) card of the premium scope the
 * predicate must agree with «the play preview carries a board-placement step
 * that names a tile» — on a fresh board, with the ocean ceiling far away, a
 * tile MOVE (TR14 Re-settlement, TR39 Canyon Carving) counting as no
 * placement. A disagreement is a bespoke card that forgot its flag (Hartlan
 * would stay silent on it) or a flag on a card that places nothing (Hartlan
 * would pay for nothing) — the guard fails with the LIST, invariant 11.
 */
const SCOPE = PREMIUM_SCOPE_MODULES;

type Factory = new () => ICard;

/** Every PLAYABLE card of the scope — projects and preludes (a corporation's first action is no play). */
function playableCardsInScope(): Array<ICard> {
  const out: Array<ICard> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.includes(manifest.module)) {
      continue;
    }
    for (const group of [manifest.projectCards, manifest.preludeCards]) {
      for (const name of Object.keys(group)) {
        const F = (group as Record<string, {Factory: Factory}>)[name]?.Factory;
        if (F === undefined || !inPremiumScope({module: manifest.module, name}, SCOPE)) {
          continue;
        }
        let card: ICard;
        try {
          card = new F();
        } catch {
          continue;
        }
        out.push(card);
      }
    }
  }
  return out;
}

function greenCardsInScope(): Array<ICard> {
  return playableCardsInScope().filter((card) => card.type === CardType.AUTOMATED);
}

/**
 * A step that puts a NEW tile down — a board placement naming its tile (a colony build and a tile MOVE are not one),
 * or a colony pick whose prompt carries a `tileSite` (TR22 Nova City: a city ON the chosen colony tile).
 */
function placesNewTile(step: ActionPreviewStep): boolean {
  if (step.kind === 'colonyPick') {
    return step.staged.prompt.tileSite !== undefined;
  }
  if (step.kind !== 'boardPlacement' || step.tileType === undefined || step.placementType === 'colony') {
    return false;
  }
  return step.staged?.tileMove === undefined && !/-move$/.test(step.placementType);
}

/** The preview's witness: a placing step in some branch, or the card's RESERVED off-Mars city (placed with no prompt). */
function previewPlacesTile(card: ICard, steps: ReadonlyArray<ReadonlyArray<ActionPreviewStep>>): boolean {
  return card.behavior?.city?.space !== undefined || steps.some((branch) => branch.some(placesNewTile));
}

describe('greenTilePlacers — the printed class «a green card that places a tile» (TR80 Hartlan Heating)', () => {
  it('the predicate agrees with every green card\'s own play preview', () => {
    // One rich table: every card previewable, the oceans far from their ceiling, the board fresh.
    const [game, player] = testGame(2, {aresExtension: true, coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true} as never);
    game.phase = Phase.ACTION;
    player.megaCredits = 500;
    player.steel = 50;
    player.titanium = 50;
    player.plants = 50;
    player.energy = 50;
    player.heat = 50;
    player.production.override({megacredits: 10, steel: 10, titanium: 10, plants: 10, energy: 10, heat: 10});

    // The class is read for EVERY playable card (its colour is Hartlan's own reading, not the predicate's), so a
    // blue or event bespoke placer declares its flag too; the floor below counts the green ones.
    const cards = playableCardsInScope();
    expect(greenCardsInScope().length, 'green cards in scope').to.be.greaterThan(100);
    const flagOnly: Array<string> = [];
    const previewOnly: Array<string> = [];
    const placers: Array<CardName> = [];
    for (const card of cards) {
      const declared = cardPlacesTile(card);
      let previewed = false;
      try {
        const preview = cardPlayPreview(player, card);
        previewed = previewPlacesTile(card, preview.branches.map((branch) => branch.steps));
      } catch (e) {
        // A preview that cannot be built on this table (a module the table lacks) is no witness either way.
        previewed = declared;
      }
      if (declared && !previewed) {
        flagOnly.push(card.name);
      } else if (!declared && previewed) {
        previewOnly.push(card.name);
      }
      if (declared) {
        placers.push(card.name);
      }
    }
    expect(previewOnly, 'a green card whose play preview places a tile but whose declaration says nothing — a bespoke card missing `placesTile: true` beside its bespokePlay').deep.eq([]);
    expect(flagOnly, 'a green card declared as a tile placer whose play preview places none — a `placesTile` flag on a card that places nothing, or a declarative tile the preview walker lost').deep.eq([]);
    // The anti-vacuous floor: the class is a real one (≈ 39 declarative + ≈ 10 bespoke green cards today).
    expect(placers.length, 'green cards that place a tile').to.be.greaterThan(35);
    expect(placers, 'the bespoke placers are in the class').to.include.members([
      CardName.NOCTIS_CITY, CardName.URBANIZED_AREA, CardName.MINING_AREA, CardName.MINING_RIGHTS, CardName.LAVA_TUBE_SETTLEMENT,
    ]);
  });

  it('the predicate reads the declaration only — never the board or the queue', () => {
    const [, player] = testGame(2);
    const cards = greenCardsInScope();
    const before = cards.map((card) => cardPlacesTile(card));
    // Fill the ocean ceiling: a two-ocean card stays a card that places a tile (the printed class).
    for (let i = 0; i < 9; i++) {
      const space = player.game.board.getAvailableSpacesForOcean(player)[0];
      if (space === undefined) {
        break;
      }
      player.game.addOcean(player, space);
    }
    expect(cards.map((card) => cardPlacesTile(card))).deep.eq(before);
  });
});
