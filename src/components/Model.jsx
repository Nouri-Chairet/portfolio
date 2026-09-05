import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Suspense } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import useInView from "../hooks/useInView";
import CanvasErrorBoundary from "./CanvasErrorBoundary";


gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);

// Clip names carried over from the three source exports, now merged into
// public/character.glb. See scripts/merge-character.mjs.
const IDLE_CLIP = "Energic_conductor_Clean";
const DANCE_CLIP = "Brag_n_Claps_Clean";

const Avatar = ({ character, scale }) => {
    let deviationY = 0;
    switch (scale) {
        case 0.8:
            deviationY = -1;
            break;
        case 0.9:
            deviationY = -0.5;
            break;
        default:
            break;
    }
    // useGLTF caches per URL, and CallMe.jsx loads this same file into its own
    // canvas. A three.js object can only live in one scene graph, so clone it
    // (SkeletonUtils, not Object3D.clone, to rebind the skeleton).
    const scene = useMemo(() => cloneSkinned(character.scene), [character.scene]);
    const { actions } = useAnimations(character.animations, scene);
    const [active, setActive] = useState(false);
    const danceTimeoutRef = useRef(null);
    const modelRef = useRef();

    useEffect(() => {
        if (modelRef.current) {
            gsap.fromTo(modelRef.current.position,
                { x: 0, y: 0, z: 0 },
                {
                    duration: 2,
                    x: 10,
                    y: 9.6,
                    z: -60,
                    scrollTrigger: {
                        trigger: ".hero",
                        start: 'top ',
                        end: 'bottom',
                        toggleActions: 'restart pause reverse pause',
                        scrub: 1,
                        pin: false,
                    },
                }
            );
        }

        // The idle and dance clips now share one mixer, so only one may be
        // active at a time — two running actions would blend into each other.
        const idle = actions[IDLE_CLIP];
        if (idle) {
            idle.play();
            idle.paused = true;
            idle.setLoop(THREE.LoopOnce);
            idle.clampWhenFinished = true;
            setTimeout(() => {
                idle.paused = false;
                idle.play();
                idle.getMixer().addEventListener("finished", () => {
                    idle.paused = true;
                });
            }, 2200);
        }
    }, [actions]);

    // TODO: the dance used to play a commercial backing track, which was removed
    // for licensing reasons. A royalty-free track can be swapped back in here,
    // but only behind an explicit user-initiated play (a visible unmute/play
    // control) — never auto-started on model click, and never preloaded.
    const handleClick = useCallback(() => {
        const idle = actions[IDLE_CLIP];
        const dance = actions[DANCE_CLIP];
        if (!idle || !dance) return;

        // Stop dancing and hold the first frame of the idle clip.
        const rest = () => {
            dance.stop();
            idle.reset();
            idle.play();
            idle.paused = true;
        };

        if (active) {
            clearTimeout(danceTimeoutRef.current);
            setActive(false);
            rest();
            return;
        }

        if (!idle.paused) {
            idle.paused = true;
        }
        else{
            // Ends the dance and returns to the idle pose after one run.
            danceTimeoutRef.current = setTimeout(() => {
                setActive(false);
                rest();
            }, 30000);

            setActive(true);
            idle.stop();
            dance.reset();
            dance.paused = false;
            dance.play();
        }
    }, [active, actions]);

    useEffect(() => () => clearTimeout(danceTimeoutRef.current), []);

   

    const zigzagPoints = [
        { x: -10, y: -2.4+deviationY, z: -100 },
        { x: -5, y: -1.4+deviationY, z: -12 },
        { x: 5, y: -0.4+deviationY, z: -10 },
        { x: 0, y: -0+deviationY, z: 0 },
    ];

    useEffect(() => {
        gsap.to(modelRef.current.position, {
            motionPath: {
                path: zigzagPoints,
                type: "cubic",
            },
            duration: 1.8,
            ease: "sine.inOut",
        });
    }, []);

    return (
        <primitive
            object={scene}
            ref={modelRef}
            scale={5*scale}
            position={[0, deviationY, 0]}
            onClick={handleClick}
        />
    );
};

const Base = ({ scene ,scale}) => {
    const baseRef = useRef();
    const zigzagPoints = [
        { x: -10, y: -7, z: -100 },
        { x: -5, y: -6, z: -12 },
        { x: 5, y: -5, z: -10 },
        { x: 0, y: -4.39, z: 0 },
    ];

    useEffect(() => {
        if (baseRef.current) {
            gsap.fromTo(baseRef.current.position,
                { x: 0, y: -4.4, z: 0 },
                {
                    duration: 2,
                    x: 10,
                    y: 6.8,
                    z: -60,
                    scrollTrigger: {
                        trigger: ".hero",
                        start: 'top top',
                        end: 'bottom',
                        toggleActions: 'restart pause reverse pause',
                        scrub: 1,
                    },
                }
            );
            gsap.to(baseRef.current.position, {
                motionPath: {
                    path: zigzagPoints,
                    type: "cubic",
                },
                duration: 1.8,
                ease: "sine.inOut",
            });
        }
    }, []);

    useFrame(() => {
        if (baseRef.current) {
            baseRef.current.rotation.y += 0.001;
        }
    });

    return (
        <primitive
            object={scene}
            ref={baseRef}
            scale={1.8*scale}
            position={[0, -4.3, -100]}
        />
    );
};

// Inner scene: only mounts (and so only triggers the GLB downloads via
// useGLTF) once the wrapper has scrolled into view.
const ModelScene = ({ finish }) => {
    const character = useGLTF('/character.glb');
    const baseModel = useGLTF('/ufo.glb', true);

    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 600) setScale(0.9);
            else if (window.innerWidth < 1024) setScale(0.8);
            else setScale(1);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <CanvasErrorBoundary>
            <Canvas
                shadows
                dpr={[1, 2]}
                camera={{
                    position: [4, 6, 23],
                    fov: 50,
                }}
                gl={{
                    preserveDrawingBuffer: true,
                    // Allow a software (SwiftShader) fallback when no GPU is available.
                    failIfMajorPerformanceCaveat: false,
                    powerPreference: 'high-performance',
                }}
            >
                <directionalLight
                    position={[0, 26, 0]}
                    intensity={1.3}
                    castShadow
                />
                <ambientLight intensity={1} />
                {finish ? <></> : <>
                    <Suspense fallback={null}>
                        <Avatar character={character} scale={scale} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <Base scene={baseModel.scene} scale={scale} />
                    </Suspense>
                </>}
            </Canvas>
        </CanvasErrorBoundary>
    );
};

const Model = ({ finish }) => {
    const [ref, inView] = useInView();
    return (
        <div className='model' ref={ref}>
            {inView && <ModelScene finish={finish} />}
        </div>
    );
};

export default React.memo(Model);
