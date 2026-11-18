/*
 * AN INVARIANT BROKE — the one door for «this cannot happen, and it did».
 *
 * A module that meets a state its own rules forbid — a legal press its surface refused, a card with nowhere to fly
 * from, a transaction that never reached its hand-over — used to say so under ITS OWN tag, and nearly every such tag
 * is a NOTE (`common/diagnostics/classify.ts`): a breadcrumb, never an event. Several were printed in development
 * builds only. So the lines whose own comments read «it is a BUG, not a mode» and «a programming error upstream»
 * reached nobody (the audit of what reaches the collector, 2026-11-19: 18 such sites).
 *
 * `invariantBroken(id, what)` prints `[invariant] <id> — <what>`: the family is of kind `integrity`, its one shape is
 * a defect, and the cause class is `invariant/broken/<id>` — ONE issue per invariant, whatever its words say this
 * time. The module's own degraded mode goes on exactly as before (the card is revealed in place, the glide recalled):
 * this only makes sure somebody hears of it — in every build.
 *
 *   · `id`   — `<module>:<what-broke>`, FIXED words (it is the class): `start-flight:no-destination`.
 *   · `what` — the sentence for a reader, with the particulars (a card, a party, a count). Never a seat's id or a name.
 *
 * NOT for an exception (that is `reportDiagnosticError`, with its stack), not for a wait that ran out (a ceiling wait
 * or a hold — the stall families, which know the page's paint), and not for a designed fallback: an invariant is a
 * statement that a reader of the code would call impossible.
 */
export function invariantBroken(id: string, what: string): void {
  console.warn(`[invariant] ${id} — ${what}`);
}
