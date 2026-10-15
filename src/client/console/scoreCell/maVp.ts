/*
 * THE MILESTONE / AWARD'S POINTS FLY FROM ITS CEREMONY (TR55 — docs/claude/console/score-cell.md).
 *
 * A claimed milestone's +5, a funded award's place: the score cell used to tick
 * in the frame the view applied while the ceremony was still crowning the
 * emblem. Claimed at the press (beside the ceremony's own arm), held by the
 * ledger, and born — once the ceremony has said it — on the ceremony's printed
 * «+5 ПО» (an award: the emblem's seat), flying to the score cell; the
 * surface lets go only after the token has LEFT it (PL-142's law).
 */
import {MaKind} from '@/client/components/ma/maArt';
import {motionMs} from '@/client/components/motion/motionTokens';
import {TRANSFER_POP_MS, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {claimVpShares, dropVpClaim, flyVpShares, holdsVpShares, releaseVpShares} from '@/client/console/scoreCell/vpShareLedger';

export const MA_VP_OWNER = 'ma-ceremony';
const MA_VP_RANK = 5;

/** The ceremony's own anchors, most specific first — the embedded stage's and the global shell's. */
export const MA_VP_SOURCES: Readonly<Record<MaKind, ReadonlyArray<string>>> = {
  milestone: ['.con-mafocus__cere-vp', '.con-macere__vp'],
  award: ['[data-ma-cere-seat]', '.con-macere__stage'],
};

/** The press: the milestone's / award's share is the ceremony's to show. */
export function claimMaVp(kind: MaKind, name: string): void {
  claimVpShares(MA_VP_OWNER, (share) =>
    (kind === 'milestone' && share.source.kind === 'milestone' && share.source.name === name) ||
    (kind === 'award' && share.source.kind === 'award' && share.source.name === name), MA_VP_RANK);
}

/** A refused / abandoned claim: whatever it held ticks now, named, and the claim ends. */
export function dropMaVp(why: string): void {
  releaseVpShares(MA_VP_OWNER, {why});
  dropVpClaim(MA_VP_OWNER);
}

function originOf(kind: MaKind): TransferPoint | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  for (const selector of MA_VP_SOURCES[kind]) {
    const el = document.querySelector<HTMLElement>(selector);
    const r = el?.getBoundingClientRect();
    if (r !== undefined && r.width > 4 && r.height > 4) {
      return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    }
  }
  return undefined;
}

/**
 * The ceremony has spoken: the token is born on its printed line and flies to the score cell. Resolves once the
 * token has LEFT the ceremony (its pop) — the caller's surface may leave then; the cell ticks at the touchdown.
 */
export function flyMaVp(kind: MaKind): Promise<void> {
  if (!holdsVpShares(MA_VP_OWNER)) {
    dropVpClaim(MA_VP_OWNER);
    return Promise.resolve();
  }
  const origin = originOf(kind);
  void flyVpShares(MA_VP_OWNER, () => origin).then(() => dropMaVp('the ceremony\'s token ended'));
  return new Promise((resolve) => window.setTimeout(resolve, motionMs(TRANSFER_POP_MS)));
}
