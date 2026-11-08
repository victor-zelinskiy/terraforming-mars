// Campaign «ТЕНДЕРЫ» — the ART of the Committee's contracts (the face's third
// pass, 2026-11-08). ONE compact, recognisable subject per KIND — a single
// object on a calm ground the player names at a glance, never a scene
// (the owner: «компактный и узнаваемый, без сложных композиций»). The window
// on the face is 4 : 3; the file lives at `assets/campaign/tenders/<id>.webp`
// (`node scripts/import-tender-art.mjs <id>` — crop, size, WebP) and the brief
// that produced it in `docs/claude/campaign/tender-face.md` §5.
//
// A kind joins this table only once its file EXISTS: until then the face
// engraves the family glyph in the window (a placeholder by construction —
// never an empty box, never a 404 on the table). The compiler refuses an id
// that is not a tender.

import {TenderId} from '@/common/campaign/tenders';

/** The art directory — served beside every other asset family. */
export const TENDER_ART_DIR = 'assets/campaign/tenders';

/** The kinds whose art has shipped (the file name is the id). */
const TENDER_ART: Readonly<Partial<Record<TenderId, true>>> = {
  projectReview: true,
  preludeReview: true,
  programExtension: true,
  targetedRequest: true,
  restructuring: true,
  extendedLegacy: true,
  openCall: true,
};

/** The kind's art URL, or undefined while the window still engraves the family glyph. */
export function tenderArtUrl(id: TenderId): string | undefined {
  return TENDER_ART[id] === true ? `${TENDER_ART_DIR}/${id}.webp` : undefined;
}
