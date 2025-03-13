import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Suspense } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import * as THREE from "three";


gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);

const Avatar = ({ models,scale }) => {
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
    const { mainModel,  danceModel } = models;
    const [music] = useState(() => new Audio("/Bassthoven (Animated Music Video w_ _King Science )(MP3_320K).mp3")); // Replace with your actual music path
    const { scene: mainScene, animations: mainAnimations } = mainModel;
    const { scene: danceScene, animations: danceAnimations } = danceModel;
    const { actions: mainActions } = useAnimations(mainAnimations, mainScene);
    const { actions: danceActions } = useAnimations(danceAnimations, danceScene);
    const [active, setActive] = useState(false);
    const [currentScene, setCurrentScene] = useState(mainScene);
    const musicTimeoutRef = useRef(null);
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

        if (mainActions) {
            const action = mainActions[Object.keys(mainActions)[0]];
            action.play();
            action.paused = true;
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            setTimeout(() => {
                action.paused = false;
                action.play();
                action.getMixer().addEventListener("finished", () => {
                    action.paused = true;
                });
            }, 2200);
        }

        if (danceActions) {
            danceActions[Object.keys(danceActions)[0]].play();
            danceActions[Object.keys(danceActions)[0]].paused = true;
        }
    }, [mainActions, danceActions]);

    const handleClick = useCallback(() => {
        if (active) {
            music.pause();
            music.currentTime = 0;
            clearTimeout(musicTimeoutRef.current);
            setActive(false);
            setCurrentScene(mainScene);
            mainActions[Object.keys(mainActions)[0]].reset();
            mainActions[Object.keys(mainActions)[0]].paused = true;
            danceActions[Object.keys(danceActions)[0]].paused = true;
            danceActions[Object.keys(danceActions)[0]].stop();
            return;
        }
      
        if (!mainActions[Object.keys(mainActions)[0]].paused) {
            mainActions[Object.keys(mainActions)[0]].paused = true;
        }
        else{
            music.play().then(() => {
                console.log("Music playing");
            });
            musicTimeoutRef.current = setTimeout(() => {
                music.pause();
                music.currentTime = 0;
                setCurrentScene(mainScene);
                mainActions[Object.keys(mainActions)[0]].reset();
                mainActions[Object.keys(mainActions)[0]].paused = true;
                danceActions[Object.keys(danceActions)[0]].paused = true;
            }, 30000);

            mainActions[Object.keys(mainActions)[0]].reset();
            mainActions[Object.keys(mainActions)[0]].paused = false;
            setActive(true);
            setCurrentScene(danceScene);
            danceActions[Object.keys(danceActions)[0]].paused = false;
            danceActions[Object.keys(danceActions)[0]].play();
         
        } 
    }, [active, mainActions, danceActions, music, mainScene, danceScene]);

   

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
            object={currentScene === mainScene ? mainScene : danceScene}
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

const Model = ({finish }) => {
    const mainModel = useGLTF('/models/costume_launch.glb');
    const danceModel = useGLTF('/models/dancing.glb');
    const baseModel = useGLTF('/models/ufo.glb',true);
    const models = {
        mainModel,
        danceModel,
    };

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
        <div className='model'>
            <Canvas
                shadows
                camera={{
                    position: [4, 6, 23],
                    fov: 50,
                }}
                gl={{ preserveDrawingBuffer: true }}
            >
                <directionalLight
                    position={[0, 26, 0]}
                    intensity={1.3}
                    castShadow
                />
                <ambientLight intensity={1} />
                {finish ? <></> : <>
                    <Suspense fallback={null}>
                        <Avatar models={models} scale={scale} />
                    </Suspense>
                    <Suspense fallback={null}>
                        <Base scene={baseModel.scene} scale={scale} />
                    </Suspense>
                </>}
            </Canvas>
        </div>
    );
};

export default React.memo(Model);
