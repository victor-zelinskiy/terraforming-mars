/**
 * WHO appends/removes direct children of <html> during the category flight?
 * Monkeypatches appendChild/insertBefore/removeChild on the documentElement
 * and captures stacks. Run: node scripts/perf/find-html-appender.mjs <playerId>
 */
import {chromium} from '@playwright/test';

const playerId = process.argv[2] ?? 'p-player1-id-perf100';
const base = process.argv[3] ?? 'http://localhost:8123';

async function pump(page, times, gap) {
  for (let i = 0; i < times; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(gap);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
await page.goto(`${base}/player?id=${playerId}&console=1&consoleProfile=handheld`);
await page.waitForSelector('.con-root', {timeout: 60_000});
await pump(page, 3, 200);

await page.evaluate(() => {
  const w = window;
  const rec = {events: []};
  w.__apRec = rec;
  const orig = {
    appendChild: Node.prototype.appendChild,
    insertBefore: Node.prototype.insertBefore,
    removeChild: Node.prototype.removeChild,
  };
  const note = (kind, parent, node) => {
    if (parent === document.documentElement || parent === document.body) {
      const stack = (new Error().stack ?? '').split('\n').slice(2, 6).join(' | ');
      rec.events.push({
        kind,
        parent: parent === document.documentElement ? 'html' : 'body',
        node: node instanceof Element ? `${node.tagName}.${String(node.className).slice(0, 60)}` : String(node.nodeName),
        stack: stack.slice(0, 300),
      });
    }
  };
  Node.prototype.appendChild = function(node) {
    note('append', this, node);
    return orig.appendChild.call(this, node);
  };
  Node.prototype.insertBefore = function(node, ref) {
    note('insert', this, node);
    return orig.insertBefore.call(this, node, ref);
  };
  Node.prototype.removeChild = function(node) {
    note('remove', this, node);
    return orig.removeChild.call(this, node);
  };
});

await page.keyboard.press('KeyX');
await page.locator('.con-played').waitFor({state: 'visible', timeout: 20_000});
await pump(page, 3, 120);
await page.evaluate(() => {
  window.__apRec.events.push({kind: '--- category open starts ---'});
});

const biggest = await page.evaluate(() => {
  let best = '';
  let bestN = -1;
  document.querySelectorAll('.con-played [data-played-cat]').forEach((el) => {
    const n = el.querySelectorAll('.con-played__slot').length;
    if (n > bestN) {
      bestN = n;
      best = el.dataset.playedCat ?? '';
    }
  });
  return best;
});
const zone = page.locator(`[data-played-cat="${biggest}"]`).first();
await zone.click();
await page.waitForTimeout(120);
await zone.click();
await page.locator('.con-played-cat').waitFor({state: 'visible', timeout: 20_000});
for (let i = 0; i < 25; i++) {
  await pump(page, 1, 80);
  if (await page.locator('.con-played-cat--framed').count() > 0) {
    break;
  }
}
await pump(page, 3, 100);

const rec = await page.evaluate(() => window.__apRec);
const hist = new Map();
for (const e of rec.events) {
  const key = e.kind.startsWith('---') ? e.kind : `${e.kind} ${e.parent} ${e.node} @ ${e.stack}`;
  hist.set(key, (hist.get(key) ?? 0) + 1);
}
for (const [k, n] of [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`${String(n).padStart(5)} × ${k}\n`);
}
await browser.close();
