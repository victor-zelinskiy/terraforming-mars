/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ONE READ-ONLY PREVIEW FETCH.
 *
 * Every preview surface in the client asks the server the same shaped
 * question — «price THIS subject against live state» — and every one of them
 * had hand-rolled the same three lines (`r.ok ? r.json() : undefined` +
 * `.catch(() => undefined)`). Six copies of an idiom is six places for the
 * server's answer contract to drift, and it drifted the moment the server
 * gained one: a preview whose SUBJECT has expired is now `204 No Content`
 * (`responses.noPreview`), not a 404. `response.ok` is TRUE for 204, so every
 * one of those copies would have called `.json()` on an empty body and reached
 * the same `undefined` by way of a thrown exception — right answer, wrong
 * road, and invisible to anyone reading the code.
 *
 * So there is one road now:
 *   - `204` → `undefined`. The subject is not previewable right now (the
 *     corporation already spent its first action, the colony is an
 *     add-a-tile catalog candidate that is not in the game). ORDINARY.
 *   - any other non-2xx → `undefined`. A genuine failure; the caller degrades
 *     the same way, and the browser console shows it.
 *   - a network error / abort → `undefined`. Never throws, never rejects: a
 *     preview is an enrichment, and no consumer may be blocked by one.
 *
 * Every consumer degrades to manifest-only rendering on `undefined`, so the
 * three cases deliberately collapse to one value — what must NOT collapse is
 * the reason, and that is exactly what the server's status now carries.
 */
/* global RequestInit */
export function fetchPreview<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  if (typeof fetch !== 'function') {
    return Promise.resolve(undefined);
  }
  return fetch(url, init)
    .then((response) => {
      // 204 = «no preview for that subject» — an empty body by contract, so
      // `.json()` is never called on it.
      if (!response.ok || response.status === 204) {
        return undefined;
      }
      return response.json() as Promise<unknown>;
    })
    .then((json) => json as T | undefined)
    .catch(() => undefined);
}
