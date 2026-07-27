<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

# ═══════════════════════════════════════════════════════════════════
# ⭐ NORTH STAR — CONSOLE NATIVE IS THE PRODUCT (read first)
# ═══════════════════════════════════════════════════════════════════

**The console-native shell (`?console=1` → `ConsoleShell.vue`) is THE product of this fork and the DEFAULT experience** (couch + gamepad on a 4K TV — see [windows target platform]). All new UI work ships in console native; the desktop UI is FROZEN. A feature is "done" when it works in console native — a desktop counterpart is NEVER required and must not block "done". The four visual goals below describe the *taste* the fork wants; the *surface* they apply to is console native now. The SHARED layer (server markers/endpoints, `src/common/` models, pure view-models, module state, the `.pcard` face) stays full-quality — console stands on it. **Before ANY UI work read the "DESKTOP UI IS DEPRECATED" banner below + `docs/CONSOLE_MODE_CONCEPT.md`; the console sections in this file are the primary spec, keep them detailed.**

## Project Goals (vize1215 fork)

This is `vize1215`'s personal fork — a private/self-hosted build of the open-source `terraforming-mars` project. The active UI work is driven by these goals; weigh decisions against them when proposing or making changes:

1. **Single-screen, no-scroll play.** The active game state (board, current player's resources/tags, hand, played-cards filter, etc.) should fit on screen at typical desktop resolutions. Long pages with vertical scroll are the thing we are getting rid of — content that doesn't fit becomes an overlay or a panel, not a scroll target. The top/bottom bar-button overlays (`bar-overlay--*`) are the canonical mechanism for "secondary" content (Log, Played cards, Milestones, Awards, Standard Projects, Colonies, Cards).
2. **Steam-version visual feel.** The reference for layout density and proportion is the Asmodee Digital Steam release of *Terraforming Mars*: large central board, compact peripheral chrome, board scaled up to dominate the screen as more vertical space is freed.
3. **Ark Nova (BoardGameArena) animation feel.** When choosing animations / transitions / hover effects, lean toward the smoothness of BGA's Ark Nova implementation — short easings, subtle scale/glow on interactive elements, no hard pop-ins. Don't introduce flashy motion just because something is being changed; default to calm.
4. **Active visual refresh.** This fork explicitly wants the game to *feel* more modern than upstream. When touching UI, take the visual freedom to refresh things: sci-fi typography for panels/labels (Prototype, Orbitron-style families that ship with the repo) where the upstream choice is generic; subtle gradient/clip-path borders on grouped blocks (resource clusters, tag clusters) to give a control-panel vibe; consistent dark glassmorphic backgrounds for floating panels. The user will push back if a specific change misses, but the default is "try to improve the look" rather than "match upstream pixel-for-pixel". When in doubt, prefer the most polished option that still respects goals 1–3.

When a change has trade-offs between these goals and any other consideration (closeness to upstream, code volume, edge cases), favor the goals above unless the user says otherwise.

