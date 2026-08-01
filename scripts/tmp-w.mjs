import {chromium} from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: 3840, height: 2160}});
await p.goto('http://localhost:8080/player?id=pb50670fbd61&console=1&consoleProfile=tv');
await p.waitForTimeout(5200);
for (let t = 0; t < 5 && await p.locator('.con-cardactions').count() === 0; t++) {
  if (await p.locator('.con-quick').count() > 0) { await p.keyboard.press('ArrowUp'); await p.waitForTimeout(1300); }
  else { await p.keyboard.press('Period'); await p.waitForTimeout(900); }
}
await p.waitForTimeout(1000);
console.log(JSON.stringify(await p.evaluate(() => {
  const g = [...document.querySelectorAll('.con-cardactions__graphic')];
  const nat = g.map((e) => Math.round(e.getBoundingClientRect().width));
  const d = [...document.querySelectorAll('.con-cardactions__desc')];
  const cs = d[0] === undefined ? null : getComputedStyle(d[0]);
  return {
    naturalGraphicW: {max: Math.max(...nat), min: Math.min(...nat)},
    canvasW: Math.round(document.querySelector('.con-cardactions__canvas').getBoundingClientRect().width),
    descW: Math.round(d[0].getBoundingClientRect().width),
    fontPx: cs.fontSize, lineHeight: cs.lineHeight, clientH: d[0].clientHeight,
    bodyH: Math.round(document.querySelector('.con-cardactions__actbody').getBoundingClientRect().height),
    clamped: d.filter((x) => x.scrollHeight > x.clientHeight + 1).length + '/' + d.length,
  };
})));
await b.close();
