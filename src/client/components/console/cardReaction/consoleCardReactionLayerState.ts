/*
 * ConsoleCardReactionLayer's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the view-models the layer has built so far live here — one cache per page, as
 * they were.
 */
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';

/** The party charters built so far — one VM per party, stable across renders. */
export const partyVms = new Map<string, PremiumCardVM | undefined>();

/** The law faces built so far — one VM per resolution, stable across renders (a fresh object per render would re-mount the face). */
export const lawVms = new Map<string, PremiumCardVM | undefined>();
