import {expect} from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {ApiFieldLog} from '../../src/server/routes/ApiFieldLog';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';

/**
 * POST /api/field-log — the field flight recorder's drop box: one JSON line per post under `TM_FIELD_LOG_DIR`
 * (the day's file), the client's ip and the server's time stamped on; a non-JSON / shapeless / oversized body is a 400
 * and writes nothing.
 */
describe('ApiFieldLog', () => {
  let dir: string;
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;
  let envBefore: string | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-field-log-'));
    envBefore = process.env.TM_FIELD_LOG_DIR;
    process.env.TM_FIELD_LOG_DIR = dir;
    scaffolding = new RouteTestScaffolding();
    scaffolding.url = '/api/field-log';
    scaffolding.req.method = 'POST';
    res = new MockResponse();
  });

  afterEach(() => {
    if (envBefore === undefined) {
      delete process.env.TM_FIELD_LOG_DIR;
    } else {
      process.env.TM_FIELD_LOG_DIR = envBefore;
    }
    fs.rmSync(dir, {recursive: true, force: true});
  });

  async function post(body: string): Promise<void> {
    const req = scaffolding.req;
    const done = ApiFieldLog.INSTANCE.processRequest(req, res, scaffolding.ctx);
    req.emitter.emit('data', body);
    req.emitter.emit('end');
    await done;
  }

  function lines(): Array<Record<string, unknown>> {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')) : [];
    return files.flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as Record<string, unknown>));
  }

  it('appends a record as one JSON line of the day\'s file, stamped with the time and the ip', async () => {
    await post(JSON.stringify({kind: 'previous-session', navigation: 'reload', record: {session: 's1', game: 'g1', player: 'p1', lines: [{at: 1, text: '[liveness] stall'}], heartbeats: []}}));
    expect(res.statusCode).eq(statusCode.ok);
    const rows = lines();
    expect(rows).length(1);
    expect(rows[0].kind).eq('previous-session');
    expect(rows[0].navigation).eq('reload');
    expect(typeof rows[0].at).eq('string');
    expect((rows[0].record as {game: string}).game).eq('g1');
    const file = fs.readdirSync(dir)[0];
    expect(file).match(/^\d{4}-\d{2}-\d{2}\.jsonl$/);
  });

  it('a second post appends — nothing is overwritten', async () => {
    await post(JSON.stringify({kind: 'live', record: {session: 's1', lines: [], heartbeats: []}}));
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding();
    scaffolding.url = '/api/field-log';
    scaffolding.req.method = 'POST';
    await post(JSON.stringify({kind: 'pagehide', record: {session: 's1', lines: [], heartbeats: []}}));
    expect(lines().map((r) => r.kind)).deep.eq(['live', 'pagehide']);
  });

  it('refuses what is not a record: not JSON, no kind, no record — and writes nothing', async () => {
    await post('{nope');
    expect(res.statusCode).eq(statusCode.badRequest);
    for (const body of [JSON.stringify({record: {}}), JSON.stringify({kind: 'live'}), JSON.stringify([1, 2])]) {
      res = new MockResponse();
      scaffolding = new RouteTestScaffolding();
      scaffolding.url = '/api/field-log';
      scaffolding.req.method = 'POST';
      await post(body);
      expect(res.statusCode, body).eq(statusCode.badRequest);
    }
    expect(lines()).length(0);
  });

  it('refuses an oversized body', async () => {
    await post(JSON.stringify({kind: 'live', record: {pad: 'x'.repeat(ApiFieldLog.BODY_MAX + 10)}}));
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(lines()).length(0);
  });
});
