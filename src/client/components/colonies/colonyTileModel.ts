/*
 * ColonyTile's MODULE level (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level statement
 * runs once per INSTANCE, so the set the tiles share lives here — built once per page, as it was.
 */
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';

/** The build benefits a tile draws inline as «number + resource icon» (every other kind has a branch of its own). */
export const SIMPLE_BUILD_TYPES: ReadonlySet<ColonyBenefit> = new Set([
  ColonyBenefit.GAIN_RESOURCES,
  ColonyBenefit.ADD_RESOURCES_TO_CARD,
]);
