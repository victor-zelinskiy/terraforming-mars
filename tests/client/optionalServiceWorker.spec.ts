import {expect} from 'chai';
import {registerOptionalServiceWorker, serviceWorkerSupported} from '@/client/optionalServiceWorker';

/*
 * THE SERVICE WORKER IS OPTIONAL — its registration never fails the page (issue #83: «ServiceWorker script evaluation
 * failed» on a loaded CI runner was an unhandled rejection on the page, and an e2e spec that asserts «no page errors»
 * went red on a line of the browser's own).
 */
describe('optionalServiceWorker — a registration the browser refuses is handled at its door', () => {
  const web = {isSecureContext: true, location: {protocol: 'https:'}};
  let unhandled: Array<unknown>;
  const onUnhandled = (event: PromiseRejectionEvent) => {
    unhandled.push(event.reason);
    event.preventDefault();
  };

  beforeEach(() => {
    unhandled = [];
    window.addEventListener('unhandledrejection', onUnhandled);
  });
  afterEach(() => {
    window.removeEventListener('unhandledrejection', onUnhandled);
  });

  it('a refused registration resolves «refused» — it never rejects, and nothing is left unhandled', async () => {
    const container = {register: () => Promise.reject(new TypeError('ServiceWorker script evaluation failed'))};
    expect(await registerOptionalServiceWorker(web, container)).to.eq('refused');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).to.deep.eq([]);
  });

  it('…and a registration that THROWS where it stands is the same refusal', async () => {
    const container = {
      register: (): Promise<unknown> => {
        throw new Error('workers are off in this profile');
      },
    };
    expect(await registerOptionalServiceWorker(web, container)).to.eq('refused');
  });

  it('a worker the browser starts is «registered», asked for by the script the server serves', async () => {
    const asked: Array<string> = [];
    const container = {
      register: (script: string) => {
        asked.push(script);
        return Promise.resolve({scope: '/'});
      },
    };
    expect(await registerOptionalServiceWorker(web, container)).to.eq('registered');
    expect(asked).to.deep.eq(['sw.js']);
  });

  it('nothing is asked where a worker cannot be: no container, an insecure context, the desktop shell\'s own scheme', async () => {
    let asked = 0;
    const container = {
      register: () => {
        asked++;
        return Promise.resolve({});
      },
    };
    expect(serviceWorkerSupported(web, undefined)).to.eq(false);
    expect(await registerOptionalServiceWorker(web, undefined)).to.eq('unsupported');
    expect(await registerOptionalServiceWorker({isSecureContext: false, location: {protocol: 'http:'}}, container)).to.eq('unsupported');
    expect(await registerOptionalServiceWorker({isSecureContext: true, location: {protocol: 'app:'}}, container)).to.eq('unsupported');
    expect(await registerOptionalServiceWorker({isSecureContext: true, location: {protocol: 'file:'}}, container)).to.eq('unsupported');
    expect(asked).to.eq(0);
    expect(serviceWorkerSupported({isSecureContext: true, location: {protocol: 'http:'}}, container)).to.eq(true);
  });
});
