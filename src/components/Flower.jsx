import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { Suspense } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import '../styles/journey.css';
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

const Base = ({model}) => {
    const { scene, animations } = model;
    const { actions } = useAnimations(animations, scene);
    const action = actions[Object.keys(actions)[0]];
    action.play();
    

    const baseRef = useRef();
    useEffect(() => {

        if(baseRef.current) {
           
          
            gsap.fromTo(
                baseRef.current.rotation,
                { x:0,z:0},
                {
                    x: Math.PI/8,
                    z: -Math.PI/6,
                    duration: 3,
                    ease: "power1.inOut",                    
                    scrollTrigger: {
                        trigger: ".hero",
                        start: 'center ',
                        end: 'bottom',
                        scrub: 1,
                        markers: true,
                        toggleActions: 'play pause reverse pause',
                        pin: false,
                    },
                }
            );}
        },[]);
  
    return (
        <primitive
            object={scene}
            ref={baseRef}
            scale={3.3}
            position={[2.3, -2, 0]}
            rotation={[Math.PI/8, Math.PI/10, -Math.PI/6]}

        />
    );
};





const Flower = () => {
    const baseModel = useGLTF('/models/bouquet.glb', true);



    return (
        <div className='flower'>
            {
                <Canvas
                    shadows
                    gl={{ preserveDrawingBuffer: true }}
                    style={{ height: "100%", width: "100%",filter: 'drop-shadow(0 0 0.25rem    #ffae00c1 )' }}
                >
                    <directionalLight
                        position={[0, 10, 6]}
                        intensity={4.3} // Adjust brightness
                        castShadow
                    />

                    <ambientLight intensity={1} />
                    <Suspense fallback={null}>
                        <Base model={baseModel} />
                    </Suspense>

                </Canvas>}
        </div>
    );
};

export default Flower;