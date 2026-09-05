/**
 * Merge the three character GLBs into a single public/character.glb.
 *
 * The three source models are the same Avaturn character on an identical
 * 52-joint skeleton (verified: identical joint names, order, rest pose and
 * inverse bind matrices), each carrying one animation clip. They are NOT
 * otherwise identical: `avaturn_body` and `avaturn_look_0` differ in every
 * file, because each export bakes a different outfit and re-cuts the body
 * mesh to fit under it. Hair, shoes and the body normal/metalRough maps are
 * byte-identical across all three.
 *
 * Because the skeleton is shared, every clip can drive every outfit.
 *
 *   --looks launch   (default, and what this project ships) keep only the
 *                    costume_launch outfit. One mesh set, one skeleton, three
 *                    clips. The character wears the same outfit during the
 *                    dance and the call-me pose.
 *   --looks all      keep all three outfits as sibling groups
 *                    `variant_launch` / `variant_dance` / `variant_call` under
 *                    the shared Armature, so each pose keeps the outfit it was
 *                    exported with. Costs ~0.6 MB more and requires the app to
 *                    toggle which group is visible.
 *
 * Usage: node scripts/merge-character.mjs [--looks launch|all]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const SOURCES = [
  { tag: 'launch', file: 'assets-src/costume_launch.glb', clip: 'Energic_conductor_Clean' },
  { tag: 'dance', file: 'assets-src/dancing.glb', clip: 'Brag_n_Claps_Clean' },
  { tag: 'call', file: 'assets-src/call_me.glb', clip: 'Call_Me_Clean' },
];
const OUT = 'public/character.glb';

// Meshes that differ per outfit and so must be kept per variant.
const PER_VARIANT = ['avaturn_body', 'avaturn_look_0'];

const argv = process.argv.slice(2);
const looksIdx = argv.indexOf('--looks');
const LOOKS = looksIdx === -1 ? 'launch' : argv[looksIdx + 1];
if (!['launch', 'all'].includes(LOOKS)) {
  console.error(`--looks must be "launch" or "all" (got "${LOOKS}")`);
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

const { mergeDocuments } = await import('@gltf-transform/functions');

// ---------------------------------------------------------------- base doc
const base = await io.read(SOURCES[0].file);
const baseRoot = base.getRoot();
const baseScene = baseRoot.listScenes()[0];
const baseSkin = baseRoot.listSkins()[0];
const baseArmature = baseScene.listChildren().find((n) => n.getName() === 'Armature');
const baseJoints = new Map(baseSkin.listJoints().map((j) => [j.getName(), j]));

console.log(`base: ${SOURCES[0].file}  (${baseJoints.size} joints)`);

/** Wrap the per-outfit meshes of the base doc into a variant group. */
function groupBaseVariant(tag) {
  const group = base.createNode(`variant_${tag}`);
  for (const name of PER_VARIANT) {
    const node = baseArmature.listChildren().find((n) => n.getName() === name);
    if (!node) throw new Error(`base is missing node ${name}`);
    baseArmature.removeChild(node);
    node.setName(`${name}_${tag}`);
    group.addChild(node);
  }
  baseArmature.addChild(group);
  return group;
}

if (LOOKS === 'all') {
  groupBaseVariant(SOURCES[0].tag);
}

// ------------------------------------------------------- merge the others
for (const src of SOURCES.slice(1)) {
  const other = await io.read(src.file);
  const map = mergeDocuments(base, other);

  const otherRoot = other.getRoot();
  const otherSkin = map.get(otherRoot.listSkins()[0]);
  const otherJoints = otherRoot.listSkins()[0].listJoints().map((j) => map.get(j));

  // 1. Retarget this clip's channels from the imported skeleton onto the
  //    shared base skeleton, matching joints by name.
  const anim = map.get(otherRoot.listAnimations()[0]);
  let retargeted = 0;
  for (const channel of anim.listChannels()) {
    const target = channel.getTargetNode();
    const shared = baseJoints.get(target.getName());
    if (!shared) throw new Error(`no base joint named ${target.getName()}`);
    channel.setTargetNode(shared);
    retargeted++;
  }
  anim.setName(src.clip);

  // 2. Move this outfit's meshes onto the shared skin, then either keep them
  //    as their own variant group or discard them.
  const importedArmature = map
    .get(otherRoot.listScenes()[0])
    .listChildren()
    .find((n) => n.getName() === 'Armature');

  if (LOOKS === 'all') {
    const group = base.createNode(`variant_${src.tag}`);
    for (const name of PER_VARIANT) {
      const node = importedArmature.listChildren().find((n) => n.getName() === name);
      if (!node) throw new Error(`${src.file} is missing node ${name}`);
      importedArmature.removeChild(node);
      node.setName(`${name}_${src.tag}`);
      node.setSkin(baseSkin); // identical joints + IBMs, verified
      group.addChild(node);
    }
    baseArmature.addChild(group);
  }

  // 3. Drop the imported scene, skeleton and skin; prune() clears the rest.
  const importedScene = map.get(otherRoot.listScenes()[0]);
  importedScene.detach();
  importedScene.dispose();
  importedArmature.dispose();
  otherSkin.dispose();
  otherJoints.forEach((j) => j.dispose());

  console.log(`merged ${src.file}  clip="${src.clip}" (${retargeted} channels retargeted)`);
}

// Only one scene should survive, and it must be the default.
for (const scene of baseRoot.listScenes()) {
  if (scene !== baseScene) scene.dispose();
}
baseRoot.setDefaultScene(baseScene);

// ------------------------------------------------------------- optimize
await base.transform(
  dedup(), // collapses the byte-identical hair/shoes/body textures + accessors
  prune({ keepAttributes: false, keepLeaves: false })
);

// mergeDocuments imports each source's buffer; a GLB may only contain one.
const buffer = baseRoot.listBuffers()[0];
baseRoot.listAccessors().forEach((a) => a.setBuffer(buffer));
baseRoot.listBuffers().forEach((b) => b !== buffer && b.dispose());

base
  .createExtension(KHRDracoMeshCompression)
  .setRequired(true)
  .setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
    encodeSpeed: 5,
    decodeSpeed: 5,
  });

await io.write(OUT, base);

// ---------------------------------------------------------------- report
const root = base.getRoot();
console.log(`\nwrote ${OUT}`);
console.log(`  looks      : ${LOOKS}`);
console.log(`  meshes     : ${root.listMeshes().map((m) => m.getName()).join(', ')}`);
console.log(`  skins      : ${root.listSkins().length}`);
console.log(`  textures   : ${root.listTextures().length}`);
console.log(`  animations : ${root.listAnimations().map((a) => a.getName()).join(', ')}`);
