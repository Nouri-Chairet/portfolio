import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Run `ANALYZE=1 npm run build` to emit dist/stats.html with the treemap.
    process.env.ANALYZE &&
      visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing libraries into long-cacheable vendor
        // chunks instead of one monolithic bundle.
        //
        // Function form, not the object form this used to use. The object form
        // entangled the vendor chunks — react-vendor ended up with a static
        // import of three-vendor, which made three.js a static dependency of
        // the entry and put a modulepreload for it in index.html. Every
        // visitor downloaded ~287 KB of renderer, including the ones on the
        // `low` tier who never mount a canvas at all.
        //
        // Matching on resolved module ids keeps the boundaries clean: three
        // and its React bindings are reachable only from the lazily-imported
        // canvas, so the chunk is a dynamic dependency and is fetched when the
        // canvas is.
        manualChunks(id) {
          // Vite's dynamic-import preload helper is a tiny virtual module with
          // no home of its own. Left unassigned, Rollup free-placed it inside
          // three-vendor — so the entry chunk imported one helper function and
          // dragged 287 KB of three.js into the critical path with it. Pin it
          // to a chunk every visitor loads anyway.
          if (id.includes('preload-helper')) return 'react-vendor';
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](three|@react-three|postprocessing|maath)[\\/]/.test(id)) {
            return 'three-vendor';
          }
          if (/[\\/]node_modules[\\/]gsap[\\/]/.test(id)) return 'gsap-vendor';
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
})
