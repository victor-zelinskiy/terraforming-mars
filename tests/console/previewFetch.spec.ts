import {expect} from 'chai';
import {fetchPreview} from '@/client/utils/previewFetch';

/**
 * THE ONE READ-ONLY PREVIEW FETCH — the client half of the preview family's
 * answer contract (`src/server/server/responses.ts` § noPreview).
 *
 * The case that matters is 204: `Response.ok` is TRUE for it, so the idiom this
 * helper replaced (`r.ok ? r.json() : undefined`, copied at six call sites)
 * would call `.json()` on an empty body and reach `undefined` by way of a
 * thrown exception. Right answer, wrong road — and invisible to a reader. Here
 * it must be a decision, so the spec asserts that `json()` is never even
 * called.
 */
type StubResponse = {
  ok: boolean,
  status: number,
  json: () => Promise<unknown>,
};

describe('fetchPreview', () => {
  const realFetch = globalThis.fetch;
  let jsonCalls = 0;
  let lastInit: unknown;

  function stub(response: StubResponse | Error): void {
    jsonCalls = 0;
    (globalThis as {fetch: unknown}).fetch = (_url: string, init?: unknown) => {
      lastInit = init;
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    };
  }

  function answer(status: number, body: unknown): StubResponse {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => {
        jsonCalls++;
        return Promise.resolve(body);
      },
    };
  }

  afterEach(() => {
    (globalThis as {fetch: unknown}).fetch = realFetch;
  });

  it('200 → the parsed body', async () => {
    stub(answer(200, {card: 'Aridor'}));
    expect(await fetchPreview<{card: string}>('/api/corp-first-action-preview')).deep.eq({card: 'Aridor'});
    expect(jsonCalls).eq(1);
  });

  it('204 → undefined, and the empty body is never parsed', async () => {
    stub(answer(204, undefined));
    expect(await fetchPreview('/api/corp-first-action-preview')).is.undefined;
    expect(jsonCalls, '`.json()` on a 204 body is a throw waiting to happen').eq(0);
  });

  it('404 → undefined (a genuine failure degrades the same way)', async () => {
    stub(answer(404, undefined));
    expect(await fetchPreview('/api/corp-first-action-preview')).is.undefined;
    expect(jsonCalls).eq(0);
  });

  it('a network error / abort resolves rather than rejecting', async () => {
    stub(new Error('aborted'));
    // A preview is an enrichment: no consumer may be blocked by one, so this
    // must never reject — several call sites deliberately have no `.catch`.
    expect(await fetchPreview('/api/action-preview')).is.undefined;
  });

  it('passes the init through (the action store aborts stale requests)', async () => {
    stub(answer(200, {}));
    const controller = new AbortController();
    await fetchPreview('/api/action-preview', {signal: controller.signal});
    expect((lastInit as {signal?: unknown}).signal).eq(controller.signal);
  });

  it('degrades where there is no fetch at all (JSDOM / a headless host)', async () => {
    (globalThis as {fetch: unknown}).fetch = undefined;
    expect(await fetchPreview('/api/action-preview')).is.undefined;
  });
});
