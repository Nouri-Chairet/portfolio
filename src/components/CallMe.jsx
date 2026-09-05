import React, { useRef, useEffect, useMemo } from 'react';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/journey.css';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import useInView from '../hooks/useInView';
import CanvasErrorBoundary from './CanvasErrorBoundary';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

// One of the three clips merged into public/character.glb.
const CALL_CLIP = 'Call_Me_Clean';

const Base = ({ character }) => {
  // Model.jsx loads the same cached GLTF into a different canvas, so this
  // canvas needs its own skinned clone of the scene graph.
  const scene = useMemo(() => cloneSkinned(character.scene), [character.scene]);
  const { actions } = useAnimations(character.animations, scene);
  const action = actions[CALL_CLIP];

  const baseRef = useRef();
  useEffect(() => {
    if (action) {
        action.setLoop(THREE.LoopOnce);
        action.reset();  
      action.play(); 
      action.paused = true; 
      action.clampWhenFinished = true;

    }

    ScrollTrigger.create({
      trigger: '.nouri',
      start: 'top center',
      end: 'bottom center',
      toggleActions: 'restart pause reverse pause',
      onEnter: () => {
        if (action) {
            action.reset(); // Reset animation state
          action.paused = false; 
          action.play();   
           action.getMixer().addEventListener("finished", () => {
            console.log("Animation finished");
            action.paused = true;
        });
        }
      },
     
    });

    return () => {
      ScrollTrigger.killAll(); 
    };
  }, [action]);


  const handleClick = () => {
    if (action) {
      action.reset();
      action.paused = false;
      action.play();
    }
  };

  return (
    <primitive
      object={scene}
      ref={baseRef}
      scale={2.4}
      position={[0, -2.7, 1.3]}
      rotation={[0, -Math.PI/100, 0]}
      onClick={handleClick} 
    />
  );
};

// Inner scene: useGLTF only fires the character GLB download once mounted
// (and it is the same cached file Model.jsx uses, so it downloads once).
const CallMeScene = () => {
  const character = useGLTF('/character.glb', true);

  return (
    <CanvasErrorBoundary>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          preserveDrawingBuffer: true,
          // Allow a software (SwiftShader) fallback when no GPU is available.
          failIfMajorPerformanceCaveat: false,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 1, 5] }}
      >
        <directionalLight
          position={[0, 7, 6]}
          intensity={2.3}
          castShadow
        />
        <ambientLight intensity={1} />
        <Suspense fallback={null}>
          <Base character={character} />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  );
};

const CallMe = () => {
  const [ref, inView] = useInView();
  return (
    <div className="nouri" ref={ref}>
      {inView && <CallMeScene />}
    </div>
  );
};

export default CallMe;
