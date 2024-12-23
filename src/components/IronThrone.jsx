import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { Suspense } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import '../styles/Chess.css';
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
const Avatar = ({ scene }) => {
    const { scene: avatarScene, animations } = scene;
    const { actions, mixer } = useAnimations(animations, avatarScene);

    useEffect(() => {
        if (actions) {
            const animationName = "mixamo.com"; // Use the correct animation name
            const action = actions[animationName];

            if (action) {
                action.reset().play(); // Play the animation
            }

            return () => {
                if (mixer) mixer.stopAllAction(); // Clean up mixer on unmount
            };
        }
    }, [actions, mixer]);

    return (
        <primitive
            object={avatarScene}
            scale={2}
            position={[0, -1.6, -0.5]}
            rotation={[0, -1, 0]}
        />
    );
};
const Base = (({ scene }) => {
    const baseRef = useRef();
   
     
    return (
        <primitive
            object={scene}
            ref={baseRef}
            scale={2}
            position={[0, -2, -1]}
            rotation={[0,-0.27, 0]}

        />
    );
});





const IronThrone = () => {
    const baseModel = useGLTF('/models/iron_throne.glb', true);
    const avatarModel = useGLTF('/models/relaxed.glb', true);
    return (
        <div className='throne'>
            {
                <Canvas
                    shadows
                    gl={{ preserveDrawingBuffer: true }}
                    style={{ height: "100%", width: "100%" }}
                    camera={{ position: [0, 2, 4], fov: 60 }}
                >
                    <directionalLight
                        position={[7, 4, 6]}
                        intensity={1.3} // Adjust brightness
                        castShadow
                    />

                    <ambientLight intensity={1} />
                    <Suspense fallback={null}>
                        <Base scene={baseModel.scene} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <Avatar scene={avatarModel} />
                    </Suspense>

                </Canvas>}
        </div>
    );
};

export default IronThrone;