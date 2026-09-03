import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {Resource} from '../../src/common/Resource';
import {IGame} from '../../src/server/IGame';
import {NotificationModel} from '../../src/client/components/notifications/notificationTypes';

/**
 * THE INDEPENDENT STATE-CHANGE ORACLE.
 *
 * The notification system's own metadata (events, `affects`, `viewerImpact`)
 * must never be the only proof of its correctness — a producer that forgets to
 * record a mutation produces streams that agree with the empty delivery. This
 * oracle reads the GAME OBJECTS THEMSELVES (stock / production / TR — the
 * gameplay-relevant per-player state) before and after a real door, derives
 * the non-actor players who actually changed, and cross-checks those changes
 * against the recipient-specific bands the REAL consumer presented:
 *
 *  - a real cross-player delta with no matching band  → SILENT MUTATION;
 *  - a band claiming a delta that did not happen      → PHANTOM NOTIFICATION;
 *  - a band whose magnitude differs from the delta    → WRONG DELTA;
 *  - a personal-sign band on an untouched viewer      → WRONG RECIPIENT;
 *  - two bands for one correlation on one viewer      → DUPLICATE.
 *
 * Scope: the six stock resources, the six productions and TR — the dimensions
 * both sides express losslessly. Cards drawn / card resources ride the same
 * bands but have legitimate hidden-information asymmetries, so they are
 * deliberately outside this oracle's strict ledger (the corpus specs assert
 * them per scenario).
 */

const RESOURCES: ReadonlyArray<Resource> = [
  Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM,
  Resource.PLANTS, Resource.ENERGY, Resource.HEAT,
];

export type PlayerLedger = {
  stock: Record<Resource, number>;
  production: Record<Resource, number>;
  tr: number;
};

export type GameLedger = Map<Color, PlayerLedger>;

/** Read the authoritative per-player state straight off the game objects. */
export function captureLedger(game: IGame): GameLedger {
  const out: GameLedger = new Map();
  for (const p of game.players) {
    const stock = {} as Record<Resource, number>;
    const production = {} as Record<Resource, number>;
    for (const r of RESOURCES) {
      stock[r] = p.stock[r as keyof typeof p.stock] as number;
      production[r] = p.production[r as keyof typeof p.production] as number;
    }
    out.set(p.color, {stock, production, tr: p.terraformRating});
  }
  return out;
}

/** One player's real change on one oracle dimension. */
export type LedgerDelta = {scope: 'stock' | 'production' | 'tr'; resource: Resource | 'tr'; amount: number};

export function deltasOf(before: GameLedger, after: GameLedger): Map<Color, Array<LedgerDelta>> {
  const out = new Map<Color, Array<LedgerDelta>>();
  for (const [color, b] of before) {
    const a = after.get(color);
    if (a === undefined) {
      continue;
    }
    const deltas: Array<LedgerDelta> = [];
    for (const r of RESOURCES) {
      if (a.stock[r] !== b.stock[r]) {
        deltas.push({scope: 'stock', resource: r, amount: a.stock[r] - b.stock[r]});
      }
      if (a.production[r] !== b.production[r]) {
        deltas.push({scope: 'production', resource: r, amount: a.production[r] - b.production[r]});
      }
    }
    if (a.tr !== b.tr) {
      deltas.push({scope: 'tr', resource: 'tr', amount: a.tr - b.tr});
    }
    if (deltas.length > 0) {
      out.set(color, deltas);
    }
  }
  return out;
}

/** Parse one viewer-impact chip back into the oracle's ledger dimensions.
 *  Chips outside the ledger (cards, card resources, …) return undefined. */
function chipToDelta(chip: {icon: string; text: string; production?: boolean}, sign: 1 | -1): LedgerDelta | undefined {
  const amount = Number(chip.text.replace('−', '-').replace('+', ''));
  if (!Number.isFinite(amount) || amount === 0) {
    return undefined;
  }
  if (chip.icon === 'tr') {
    return {scope: 'tr', resource: 'tr', amount: sign * Math.abs(amount)};
  }
  if ((RESOURCES as ReadonlyArray<string>).includes(chip.icon)) {
    return {
      scope: chip.production === true ? 'production' : 'stock',
      resource: chip.icon as Resource,
      amount: sign * Math.abs(amount),
    };
  }
  return undefined;
}

/** Sum a band list's claims per ledger dimension for its viewer. */
function claimedDeltas(bands: ReadonlyArray<NotificationModel>): Map<string, number> {
  const out = new Map<string, number>();
  for (const band of bands) {
    const impact = band.viewerImpact;
    if (impact === undefined) {
      continue;
    }
    for (const chip of impact.gains) {
      const d = chipToDelta(chip, 1);
      if (d !== undefined) {
        const key = `${d.scope}:${d.resource}`;
        out.set(key, (out.get(key) ?? 0) + d.amount);
      }
    }
    for (const chip of impact.losses) {
      const d = chipToDelta(chip, -1);
      if (d !== undefined) {
        const key = `${d.scope}:${d.resource}`;
        out.set(key, (out.get(key) ?? 0) + d.amount);
      }
    }
  }
  return out;
}

export type OracleInput = {
  /** The acting player — their own deltas need no self-notification. */
  actor: Color;
  before: GameLedger;
  after: GameLedger;
  /** What each viewer's REAL consumer presented for this door (correlation-
   *  filtered by the caller when the door is one correlation; otherwise all). */
  presentedFor: (viewer: Color) => ReadonlyArray<NotificationModel>;
  /** Every player in the game. */
  players: ReadonlyArray<Color>;
  /** Door label for failure messages. */
  door: string;
};

/**
 * The invariant, checked by COMPARISON of independent sources: «если действие
 * actor A приводит к реальному gameplay-relevant изменению состояния другого
 * игрока P, игрок P должен получить ровно одну корректную нотификацию».
 */
export function verifyCrossPlayerDelivery(input: OracleInput): void {
  const deltas = deltasOf(input.before, input.after);
  for (const viewer of input.players) {
    if (viewer === input.actor) {
      continue;
    }
    const real = deltas.get(viewer) ?? [];
    const bands = input.presentedFor(viewer);
    const personal = bands.filter((b) => b.sign !== 'neutral');
    const claims = claimedDeltas(personal);

    if (real.length === 0) {
      // No real change → no personal-sign band may exist (phantom check), and
      // no ledger-dimension claim may exist on any band.
      expect(personal.length,
        `[${input.door}] viewer ${viewer}: personal band(s) with NO real state change ` +
        `(claims: ${JSON.stringify([...claims])})`).eq(0);
      continue;
    }

    // Every real delta must be claimed with the exact magnitude…
    for (const d of real) {
      const key = `${d.scope}:${d.resource}`;
      expect(claims.get(key) ?? 0,
        `[${input.door}] viewer ${viewer}: real change ${key} ${d.amount > 0 ? '+' : ''}${d.amount} ` +
        `vs delivered claim ${claims.get(key) ?? 0} — silent mutation or wrong delta ` +
        `(bands: ${bands.map((b) => `${b.id}/${b.sign}`).join(', ') || 'none'})`).eq(d.amount);
    }
    // …and no claim may exist without a real delta behind it.
    for (const [key, amount] of claims) {
      const match = real.find((d) => `${d.scope}:${d.resource}` === key);
      expect(match?.amount ?? 0,
        `[${input.door}] viewer ${viewer}: band claims ${key} ${amount} with no matching real change`).eq(amount);
    }
    // One correlation → at most one band per viewer (no duplicates).
    const corrIds = personal.map((b) => b.correlationId).filter((c) => c !== undefined);
    expect(new Set(corrIds).size,
      `[${input.door}] viewer ${viewer}: duplicate bands for one correlation`).eq(corrIds.length);
  }
}
