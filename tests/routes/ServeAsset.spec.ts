import {expect} from 'chai';
import fs from 'fs';
import {FileAPI, ServeAsset} from '../../src/server/routes/ServeAsset';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
class FileApiMock extends FileAPI {
  public counts = {
    readFile: 0,
    readFileSync: 0,
    existsSync: 0,
  };
  public constructor() {
    super();
  }
  public override readFileSync(path: string): Buffer {
    this.counts.readFileSync++;
    return Buffer.from('data: ' + path);
  }
  public override readFile(path: string): Promise<Buffer> {
    this.counts.readFile++;
    return Promise.resolve(Buffer.from('data: ' + path));
  }
  public override existsSync(_path: string): boolean {
    this.counts.existsSync++;
    return true;
  }
}

describe('ServeAsset', () => {
  let instance: ServeAsset;
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;
  let fileApi: FileApiMock;
  // The expected state of call counts in most simple cases in this test. This is a template
  // used and overridden below. That makes how individual condition changes these calls.
  const primedCache = {
    readFile: 0,
    readFileSync: 3,
    existsSync: 0,
  };

  const storedNodeEnv = process.env.NODE_ENV;
  beforeEach(() => {
    instance = new ServeAsset(undefined, false);
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
    fileApi = new FileApiMock();
  });
  afterEach(() => {
    process.env.NODE_ENV = storedNodeEnv;
  });
  it('bad filename', async () => {
    scaffolding.url = 'goo.goo.gaa.gaa';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found');
  });

  it('index.html — the BUILT shell (vite.config.mts writes it into build/)', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/index.html';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/index.html');
  });

  it('styles.css', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/styles.css';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/styles.css');
  });

  it('styles.css.gz', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/styles.css';
    scaffolding.req.headers['accept-encoding'] = 'gzip';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/styles.css.gz');
  });

  it('styles.css: uncached', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    // Primes the cache.
    expect(fileApi.counts).deep.eq(primedCache);

    scaffolding.url = '/styles.css';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);

    expect(res.content).eq('data: build/styles.css');
    expect(fileApi.counts).deep.eq({
      ...primedCache,
      readFile: 1, // Still read.
    });
  });

  it('styles.css.gz: cached', async () => {
    instance = new ServeAsset(undefined, true, fileApi);
    // Primes the cache.
    expect(fileApi.counts).deep.eq(primedCache);

    scaffolding.url = '/styles.css';
    scaffolding.req.headers['accept-encoding'] = 'gzip';
    await scaffolding.get(instance, res);

    expect(res.content).eq('data: build/styles.css.gz');
    expect(fileApi.counts).deep.eq({
      ...primedCache,
      readFile: 0, // Does not change
    });
  });

  it('development main.js', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/main.js';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/main.js');
    expect(fileApi.counts).deep.eq({
      ...primedCache,
      readFile: 1,
      existsSync: 0,
    });
  });

  it('production main.js', async () => {
    process.env.NODE_ENV = 'production';
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/main.js';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/main.js');
    expect(fileApi.counts).deep.eq({
      ...primedCache,
      readFile: 1,
      existsSync: 0,
    });
  });

  it('sw.js', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/sw.js';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/sw.js');
    expect(fileApi.counts).deep.eq({
      ...primedCache,
      readFile: 1,
      existsSync: 0,
    });
  });

  it('vendors.js', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/vendors.js';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/vendors.js');
  });

  // The frame symbols of the two initial chunks — the in-game diagnostics journal reads a minified stack back with
  // them. They are written after the bundle and have no compressed twin: an accepted encoding changes nothing.
  for (const script of ['main.js', 'vendors.js']) {
    it(script + '.symbols.json', async () => {
      instance = new ServeAsset(undefined, false, fileApi);
      scaffolding.url = '/' + script + '.symbols.json';
      scaffolding.req.headers['accept-encoding'] = 'br, gzip';
      await scaffolding.get(instance, res);
      expect(res.content).eq('data: build/' + script + '.symbols.json');
    });
  }

  it('chunk js file', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/chunks/player-home.js';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/chunks/player-home.js');
  });

  it('chunk js.map file', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/chunks/player-home.js.map';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.content).eq('data: build/chunks/player-home.js.map');
  });

  it('rejects path traversal in chunks', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/chunks/../main.js';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('serves every file the built shell references: its module scripts, their preloads and the components\' CSS', async () => {
    // The shell's SOURCE names the module entry; Vite writes the built one (vite.config.mts — fixed names). The
    // partition is the config's: the two initial chunks at the root, everything else under chunks/.
    const source = fs.readFileSync('src/client/index.html', 'utf8');
    expect(source).to.match(/<script type="module" src="\.\/main\.ts"><\/script>/);
    const config = fs.readFileSync('vite.config.mts', 'utf8');
    expect(config).to.include('const INITIAL_CHUNKS = new Set([\'main\', \'vendors\']);');
    const srcs = ['main.js', 'vendors.js', 'sw.js', 'chunks/rolldown-runtime.js', 'chunks/main.css', 'chunks/console-shell.js', 'chunks/console-shell.css'];
    for (const src of srcs) {
      const perRes = new MockResponse();
      const perScaffolding = new RouteTestScaffolding();
      instance = new ServeAsset(undefined, false, fileApi);
      perScaffolding.url = '/' + src;
      perScaffolding.req.headers['accept-encoding'] = '';
      await perScaffolding.get(instance, perRes);
      expect(perRes.statusCode, `${src} should return 200`).eq(statusCode.ok);
    }
  });

  // Regression: the assets whitelist in toFile() must include .webp, else the
  // webp board/card textures 404 (the "hex textures vanished" bug after the
  // png→webp conversion).
  it('serves .webp assets (200, not 404)', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/assets/board/mars.webp';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.statusCode).eq(statusCode.ok);
  });

  /*
   * EVERY FONT A STYLE SHEET ASKS FOR IS SERVED — read off the sheets themselves, never off a list kept by hand.
   *
   * The faces used to be named one by one in `toFile()` and again here. The styles then self-hosted Ubuntu, Jura and
   * Play (twenty-six files, 2026-10-22) and neither list was told: for a month every one of them answered 404 and the
   * text fell back to a system face in silence — found by the first whole game whose log was read whole (FREEZE ZERO,
   * the zero bar). A font is served by its extension now, and this row walks what the sheets really reference: the
   * file ships, the route answers 200, and the content type is the font's (a wrong one makes Chromium refuse the face
   * in silence).
   */
  const FONT_URL = /url\(\s*['"]?\.\/assets\/([^'")]+\.(?:woff2|ttf))['"]?\s*\)/g;
  const styleFonts = [...new Set(fs.readdirSync('src/styles').filter((name) => name.endsWith('.less'))
    .flatMap((name) => [...fs.readFileSync(`src/styles/${name}`, 'utf8').matchAll(FONT_URL)].map((match) => match[1])))].sort();

  it('the style sheets reference fonts at all (the row below reads them)', () => {
    expect(styleFonts.length, 'the self-hosted faces').to.be.greaterThan(30);
    expect(styleFonts, 'the family that named the defect').to.include('Ubuntu-latin.woff2');
  });

  for (const font of styleFonts) {
    it(`serves ${font} — a face the styles ask for`, async () => {
      expect(fs.existsSync(`assets/${font}`), `assets/${font} must ship with the app`).is.true;
      instance = new ServeAsset(undefined, false, fileApi);
      scaffolding.url = `/assets/${font}`;
      scaffolding.req.headers['accept-encoding'] = '';
      await scaffolding.get(instance, res);
      expect(res.statusCode, `${font} is served`).eq(statusCode.ok);
      expect(res.headers.get('Content-Type'), `${font} carries a font's content type`).eq(font.endsWith('.woff2') ? 'font/woff2' : 'font/ttf');
    });
  }

  it('a font outside the assets is not served by its extension', async () => {
    instance = new ServeAsset(undefined, false, fileApi);
    scaffolding.url = '/assets/../package.woff2';
    scaffolding.req.headers['accept-encoding'] = '';
    await scaffolding.get(instance, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });
});
