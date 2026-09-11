import { useEffect, useRef, useState } from 'react';

/**
 * Frame-rate readout, shown only with `?perf=1`.
 *
 * Deliberately dependency-free rather than pulling in r3f-perf: it is ~40
 * lines, it ships nothing unless the query flag is present, and the number
 * that matters here is simply the frame time.
 *
 * Pair it with the other overrides to isolate a cost:
 *   ?perf=1                    what visitors actually get
 *   ?perf=1&bloom=0            frame cost of the Bloom pass
 *   ?perf=1&stars=low&bloom=0  the handheld tier
 */
const PerfOverlay = ({ quality, bloom, dpr }) => {
  const [stats, setStats] = useState({ fps: 0, ms: 0, p95: 0 });
  const frames = useRef([]);

  useEffect(() => {
    let raf;
    let last = performance.now();
    let sinceReport = 0;

    const tick = () => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      frames.current.push(delta);
      if (frames.current.length > 180) frames.current.shift();
      sinceReport += delta;

      if (sinceReport > 500 && frames.current.length > 10) {
        sinceReport = 0;
        const sorted = [...frames.current].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        setStats({
          fps: Math.round(1000 / median),
          ms: Number(median.toFixed(1)),
          p95: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(1)),
        });
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const starCount = quality === 'low' ? 2360 : 5900;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 40,
        padding: '6px 10px',
        font: '12px/1.5 monospace',
        color: '#F3F3E0',
        background: 'rgba(5,20,67,0.82)',
        border: '1px solid rgba(243,243,224,0.35)',
        borderRadius: 4,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {`${stats.fps} fps   ${stats.ms}ms  p95 ${stats.p95}ms
stars ${starCount}  bloom ${bloom ? 'on' : 'off'}
dpr ${dpr}  quality ${quality}`}
    </div>
  );
};

export default PerfOverlay;
