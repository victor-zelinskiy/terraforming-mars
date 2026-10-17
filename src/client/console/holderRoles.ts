/*
 * @console-shared LIVE — THE ROLE OF A HOLDER: what a card's stored resource
 * is FOR (PL-030 / PL-075, the TR34 walk — `common/cards/holderRole.ts`;
 * PL-135 / PL-136, the TR40 walk).
 *
 * ONE reading, two consumers: the ДОП. РЕСУРСЫ satellite splits a resource
 * type's chip by it («[mech] 1 · 5 M€» beside «[mech] 2 · delegates» — never
 * three mechs under one coin when two of them buy delegates), and the
 * played-target step prints it under a candidate («a delegate on a resolution
 * per unit» — the value the counter alone never said). Pure, manifest-read,
 * no card name anywhere: a PAYMENT role is the enabling card of a spendable
 * unit, a VP role is the card's own printed `resourcesHere` rule, DELEGATE
 * and TRADE are the card's declaration, an ACTION role is what the card's own
 * declarative action buys with the resource (derived at export time —
 * `server/cards/holderActionGood.ts`), everything else is plain STORAGE.
 */
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ActionGood, ActionGoodTile, actionGoodsOf, actionGoodSetOf, isActionGoodSet, roleGoodsOf} from '@/common/cards/holderRole';
import {DEFAULT_PAYMENT_VALUES} from '@/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES, SpendableCardResource} from '@/common/inputs/Spendable';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CONTEXT_FOR_CARD_UNIT, MC_CONTEXT_KEYS, RailMcContext} from '@/client/console/railValueModel';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

export type HolderRole =
  /** The enabling card of a payment unit — one unit pays `rate` M€ where `context` says. */
  | {kind: 'payment', unit: SpendableCardResource, rate: number, context: RailMcContext}
  /** The card's printed «VP per resources here» rule. */
  | {kind: 'vp', per: number, each: number}
  /** The card's declaration: `price` units of the resource buy a delegate on a resolution. */
  | {kind: 'delegate', price: number}
  /** The card's declaration: `price` units of the resource buy a free trade. */
  | {kind: 'trade', price: number}
  /**
   * The card's own action: `spend` units off this card buy `good` (PL-135) — or, a CHOICE at one price (PL-484), any
   * ONE of `good` and `or`. Read the set through `actionGoodsOf`, never `good` alone.
   */
  | {kind: 'action', spend: number | 'all', good: ActionGood, or?: ReadonlyArray<ActionGood>, with?: ReadonlyArray<ActionGood>}
  /** Storage with no role the console can name. */
  | {kind: 'store'};

export type HolderRoleKind = HolderRole['kind'];

/**
 * The role of the resource a card stores — `store` for a card the manifest does not know.
 * PRECEDENCE: the card's declaration, then a payment unit, then a printed VP rule, then the action's good —
 * EVA Mechs stay tender and Mech Sports stay VP whatever their actions say.
 */
export function holderRoleOf(name: CardName): HolderRole {
  const card = getCard(name);
  if (card === undefined) {
    return {kind: 'store'};
  }
  if (card.resourceRole !== undefined) {
    return card.resourceRole;
  }
  const unit = SPENDABLE_CARD_RESOURCES.find((u) => CARD_FOR_SPENDABLE_RESOURCE[u] === name);
  if (unit !== undefined) {
    return {kind: 'payment', unit, rate: DEFAULT_PAYMENT_VALUES[unit], context: CONTEXT_FOR_CARD_UNIT[unit]};
  }
  const vp = card.victoryPoints;
  if (typeof vp === 'object' && vp.resourcesHere !== undefined) {
    return {kind: 'vp', per: vp.per ?? 1, each: vp.each ?? 1};
  }
  if (card.actionGood !== undefined) {
    const {spend, good, or, with: together} = card.actionGood;
    return {
      kind: 'action', spend, good,
      ...(or === undefined || or.length === 0 ? {} : {or}),
      ...(together === undefined || together.length === 0 ? {} : {with: together}),
    };
  }
  return {kind: 'store'};
}

/**
 * A role CLAIMS something about every unit — it is tender, it buys a
 * delegate, it buys a trade, it buys the action's good — or it does not: a VP
 * rule and plain storage are what a stored resource IS by default, so they
 * stay ONE plain chip (Tardigrades beside Nitrite Reducing Bacteria is still
 * «microbes»), and only a claiming role stands apart from it.
 */
export function holderRoleClaims(kind: HolderRoleKind): boolean {
  return kind === 'payment' || kind === 'delegate' || kind === 'trade' || kind === 'action';
}

/**
 * The satellite / explorer KEY of a holder group: the resource's own key
 * for the plain group and for a type that is not split (every consumer's
 * address stays what it was), the resource and the role for a claiming role
 * of a split type — and the UNIT too for a payment role when two tender
 * pools of one resource stand on the table (PL-136: EVA's Space mechs beside
 * Construction Mechs' Building mechs are two coins, not one).
 */
export function holderGroupKey(resource: CardResource, role: HolderRole | undefined, split: boolean, unitSplit = false, goodSplit = false): string {
  const base = cardResourceKey(resource);
  if (!split || role === undefined || !holderRoleClaims(role.kind)) {
    return base;
  }
  if (role.kind === 'payment' && unitSplit) {
    return `${base}:${role.kind}:${role.unit}`;
  }
  if (role.kind === 'action' && goodSplit) {
    return `${base}:${role.kind}:${actionRoleGoodKey(role)}`;
  }
  return `${base}:${role.kind}`;
}

/**
 * The identity of an action's GOOD — what tells two action holders of one resource apart (PL-223, the TR50 walk:
 * Forestry Mechs' «1 mech → plant production» and Expedition Mechs' «1 mech → a card» were ONE chip «[mech] 3» under
 * the FIRST holder's plant plate, so the satellite promised plant production for a mech that buys a card). One good,
 * one key: the same production of the same resource, the same draw (its tag filter included), the same parameter.
 */
export function actionGoodKey(good: ActionGood): string {
  switch (good.kind) {
  case 'production':
  case 'stock':
    return `${good.kind}-${good.resource}`;
  case 'cards':
    return good.tag === undefined ? 'cards' : `cards-${good.tag}`;
  case 'global':
    return `global-${good.parameter}`;
  case 'tile':
    return `tile-${good.tile}`;
  default:
    return good.kind;
  }
}

/**
 * The identity of an action role's WHOLE set of goods (PL-484) — a choice is its own lane: TR57's «steel OR titanium
 * production» beside a holder that buys steel production alone are two different promises, never one chip. A SET
 * (TR60 — «+1 M€ production AND 3 M€») is its own lane too, keyed apart from a choice of the same goods.
 */
export function actionRoleGoodKey(role: {good: ActionGood, or?: ReadonlyArray<ActionGood>, with?: ReadonlyArray<ActionGood>}): string {
  return isActionGoodSet(role) ? actionGoodSetOf(role).map(actionGoodKey).join('+') : actionGoodsOf(role).map(actionGoodKey).join('|');
}

/** A CHOICE of goods at one price (PL-484): more than one good. */
export function holderRoleIsChoice(role: HolderRole): boolean {
  return role.kind === 'action' && actionGoodsOf(role).length > 1;
}

/** A SET of goods at one price (TR60): ONE press buys more than one good. */
export function holderRoleIsSet(role: HolderRole): boolean {
  return role.kind === 'action' && isActionGoodSet(role);
}

/**
 * How a role's several icons are JOINED where they are drawn on one plate — «or» for a choice («[steel-pr] /
 * [titanium-pr]», PL-484), «and» for a set («[M€-pr] + [M€]», TR60). One reading for every host (the satellite's
 * badge, the target step's value line and tag, the answered row) — never a host's own guess from the icon count.
 */
export function holderRoleJoin(role: HolderRole): 'or' | 'and' {
  return holderRoleIsSet(role) ? 'and' : 'or';
}

/** The chip's one-word caption of a role (an i18n key) — only the roles the console names; `store` has none. */
export const HOLDER_ROLE_CAPTION: Readonly<Record<Exclude<HolderRoleKind, 'store' | 'action'>, string>> = {
  payment: 'money',
  vp: 'VP',
  delegate: 'Delegates',
  trade: 'trade',
};

/** The action role's caption is its GOOD's family word (i18n keys). */
export const ACTION_GOOD_CAPTION: Readonly<Record<ActionGood['kind'], string>> = {
  production: 'production',
  stock: 'resources',
  cards: 'cards',
  tr: 'TR',
  global: 'terraforming',
  look: 'cards',
  // TR61: the mech buys a REPEAT of a used action — the family word is the repeat family's own (the bridge's kicker).
  repeat: 'Repeat action',
  // TR69: the floaters buy a TILE on Mars.
  tile: 'Tile',
};

/** The caption of a role — `undefined` for plain storage. */
export function holderRoleCaption(role: HolderRole): string | undefined {
  switch (role.kind) {
  case 'store':
    return undefined;
  case 'action': {
    // A choice of one family speaks the family's word («production» for steel OR titanium production); a choice
    // across families has no one word but the action's own.
    const kinds = new Set(roleGoodsOf(role).map((g) => g.kind));
    return kinds.size === 1 ? ACTION_GOOD_CAPTION[role.good.kind] : 'Action';
  }
  default:
    return HOLDER_ROLE_CAPTION[role.kind];
  }
}

/** The icon a role badge carries (the shared icon vocabulary); the VP role carries its own shield instead. */
export const HOLDER_ROLE_ICON: Readonly<Partial<Record<HolderRoleKind, string>>> = {
  payment: 'megacredits',
  delegate: 'delegate',
  trade: 'trade',
};

/** The icon of an action's good — the resource it moves, the card, the rating, the parameter. */
export function actionGoodIcon(good: ActionGood): string {
  switch (good.kind) {
  case 'production':
  case 'stock':
    return good.resource;
  case 'cards':
  case 'look':
    return 'cards';
  case 'tr':
    return 'tr';
  case 'global':
    return good.parameter;
  case 'repeat':
    // The printed ACTION plate (`action-replay`) — the icon Project Inspection's block and TR61's row carry.
    return 'action-replay';
  case 'tile':
    // The printed TILE itself (TR69's greenery with its oxygen dot) — `wgt-icon--<tile>`.
    return good.tile;
  }
}

/** The icon of a role — the (first) good's own for an action role, the vocabulary's for the rest. */
export function holderRoleIcon(role: HolderRole): string | undefined {
  return role.kind === 'action' ? actionGoodIcon(role.good) : HOLDER_ROLE_ICON[role.kind];
}

/**
 * EVERY icon a role shows (PL-484): one for every role but a CHOICE or a SET, whose goods are ALL drawn, in the
 * printed order, joined by the role's own joint (`holderRoleJoin`) — «[steel-pr] / [titanium-pr]», «[M€-pr] + [M€]»,
 * never the first good standing for the lot.
 */
export function holderRoleIcons(role: HolderRole): ReadonlyArray<string> {
  if (role.kind === 'action') {
    return roleGoodsOf(role).map(actionGoodIcon);
  }
  const icon = HOLDER_ROLE_ICON[role.kind];
  return icon === undefined ? [] : [icon];
}

/** A production good rides the PRODUCTION PLATE (the card art's brown box) wherever its icon is drawn — a choice / a set only when EVERY good does. */
export function holderRolePlate(role: HolderRole): 'production' | undefined {
  return role.kind === 'action' && roleGoodsOf(role).every((g) => g.kind === 'production') ? 'production' : undefined;
}

/**
 * The plate of EACH icon (`holderRoleIcons`' order) when the goods do not share one — a SET of a production step and a
 * stock gain (TR60: the brown box under the first M€, none under the second). Undefined when one plate (or none)
 * stands for every icon: `holderRolePlate` says it.
 */
export function holderRoleIconPlates(role: HolderRole): ReadonlyArray<'production' | undefined> | undefined {
  if (role.kind !== 'action') {
    return undefined;
  }
  const plates = roleGoodsOf(role).map((g) => g.kind === 'production' ? 'production' as const : undefined);
  return plates.every((p) => p === plates[0]) ? undefined : plates;
}

/**
 * HOW the role's icon list is drawn, as fields to spread beside `icons` on a reading / a tag (TR60): the joint of a
 * SET («+») and the plate of each icon when the goods do not share one. Empty for a choice and a single good — their
 * `plate` says everything.
 */
export function holderRoleIconSpread(role: HolderRole): {join?: 'and', plates?: ReadonlyArray<'production' | undefined>} {
  const plates = holderRoleIconPlates(role);
  return {...(holderRoleJoin(role) === 'and' ? {join: 'and' as const} : {}), ...(plates === undefined ? {} : {plates})};
}

/** The amount an action's good moves — the label's second number. */
export function actionGoodAmount(good: ActionGood): number {
  // A repeat has no count — ONE action performed again; a tile is ONE tile.
  return good.kind === 'global' ? good.steps : good.kind === 'look' ? good.keep : good.kind === 'repeat' || good.kind === 'tile' ? 1 : good.amount;
}

/** The tail phrase after an action good's amount (an i18n key) — what the «+N» is of. */
export function actionGoodTail(good: ActionGood): string | undefined {
  switch (good.kind) {
  case 'production':
    return 'production';
  case 'stock':
    return undefined;
  case 'cards':
    return good.tag === undefined ? (good.amount === 1 ? 'card' : 'cards') : 'card with the ${0} tag';
  case 'tr':
    return 'TR';
  case 'global':
    return good.parameter;
  case 'look':
    return undefined;
  case 'repeat':
    return 'repeat of a used action';
  case 'tile':
    return TILE_GOOD_TAIL[good.tile];
  }
}

/** The tail of a TILE good — the tile's own word (TR69). */
const TILE_GOOD_TAIL: Readonly<Record<ActionGoodTile, string>> = {
  greenery: 'greenery tile',
  ocean: 'ocean tile',
  city: 'city tile',
};

/** The value line of a TILE good — «Spend 3 from here: a greenery tile» (one tile, no «+N»; TR69). */
const TILE_GOOD_READING: Readonly<Record<ActionGoodTile, string>> = {
  greenery: 'Spend ${0} from here: a greenery tile',
  ocean: 'Spend ${0} from here: an ocean tile',
  city: 'Spend ${0} from here: a city tile',
};

/**
 * THE VALUE LINE of a role — what ONE unit of the resource is worth on this
 * holder, for the target step's rail and the badge's aria: an i18n key, its
 * number params, and a TAIL phrase (its own key — the payment's «where», the
 * action good's «of what», translated beside the label). Undefined for `vp`
 * (the VP line is the step's own, authoritative, per candidate) and for `store`.
 */
export type HolderRoleReading = {
  label: string;
  /**
   * The label's `${n}` params — REQUIRED, never optional (PL-160): a reading
   * whose params are a «maybe» is a reading one renderer forgets, and the TV
   * then prints «Потратьте ${0} отсюда: +${1}». Empty for a key without
   * placeholders. Rendered by `readingText` and nowhere else.
   */
  params: ReadonlyArray<string>;
  tail?: string;
  tailParams?: ReadonlyArray<string>;
};

export function holderRoleReading(role: HolderRole): HolderRoleReading | undefined {
  switch (role.kind) {
  case 'payment':
    return {label: 'Pays ${0} M€ per unit', params: [String(role.rate)], tail: MC_CONTEXT_KEYS[role.context]};
  case 'delegate':
    // The census asks THREE data a delegate — «per unit» was a lie on its value line (TR48 walk).
    return role.price === 1 ?
      {label: 'A delegate on a resolution per unit', params: []} :
      {label: 'A delegate on a resolution per ${0} units', params: [String(role.price)]};
  case 'trade':
    return role.price === 1 ?
      {label: 'A free trade per unit', params: []} :
      {label: 'A free trade per ${0} units', params: [String(role.price)]};
  case 'action': {
    if (role.good.kind === 'look') {
      // TR46: every unit here is one more card turned over; the action keeps `keep` of them.
      return {label: 'All from here: as many cards off the deck, ${0} to the hand', params: [String(role.good.keep)]};
    }
    if (role.good.kind === 'repeat') {
      // TR61: the spend buys ONE repeat of an already-used action — no «+N», the good is a verb.
      return {label: 'Spend ${0} from here: repeat a used action', params: [String(role.spend)]};
    }
    if (role.good.kind === 'tile' && actionGoodsOf(role).length === 1 && !isActionGoodSet(role)) {
      // TR69: the spend buys ONE tile on Mars — the tile named, no «+1».
      return {label: TILE_GOOD_READING[role.good.tile], params: [String(role.spend)]};
    }
    if (isActionGoodSet(role)) {
      // A SET at one price (TR60): «Spend 1 from here: +1 and +3 at once» beside the goods' icons in the same order —
      // every number a digit, nothing translated inside a param; a set of more than two joins its amounts.
      const amounts = actionGoodSetOf(role).map((g) => String(actionGoodAmount(g)));
      return amounts.length === 2 ?
        {label: 'Spend ${0} from here: +${1} and +${2}', params: [String(role.spend), amounts[0], amounts[1]], tail: 'at once'} :
        {label: 'Spend ${0} from here: +${1}', params: [String(role.spend), amounts.join(' + ')], tail: 'at once'};
    }
    const goods = actionGoodsOf(role);
    if (goods.length > 1) {
      // A CHOICE at one price (PL-484): «Spend 2 from here: +1 production of your choice» beside the goods' icons, or
      // «+2 / 3 / 4 of your choice» when the amounts differ (in the icons' order) — the numbers are digits, the words
      // one tail, nothing translated inside a param.
      const amounts = goods.map((g) => String(actionGoodAmount(g)));
      const same = amounts.every((a) => a === amounts[0]);
      return {
        label: 'Spend ${0} from here: +${1}',
        params: [String(role.spend), same ? amounts[0] : amounts.join(' / ')],
        tail: goods.every((g) => g.kind === 'production') ? 'production of your choice' : 'of your choice',
      };
    }
    const tail = actionGoodTail(role.good);
    const tag = role.good.kind === 'cards' ? role.good.tag : undefined;
    return {
      label: 'Spend ${0} from here: +${1}',
      params: [String(role.spend), String(actionGoodAmount(role.good))],
      ...(tail === undefined ? {} : {tail}),
      ...(tag === undefined ? {} : {tailParams: [tag]}),
    };
  }
  default:
    return undefined;
  }
}

// ── WHAT A GAIN DOES HERE (К-T1, TR48 — the owner's decision 2026-10-12) ─────────────

/**
 * WHAT +N UNITS DO ON THIS HOLDER — the reading a «put N on ANY card» target step
 * prints for the candidate (Supercomputer's «+2 data on ANY card», the
 * Scientists' «2 data or 2 microbes», Supreme Expertise's 4 data, Ichtiology
 * Grant's animals / microbes …). The ROLE says what one unit is worth; this says
 * what THIS gain changes, which is the decision «where do the N go»:
 *
 *  · tender (`payment`) — the money it becomes: «+4 M€ · for Science cards»;
 *  · a PRICED good (a delegate, a free trade, the card's own action at a numeric
 *    spend) — the threshold, read against the price the card itself declares:
 *    within reach now / still m short / already within reach before the gain;
 *  · a LOOK (TR46 — every unit is one more card turned over) — the count it grows to.
 *
 * VP is the step's own authoritative line (`vpBox`, the server's arithmetic) and
 * plain storage has nothing to add — both answer `undefined`. Every number comes
 * from the role (manifest) and the candidate's `current → resulting`; the client
 * compares with the role's price and restates no rule.
 */
export type HolderGainOutcome =
  | {kind: 'money', amount: number, context: RailMcContext}
  | {kind: 'reach', good: 'delegate' | 'trade' | 'action', role: HolderRole, have: number, need: number, state: 'opens' | 'short' | 'already'}
  | {kind: 'look', from: number, to: number};

export function holderGainOutcome(role: HolderRole, from: number, to: number): HolderGainOutcome | undefined {
  if (to <= from) {
    return undefined;
  }
  const reach = (good: 'delegate' | 'trade' | 'action', need: number): HolderGainOutcome => ({
    kind: 'reach', good, role, have: to, need,
    state: from >= need ? 'already' : to >= need ? 'opens' : 'short',
  });
  switch (role.kind) {
  case 'payment':
    return {kind: 'money', amount: (to - from) * role.rate, context: role.context};
  case 'delegate':
  case 'trade':
    return reach(role.kind, role.price);
  case 'action':
    return role.spend === 'all' ? {kind: 'look', from, to} : reach('action', role.spend);
  default:
    return undefined;
  }
}

/** The reading keys of a priced good, per state — the good's own word in each (the RU noun declines). */
const REACH_READING: Readonly<Record<'delegate' | 'trade' | 'action', Readonly<Record<'opens' | 'short' | 'already', string>>>> = {
  delegate: {
    opens: 'A delegate within reach: ${0} / ${1}',
    short: '${2} more to a delegate: ${0} / ${1}',
    already: 'A delegate already within reach: ${0} / ${1}',
  },
  trade: {
    opens: 'A free trade within reach: ${0} / ${1}',
    short: '${2} more to a free trade: ${0} / ${1}',
    already: 'A free trade already within reach: ${0} / ${1}',
  },
  action: {
    opens: 'The action opens: ${0} / ${1}',
    short: '${2} more to the action: ${0} / ${1}',
    already: 'The action is already open: ${0} / ${1}',
  },
};

/**
 * The outcome as a READING (an i18n key + its params + a tail, rendered by
 * `readingText` alone — PL-160): the money with its «where», a threshold with its
 * fraction, a look with the count it grows to.
 */
export function holderGainOutcomeReading(outcome: HolderGainOutcome): HolderRoleReading {
  switch (outcome.kind) {
  case 'money':
    return {label: 'Payment: +${0} M€', params: [String(outcome.amount)], tail: MC_CONTEXT_KEYS[outcome.context]};
  case 'reach': {
    const fraction = [String(outcome.have), String(outcome.need)];
    // Only «still short» names what is missing — exactly the params each key prints.
    return {
      label: REACH_READING[outcome.good][outcome.state],
      params: outcome.state === 'short' ? [...fraction, String(outcome.need - outcome.have)] : fraction,
    };
  }
  case 'look':
    return {label: 'Cards turned over: ${0} → ${1}', params: [String(outcome.from), String(outcome.to)]};
  }
}

/**
 * WHAT A LOSS COSTS THE HOLDER (PL-267, TR52 — «remove 2 data from ANY player's card», the owner's decision
 * 2026-10-13). The mirror of `holderGainOutcome` for resources LEAVING a holder: on an attack's target step a rival's
 * card read only its static role («делегат на резолюцию за 3 единицы»), and the decision — whose census loses a
 * READY delegate, whose Supercomputer loses 4 M€ of Science payment — was not on the screen. The same roles, the same
 * prices, the other direction: a priced good the holder HAD within reach and no longer has (`lost`), still has
 * (`kept`), or was short of and is now further from (`further`); tender's money lost; a look's count falling. The
 * client compares with the role's own price only — never a rule of its own.
 */
export type HolderLossOutcome =
  | {kind: 'money', amount: number, context: RailMcContext}
  | {kind: 'reach', good: 'delegate' | 'trade' | 'action', role: HolderRole, from: number, to: number, need: number, state: 'lost' | 'kept' | 'further'}
  | {kind: 'look', from: number, to: number};

export function holderLossOutcome(role: HolderRole, from: number, to: number): HolderLossOutcome | undefined {
  if (to >= from) {
    return undefined;
  }
  const reach = (good: 'delegate' | 'trade' | 'action', need: number): HolderLossOutcome => ({
    kind: 'reach', good, role, from, to, need,
    state: from >= need ? (to >= need ? 'kept' : 'lost') : 'further',
  });
  switch (role.kind) {
  case 'payment':
    return {kind: 'money', amount: (from - to) * role.rate, context: role.context};
  case 'delegate':
  case 'trade':
    return reach(role.kind, role.price);
  case 'action':
    return role.spend === 'all' ? {kind: 'look', from, to} : reach('action', role.spend);
  default:
    return undefined;
  }
}

/** The reading keys of a priced good LOST, per state — the good's own word in each (the RU noun declines). */
const LOSS_READING: Readonly<Record<'delegate' | 'trade' | 'action', Readonly<Record<'lost' | 'kept' | 'further', string>>>> = {
  delegate: {
    lost: 'No longer a delegate within reach: ${0} → ${1} / ${2}',
    kept: 'A delegate still within reach: ${0} → ${1} / ${2}',
    further: 'Further from a delegate: ${0} → ${1} / ${2}',
  },
  trade: {
    lost: 'No longer a free trade within reach: ${0} → ${1} / ${2}',
    kept: 'A free trade still within reach: ${0} → ${1} / ${2}',
    further: 'Further from a free trade: ${0} → ${1} / ${2}',
  },
  action: {
    lost: 'The action closes: ${0} → ${1} / ${2}',
    kept: 'The action stays open: ${0} → ${1} / ${2}',
    further: 'Further from the action: ${0} → ${1} / ${2}',
  },
};

/** The reading of a loss outcome — one key per kind and state, its params exactly the placeholders it prints. */
export function holderLossOutcomeReading(outcome: HolderLossOutcome): HolderRoleReading {
  switch (outcome.kind) {
  case 'money':
    return {label: 'Payment: −${0} M€', params: [String(outcome.amount)], tail: MC_CONTEXT_KEYS[outcome.context]};
  case 'reach':
    return {label: LOSS_READING[outcome.good][outcome.state], params: [String(outcome.from), String(outcome.to), String(outcome.need)]};
  case 'look':
    return {label: 'Cards turned over: ${0} → ${1}', params: [String(outcome.from), String(outcome.to)]};
  }
}

/** The icon an outcome reading wears: the coin, the good's own icon (a delegate, a trade, the action's good), the cards. */
export function holderGainOutcomeIcon(outcome: HolderGainOutcome | HolderLossOutcome): string | undefined {
  switch (outcome.kind) {
  case 'money':
    return 'megacredits';
  case 'reach':
    return holderRoleIcon(outcome.role);
  case 'look':
    return 'cards';
  }
}

/** EVERY icon an outcome reading wears — a CHOICE role's whole set (PL-484); one icon for the rest. */
export function holderGainOutcomeIcons(outcome: HolderGainOutcome | HolderLossOutcome): ReadonlyArray<string> {
  if (outcome.kind === 'reach') {
    return holderRoleIcons(outcome.role);
  }
  const icon = holderGainOutcomeIcon(outcome);
  return icon === undefined ? [] : [icon];
}
