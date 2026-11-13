/*
 * ArcScale's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level statement
 * runs once per INSTANCE, so the baseline the bands share across their remounts lives here — one per page, as it was
 * (left in the component it would start empty with every mount, and no band would ever have a previous value to
 * animate from).
 */
import {ArcScaleName} from '@/client/components/board/arcScaleTheme';

/**
 * Cross-remount fill baseline per scale (survives the `<player-home :key>`
 * remount, like AnimatedScaleMarker.accentBaseline / OceanArcScale). Lets the
 * progress fill animate from the previous value to the current one.
 */
export const arcFillBaseline: Partial<Record<ArcScaleName, number>> = {};
