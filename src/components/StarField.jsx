import { useMemo } from 'react';
import '../styles/starfield.css';

// Generate a `box-shadow` string scattering `count` stars across a
// `spread`×`spread` px area. Computed once per layer (no animation loop,
// no canvas) — the drift/twinkle is done entirely in CSS on the GPU.
function buildShadow(count, spread) {
  let shadow = '';
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * spread);
    const y = Math.floor(Math.random() * spread);
    shadow += `${x}px ${y}px #FFF${i === count - 1 ? '' : ', '}`;
  }
  return shadow;
}

const SPREAD = 2000;

const StarField = () => {
  // Three depth layers: small/dense/slow → large/sparse/fast for parallax.
  const layers = useMemo(
    () => ({
      small: buildShadow(700, SPREAD),
      medium: buildShadow(200, SPREAD),
      large: buildShadow(60, SPREAD),
    }),
    []
  );

  return (
    <div className="starfield" aria-hidden="true">
      <div className="stars stars--sm" style={{ '--shadow': layers.small }} />
      <div className="stars stars--md" style={{ '--shadow': layers.medium }} />
      <div className="stars stars--lg" style={{ '--shadow': layers.large }} />
    </div>
  );
};

export default StarField;
