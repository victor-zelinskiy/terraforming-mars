import {expect} from 'chai';
import {ApiDeckComposition} from '../../src/server/routes/ApiDeckComposition';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {DeckCompositionModel} from '../../src/common/models/DeckCompositionModel';
import {clearDeckCompositionMemo} from '../../src/server/deckComposition';
import {creatorConfig} from '../server/creatorConfig';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';

describe('ApiDeckComposition', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    clearDeckCompositionMemo();
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
    // THE ROUTE IS TABLE-FREE: any touch of the game loader (and through it the database) fails the spec.
    scaffolding.ctx.gameLoader = new Proxy({}, {
      get: (_target, property) => {
        throw new Error(`ApiDeckComposition touched the game loader (${String(property)})`);
      },
    }) as typeof scaffolding.ctx.gameLoader;
  });

  async function put(body: string): Promise<void> {
    const put = scaffolding.put(ApiDeckComposition.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      scaffolding.req.emitter.emit('data', body);
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all([emit, put]);
  }

  it('only PUT', async () => {
    await scaffolding.get(ApiDeckComposition.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('a body that is not a creator config is a bad request', async () => {
    await put('{"players": "nobody"}');
    expect(res.statusCode).eq(statusCode.badRequest);
  });

  it('a body that is not JSON is a bad request', async () => {
    await put('not json');
    expect(res.statusCode).eq(statusCode.badRequest);
  });

  it('the launch body answers the decks and every creator toggle\'s contribution', async () => {
    await put(JSON.stringify(creatorConfig(['corpera', 'prelude', 'colonies', 'turmoilRedux'])));
    expect(res.statusCode).eq(statusCode.ok);
    expect(res.headers.get('Content-Type')).eq('application/json');
    const model = JSON.parse(res.content) as DeckCompositionModel;
    expect(model.projects.total).greaterThan(200);
    expect(model.preludes.total).greaterThan(0);
    expect(model.extras.resolutions).greaterThan(0);
    // No Venus Next in this set: the Redux cards that need it stay out — the contribution is what is DEALT.
    expect(model.contributions.turmoilRedux?.projects).eq((model.projects.byModule.turmoilRedux ?? 0) + (model.projects.byModule.turmoil ?? 0));
    // …measured against the module's own project cards (the printed 70 + the replacements authored so far), never a literal.
    expect(model.projects.byModule.turmoilRedux).lessThan(Object.keys(TURMOIL_REDUX_CARD_MANIFEST.projectCards).length);
    expect(model.contributions.colonies?.projects).greaterThan(0);
  });
});
