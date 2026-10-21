import {Color} from '../Color';
import {Units} from '../Units';
import {CardName} from '../cards/CardName';
import {Resource} from '../Resource';
import {AdditionalProjectCosts, CardDiscount, StandardProjectCanPayWith} from '../cards/Types';
import {Tag} from '../cards/Tag';
import {Warning} from '../cards/Warning';
import {PreludeOutlook} from '../cards/PreludeOutlook';
import {UnplayableReason} from '../cards/UnplayableReason';
import {Message} from '../logs/Message';
// `import type`: `ActionPreviewModel` imports `PlayerInputModel`, which imports
// THIS file — a value import would close that cycle at runtime (the same reason
// `PlayerInputModel` type-imports `ActionEffect`).
import type {ActionEffect, ActionPreviewStep, AgendaWalkModel} from './ActionPreviewModel';
import type {EffectForecast} from './EffectForecastModel';
import type {RequirementEasingModel} from './ArmedPlayEffectModel';
import type {ActionFutility, ActionFutilityVerdict} from './ActionFutilityModel';

/**
 * The GUARANTEED result of a standard project, computed server-side from the
 * real rule sources (adjusted cost, the card's own `tr` bump clamped to the
 * global scales, co-located per-card extras). Attached to a std project's
 * CardModel in the standard-projects menu so the client can render honest
 * `current → resulting` chips without re-deriving a single rule.
 *
 * `target` names the follow-up the project asks for AFTER the initial submit —
 * the PAY-ON-COMMIT projects (City / Greenery / Aquifer → a board space,
 * Build Colony → a colony), whose cost applies only once that target commits.
 * The console hosts that follow-up as a nested step of the Standard-Projects
 * flow; target-DEPENDENT consequences (cell bonuses, colony grants) stay with
 * the step's own preview surfaces and are deliberately NOT guessed here.
 */
export interface StandardProjectPreviewModel {
    effects: ReadonlyArray<ActionEffect>;
    target?: 'space' | 'colony';
    /**
     * Pre-collected steps the project asks AFTER the submit, in live order (Turmoil Redux RX35: the «where» pick of
     * the data a replacing law turns the project's step or tile into — one card pick, addressed to the law). The
     * workspace hosts them like a composer's steps and posts the batch; absent for every project today's submit
     * answers whole.
     */
    steps?: ReadonlyArray<ActionPreviewStep>;
    /**
     * WHAT THE TABLE ANSWERS to the project's own bump (the ruling Greens' 2 M€
     * on an asteroid's TR step, a card that reacts to the scale) — the forecast
     * engine's pass over `effects` (`effectForecast.rewardReactionForecast`),
     * read by the workspace's «⚡ сработает» line and its R3 «Эффекты» layer.
     * Absent = nothing reacts. A placement's answer is the cell dossier's.
     */
    forecast?: EffectForecast;
    /**
     * NO EFFECT (`ActionFutilityModel.ts`): the project's whole result is a step of a maxed parameter (an asteroid at
     * +8 °C, an aquifer with every ocean placed) and nothing on the table answers it — the row says why; never a block.
     */
    futile?: ActionFutilityVerdict;
}

export interface CardModel {
    name: CardName;
    resources?: number | undefined;
    calculatedCost?: number;
    isSelfReplicatingRobotsCard?: boolean,
    /**
     * The card's PRINTED resource protection (`Pets`, `Bioengineering
     * Enclosure`): the resources stored here cannot be removed by an opponent
     * — Pets' cannot be removed by anyone, its own owner included. Public,
     * because it is a printed property already visible on the card's face;
     * absent (never `false`) on every other card. The console rail reads it to
     * qualify an aggregated card-resource chip's protection.
     */
    protectedResources?: true,
    discount?: Array<CardDiscount>,
    isDisabled?: boolean; // Used with Pharmacy Union
    /**
     * A TRADE FLEET STANDS ON THIS CARD this generation (a fleet dock —
     * Turmoil Redux TR06 Water Hauling and its sisters): the owner sent a
     * trade's fleet here instead of to a colony, and it returns with the
     * others at the generation's end. Public (a fleet on a card is on the
     * table for every seat); absent — never `false` — on every other card and
     * on a free dock. NOT a used ACTION: the card has none, and it must not
     * read as «activated».
     *
     * The value is the fleet's OWNER colour (a dock takes only its owner's
     * fleet), so the face can paint the ship in that livery on every host —
     * a tableau, an inspector, a rival's table — without the host knowing
     * whose card it is drawing.
     */
    fleetDocked?: Color;
    // When this card is a DISABLED candidate in a SelectCard prompt (it's a
    // relevant target but can't be picked right now — e.g. no resources on it),
    // a user-facing reason. Shown as a badge/popover in the premium card picker.
    disabledReason?: string | Message;
    additionalProjectCosts?: AdditionalProjectCosts;
    warnings?: ReadonlyArray<Warning>;
    // The ORDER-AWARE verdict for a prelude the player is being asked to play
    // (`playable` / `deferred` + certainty + enablers / `noEffect`). Set only
    // inside a prelude-selection prompt, computed from the real rule sources —
    // the client renders it and never re-derives a rule. Absent on an older
    // server: the client then falls back to the flat `preludeFizzle` warning.
    preludeOutlook?: PreludeOutlook;
    // Structured reasons this card can't be played right now. Set only for
    // the viewer's OWN cards in hand (in their private PlayerViewModel) and
    // only when the card is currently unplayable. See UnplayableReason.
    unplayableReasons?: ReadonlyArray<UnplayableReason>;
    /**
     * The Agenda walk PLAYING this card would make (Turmoil Redux — a card that
     * «advances the Agenda marker»: TR04 / TR12 / TR37 / TR42), read by the
     * server through the card's own `agendaWalkForecast` — the very reading its
     * play preview hands the composer. Set only for the viewer's OWN cards in
     * hand, inside the Mars Parliament. The hand tile's forecast plate («★ 2»)
     * and the inspector's «ДЛЯ ВАС» row read it; the client computes no step.
     */
    agendaWalk?: AgendaWalkModel;
    /**
     * A COUNTED PLAY — what playing this card would give where the amount is
     * COUNTED off the table (TR45 «1 microbe per tile on Mars», TR23 «1 data per
     * colony in play», TR43 «1 M€ production per ocean», the upstream «per tag /
     * per city» plays): the play preview's own chips with their basis (and its
     * composition — `ActionEffectBasis.parts`), read by the server through
     * `countedPlayEffects` — the SAME builder the composer reads. Set only for
     * the viewer's OWN cards in hand; the hand tile's forecast plate («+14
     * [microbe]») and the inspector's «ДЛЯ ВАС» read it; the client counts nothing.
     */
    countedPlay?: ReadonlyArray<ActionEffect>;
    /** A play whose count the player CHOOSES (TR54): the hand plate's ceiling «[?] up to +max» (`ICard.countedChoiceForecast`). */
    countedChoice?: {max: number};
    /**
     * THE RATING THIS PLAY PROMISES AND THE LAW WILL REFUSE (Turmoil Redux RX42 UNMI Veto): the steps the play
     * preview's exit pass struck (`ActionEffect.vetoed`, summed over the branch that strikes the most), read by the
     * server for the viewer's OWN hand while a vetoing law stands and the seat is in its aspect. The hand tile's plate
     * strikes them BEFORE the composer opens; the client counts nothing (invariant 2). Absent when nothing is struck.
     */
    ratingVetoed?: {steps: number};
    /**
     * THE REQUIREMENT UNDER A MODIFIER (TR49 class): for each printed GLOBAL
     * requirement this player's modifiers touch — an armed Special Design (±2),
     * Cutting-Edge Design / Ecology Experts (ignored), Inventrix / Adaptation
     * Technology (±2 for good) — printed → effective, the sources named, and
     * whether the card is playable only thanks to them. The server's one
     * reading (`models/requirementEasing.ts`); the face's requirement
     * cassette, the hand plate, the availability verdict, «ДЛЯ ВАС» and the
     * composer read it and derive nothing. The OWN hand only (the same opt-in
     * as `unplayableReasons`); absent when no modifier touches a requirement.
     */
    requirementEasing?: ReadonlyArray<RequirementEasingModel>;
    // Structured reasons this card's activatable ACTION can't be used right now.
    // Set for (a) the viewer's OWN tableau (their PublicPlayerModel is the
    // self-model) — an action card whose action is currently unavailable AND not
    // yet used this generation, and (b) a DISABLED STANDARD PROJECT in the
    // standard-projects menu (see server/models/standardProjectReasons.ts): same
    // question, same shape, one renderer. Reuses UnplayableReason's shape.
    // Drives the "why is this disabled" popover / status line.
    actionReasons?: ReadonlyArray<UnplayableReason>;
    // The viewer's OWN tableau: an action card whose action IS available would change nothing right now — the whole
    // action (`verdict`) and/or some of its branches (`ActionFutilityModel.ts`, `server/models/actionFutility.ts`). It
    // arrives WITH the view, so the action list can order by it without waiting for a preview (no re-sort under the
    // cursor). Never a block: the action stays activatable.
    actionFutility?: ActionFutility;
    reserveUnits?: Readonly<Units>; // Written for The Moon, but useful in other contexts.
    bonusResource?: Array<Resource>; // Used with the Mining cards and Robotic Workforce
    cloneTag?: Tag; // Used with Pathfinders
    standardProjectCanPayWith?: StandardProjectCanPayWith; // Set for standard projects; undefined for regular project cards
    standardProjectPreview?: StandardProjectPreviewModel; // Set for standard projects in the std-projects menu
}
