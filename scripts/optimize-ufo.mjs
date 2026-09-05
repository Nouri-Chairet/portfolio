/**
 * assets-src/ufo.glb -> public/ufo.glb
 *
 * The source's six textures are 4096x4096. On disk that is cheap (they are
 * already WebP and compress well) but each one costs ~89 MB of VRAM once
 * uploaded — about 537 MB for a single background prop. Resizing to 1024
 * cuts that to ~33 MB total.
 *
 * Draco must be re-applied explicitly: reading the file decodes the existing
 * KHR_draco_mesh_compression, and any intermediate write would otherwise emit
 * uncompressed geometry (the resized intermediate is ~16 MB).
 *
 * Usage: node scripts/optimize-ufo.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const IN = 'assets-src/ufo.glb';
const OUT = 'public/ufo.glb';
const MAX = 1024;

const cli = process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform';
const bin = join('node_modules', '.bin', cli);
const tmp = mkdtempSync(join(tmpdir(), 'ufo-'));
const run = (...args) => execFileSync(bin, args, { stdio: 'inherit' });

try {
  const resized = join(tmp, 'resized.glb');
  const webp = join(tmp, 'webp.glb');

  run('resize', IN, resized, '--width', String(MAX), '--height', String(MAX));
  run('webp', resized, webp, '--quality', '85');
  run('draco', webp, OUT);

  const before = statSync(IN).size;
  const after = statSync(OUT).size;
  console.log(
    `\n${IN} (${(before / 1048576).toFixed(2)} MB) -> ${OUT} (${(after / 1048576).toFixed(2)} MB)`
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
