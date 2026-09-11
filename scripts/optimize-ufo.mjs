/**
 * assets-src/ufo.glb -> public/ufo.glb
 *
 * The UFO is a background prop that renders about 120 px wide in the hero.
 * The version this replaced was 324,507 triangles and ~50 MB of VRAM — around
 * 11 triangles per rendered pixel, and ~90% of every triangle the GPU touched
 * in a frame, for a prop nobody looks at. (The rigged character that *is* the
 * focal point is 34,172 triangles.)
 *
 * File size was never the problem and is not the target here: the old
 * public/ufo.glb was already 1.37 MB. Draco and WebP are transfer formats and
 * the GPU expands both. What costs frame time is triangles and VRAM.
 *
 *     stage                          triangles      VRAM
 *     raw Sketchfab export             324,507     ~553 MB
 *     previously shipped               324,507      ~50 MB   (1024 maps)
 *     now                               17,165      8.51 MB  (512 maps)
 *
 * The geometry half of that lives in scripts/decimate-ufo.py, which turns
 * assets-src/ufo-raw.glb (the untouched Sketchfab export) into
 * assets-src/ufo.glb. It needs Blender, so it is not part of `npm run assets`:
 *
 *     npm run assets:ufo:decimate     # only when re-tuning the geometry
 *     npm run assets:ufo              # the normal rebuild, this file
 *
 * Every parameter in both stages was measured at 120 px, not at full zoom. A
 * decimation that looks brutal zoomed in is usually invisible at the size the
 * prop actually renders, and judging it zoomed in buys triangles that cost
 * real frame time and nothing else.
 *
 * Usage: node scripts/optimize-ufo.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const IN = 'assets-src/ufo.glb';
const OUT = 'public/ufo.glb';

/**
 * Texture resolution. 512 costs 1.4 MB of VRAM per map against 5.59 MB at
 * 1024, and at 120 px the two are indistinguishable (RMSE 0.010, and the
 * pixels that differ are dithering in the specular falloff).
 *
 * 256 was tested too and is NOT indistinguishable — it visibly softens the
 * hexagonal panel outline on the lower hull (RMSE 0.018). It saves a further
 * 5.25 MB, so if this prop ever stops being a prop-sized problem it is the
 * next lever, but it is a real look change and 512 is the honest choice.
 *
 * CLAUDE.md caps textures at 1024; this is well inside that.
 */
const MAX = 512;

/**
 * Drop the two normal maps and, with them, the TANGENT attribute and the
 * TEXCOORD_1 set that only UFO_BLACK's normal map read.
 *
 * Saves 3.30 MB (8.51 -> 5.21 MB): 2.80 MB of texture and 0.50 MB of tangents.
 *
 * Left off deliberately. The per-vertex saving is small *because* the geometry
 * stage already ran — tangents cost 16 bytes across 29,153 vertices, not
 * across the 264,459 the raw model had. What it costs is the hull panel seams,
 * which at 120 px are the only surface detail the prop has; without them the
 * saucer reads as a blank shell. 3.3 MB is not worth that when the model is
 * already down 83% from where it started.
 */
const STRIP_NORMALS = false;

const cli = process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform';
const bin = join('node_modules', '.bin', cli);
const tmp = mkdtempSync(join(tmpdir(), 'ufo-'));
const run = (...args) => execFileSync(bin, args, { stdio: 'inherit' });

try {
  let src = IN;

  if (STRIP_NORMALS) {
    const stripped = join(tmp, 'stripped.glb');
    const { NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const draco3d = (await import('draco3dgltf')).default;

    const io = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });
    const doc = await io.read(src);
    for (const material of doc.getRoot().listMaterials()) material.setNormalTexture(null);
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) prim.setAttribute('TANGENT', null);
    }
    await io.write(stripped, doc);
    src = stripped;
  }

  const resized = join(tmp, 'resized.glb');
  const webp = join(tmp, 'webp.glb');
  const deduped = join(tmp, 'deduped.glb');
  const pruned = join(tmp, 'pruned.glb');

  run('resize', src, resized, '--width', String(MAX), '--height', String(MAX));
  run('webp', resized, webp, '--quality', '85');

  // Blender emits one glTF texture per shader node, so Ventanilla's shared
  // base-colour/emissive image comes out of the geometry stage as two
  // textures pointing at one image. three.js uploads both. dedup collapses
  // them back to one and saves 1.4 MB.
  run('dedup', webp, deduped);

  // UFO_BLACK's metallicRoughness map is a solid colour. prune replaces it
  // with the equivalent factors — byte-identical render (RMSE 0.000 at both
  // 120 px and 800 px), one fewer texture, another 1.4 MB. It also sweeps up
  // TEXCOORD_1 when STRIP_NORMALS leaves nothing reading it.
  run('prune', deduped, pruned);

  // Draco last, and explicitly: reading a .glb decodes any existing
  // KHR_draco_mesh_compression, so every intermediate above is uncompressed
  // geometry and the extension has to be re-applied before the final write.
  // EXT_texture_webp and KHR_draco_mesh_compression are both required in the
  // output (CLAUDE.md, Conventions).
  run('draco', pruned, OUT);

  const before = statSync(IN).size;
  const after = statSync(OUT).size;
  console.log(
    `\n${IN} (${(before / 1048576).toFixed(2)} MB) -> ${OUT} (${(after / 1048576).toFixed(2)} MB)` +
      `  [${MAX}px maps${STRIP_NORMALS ? ', no normal maps' : ''}]`
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
