// node scripts/shell-extract/vue_types_out.mjs   (cwd = the repo root)
// A `.ts` module cannot import a NAMED export of a `.vue` file (plain tsc — the production build's fork-ts-checker —
// sees `*.vue` through the shim, which declares only the default export). The types the shell's controllers need
// therefore move OUT of their SFCs into a sibling `<component>Types.ts`; the SFC imports and re-exports them, so every
// existing importer keeps working.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript');

const DIR = 'src/client/components/console';
const MOVES = [
  ['foundation/ConsoleAlbumSpine.vue', ['AlbumSpinePosition']],
  ['ConsoleHandDock.vue', ['HandDockAlbum']],
  ['ConsoleSheet.vue', ['ConsoleSheetRow']],
  ['ConsoleHandSection.vue', ['ConsoleHandEntry', 'ConsoleHandSelectMode', 'ConsoleHandStage']],
  ['ConsoleColoniesSection.vue', ['ConsoleColonyPick']],
  ['ConsoleRevealOverlay.vue', ['ConsoleRevealMode']],
  ['ConsoleFleetDockStage.vue', ['FleetDockConfirmPayload']],
  ['ConsoleActionConfirm.vue', ['ActionConfirmKind']],
];

const movedTo = new Map(); // type name → the .ts module it lives in now
for (const [file, names] of MOVES) {
  const sfcPath = path.join(DIR, file);
  const raw = fs.readFileSync(sfcPath, 'utf8');
  const CRLF = raw.includes('\r\n');
  const sfc = raw.replace(/\r\n/g, '\n');
  const open = sfc.indexOf('\n', sfc.indexOf('<script lang="ts">')) + 1;
  const close = sfc.lastIndexOf('</script>');
  const script = sfc.slice(open, close);
  const sf = ts.createSourceFile('c.ts', script, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const base = path.basename(file).replace(/\.vue$/, '');
  const sub = path.dirname(file) === '.' ? '' : path.dirname(file).split(path.sep).join('/') + '/';
  const moduleName = base[0].toLowerCase() + base.slice(1) + 'Types';
  const modulePath = path.join(DIR, sub + moduleName + '.ts');
  const importPath = `@/client/components/console/${sub}${moduleName}`;
  for (const name of names) {
    movedTo.set(name, importPath);
  }
  if (fs.existsSync(modulePath)) {
    console.log(`${file}: ${moduleName}.ts exists — skipped`);
    continue;
  }

  const moved = [];
  for (const name of names) {
    const st = sf.statements.find((s) => (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) && s.name.text === name);
    if (st === undefined) {
      throw new Error(`${file}: no exported type ${name}`);
    }
    moved.push(st);
  }
  // what the moved types name
  const used = new Set();
  for (const st of moved) {
    (function walk(n) {
      if (ts.isIdentifier(n)) {
        used.add(n.text);
      }
      ts.forEachChild(n, walk);
    })(st);
  }
  const movedNames = new Set(names);
  // local (non-imported) declarations of the SFC a moved type names → they must move too, or be importable
  const localDecls = new Map();
  for (const st of sf.statements) {
    if ((ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && !movedNames.has(st.name.text)) {
      localDecls.set(st.name.text, st);
    }
  }
  const dragged = [...used].filter((n) => localDecls.has(n));
  if (dragged.length > 0) {
    throw new Error(`${file}: ${names.join(', ')} name the SFC's local type(s) ${dragged.join(', ')} — list them in MOVES too`);
  }
  // imports the new module needs
  const importLines = [];
  for (const decl of sf.statements.filter(ts.isImportDeclaration)) {
    const clause = decl.importClause;
    if (clause === undefined || clause.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings)) {
      continue;
    }
    const from = decl.moduleSpecifier.text;
    const need = clause.namedBindings.elements.filter((el) => used.has(el.name.text) && !movedNames.has(el.name.text));
    if (need.length === 0) {
      continue;
    }
    if (from.endsWith('.vue') && need.every((el) => movedTo.has(el.name.text))) {
      for (const el of need) {
        importLines.push(`import type {${el.getText(sf)}} from '${movedTo.get(el.name.text)}';`);
      }
      continue;
    }
    if (from.endsWith('.vue')) {
      throw new Error(`${file}: ${need.map((el) => el.name.text).join(', ')} come from another SFC (${from}) — move them out first`);
    }
    importLines.push(`import type {${need.map((el) => el.getText(sf)).join(', ')}} from '${from}';`);
  }
  const attachedStart = (st) => {
    const trivia = script.slice(st.getFullStart(), st.getStart(sf));
    const gap = trivia.lastIndexOf('\n\n');
    return gap === -1 ? st.getFullStart() : st.getFullStart() + gap + 1;
  };
  const bodies = moved.map((st) => script.slice(attachedStart(st), st.getEnd()).replace(/^\n+/, ''));
  const header = `/*\n * @console-shared LIVE — console native stands on this file.\n *\n * The types \`${file}\` shares with the code that drives it. They live in a \`.ts\` module because a \`.ts\` module\n * (a shell controller — console/shell/) cannot import a named export of a \`.vue\` file: plain tsc sees \`*.vue\` through\n * the shim. The SFC imports and re-exports them, so \`import {…} from '…/${file}'\` inside another SFC still works.\n */\n`;
  const moduleText = `${header}${importLines.join('\n')}${importLines.length > 0 ? '\n\n' : ''}${bodies.join('\n\n')}\n`;
  fs.writeFileSync(modulePath, CRLF ? moduleText.replace(/\n/g, '\r\n') : moduleText);

  // patch the SFC: cut the declarations, import + re-export
  const cuts = moved.map((st) => ({start: attachedStart(st), end: st.getEnd(), text: ''}));
  const lastImport = sf.statements.filter(ts.isImportDeclaration).pop();
  cuts.push({start: lastImport.getEnd(), end: lastImport.getEnd(), text: `\nimport type {${names.join(', ')}} from '${importPath}';\n\nexport type {${names.join(', ')}};`});
  cuts.sort((a, b) => b.start - a.start);
  let patched = script;
  for (const c of cuts) {
    patched = patched.slice(0, c.start) + c.text + patched.slice(c.end);
  }
  patched = patched.replace(/\n{4,}/g, '\n\n\n');
  const out = sfc.slice(0, open) + patched + sfc.slice(close);
  fs.writeFileSync(sfcPath, CRLF ? out.replace(/\r?\n/g, '\r\n') : out);
  console.log(`${file}: ${names.join(', ')} → ${moduleName}.ts (${importLines.length} import line(s))`);
}
