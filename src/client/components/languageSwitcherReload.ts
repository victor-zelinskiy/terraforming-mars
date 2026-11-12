/*
 * The ONE side effect of `LanguageSwitcher.vue` — the page reload that applies a newly chosen language.
 *
 * It lives in a module of its own, as a member of an object, so that a unit spec can replace it
 * (`languageSwitcherReload.reload = stub`): inside `<script setup>` a component reaches its own functions directly,
 * so replacing one through `wrapper.vm` intercepts nothing (docs/claude/vapor/RECIPES.md § 3).
 */
export const languageSwitcherReload = {
  reload(): void {
    window.location.reload();
  },
};
