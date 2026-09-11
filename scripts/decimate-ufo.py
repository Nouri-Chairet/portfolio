"""
assets-src/ufo-raw.glb  ->  assets-src/ufo.glb        (geometry stage; needs Blender)

    blender --background --python scripts/decimate-ufo.py

The UFO is a background prop that renders about 120 px wide in the hero. The
raw Sketchfab export is 324,507 triangles — roughly 11 triangles per rendered
pixel, and ~90% of every triangle the GPU processes in a frame. The rigged
character that is the actual focal point is 34,172. This script cuts the prop
to ~17,200 without touching its silhouette, which at 120 px is the only thing
a viewer can resolve.

This is the geometry half of the pipeline. scripts/optimize-ufo.mjs owns the
texture half (resize -> webp -> dedup -> prune -> draco) and is what
`npm run assets:ufo` runs. Blender is not required for a normal asset rebuild;
it is only needed to regenerate assets-src/ufo.glb itself.

Do not hand-edit assets-src/ufo.glb. Every number below was measured, and the
file is reproducible from ufo-raw.glb by re-running this script.

--------------------------------------------------------------------------
WHAT THIS REMOVES, AND WHY IT IS SAFE
--------------------------------------------------------------------------

1. HIDDEN INTERIOR GEOMETRY                              -56,028 triangles

   A Sketchfab rip of a hard-surface model carries the full interior: solid
   greeble boxes buried in the hull, backsides of panels, the underside of
   the dome. A face is kept only if a ray from its centre escapes the model
   in at least one of 161 view directions (10 elevations x 16 azimuths, plus
   straight down; the UFO spins on Y, so every azimuth is eventually seen).
   All three materials are alphaMode OPAQUE, so an enclosed face can never
   contribute a pixel. 17.3% of the model was interior.

   The sweep is done twice on purpose: a 600x600 raster from each direction
   first, then a per-face escape ray for everything the raster missed. The
   raster alone reports 97,884 hidden faces, but 41,856 of those are thin
   geometry the grid stepped over rather than geometry that is occluded.
   Deleting on the raster result alone would punch holes in the hull.

2. MERGE BY DISTANCE                                    -104,687 vertices

   glTF splits vertices at every UV and normal seam, so the import arrives
   with ~40% duplicates sitting on top of each other. Decimate collapses
   across a weld but not across a split, so this has to happen first or the
   ratios below do not reach their targets.

   dist=0.01 in local units (1e-4 world). Thresholds from 0.0001 to 0.05 all
   weld exactly the same 4,097 vertices on the main hull with zero face loss
   — a clean plateau. 0.1 starts collapsing real geometry (-803 faces), so
   0.01 sits safely mid-plateau rather than at its edge.

3. SECOND UV MAP                                    4 of 5 meshes stripped

   The glTF carries TEXCOORD_1 on every mesh, but only UFO_BLACK's normal
   map samples it (`"normalTexture": {"index": 4, "texCoord": 1}`). The
   other four meshes pay for a UV set nothing reads. UFO_BLACK keeps both.
   If the normal maps are ever dropped (see optimize-ufo.mjs STRIP_NORMALS)
   this set becomes dead too and `prune` removes it automatically.

4. SUB-PIXEL LOOSE PARTS                                 -6,934 triangles

   At 120 px the model spans 9.37 world units across 120 pixels — one pixel
   is 0.078 world units. Rivets and vents smaller than that cannot resolve.
   They also set the floor on how far Decimate can go: Collapse cannot take
   a disconnected part below a tetrahedron, and UFO Metal_0 alone is 1,736
   separate parts, so ~6,900 faces of it are floor regardless of ratio.

   Culled at 2 px on the metal meshes. The emissive window ring is bright
   against a dark background and reads even when tiny, so it is culled at
   1 px only — the conservative threshold is deliberate, not an oversight.

5. DECIMATE (COLLAPSE), per object                       -244,097 triangles

   Ratios are computed from a target triangle count rather than written as
   literals, because steps 1-4 change the input count; hardcoded ratios
   would drift the moment anything above is retuned.

--------------------------------------------------------------------------
RESULT                    raw          shipped       this
--------------------------------------------------------------------------
  triangles            324,507         324,507      17,165     (-94.7%)
  vertices             264,459         263,771      29,153     (-89.0%)
  geometry VRAM         16.54 MB        16.54 MB     1.51 MB
  texture  VRAM         89.48x6         33.5 MB      7.00 MB   (at 512)
  total    VRAM        ~553 MB         ~50 MB        8.51 MB   (-83%)

Measured at 120 px against the untouched source: the silhouette (alpha
channel) differs in 4 of 14,400 pixels, and full-frame RMSE is 0.021 — lower
than the 21,051-triangle variant that keeps more geometry. A 13,750-triangle
variant was also tested and starts to soften the rim (23 silhouette pixels),
so 17,165 is where this stops.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "ufo-raw.glb"
DST = ROOT / "assets-src" / "ufo.glb"

# --- the tuned parameters -------------------------------------------------

WELD_DIST = 0.01  # local units; plateau is 0.0001-0.05, 0.1 damages geometry

# The model is 9.37 world units wide and renders ~120 px, so 1 px = 0.078 u.
MODEL_WIDTH = 9.3709
RENDER_PX = 120

# loose parts smaller than this many rendered pixels are deleted
CULL_PX = {
    "UFO_UFO Metal_0": 2.0,
    "UFO_UFO Metal_0.001": 2.0,
    "UFO_UFO Metal_0.002": 2.0,
    "UFO_Ventanilla_0": 1.0,  # emissive, reads when small - stay conservative
    "UFO_UFO_BLACK_0": 0.0,  # 7 parts, none sub-pixel
}

# target triangle count per object after Decimate (Collapse)
TARGETS = {
    "UFO_UFO Metal_0.001": 4000,
    "UFO_UFO Metal_0": 3200,  # floors at ~6,160: 1,736 disconnected parts
    "UFO_UFO Metal_0.002": 2200,
    "UFO_UFO_BLACK_0": 2400,
    "UFO_Ventanilla_0": 2400,
}

# only this material's normal map samples TEXCOORD_1
KEEP_UV1 = {"UFO_UFO_BLACK_0"}

# 161 view directions: the UFO spins, so every azimuth is eventually seen
VIEW_DIRS = [
    (k * 2 * math.pi / 16, math.radians(el))
    for el in (-60, -45, -30, -15, 0, 15, 30, 45, 60, 75)
    for k in range(16)
] + [(0.0, math.radians(89.9))]

RASTER = 600  # samples per axis for the first-pass visibility raster


def log(msg):
    print(f"[decimate-ufo] {msg}", flush=True)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_source():
    bpy.ops.import_scene.gltf(filepath=str(SRC))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    meshes.sort(key=lambda o: o.name)
    total = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    log(f"imported {SRC.name}: {len(meshes)} meshes, {total:,} triangles")
    return meshes


def find_hidden_faces(meshes):
    """Faces from which no ray escapes the model in any VIEW_DIRS direction."""
    bm = bmesh.new()
    fmap = []
    for o in meshes:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        vmap = {v.index: bm.verts.new(v.co) for v in tmp.verts}
        bm.verts.ensure_lookup_table()
        for f in tmp.faces:
            try:
                bm.faces.new([vmap[v.index] for v in f.verts])
            except ValueError:
                pass
            fmap.append((o.name, f.index))
        tmp.free()
    bm.faces.ensure_lookup_table()
    bvh = BVHTree.FromBMesh(bm)

    co = [v.co for v in bm.verts]
    lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    mid, radius = (lo + hi) / 2, (hi - lo).length / 2 * 1.05

    # pass 1 - orthographic raster from each direction
    visible = set()
    for az, el in VIEW_DIRS:
        d = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        up = Vector((0, 0, 1)) if abs(d.z) < 0.99 else Vector((0, 1, 0))
        ex = d.cross(up).normalized()
        ey = d.cross(ex).normalized()
        start = mid + d * radius
        for i in range(RASTER):
            base = start + ex * ((i / (RASTER - 1) - 0.5) * 2 * radius)
            for j in range(RASTER):
                idx = bvh.ray_cast(base + ey * ((j / (RASTER - 1) - 0.5) * 2 * radius), -d)[2]
                if idx is not None:
                    visible.add(idx)
    log(f"raster pass: {len(visible):,} of {len(fmap):,} faces hit")

    # pass 2 - the raster steps over thin geometry, so re-test every candidate
    vecs = [
        Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        for az, el in VIEW_DIRS
    ]
    hidden = set()
    for i in range(len(fmap)):
        if i in visible:
            continue
        f = bm.faces[i]
        ctr, n = f.calc_center_median(), f.normal
        for d in vecs:
            if bvh.ray_cast(ctr + n * (1e-4 if d.dot(n) > 0 else -1e-4), d)[2] is None:
                break
        else:
            hidden.add(i)
    log(f"escape re-test: {len(hidden):,} faces are genuinely enclosed")

    by_obj = {}
    for i in hidden:
        name, local = fmap[i]
        by_obj.setdefault(name, set()).add(local)
    bm.free()
    return by_obj


def loose_parts(bm):
    seen, parts = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            c = stack.pop()
            comp.append(c)
            for e in c.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf)
        parts.append(comp)
    return parts


def clean(meshes, hidden_by_obj):
    """Delete hidden faces, weld, cull sub-pixel parts, strip the dead UV set."""
    units_per_px = MODEL_WIDTH / RENDER_PX
    for o in meshes:
        me = o.data
        t0 = len(me.polygons)
        scale = o.matrix_world.to_scale()[0]

        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()

        kill = [bm.faces[i] for i in hidden_by_obj.get(o.name, ())]
        if kill:
            bmesh.ops.delete(bm, geom=kill, context="FACES")
            loose = [v for v in bm.verts if not v.link_faces]
            if loose:
                bmesh.ops.delete(bm, geom=loose, context="VERTS")

        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD_DIST)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)

        limit = CULL_PX.get(o.name, 0.0) * units_per_px
        if limit > 0:
            kill = []
            for comp in loose_parts(bm):
                vs = [v.co for f in comp for v in f.verts]
                extent = max(
                    max(v[i] for v in vs) - min(v[i] for v in vs) for i in range(3)
                )
                if extent * scale < limit:
                    kill.extend(comp)
            if kill:
                bmesh.ops.delete(bm, geom=kill, context="FACES")
                loose = [v for v in bm.verts if not v.link_faces]
                if loose:
                    bmesh.ops.delete(bm, geom=loose, context="VERTS")

        bm.to_mesh(me)
        bm.free()
        me.update()

        if o.name not in KEEP_UV1:
            for uv in list(me.uv_layers):
                if uv.name != me.uv_layers[0].name:
                    me.uv_layers.remove(uv)

        log(f"  {o.name:<22} {t0:>7,} -> {len(me.polygons):>6,} tris  before decimate")


def decimate(meshes):
    total = 0
    for o in meshes:
        target = TARGETS[o.name]
        current = len(o.data.polygons)
        ratio = min(1.0, target / current)

        mod = o.modifiers.new("dec", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)

        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()

        got = len(o.data.polygons)
        total += got
        note = "" if got <= target * 1.1 else "  (part-count floor)"
        log(f"  {o.name:<22} ratio {ratio:.4f} -> {got:>6,} tris{note}")
    return total


def export():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(DST),
        export_format="GLB",
        use_selection=True,
        # optimize-ufo.mjs owns compression; Draco here would be decoded and
        # re-encoded by every downstream pass.
        export_draco_mesh_compression_enable=False,
        # passes the source's WebP bytes through untouched rather than
        # re-encoding, so this stage is lossless on textures
        export_image_format="WEBP",
        export_image_quality=100,
        export_yup=True,
        export_apply=True,
        export_tangents=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


def main():
    if not SRC.exists():
        sys.exit(f"missing {SRC} - the untouched Sketchfab export")

    reset_scene()
    meshes = import_source()

    log("finding hidden interior geometry (161 directions, this takes ~90s)")
    hidden = find_hidden_faces(meshes)

    log("cleaning")
    clean(meshes, hidden)

    log("decimating")
    total = decimate(meshes)

    export()
    log(f"wrote {DST} - {total:,} triangles")


if __name__ == "__main__":
    main()
