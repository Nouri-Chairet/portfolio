import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

gsap.registerPlugin(ScrollTrigger);

// One of the three clips merged into public/character.glb.
const CALL_CLIP = 'Call_Me_Clean';

/**
 * The character waving in the journey panel. Plain R3F, rendered into the
 * site's single canvas through the journey's <View>.
 */
const CallMePose = ({ hitArea }) => {
  const character = useGLTF('/character.glb', true);
  // Astronaut clones the same cached GLTF for the hero view; a three.js object
  // can only live in one scene graph, so this needs its own clone too.
  const scene = useMemo(() => cloneSkinned(character.scene), [character.scene]);
  const { actions } = useAnimations(character.animations, scene);
  const action = actions[CALL_CLIP];
  const baseRef = useRef();

  useEffect(() => {
    if (!action) return undefined;

    action.setLoop(THREE.LoopOnce);
    action.reset();
    action.play();
    action.paused = true;
    action.clampWhenFinished = true;

    const onFinished = () => {
      action.paused = true;
    };

    // Previously this cleanup called ScrollTrigger.killAll(), which destroyed
    // every trigger on the page — including the hero's. gsap.context() scopes
    // the trigger to this component so revert() kills only what it created.
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: '.nouri',
        start: 'top center',
        end: 'bottom center',
        toggleActions: 'restart pause reverse pause',
        onEnter: () => {
          action.reset();
          action.paused = false;
          action.play();
          action.getMixer().addEventListener('finished', onFinished);
        },
      });
    });

    return () => {
      action.getMixer().removeEventListener('finished', onFinished);
      ctx.revert();
    };
  }, [action]);

  const handleClick = useCallback(
    (event) => {
      // Confirm the click landed on this view's own box — the event layer is
      // attached to a shared ancestor (see SceneRoot).
      if (hitArea?.current && event?.nativeEvent?.target !== hitArea.current) return;
      if (!action) return;
      action.reset();
      action.paused = false;
      action.play();
    },
    [action, hitArea]
  );

  return (
    <primitive
      object={scene}
      ref={baseRef}
      scale={2.4}
      position={[0, -2.7, 1.3]}
      rotation={[0, -Math.PI / 100, 0]}
      onClick={handleClick}
    />
  );
};

export default CallMePose;
