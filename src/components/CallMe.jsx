import React, { useRef, useEffect } from 'react';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/journey.css';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

const Base = ({ model }) => {
  const { scene, animations } = model;
  const { actions } = useAnimations(animations, scene);
  const action = actions[Object.keys(actions)[0]];

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

const CallMe = () => {
  const baseModel = useGLTF('/models/call_me.glb', true);

  return (
    <div className="nouri">
      <Canvas
        shadows
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [0, 1, 5] }}
      >
        <directionalLight
          position={[0, 7, 6]}
          intensity={2.3} 
          castShadow
        />
        <ambientLight intensity={1} />
        <Suspense fallback={null}>
          <Base model={baseModel} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default CallMe;
