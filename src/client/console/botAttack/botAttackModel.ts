/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE MARSBOT ATTACK — the PURE view-model behind the console's compact modal
 * for «бот атаковал вас: выберите, что потеряете».
 *
 * WHY IT EXISTS. A hostile MarsBot effect reaches the client as an ordinary
 * `SelectCard` over the victim's own tableau. Served by the generic card
 * browser it became a full-screen picker with one card blown up to half a 4K
 * screen, under a raw English sentence whose only trace of the attacker was the
 * source card's English name in brackets. Nothing said the player had been
 * ATTACKED, nothing showed the bot's card, and nothing said what the choice
 * would cost — the single most important thing about it.
 *
 * THE HARD RULE — NOTHING HERE READS LOCALIZED TEXT, and nothing here
 * re-derives a game rule. Who attacked, with what, what leaves and what each
 * candidate costs all come from the SERVER's `botAttackPrompt` marker
 * (`BotAttackPromptMeta`), whose preview figures were computed through the real
 * scoring sources. This module only arranges them.
 *
 * IT IS A FAMILY, NOT A CARD. Nothing below names Invasive Species: the
 * builder is driven by `effect`, `amount`, `cardResource` and the server's
 * candidate set, so the next bot effect that forces a target choice reuses the
 * whole surface by filling in the same marker.
 *
 * PURE: no Vue, no DOM, no i18n — labels are English i18n KEYS (the text IS the
 * key) and the surface translates. Unit-tested under the server runner.
 */

import {BonusCardContext} from '@/common/automa/BonusCardData';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {BotAttackPromptMeta, BotAttackTargetPreview} from '@/common/models/BotAttackPromptModel';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {botAttackSourceView, PromptSourceView} from '@/client/console/promptSource';
import {
  PlayedTargetImpact,
  PlayedTargetPreviewSection,
  PlayedTargetResourceContext,
} from '@/client/console/played/consolePlayedTargetModel';

// ── copy keys (English text IS the i18n key) ────────────────────────────────

export const EYEBROW_BOT_ATTACK = 'MarsBot attack';
/** The headline: «"Инвазивные виды" активирует эффект». */
export const HEADLINE_SOURCE_TRIGGERS = '${0} triggers its effect';
/** …and the honest fallback when the bot's card cannot be named. */
export const HEADLINE_BOT_ATTACKS = 'MarsBot triggers a hostile effect';

/** WHAT the player must do — one plain sentence, singular and counted forms. */
export const EXPLAIN_REMOVE_ONE = 'Choose one of your cards and remove 1 resource from it.';
export const EXPLAIN_REMOVE_MANY = 'Choose one of your cards and remove ${0} resources from it.';

/**
 * The commit verb — it names the ACT, never an abstract «выбрать».
 *
 * TWO forms, because two consumers with different capabilities read it: the
 * commit ROW can interpolate («Удалить 3 ресурса»), while the ONE command bar
 * renders a bare i18n KEY and has no parameter channel. Rather than invent one
 * for a single string, the bar gets a countless verb — which is also the right
 * copy there: the bar names the action, the row states its magnitude.
 */
export const COMMIT_REMOVE_ONE = 'Remove 1 resource';
export const COMMIT_REMOVE_MANY = 'Remove ${0} resources';
export const COMMIT_VERB_ONE = 'Remove 1 resource';
export const COMMIT_VERB_MANY = 'Remove the resources';

/** The pre-select verb (A on a candidate). `Inspect` / `Inspect the source` are
 *  the console-wide X / L3 verbs — reused, never re-coined (invariant 9). */
export const VERB_CHOOSE_TARGET = 'Choose the target';
export const VERB_INSPECT_CARD = 'Inspect';
export const VERB_INSPECT_SOURCE = 'Inspect the source';
export const VERB_MINIMIZE = 'Minimize';
export const VERB_NAVIGATE = 'Navigate';
export const VERB_CONTINUE = 'Continue';

/** Section + impact labels of the `было → станет` preview. */
export const SECTION_TARGET = 'Attack target';
export const LABEL_RESOURCES = 'Resources on this card';
export const LABEL_CARD_VP = 'VP on this card';
export const LABEL_SCORE = 'Your total score';

/** The honest state when the rules left nothing to choose. */
export const EMPTY_NO_TARGETS = 'MarsBot found nothing to take from you.';

// ── the view model ──────────────────────────────────────────────────────────

/**
 * A phrase that still needs its parameters substituted after translation.
 *
 * `translateParams` marks the case where a parameter is itself an i18n KEY (a
 * card's name) rather than a literal (a count): interpolating the raw English
 * name would print «Invasive Species активирует эффект» in a Russian sentence.
 */
export type BotAttackPhrase = {key: string, params: ReadonlyArray<string>, translateParams?: boolean};

export type BotAttackTargetView = {
  card: CardName;
  /** Icon key of the resource leaving (the `cardResourceIcon` form). */
  icon: string;
  resources: {from: number, to: number};
  /** The CARD's own points — absent when the resource does not touch them. */
  victoryPoints?: {from: number, to: number};
  /** The player's TOTAL — present ONLY when it moves, and never the same
   *  number as `victoryPoints` under a second label. */
  score?: {from: number, to: number};
};

export type BotAttackViewModel = {
  eyebrowKey: string;
  attacker: Color;
  victim: Color;
  /** WHO/WHAT asked — rendered by the SHARED source dock (`BonusCardFace`). */
  source: PromptSourceView;
  headline: BotAttackPhrase;
  explanation: BotAttackPhrase;
  /** WHY only these cards — the server's own rule key, when it sent one. */
  restrictionKey?: string;
  /** The commit verb for the ROW, already counted. */
  commit: BotAttackPhrase;
  /** …and the parameter-free key the ONE command bar publishes on A. */
  commitVerbKey: string;
  targets: ReadonlyArray<BotAttackTargetView>;
  /**
   * The rules left NOTHING selectable. The server normally resolves that case
   * without a prompt at all, so this is the honest last resort rather than a
   * state the flow expects — `skippable` says whether the protocol even allows
   * an empty answer (`min === 0`).
   */
  empty: boolean;
  skippable: boolean;
};

/** The icon key of a card resource — the same lowercase-hyphen form the server's
 *  `cardResourceIcon` produces, so one vocabulary reaches every icon lookup. */
export function botAttackResourceIcon(resource: string): string {
  return resource.toLowerCase().replace(/\s+/g, '-');
}

function targetView(preview: BotAttackTargetPreview): BotAttackTargetView {
  return {
    card: preview.card,
    icon: botAttackResourceIcon(preview.resource),
    resources: {from: preview.resources.before, to: preview.resources.after},
    victoryPoints: preview.victoryPoints === undefined ?
      undefined :
      {from: preview.victoryPoints.before, to: preview.victoryPoints.after},
    score: preview.score === undefined ?
      undefined :
      {from: preview.score.before, to: preview.score.after},
  };
}

/**
 * Build the modal's model, or `undefined` when this prompt is not a bot attack.
 *
 * Deliberately tolerant of the candidate set and the preview list DISAGREEING:
 * the prompt's `cards` are what the server will validate an answer against, so
 * they are the authority on WHAT may be chosen; a preview entry that has no
 * candidate is dropped, and a candidate with no preview still renders (its
 * reading is simply absent rather than invented). That is what makes a stale
 * client frame degrade into "less information" instead of "a target the server
 * will refuse".
 */
export function buildBotAttackView(
  input: PlayerInputModel | undefined,
  /** Resolves the bot card's expansion branches — the live game options. */
  bonusCtx: BonusCardContext,
): BotAttackViewModel | undefined {
  const meta: BotAttackPromptMeta | undefined = input?.botAttackPrompt;
  if (input === undefined || meta === undefined || input.type !== 'card') {
    return undefined;
  }
  const model = input as SelectCardModel;
  const offered = new Set<string>(model.cards.map((c) => c.name));
  const targets = meta.targets.filter((t) => offered.has(t.card)).map(targetView);
  const amount = Math.max(1, meta.amount);
  const source = botAttackSourceView(meta.source, bonusCtx);
  const sourceName = source.name;

  return {
    eyebrowKey: EYEBROW_BOT_ATTACK,
    attacker: meta.attacker,
    victim: meta.victim,
    source,
    headline: typeof sourceName === 'string' && sourceName !== '' ?
      {key: HEADLINE_SOURCE_TRIGGERS, params: [sourceName], translateParams: true} :
      {key: HEADLINE_BOT_ATTACKS, params: []},
    explanation: amount === 1 ?
      {key: EXPLAIN_REMOVE_ONE, params: []} :
      {key: EXPLAIN_REMOVE_MANY, params: [String(amount)]},
    restrictionKey: meta.restrictionKey,
    commit: amount === 1 ?
      {key: COMMIT_REMOVE_ONE, params: []} :
      {key: COMMIT_REMOVE_MANY, params: [String(amount)]},
    commitVerbKey: amount === 1 ? COMMIT_VERB_ONE : COMMIT_VERB_MANY,
    targets,
    empty: model.cards.length === 0,
    skippable: model.min === 0,
  };
}

// ── the `было → станет` preview, in the SHARED target-step vocabulary ────────

/**
 * The contextual sections for ONE candidate, in exactly the shape the shared
 * played-target selector already renders (`PlayedTargetPreviewSection`). The
 * selector therefore needs no knowledge of MarsBot at all — the host injects
 * the reading, as every other host of that component does.
 *
 * WHAT IS SHOWN AND WHAT IS NOT:
 *  · resources — ALWAYS. It is the thing being taken.
 *  · the CARD's VP — whenever the card scores from this resource, even when
 *    this particular removal lands inside the same bracket («1 ПО за каждые
 *    две фишки»): silence there would read as «this card scores nothing», the
 *    opposite of true, and it is exactly the comparison the choice is about.
 *    The unmoved reading is marked `static` so it states itself quietly.
 *  · the TOTAL score — only when it actually MOVES, and it is a different
 *    figure from the card's own points, never the same number twice.
 */
export function botAttackPreviewFor(
  vm: BotAttackViewModel,
  card: CardName,
): ReadonlyArray<PlayedTargetPreviewSection> {
  const target = vm.targets.find((t) => t.card === card);
  if (target === undefined) {
    return [];
  }
  const impacts: Array<PlayedTargetImpact> = [{
    label: LABEL_RESOURCES,
    icon: target.icon,
    from: target.resources.from,
    to: target.resources.to,
  }];
  if (target.victoryPoints !== undefined) {
    impacts.push({
      label: LABEL_CARD_VP,
      from: target.victoryPoints.from,
      to: target.victoryPoints.to,
      static: target.victoryPoints.from === target.victoryPoints.to,
    });
  }
  if (target.score !== undefined) {
    impacts.push({label: LABEL_SCORE, from: target.score.from, to: target.score.to});
  }
  return [{key: 'attack', title: SECTION_TARGET, entity: 'target', impacts}];
}

/** The resource badge a candidate face earns — the count the attack moves. */
export function botAttackResourceFor(
  vm: BotAttackViewModel,
  card: CardName,
): PlayedTargetResourceContext | undefined {
  const target = vm.targets.find((t) => t.card === card);
  return target === undefined ?
    undefined :
    {icon: target.icon, count: target.resources.from, showZero: true};
}

/** The VP the player LOSES by choosing this card — the accent delta chip, and
 *  `0` (i.e. «no chip») whenever the removal costs no points at all. */
export function botAttackVpLoss(vm: BotAttackViewModel, card: CardName | undefined): number {
  const target = card === undefined ? undefined : vm.targets.find((t) => t.card === card);
  if (target?.victoryPoints === undefined) {
    return 0;
  }
  return target.victoryPoints.to - target.victoryPoints.from;
}

// ── the pad semantics (pure — the surface only renders and emits) ───────────

/**
 * WHERE THE CURSOR IS. Two zones, because the choice and its confirmation are
 * two deliberate presses on two visibly different rows — the console's own
 * pre-select → commit grammar (`consoleCommitGate`). Selecting a target moves
 * the cursor onto the commit row; the player can always walk back UP to change
 * their mind, and no single stray A can ever remove a resource.
 */
export type BotAttackZone = 'targets' | 'commit';

export type BotAttackPress =
  /** A on a candidate — pre-select it (idempotent). */
  | {kind: 'select', card: CardName}
  /** A on the commit row — the answer leaves for the server. */
  | {kind: 'commit', card: CardName}
  /** X — the focused candidate, fullscreen. */
  | {kind: 'inspectTarget', card: CardName}
  /** L3 — the SOURCE that produced this (console-wide inspection grammar). */
  | {kind: 'inspectSource'}
  /** The degenerate no-targets prompt the protocol lets us answer empty. */
  | {kind: 'skip'}
  /** B — set aside; the prompt stays pending and the chip carries it. */
  | {kind: 'defer'};

export type BotAttackPressInput = {
  vm: BotAttackViewModel;
  zone: BotAttackZone;
  /** The candidate under the cursor (undefined = nothing focusable). */
  focused: CardName | undefined;
  /** The candidate the player has already CHOSEN (undefined = none yet). */
  selected: CardName | undefined;
  /**
   * The console action the press resolved to, plus the ONE pseudo-action the
   * surface adds: `'source'` for L3, which is a raw stick press and therefore
   * has no entry in the shared button→action map (the same way the action
   * composer's verdict reads it).
   */
  action: string | undefined;
  /** An answer is already on its way — a second press must not send another. */
  submitting: boolean;
};

/**
 * What a press MEANS. Kept out of the component on purpose: «does A choose or
 * confirm», «may a second A submit again», «is B a refusal» are decision rules,
 * not rendering — and they are exactly the rules worth guarding.
 *
 * B is NEVER an answer. A mandatory attack cannot be declined, so B sets the
 * prompt aside (it stays pending, the player's chip keeps signalling it) — it
 * never resolves the effect.
 */
export function botAttackPressIntent(o: BotAttackPressInput): BotAttackPress | undefined {
  if (o.action === 'back') {
    return {kind: 'defer'};
  }
  if (o.action === 'source') {
    return o.vm.source.inspectable ? {kind: 'inspectSource'} : undefined;
  }
  if (o.action === 'inspect') {
    return o.focused === undefined ? undefined : {kind: 'inspectTarget', card: o.focused};
  }
  if (o.action !== 'primary' || o.submitting) {
    return undefined;
  }
  if (o.vm.empty) {
    return o.vm.skippable ? {kind: 'skip'} : undefined;
  }
  if (o.zone === 'commit') {
    return o.selected === undefined ? undefined : {kind: 'commit', card: o.selected};
  }
  return o.focused === undefined ? undefined : {kind: 'select', card: o.focused};
}

/**
 * The pad contract this screen publishes to the ONE command bar. The A-verb is
 * the honest difference between «this chooses a target» and «this removes the
 * resource», so a player can never confirm while believing they are still
 * browsing.
 */
export function botAttackCommandKeys(
  vm: BotAttackViewModel,
  zone: BotAttackZone,
  selected: CardName | undefined,
): Array<string> {
  if (vm.empty) {
    return vm.skippable ? [VERB_CONTINUE, VERB_MINIMIZE] : [VERB_MINIMIZE];
  }
  const keys: Array<string> = [VERB_NAVIGATE];
  keys.push(zone === 'commit' && selected !== undefined ? vm.commitVerbKey : VERB_CHOOSE_TARGET);
  keys.push(VERB_INSPECT_CARD);
  if (vm.source.inspectable) {
    keys.push(VERB_INSPECT_SOURCE);
  }
  keys.push(VERB_MINIMIZE);
  return keys;
}
