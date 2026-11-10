/*
 * @console-shared LIVE — console native stands on this file.
 *
 * Numbers more than one controller of the console shell reads (architecture v2 — the shell slices). A constant that
 * belongs to ONE domain lives in that domain's controller; what is here is shared by construction.
 */

/**
 * The right stick's per-frame deflection (−1…1) → pixels. The intent's `dy` is a deflection, never a distance: raw, a
 * body crawls under a pixel a frame and reads as dead (`.claude/rules/console-ui.md` § WHAT OVERFLOWS IS REACHABLE).
 * Scale it by this and by `conUiScale()` before it reaches a scroller.
 */
export const CONSOLE_SCROLL_STEP_PX = 24;
