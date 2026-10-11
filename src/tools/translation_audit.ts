import '@/server/init';
import fs from 'fs';
import path from 'path';

import {MultiMap} from 'mnemonist';

function removeTrailingComma(str: string) {
  if (str.endsWith(',')) {
    return str.slice(0, -1); // Remove the last character (the comma).
  } else {
    return str; // Return the original string if no comma is present.
  }
}
function parseLine(line: string) {
  const jsonObjectString = '{' + removeTrailingComma(line) + '}';
  const data = JSON.parse(jsonObjectString);
  const key = Object.keys(data)[0];
  const value = data[key];
  return [key, value];
}

function parseJson(input: string): MultiMap<string, string> {
  const map = new MultiMap<string, string>();
  const lines = input.split('\n').map((e) => e.trim()).filter((e) => e.length > 0);
  const firstLine = lines.shift();
  if (firstLine === '{}') {
    return map;
  }
  if (firstLine !== '{') {
    throw new Error('Expected {, got' + firstLine);
  }
  while (lines.length > 0) {
    let line = lines.shift();
    if (line === undefined) {
      break;
    }
    if (line === '}') {
      if (lines.length > 0) {
        throw new Error('lines available after }');
      }
      break;
    }
    if (line.endsWith(':')) {
      const nextLine = lines.shift();
      line = line + ' ' + nextLine;
    }
    const [key, value] = parseLine(line);
    map.set(key, value);
  }
  return map;
}

const pathToTranslationsDir = path.resolve('src/locales');

let errors = 0;

/**
 * STRAY WHITESPACE IN A CURATED VALUE (PL-160's neighbour, 2026-10-11): «Aerial
 * Mappers» → «Карта ветров » shipped with a trailing space, which every
 * surface that joins the name with a separator then printed as a double gap
 * (the crumb, the target row, the journal chip). A value may carry leading /
 * trailing whitespace ONLY where its KEY does («game id: » → «ID игры: »).
 * Scoped to the locales this fork CURATES — the upstream languages carry
 * ~160 such values that are not ours to rewrite (invariant 9).
 */
const CURATED_LOCALES = new Set(['ru']);
function strayWhitespace(key: string, value: string): string | undefined {
  if (/^\s/.test(value) && !/^\s/.test(key)) {
    return 'leading';
  }
  if (/\s$/.test(value) && !/\s$/.test(key)) {
    return 'trailing';
  }
  return undefined;
}

const dirs = fs.readdirSync(pathToTranslationsDir);
for (const lang of dirs) {
  const localeDir = path.join(pathToTranslationsDir, lang);
  if (lang.length === 2 && fs.statSync(localeDir).isDirectory()) {
    const translationDir = path.resolve(path.join(pathToTranslationsDir, lang));
    const files = fs.readdirSync(translationDir);
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const filename = path.join(translationDir, file);
      // console.log('processing ' + filename);
      const content = fs.readFileSync(filename, 'utf8');
      const results = parseJson(content);
      for (const key of results.keys()) {
        if ((results.get(key) ?? []).length > 1) {
          const uniqueCount = new Set(results.get(key)).size;
          console.log(filename, '[', uniqueCount, '] [', key, ']');
          errors++;
        }
        if (CURATED_LOCALES.has(lang)) {
          for (const value of results.get(key) ?? []) {
            const stray = strayWhitespace(key, value);
            if (stray !== undefined) {
              console.log(filename, `[${stray} whitespace in the value] [`, key, '] →', JSON.stringify(value));
              errors++;
            }
          }
        }
      }
    }
  }
}

if (errors > 0) {
  console.error('Translation audit failed (duplicate strings in one file, or stray whitespace in a curated value). Stopping.');
  process.exit(1);
}
