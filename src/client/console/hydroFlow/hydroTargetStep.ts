/*
 * THE HYDRO ANIMAL-TARGET STEP (position 9) — the pure glue between the delta
 * preview's `animalTargetCards` and the SHARED played-card target selector
 * (`ConsolePlayedTargetStep` + `consolePlayedTargetModel`).
 *
 * WHY GLUE AND NOT A NEW SURFACE. «Куда положить животных с этапа 9» is the
 * same decision as a colony trade's «куда положить награду»: point at a
 * physical card already on the table. The console owns ONE selector for that,
 * so the hydro workspace reuses it verbatim — this module only translates the
 * hydro shapes (a CardName list off the server preview + the viewer's live
 * tableau) into the selector's model. A hydro-only picker is exactly the
 * drift this fork forbids (the old flat `hydroPick` sheet was that drift).
 *
 * Deliberate parallels with the colony glue, both structural:
 *  · NO `sourceCardName` — the hero of the hydro scene is the TRACK, not a
 *    card, so every candidate renders as its own physical face;
 *  · the preview section is built from the step's own numbers (the live
 *    resource count on the candidate + the fixed +2 animals of the stage).
 *
 * PURE: no DOM, no Vue, no i18n (labels are keys); unit-tested.
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {
  BuildPlayedTargetInput, PlayedTargetModel, PlayedTargetPreviewSection,
  buildPlayedTargetModel,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';

/** Position 9 grants exactly 2 animals (the server's AddResourcesToCard count). */
export const HYDRO_ANIMAL_AMOUNT = 2;

export type BuildHydroTargetInput = {
  /** The server preview's candidate names (`animalTargetCards`) — verbatim. */
  eligible: ReadonlyArray<CardName>;
  /** The viewer's live tableau — the candidates' models (resource counts). */
  tableau: ReadonlyArray<CardModel>;
  /** Every player, for owner resolution (`PlayedTargetPlayerRef` shape). */
  players: BuildPlayedTargetInput['players'];
  viewerColor: string;
  /** The step's ask, already translated by the caller. */
  ask: string;
  /** `ClientCardManifest.getCard(...)?.type`, injected for purity. */
  typeOf: (name: CardName) => CardType | undefined;
};

/**
 * The selector model of the position-9 animal target. Candidates are the
 * SERVER's own eligibility list (never re-derived); every candidate carries
 * the honest `current → resulting` reading plus the animal badge — zero
 * included, an empty legal target must still answer «сколько там сейчас».
 */
export function buildHydroTargetModel(input: BuildHydroTargetInput): PlayedTargetModel {
  const byName = new Map(input.tableau.map((c) => [c.name, c]));
  const candidates: Array<CardModel> = [];
  for (const name of input.eligible) {
    const model = byName.get(name);
    if (model !== undefined) {
      candidates.push(model);
    }
  }
  const preview = (name: CardName): ReadonlyArray<PlayedTargetPreviewSection> => {
    const model = byName.get(name);
    if (model === undefined) {
      return [];
    }
    const from = model.resources ?? 0;
    return [{
      key: 'res',
      title: 'Target card',
      entity: 'target',
      impacts: [{
        label: 'Animals on card',
        icon: 'animal',
        from,
        to: from + HYDRO_ANIMAL_AMOUNT,
      }],
    }];
  };
  return buildPlayedTargetModel({
    candidates,
    players: input.players,
    viewerColor: input.viewerColor,
    ask: input.ask,
    typeOf: input.typeOf,
    preview,
    resourceContext: (_name, model) =>
      playedTargetResourceFor(HYDRO_ANIMAL_AMOUNT, 'animal', model),
  });
}

/**
 * The presented target's card model for the resolving scene: the live model
 * with its counter FROZEN at the pre-commit value, ticking UP by exactly what
 * has physically landed (the transfer framework's per-card touchdown tally).
 * Snapshotted, so the server commit updating the tableau underneath can never
 * tick the visible counter early.
 */
export function hydroPresentedTargetModel(
  card: CardName,
  before: number,
  live: CardModel | undefined,
  landedCount: number,
): CardModel {
  const base: CardModel = live !== undefined ? {...live} : ({name: card} as CardModel);
  const shown = before + Math.min(Math.max(0, landedCount), HYDRO_ANIMAL_AMOUNT);
  return {...base, resources: Math.max(0, shown)};
}
