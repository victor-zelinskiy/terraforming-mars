import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {PreludeCard} from '../prelude/PreludeCard';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {TileType} from '../../../common/TileType';
import {ActionEffect, ActionPreview, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import {ActionFutility, FutileParameter} from '../../../common/models/ActionFutilityModel';
import {WorldGovernmentActAsker} from '../../../common/models/PlayerInputModel';
import {BranchSpec} from '../actionPreviews';
import * as actionPreviews from '../actionPreviews';
import {parameterMaxed} from '../actionFutilities';
import {crossesTrackBonus} from '../../boards/GlobalParameterTracks';
import {venusLevelAfterSteps} from '../../venusNext/venusScale';

/** The printed order of the action's row — `oceans · oxygen · temperature · Venus`. */
const PRINTED: ReadonlyArray<FutileParameter> = ['oceans', 'oxygen', 'temperature', 'venus'];

const ANNOTATION: Readonly<Record<FutileParameter, GlobalParameter>> = {
  oceans: GlobalParameter.OCEANS,
  oxygen: GlobalParameter.OXYGEN,
  temperature: GlobalParameter.TEMPERATURE,
  venus: GlobalParameter.VENUS,
};

/** The live question's option titles (the engine's own keys — `Game.worldGovernmentTerraformingInput`). */
const OPTION_TITLE: Readonly<Record<FutileParameter, string>> = {
  oceans: 'Add an ocean',
  oxygen: 'Increase oxygen',
  temperature: 'Increase temperature',
  venus: 'Increase Venus scale',
};

/*
 * The chips' notes (i18n keys) — the player's DELTA only: «as the World Government, no TR» is the card's own rule line
 * above the tiles (a note repeating it on every chip overflowed the four tiles at 4K — the status-line law). A plain
 * step carries no note (`world: true` alone); a step that crosses a bonus the government does NOT take names it…
 */
export const WORLD_MOVE_NO_HEAT_NOTE = 'no heat production';
export const WORLD_MOVE_NO_CELL_BONUS_NOTE = 'no cell bonus';
export const WORLD_MOVE_NO_VENUS_CARD_NOTE = 'no bonus card';
export const WORLD_MOVE_NO_VENUS_RATING_NOTE = 'no bonus TR';
export const WORLD_MOVE_NO_ALT_VENUS_NOTE = 'no Venus bonus';
/** …and a bonus step the government DOES take is named as one — it is played, for nobody. */
export const WORLD_BONUS_OCEAN_NOTE = 'bonus ocean';
export const WORLD_BONUS_TEMPERATURE_NOTE = 'bonus step';
/** The step that terraforms Mars (the game ends with the generation). */
export const WORLD_LAST_STEP_NOTE = 'The last step: Mars is terraformed';
/** The whole action at the maximum. */
export const WORLD_ALL_MAXED_REASON = 'Every global parameter is at its maximum';

/**
 * P67 — WORLD GOVERNMENT ADVISOR («Советник Мирового правительства»), a Prelude 2 prelude with an ACTION: Earth tag,
 * «Raise your TR 2 steps and draw 1 card» (declarative), and «Action: as the World Government, raise 1 global
 * parameter — you gain no TR and no other bonuses».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/WorldGovernmentAdvisor.spec.ts — the upstream block byte for byte, the
 * fork's below it):
 *  1. The action borrows the World Government's phase (`Game.temporarySolarPhase` — SOLAR is the engine's SUPPRESSION
 *     flag: no rating, no cell bonus, no party reward, no RX35 replacement) and asks the government's own question
 *     (`Game.worldGovernmentTerraformingInput`), marked as THIS card's (`worldGovernmentPrompt` · `choiceContext`). While
 *     it stands the game publishes `worldGovernmentAct` — the generation is still in its action phase.
 *  2. What the engine still does in SOLAR is the upstream's and stays: the 0 °C ocean IS placed (for nobody), the 8 %
 *     oxygen's temperature step IS made; a card answering ANY raise (Aphrodite, Venusian Census — a rival's too) pays.
 *  3. The preview is the SAME question (one builder): one branch per printed parameter in the printed order, each
 *     carrying its live option's index — a parameter the engine no longer offers is SHOWN refused with its reason. The
 *     ocean's cell is a staged placement nested in the branch pick, read in the government's mode.
 *  4. Everything at the maximum: the action is still legal (`canAct` — and the upstream's warning) and does nothing —
 *     the preview is one empty branch and the futility verdict names it.
 */
export class WorldGovernmentAdvisor extends PreludeCard implements IActionCard {
  constructor() {
    super({
      name: CardName.WORLD_GOVERNMENT_ADVISOR,
      tags: [Tag.EARTH],

      behavior: {
        tr: 2,
        drawCard: 1,
      },

      metadata: {
        cardNumber: 'P67',
        // The full rule (94 characters) is over the browser's caption budget (52); the short keeps the act and the cost.
        infoText: [{kind: 'action-short', text: 'As the World Government: +1 parameter, no TR', tokens: ['oceans', 'oxygen', 'temperature', 'venus']}],
        renderData: CardRenderer.builder((b) => {
          b.action('As the World Government, raise 1 global parameter — you gain no TR and no other bonuses.', (ab) => {
            ab.empty().startAction.oceans(1).oxygen(1).temperature(1).venus(1).asterix();
          }).br;
          b.tr(2).cards(1);
        }),
        description: 'Raise your TR 2 steps and draw 1 card.',
      },
    });
  }

  /** Who asks the government's question — this card (`worldGovernmentPrompt`, `worldGovernmentAct`). */
  private get asker(): WorldGovernmentActAsker {
    return {source: 'card', card: this.name};
  }

  public canAct(player: IPlayer) {
    const orOptions = player.game.worldGovernmentTerraformingInput(player, this.asker);
    if (orOptions.options.length === 0) {
      this.addWarning('marsIsTerraformed');
    }
    return true;
  }

  public action(player: IPlayer) {
    const game = player.game;

    game.temporarySolarPhase(player, () => {
      const orOptions = game.worldGovernmentTerraformingInput(player, this.asker);
      if (orOptions.options.length !== 0) {
        player.defer(orOptions);
      }
    }, this.asker);
    return undefined;
  }

  /** Rule 4 — nothing the government may still raise: the whole action does nothing (no raise → nothing answers). */
  public actionFutility(player: IPlayer): ActionFutility | undefined {
    const options = player.game.worldGovernmentTerraformingInput(player, this.asker).options;
    return options.length > 0 ? undefined : {verdict: {kind: 'parameter-maxed', reason: WORLD_ALL_MAXED_REASON}};
  }

  /** Rule 3 — the branches of the live question, read off the SAME builder (read-only: the options act in `andThen`). */
  public actionPreview(player: IPlayer): ActionPreview {
    const game = player.game;
    const options = game.worldGovernmentTerraformingInput(player, this.asker).options;
    if (options.length === 0) {
      return actionPreviews.singleBranch(this, player);
    }
    const specs: Array<BranchSpec & {live: number}> = [];
    for (const parameter of PRINTED) {
      if (parameter === 'venus' && game.gameOptions.venusNextExtension !== true) {
        continue;
      }
      const live = options.findIndex((o) => o.annotation === ANNOTATION[parameter]);
      if (live < 0) {
        specs.push({
          live: -1,
          available: false,
          title: OPTION_TITLE[parameter],
          renderKey: '0',
          unavailableReason: parameterMaxed(player, parameter)?.reason ?? WORLD_ALL_MAXED_REASON,
        });
        continue;
      }
      specs.push({
        live,
        available: true,
        title: OPTION_TITLE[parameter],
        renderKey: '0',
        effects: worldMoveEffects(player, parameter),
        steps: worldMoveSteps(player, this.name, parameter),
      });
    }
    // (Every branch names the ONE printed action row — `renderKey` '0': one tile in «ДЕЙСТВИЯ КАРТ», the choice inside.)
    // An option the print does not show (Ares extreme solo — the unprotected hazard) is the question's too.
    options.forEach((option, live) => {
      if (!specs.some((s) => s.live === live)) {
        specs.push({live, available: true, title: option.title});
      }
    });
    // The branch's index is its LIVE position (the answer replays byte for byte); the order on screen is the print's.
    const preview = actionPreviews.orBranches(this, specs, {autoResolveSingle: false});
    return {
      ...preview,
      branches: preview.branches.map((branch, i) => ({...branch, index: specs[i].available ? specs[i].live : -1})),
    };
  }
}

/** The world chip of one step of `parameter` (nobody credited) and the bonus steps the government takes with it. */
function worldMoveEffects(player: IPlayer, parameter: FutileParameter): Array<ActionEffect> {
  const game = player.game;
  const world = (effect: ActionEffect, note: string | undefined): ActionEffect => ({...effect, world: true, ...(note !== undefined ? {note} : {})});
  switch (parameter) {
  case 'oceans':
    return [world(actionPreviews.oceanGain(player, 1), WORLD_MOVE_NO_CELL_BONUS_NOTE)];
  case 'temperature': {
    const from = game.getTemperature();
    const out = [world(actionPreviews.globalGain(player, 'temperature', 1), crossesHeatBonus(game, from) ? WORLD_MOVE_NO_HEAT_NOTE : undefined)];
    out.push(...temperatureBonusOcean(player, from));
    return out;
  }
  case 'oxygen': {
    const from = game.getOxygenLevel();
    const out = [world(actionPreviews.globalGain(player, 'oxygen', 1), undefined)];
    if (crossesTrackBonus(game.globalParameterTracks, 'oxygen', 'temperature', from, from + 1) &&
        game.getTemperature() < game.max.temperature) {
      const t = game.getTemperature();
      out.push({...actionPreviews.globalGain(player, 'temperature', 1), world: true, note: WORLD_BONUS_TEMPERATURE_NOTE});
      out.push(...temperatureBonusOcean(player, t));
    }
    return out;
  }
  case 'venus': {
    const from = game.getVenusScaleLevel();
    const to = Math.min(game.max.venus, venusLevelAfterSteps(from, 1));
    const chip = actionPreviews.globalGain(player, 'venus', 1);
    // The alternative board's bonus is a REWARD (the engine's reward gate): the government earns none of it.
    const {altVenusBonus: _withheld, ...plain} = chip;
    const note = crossesTrackBonus(game.globalParameterTracks, 'venus', 'drawcard', from, to) ? WORLD_MOVE_NO_VENUS_CARD_NOTE :
      crossesTrackBonus(game.globalParameterTracks, 'venus', 'tr', from, to) ? WORLD_MOVE_NO_VENUS_RATING_NOTE :
        _withheld !== undefined ? WORLD_MOVE_NO_ALT_VENUS_NOTE : undefined;
    return [world(plain, note)];
  }
  }
}

function crossesHeatBonus(game: IPlayer['game'], from: number): boolean {
  return crossesTrackBonus(game.globalParameterTracks, 'temperature', 'heatproduction', from, from + 2);
}

/** The 0 °C ocean a temperature step from `from` sets off — placed by the government too (the engine's own rule). */
function temperatureBonusOcean(player: IPlayer, from: number): Array<ActionEffect> {
  const game = player.game;
  if (crossesTrackBonus(game.globalParameterTracks, 'temperature', 'ocean', from, from + 2) && game.canAddOcean()) {
    return [{...actionPreviews.oceanGain(player, 1), world: true, note: WORLD_BONUS_OCEAN_NOTE}];
  }
  return [];
}

/**
 * The branch's steps: the ocean's CELL — a staged pick nested in the branch pick, read in the government's mode — and
 * the last step's note when this one terraforms Mars.
 */
function worldMoveSteps(player: IPlayer, card: CardName, parameter: FutileParameter): Array<ActionPreviewStep | undefined> {
  const game = player.game;
  const steps: Array<ActionPreviewStep | undefined> = [];
  if (parameter === 'oceans') {
    const staged = actionPreviews.stagedActionPlacement(player, {
      title: OPTION_TITLE.oceans,
      spaces: game.board.getAvailableSpacesForOcean(player),
      placementType: 'ocean',
      tileType: TileType.OCEAN,
      sourceCard: card,
    });
    steps.push(actionPreviews.boardPlacementStep('ocean', {
      tileType: TileType.OCEAN,
      staged: staged === undefined ? undefined : {...staged, nestedInBranch: true, government: true},
    }));
  }
  if (closesMars(player, parameter)) {
    steps.push(actionPreviews.noteStep('generic', WORLD_LAST_STEP_NOTE));
  }
  return steps;
}

/** Does one step of `parameter` (with the bonus steps it sets off) leave every Martian parameter at its goal? */
function closesMars(player: IPlayer, parameter: FutileParameter): boolean {
  const game = player.game;
  let temperature = game.getTemperature();
  let oxygen = game.getOxygenLevel();
  let oceans = game.board.getOceanSpaces().length;
  if (parameter === 'venus') {
    return false;
  }
  const raiseTemperature = () => {
    const from = temperature;
    temperature = Math.min(game.max.temperature, temperature + 2);
    if (crossesTrackBonus(game.globalParameterTracks, 'temperature', 'ocean', from, temperature)) {
      oceans = Math.min(game.max.oceans, oceans + 1);
    }
  };
  if (parameter === 'oceans') {
    oceans = Math.min(game.max.oceans, oceans + 1);
  } else if (parameter === 'temperature') {
    raiseTemperature();
  } else {
    const from = oxygen;
    oxygen = Math.min(game.max.oxygen, oxygen + 1);
    if (crossesTrackBonus(game.globalParameterTracks, 'oxygen', 'temperature', from, oxygen)) {
      raiseTemperature();
    }
  }
  return temperature >= game.max.temperature && oxygen >= game.max.oxygen && oceans >= game.max.oceans;
}
