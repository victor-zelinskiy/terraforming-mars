<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

## Premium tooltips — NEVER the native `title` attribute

**The native browser `title=""` tooltip is BANNED in new UI.** It can't be styled to match the sci-fi chrome, it renders with an OS-default delay/look, and — critically — it's unreliable on `:disabled` controls (the very place we most need a "why is this disabled" hint). Use the shared **`.premium-tooltip(@max-width)`** LESS mixin (defined in `src/styles/card_action_buttons.less`, imported before every consumer) instead:

```less
.my-host { .premium-tooltip(220px); }
```
```html
<span class="my-host" :data-hint="reason">…</span>   <!-- reason '' → no tooltip -->
```

The mixin renders the reason from the host's `data-hint` attribute via a styled `::after` (dark glass + cyan rim), gated on `:hover` and `:not([data-hint=""])`. **Put `data-hint` on a NON-disabled host** — a disabled `<button>` never fires `:hover`, so wrap it (e.g. `.card-selection__action-wrap`, `.card-zoom-actions__tip`) and host the hint on the wrapper; the wrapper gets `:hover` from the pointer position even when the control inside is disabled. The mixin forces `position: relative`, so don't apply it to an element that must stay `position: absolute` (host the hint elsewhere or inline just the `::after`). Adopters so far: card-selection (per-card action button, confirm footer, fullscreen viewer buttons), colony tiles (select button, fleet badge), colony detail (status pills), colony trade-payment (disabled option cards). Migrate any remaining native `title` you touch.

**Known remaining exception:** the placement-lock tooltip in `PlayerHome.installPlacementGuards()` still sets a native `title` via JS on turn-ending buttons that mount mid-placement (a capture-phase `mouseover` attaches it to late-mounted buttons). That's a dynamic JS-driven case, not a static template binding; migrate it to `data-hint` + `.premium-tooltip()` when that subsystem is next touched.

**Disabled-button visuals:** never dim a button with whole-element `opacity` (it goes see-through over the board). The shared `.cab-base()` `:disabled` keeps the button OPAQUE (dim via `filter` + muted text); the CTA roles additionally override their bright plate to a solid dark "off" plate (`.cab-palette-cta()` `:disabled`). Follow the same "opaque, not transparent" rule for any new disabled control.

