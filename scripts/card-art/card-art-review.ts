// v2 review artifacts: per-card previews that make alpha verifiable —
// normalized card, canvas + mask overlay, and the final art on checkerboard /
// dark / light backgrounds + a 200% zoom. Plus a static mask editor.

import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import type {CardArtManifest, MaskShape, ProcessedCard, Report} from './card-art-types';
import {clamp, shapeToPolygon} from './card-art-image-utils';

const STATUS_COLOR: Record<string, string> = {
  'accepted': '#3fb950',
  'needs-more-coverage': '#d29922',
  'needs-edge-cleanup': '#d29922',
  'holes-detected': '#f85149',
  'needs-layout-fix': '#db6d28',
  'needs-manual-mask': '#d29922',
  'rejected': '#f85149',
  'failed': '#f85149',
};

function checkerSvg(w: number, h: number, size = 16): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs><pattern id="c" width="${size * 2}" height="${size * 2}" patternUnits="userSpaceOnUse">` +
      `<rect width="${size * 2}" height="${size * 2}" fill="#9aa3ad"/>` +
      `<rect width="${size}" height="${size}" fill="#cdd4db"/>` +
      `<rect x="${size}" y="${size}" width="${size}" height="${size}" fill="#cdd4db"/>` +
      `</pattern></defs><rect width="${w}" height="${h}" fill="url(#c)"/></svg>`,
  );
}

function maskOverlaySvg(
  includeMasks: MaskShape[],
  excludeMasks: MaskShape[],
  canvas: {x: number; y: number; w: number; h: number},
  w: number,
  h: number,
): Buffer {
  const poly = (m: MaskShape, stroke: string, fill: string) => {
    const pts = shapeToPolygon(m)
      .map((p) => `${(clamp(p.x, 0, 1) * w).toFixed(1)},${(clamp(p.y, 0, 1) * h).toFixed(1)}`)
      .join(' ');
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  };
  const inc = includeMasks.map((m) => poly(m, '#22d3ee', 'rgba(34,211,238,0.22)')).join('');
  const exc = excludeMasks.map((m) => poly(m, '#f87171', 'rgba(248,113,113,0.35)')).join('');
  const canv = `<rect x="${(canvas.x * w).toFixed(1)}" y="${(canvas.y * h).toFixed(1)}" width="${(canvas.w * w).toFixed(1)}" height="${(canvas.h * h).toFixed(1)}" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${canv}${inc}${exc}</svg>`);
}

async function onBackground(artPng: Buffer, bg: {r: number; g: number; b: number} | 'checker'): Promise<Buffer> {
  const meta = await sharp(artPng).metadata();
  const w = meta.width ?? 512;
  const h = meta.height ?? 512;
  const base =
    bg === 'checker'
      ? sharp(checkerSvg(w, h)).png()
      : sharp({create: {width: w, height: h, channels: 3, background: bg}});
  return base.composite([{input: artPng}]).png().toBuffer();
}

export async function writeCardReview(card: ProcessedCard, reviewDir: string): Promise<void> {
  const dir = path.join(reviewDir, 'cards', card.cardCode);
  await fs.mkdir(dir, {recursive: true});

  // 1. normalized card (+ a copy for the mask editor)
  await fs.writeFile(path.join(dir, 'card.png'), card.normalizedCardPng);

  // 2/3. card with canvas rect + mask overlay
  const cw = card.normalizedCardWidth;
  const chh = card.normalizedCardHeight;
  const overlay = maskOverlaySvg(card.plan.includeMasks, card.plan.excludeMasks, card.plan.canvas, cw, chh);
  await fs.writeFile(
    path.join(dir, 'mask-overlay.png'),
    await sharp(card.normalizedCardPng).composite([{input: overlay, top: 0, left: 0}]).png().toBuffer(),
  );

  if (card.initialArtPng) {
    await fs.writeFile(path.join(dir, 'art-initial-checker.png'), await onBackground(card.initialArtPng, 'checker'));
  }
  if (card.artPng) {
    await fs.writeFile(path.join(dir, 'art-checker.png'), await onBackground(card.artPng, 'checker'));
    await fs.writeFile(path.join(dir, 'art-dark.png'), await onBackground(card.artPng, {r: 18, g: 20, b: 26}));
    await fs.writeFile(path.join(dir, 'art-light.png'), await onBackground(card.artPng, {r: 238, g: 240, b: 244}));
    // 200% edge zooms (top / bottom / left / right) — to spot lost art OR remnants.
    const m = await sharp(card.artPng).metadata();
    const aw = m.width ?? 1;
    const ah = m.height ?? 1;
    const stripV = Math.max(8, Math.round(ah * 0.16));
    const stripH = Math.max(8, Math.round(aw * 0.16));
    const edge = async (region: {left: number; top: number; width: number; height: number}, name: string) => {
      const piece = await sharp(card.artPng).extract(region).resize({width: region.width * 2, kernel: 'nearest'}).png().toBuffer();
      await fs.writeFile(path.join(dir, name), await onBackground(piece, 'checker'));
    };
    await edge({left: 0, top: 0, width: aw, height: stripV}, 'edge-top.png');
    await edge({left: 0, top: ah - stripV, width: aw, height: stripV}, 'edge-bottom.png');
    await edge({left: 0, top: 0, width: stripH, height: ah}, 'edge-left.png');
    await edge({left: aw - stripH, top: 0, width: stripH, height: ah}, 'edge-right.png');
  }
}

export async function buildHtmlReport(report: Report, manifest: CardArtManifest, reviewDir: string): Promise<void> {
  await fs.mkdir(reviewDir, {recursive: true});
  const data = {report, manifest};
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Card Art Review v2</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0d1117; color:#e6edf3; font:14px/1.4 system-ui,sans-serif; }
  header { position:sticky; top:0; background:#11161d; padding:14px 20px; border-bottom:1px solid #222b36; z-index:5; }
  h1 { font-size:18px; margin:0 0 6px; } a { color:#58a6ff; }
  .summary { color:#9aa7b3; font-size:13px; }
  .controls { margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; }
  button { background:#1b232d; color:#e6edf3; border:1px solid #2d3a47; border-radius:6px; padding:6px 12px; cursor:pointer; }
  button.active { background:#1f6feb; border-color:#1f6feb; }
  .card { background:#11161d; border:1px solid #222b36; border-radius:10px; margin:18px 20px; overflow:hidden; }
  .card h2 { font-size:15px; margin:0; padding:10px 14px; border-bottom:1px solid #1b2330; display:flex; gap:10px; align-items:center; }
  .pill { padding:1px 9px; border-radius:10px; font-size:12px; }
  .row { display:flex; flex-wrap:wrap; gap:14px; padding:14px; }
  .panel { background:#0b0f14; border:1px solid #1b2330; border-radius:8px; padding:8px; }
  .panel .lbl { font-size:11px; color:#7d8893; margin-bottom:6px; text-transform:uppercase; letter-spacing:.06em; }
  .panel img { display:block; max-height:300px; height:auto; width:auto; border-radius:4px; }
  .panel.zoom img { max-height:380px; }
  .meta { padding:0 14px 14px; color:#9aa7b3; font-size:13px; }
  .qc { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
  .qc span { font-size:12px; padding:2px 8px; border-radius:6px; }
  .qc .pass { background:#0e2f1a; color:#3fb950; } .qc .warn { background:#3a2c0a; color:#e3b341; } .qc .fail { background:#3a1414; color:#f85149; }
  .warn-line { color:#e3b341; font-size:12px; margin-top:6px; }
  table.clog { margin-top:8px; border-collapse:collapse; font-size:12px; color:#9aa7b3; }
  table.clog td, table.clog th { border:1px solid #1b2330; padding:2px 8px; text-align:left; }
  table.clog th { color:#7d8893; font-weight:600; }
</style></head><body>
<header>
  <h1>Card Art Review — structural detector v3</h1>
  <div class="summary" id="summary"></div>
  <div class="controls">
    <button data-f="all" class="active">All</button>
    <button data-f="accepted">accepted</button>
    <button data-f="needs-more-coverage">needs-more-coverage</button>
    <button data-f="needs-edge-cleanup">needs-edge-cleanup</button>
    <button data-f="needs-layout-fix">needs-layout-fix</button>
    <button data-f="holes-detected">holes-detected</button>
    <button data-f="rejected">rejected</button>
  </div>
</header>
<div id="list"></div>
<script id="data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>
  const D = JSON.parse(document.getElementById('data').textContent);
  const SC = ${JSON.stringify(STATUS_COLOR)};
  const GC = {pass:'#3fb950', warning:'#e3b341', fail:'#f85149'};
  let filter='all';
  const list=document.getElementById('list');
  document.getElementById('summary').textContent =
    D.report.scope+' · '+D.report.processed+' processed · '+D.report.accepted+' accepted · '+
    D.report.needsMoreCoverage+' more-coverage · '+D.report.needsEdgeCleanup+' edge-cleanup · '+
    D.report.needsLayoutFix+' layout-fix · '+(D.report.holesDetected||0)+' holes · '+D.report.rejected+' rejected · '+D.report.failed+' failed';
  function panel(lbl, src, cls){ return '<div class="panel '+(cls||'')+'"><div class="lbl">'+lbl+'</div><img loading="lazy" src="'+src+'"></div>'; }
  function grade(name, g){ const col=GC[g]||'#8b949e'; return '<span style="background:'+col+'22;color:'+col+'">'+name+': '+g+'</span>'; }
  function clog(c){ if(!c.candidateLog) return '';
    const rows=c.candidateLog.map(e=>'<tr'+(e.chosen?' style="color:#3fb950;font-weight:700"':'')+'><td>'+(e.chosen?'▶ ':'')+'s='+e.strength+'</td><td>cov '+(e.coverageRatio*100).toFixed(0)+'%</td><td>'+e.coverage+'</td><td>'+e.purity+'</td><td>'+e.edgeCleanliness+'</td><td>'+e.noHoles+'</td><td>holes '+e.holesRemaining+'</td></tr>').join('');
    return '<table class="clog"><tr><th>peel</th><th>coverage</th><th>cov</th><th>purity</th><th>edge</th><th>holes</th><th>px</th></tr>'+rows+'</table>'; }
  function render(){
    const cards = D.report.cards.filter(c=>filter==='all'||c.status===filter);
    list.innerHTML = cards.map(c=>{
      const m=D.manifest[c.cardCode]; const dir='cards/'+c.cardCode+'/'; const col=SC[c.status]||'#8b949e';
      const q=c.quality||{}; const grades='<div class="qc">'+grade('coverage',q.coverage)+grade('purity',q.purity)+grade('edge',q.edgeCleanliness)+grade('noHoles',q.noHoles)+'</div>';
      const notes=(c.notes||[]).length?'<div class="warn-line">'+c.notes.map(esc).join(' · ')+'</div>':'';
      const sizes=m?('512: '+Math.round(m.sizeBytes.preview/1024)+'KB · 1024: '+Math.round(m.sizeBytes.large/1024)+'KB · '+(m.mask.transparentRatio*100).toFixed(0)+'% alpha · it='+(m.iterations||1)):'';
      const dg=c.diagnostics?('<div class="warn-line" style="color:#7d8893">layout: '+Object.entries(c.diagnostics).map(e=>e[0]+'='+e[1]).join('  ')+'</div>'):'';
      return '<div class="card"><h2>'+c.cardCode+
        ' <span class="pill" style="background:'+col+'22;color:'+col+'">'+c.status+'</span>'+
        ' <span style="color:#7d8893;font-weight:400">'+esc(c.sourceFile)+'</span>'+
        ' <span style="margin-left:auto;color:#7d8893;font-weight:400">'+(c.method||'')+'</span></h2>'+
        '<div class="row">'+
          panel('normalized card', dir+'card.png')+
          panel('detected boundaries', dir+'mask-overlay.png')+
          panel('initial mask (no cleanup)', dir+'art-initial-checker.png')+
          (m?panel('FINAL · checkerboard', dir+'art-checker.png'):'')+
          (m?panel('final · dark', dir+'art-dark.png'):'')+
          (m?panel('final · light', dir+'art-light.png'):'')+
        '</div>'+
        (m?'<div class="row">'+
          panel('200% top', dir+'edge-top.png','zoom')+
          panel('200% bottom', dir+'edge-bottom.png','zoom')+
          panel('200% left', dir+'edge-left.png','zoom')+
          panel('200% right', dir+'edge-right.png','zoom')+
        '</div>':'')+
        '<div class="meta">'+sizes+grades+notes+dg+clog(c)+'</div></div>';
    }).join('');
  }
  function esc(s){return (s||'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));}
  document.querySelectorAll('button[data-f]').forEach(b=>b.onclick=()=>{document.querySelectorAll('button[data-f]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.f;render();});
  render();
</script></body></html>`;
  await fs.writeFile(path.join(reviewDir, 'index.html'), html, 'utf8');
}

/** A static, dependency-free polygon mask editor (click to add points). */
export async function buildMaskEditor(codes: string[], reviewDir: string): Promise<void> {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Mask editor</title>
<style>
  :root{color-scheme:dark;} body{margin:0;background:#0d1117;color:#e6edf3;font:14px/1.4 system-ui,sans-serif;display:flex;height:100vh;}
  #side{width:360px;flex:0 0 360px;padding:14px;overflow:auto;border-right:1px solid #222b36;}
  #stage{flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;background:#0b0f14;}
  canvas{background:#000;max-width:100%;max-height:100%;cursor:crosshair;}
  select,button,textarea{background:#1b232d;color:#e6edf3;border:1px solid #2d3a47;border-radius:6px;padding:6px 10px;}
  button{cursor:pointer;margin:2px 0;} .row{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;}
  textarea{width:100%;height:240px;font:12px/1.4 monospace;} h3{margin:10px 0 4px;font-size:13px;color:#9aa7b3;}
  label{font-size:12px;color:#9aa7b3;} .hint{font-size:12px;color:#7d8893;}
</style></head><body>
<div id="side">
  <h3>Card</h3>
  <select id="card"></select>
  <div class="row">
    <label><input type="checkbox" id="showChecker" checked> checkerboard preview</label>
  </div>
  <div class="hint">Click on the image to add include-polygon points. Shift+Click adds to an EXCLUDE polygon. Right-click removes the last point. "New polygon" starts another ring.</div>
  <div class="row">
    <button id="newInc">New include polygon</button>
    <button id="newExc">New exclude polygon</button>
    <button id="undo">Undo point</button>
    <button id="clear">Clear all</button>
  </div>
  <h3>masks.json snippet (canvas-relative)</h3>
  <textarea id="out" readonly></textarea>
  <button id="copy">Copy</button>
  <div class="hint">canvas = bounding box of all points; polygon points are normalized within that box, matching card-art-masks.json.</div>
</div>
<div id="stage"><canvas id="cv"></canvas></div>
<script>
const CODES=${JSON.stringify(codes)};
const sel=document.getElementById('card'); CODES.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o);});
const cv=document.getElementById('cv'), ctx=cv.getContext('2d'); const out=document.getElementById('out');
let img=new Image(), includes=[[]], excludes=[], mode='inc';
function load(code){ img=new Image(); img.onload=()=>{cv.width=img.naturalWidth;cv.height=img.naturalHeight;draw();}; img.src='cards/'+code+'/card.png'; includes=[[]];excludes=[];mode='inc'; }
function curRing(){ return mode==='inc'?includes[includes.length-1]:excludes[excludes.length-1]; }
cv.addEventListener('contextmenu',e=>{e.preventDefault();const r=curRing();if(r)r.pop();draw();});
cv.addEventListener('mousedown',e=>{ if(e.button!==0)return; const rect=cv.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width, y=(e.clientY-rect.top)/rect.height;
  if(e.shiftKey){ if(!excludes.length)excludes=[[]]; mode='exc'; } else { mode='inc'; }
  curRing().push({x:+x.toFixed(4),y:+y.toFixed(4)}); draw(); });
function bbox(pts){ const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y); return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}; }
function draw(){ ctx.clearRect(0,0,cv.width,cv.height); ctx.drawImage(img,0,0);
  if(document.getElementById('showChecker').checked){ maskPreview(); }
  drawRings(includes,'#22d3ee'); drawRings(excludes,'#f87171');
  emit();
}
function drawRings(rings,color){ rings.forEach(r=>{ if(!r.length)return; ctx.beginPath(); r.forEach((p,i)=>{const X=p.x*cv.width,Y=p.y*cv.height; i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}); ctx.closePath();
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle=color+'33'; ctx.fill();
  r.forEach(p=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x*cv.width,p.y*cv.height,3,0,7);ctx.fill();}); }); }
function maskPreview(){ // dim everything outside include ∖ exclude
  ctx.save(); ctx.globalCompositeOperation='source-over';
  const o=document.createElement('canvas'); o.width=cv.width;o.height=cv.height; const oc=o.getContext('2d');
  oc.fillStyle='rgba(0,0,0,0.55)'; oc.fillRect(0,0,o.width,o.height);
  oc.globalCompositeOperation='destination-out';
  includes.forEach(r=>{ if(r.length<3)return; oc.beginPath(); r.forEach((p,i)=>{const X=p.x*o.width,Y=p.y*o.height;i?oc.lineTo(X,Y):oc.moveTo(X,Y);}); oc.closePath(); oc.fill(); });
  oc.globalCompositeOperation='source-over'; oc.fillStyle='rgba(0,0,0,0.55)';
  excludes.forEach(r=>{ if(r.length<3)return; oc.beginPath(); r.forEach((p,i)=>{const X=p.x*o.width,Y=p.y*o.height;i?oc.lineTo(X,Y):oc.moveTo(X,Y);}); oc.closePath(); oc.fill(); });
  ctx.drawImage(o,0,0); ctx.restore();
}
function emit(){ const all=[].concat(...includes,...excludes).filter(r=>r); const pts=[].concat(...includes.filter(r=>r.length),...excludes.filter(r=>r.length));
  if(!pts.length){out.value='';return;} const bb=bbox(pts);
  const rel=ring=>ring.map(p=>({x:+((p.x-bb.x)/(bb.w||1)).toFixed(4),y:+((p.y-bb.y)/(bb.h||1)).toFixed(4)}));
  const obj={[sel.value]:{canvas:{x:+bb.x.toFixed(4),y:+bb.y.toFixed(4),w:+bb.w.toFixed(4),h:+bb.h.toFixed(4)},
    includePolygons:includes.filter(r=>r.length>=3).map(rel),
    excludePolygons:excludes.filter(r=>r.length>=3).map(rel),
    focus:{x:0.5,y:0.45}, note:'authored in mask editor'}};
  if(!obj[sel.value].excludePolygons.length) delete obj[sel.value].excludePolygons;
  out.value=JSON.stringify(obj,null,2); void all;
}
document.getElementById('newInc').onclick=()=>{includes.push([]);mode='inc';draw();};
document.getElementById('newExc').onclick=()=>{excludes.push([]);mode='exc';draw();};
document.getElementById('undo').onclick=()=>{const r=curRing();if(r)r.pop();draw();};
document.getElementById('clear').onclick=()=>{includes=[[]];excludes=[];draw();};
document.getElementById('copy').onclick=()=>{out.select();document.execCommand('copy');};
document.getElementById('showChecker').onchange=draw;
sel.onchange=()=>load(sel.value); load(CODES[0]);
</script></body></html>`;
  await fs.writeFile(path.join(reviewDir, 'mask-editor.html'), html, 'utf8');
}
