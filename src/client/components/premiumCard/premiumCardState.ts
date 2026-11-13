/*
 * PremiumCard's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level statement
 * runs once per INSTANCE, so the cache the printed faces share lives here — one per page, as it was (left in the
 * component every face would start with an empty cache of its own, and a table of 100+ static faces would build 100+
 * mechanics trees again).
 */
import {CardName} from '@/common/cards/CardName';
import {PremiumCardVM} from './premiumCardViewModel';

/**
 * PRINTED-FACE VM CACHE. A `name`-only face (console proxies, the tableau,
 * category grids) is a pure function of the static manifest — the VM never
 * changes for the lifetime of the session. Mounting 100+ static faces at once
 * (the «Разыграно» table / category open) used to rebuild 100+ mechanics
 * trees; now each card name pays the build exactly once. VMs are shared and
 * read-only by contract (the render layer never mutates them). Live-model
 * faces (`card` prop) keep the per-instance build — their VM tracks state.
 */
export const printedVmCache = new Map<CardName, PremiumCardVM>();
