import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {artTierForWidth, cardArtUrlAtTier, CardArtTier, premiumCardArtForKey} from '@/client/cards/cardArt';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {ResolutionId} from '@/common/parliament/ParliamentTypes';

/*
 * THE ART TIER OF THE WHOLE PARLIAMENT SURFACE (cardArt.ts § ART TIERS) — and the two numbers it is decided
 * by. A LIGHT module on purpose: the transition seed reads it in the transport's apply block, so it may not
 * drag the fit engine (and the sitting director behind it) into that graph.
 */

/** The premium face's design width (`--pcard-w`). */
export const PCARD_W = 320;
/**
 * The vote mode's card cap. 1.05 was reached on every profile at the old panel heights; the panel was
 * re-measured (final polish A.2 — its graphic at the card's own size) and the row's room now fits 1.12
 * at 1080 (measured: row 668 px → 682 px, slot chrome 163 px, card 320×460 × 1.12 = 515 px).
 */
export const MAX_VOTE_ZOOM = 1.12;

/**
 * ONE answer for the voting slots, the government, the payout's hero and every flight proxy, decided by the
 * LARGEST box a carried card reaches (the vote row's cap) — never per zone: a card is ONE DOM instance from
 * the overview to the vote row and from the government to the hero, and a tier that changed with the zone
 * would re-arm the art's load chain mid-FLIP (a re-fade of the picture the player is looking at); a proxy on
 * a different tier than its landing slot is a different picture at the handoff. 1080p and the Deck paint the
 * 512-px build (9× less decode and GPU memory for six faces — and a dealt card's art is decoded before its
 * body turns); 4K takes the full file.
 */
export function parliamentArtTier(): CardArtTier {
  return artTierForWidth(PCARD_W * MAX_VOTE_ZOOM * conUiScale());
}

/**
 * WARM A RESOLUTION'S ILLUSTRATION before a proxy of it takes the air. A card DEALT from the deck is one the
 * table has never painted, and it turns face up in flight: fetching is not decoding, so the picture is decoded
 * at ARM time (the seed of the renewal) — the law `preloadPremiumCardArt` states for project cards, keyed the
 * way a resolution's art is (its printed code) and at the tier the proxy will actually paint (warming the
 * other build decodes a picture nobody draws). No-op without a DOM, and for a resolution that ships no art.
 */
export function preloadResolutionArt(ids: ReadonlyArray<ResolutionId>): void {
  if (typeof Image === 'undefined') {
    return;
  }
  const tier = parliamentArtTier();
  for (const id of ids) {
    const art = premiumCardArtForKey(getResolution(id)?.code);
    if (art === undefined) {
      continue;
    }
    const img = new Image();
    img.src = cardArtUrlAtTier(art.url, tier);
    void img.decode?.().catch(() => undefined);
  }
}
