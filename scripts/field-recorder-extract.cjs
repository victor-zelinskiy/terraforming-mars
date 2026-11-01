#!/usr/bin/env node
/*
 * field-recorder-extract — the FIELD FLIGHT RECORDER's record read straight out of a Chromium profile's localStorage
 * (the owner's export of 2026-11-01 13:50: the recorder's posts had never reached the box — `fieldRecorder.ts` posted to
 * a bare `/api/field-log` under `app://bundle` — and the record still sat on the box's disk). Every version of the
 * `tm_field_rec:<player>` key is read out of the compacted `.ldb` tables (Snappy) — older versions survive there until a
 * compaction, which is how the minutes BEFORE a relaunch come back. (The newest writes sit in the uncompressed
 * write-ahead `.log`: the value is UTF-16LE JSON after the key — `grep -a` / a UTF-16 decode reads it.)
 *
 *   scp -r "steam-machine:.config/terraforming-mars/Local\ Storage/leveldb" <dir>
 *   node scripts/field-recorder-extract.cjs <dir> <out.json>
 *
 * Prints one row per version (session · start · lines · heartbeats) and writes them all; merge the heartbeats of one
 * session by `at` to rebuild the longest timeline the ring ever held.
 */
const fs = require('fs');
const path = require('path');

function varint(buf, pos) {
  let result = 0;
  let shift = 0;
  for (;;) {
    const b = buf[pos++];
    result += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) return [result, pos];
    shift += 7;
  }
}

function snappy(input) {
  let [len, pos] = varint(input, 0);
  const out = Buffer.alloc(len);
  let op = 0;
  while (pos < input.length) {
    const tag = input[pos++];
    const type = tag & 3;
    if (type === 0) {
      let l = tag >> 2;
      if (l >= 60) {
        const bytes = l - 59;
        l = 0;
        for (let i = 0; i < bytes; i++) l |= input[pos++] << (8 * i);
      }
      l += 1;
      input.copy(out, op, pos, pos + l);
      pos += l;
      op += l;
    } else {
      let l;
      let off;
      if (type === 1) {
        l = ((tag >> 2) & 7) + 4;
        off = ((tag >> 5) << 8) | input[pos++];
      } else if (type === 2) {
        l = (tag >> 2) + 1;
        off = input[pos] | (input[pos + 1] << 8);
        pos += 2;
      } else {
        l = (tag >> 2) + 1;
        off = input.readUInt32LE(pos);
        pos += 4;
      }
      for (let i = 0; i < l; i++, op++) out[op] = out[op - off];
    }
  }
  return out;
}

function readBlock(file, offset, size) {
  const raw = file.slice(offset, offset + size);
  const type = file[offset + size];
  return type === 1 ? snappy(raw) : raw;
}

function entries(block) {
  const numRestarts = block.readUInt32LE(block.length - 4);
  const end = block.length - 4 - numRestarts * 4;
  const out = [];
  let pos = 0;
  let key = Buffer.alloc(0);
  while (pos < end) {
    let shared; let nonShared; let valueLen;
    [shared, pos] = varint(block, pos);
    [nonShared, pos] = varint(block, pos);
    [valueLen, pos] = varint(block, pos);
    key = Buffer.concat([key.slice(0, shared), block.slice(pos, pos + nonShared)]);
    pos += nonShared;
    out.push([key, block.slice(pos, pos + valueLen)]);
    pos += valueLen;
  }
  return out;
}

const dir = process.argv[2];
const found = [];
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.ldb'))) {
  const file = fs.readFileSync(path.join(dir, name));
  const footer = file.slice(file.length - 48);
  let pos = 0;
  let mOff; let mSize; let iOff; let iSize;
  [mOff, pos] = varint(footer, pos);
  [mSize, pos] = varint(footer, pos);
  [iOff, pos] = varint(footer, pos);
  [iSize, pos] = varint(footer, pos);
  void mOff; void mSize;
  for (const [, handle] of entries(readBlock(file, iOff, iSize))) {
    let p = 0;
    let off; let size;
    [off, p] = varint(handle, p);
    [size, p] = varint(handle, p);
    for (const [key, value] of entries(readBlock(file, off, size))) {
      if (key.toString('latin1').includes('tm_field_rec')) {
        // Chromium localStorage values: a 1-byte format prefix (0 = UTF-16LE, 1 = Latin-1).
        const text = value[0] === 0 ? value.slice(1).toString('utf16le') : value.slice(1).toString('latin1');
        try {
          const rec = JSON.parse(text);
          found.push({file: name, rec});
        } catch {
          found.push({file: name, raw: text.slice(0, 200)});
        }
      }
    }
  }
}
for (const f of found) {
  if (f.rec !== undefined) {
    console.log(f.file, f.rec.session, new Date(f.rec.startedAt).toISOString(), 'lines', (f.rec.lines ?? []).length, 'hb', (f.rec.heartbeats ?? []).length);
  } else {
    console.log(f.file, 'unparsed', f.raw);
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(found.map((f) => f.rec).filter(Boolean), null, 1));
