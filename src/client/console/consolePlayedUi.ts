/*
 * Console-native «Разыграно» (played cards) overlay UI state — the mirror the
 * shell's command bar reads (WHICH sub-surface owns input, what the verbs
 * are) without poking component refs from a computed.
 *
 * The fields are MIRRORS ConsolePlayedOverlay syncs from its live state — the
 * bar never guesses. Transient by design: reset when the overlay closes.
 */
import {reactive} from 'vue';
import type {PlayedCategoryKey} from '@/client/components/console/consolePlayedCategoryModel';

export const consolePlayedUi = reactive({
  /** The focused CATEGORY of the tableau ('' → empty table). */
  focusCategory: '' as PlayedCategoryKey | '',
  /** The category view is OPEN (settled — grid navigation owns the pad). */
  categoryOpen: false,
  /** The category flights are airborne (opening/closing — B reverses). */
  categoryBusy: false,
  /** The open category's caption (an i18n key — the bar's context title). */
  categoryLabel: '',
  /** ≥2 participants — LB/RB cycles the viewed player. */
  canCyclePlayer: false,
  /** The CATEGORY VIEW album's page on screen and how many there are (LB/RB turn them when more than one; the table
   *  itself is one page). Written by the view, reset when it closes. */
  page: 0,
  pageCount: 1,
});

export function resetConsolePlayedUi(): void {
  consolePlayedUi.focusCategory = '';
  consolePlayedUi.categoryOpen = false;
  consolePlayedUi.categoryBusy = false;
  consolePlayedUi.categoryLabel = '';
  consolePlayedUi.canCyclePlayer = false;
  consolePlayedUi.page = 0;
  consolePlayedUi.pageCount = 1;
}
