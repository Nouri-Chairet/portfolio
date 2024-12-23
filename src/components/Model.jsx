import React, { useRef, useEffect, useState, forwardRef ,useCallback} from 'react';
import { Suspense } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import * as THREE from "three";

gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);

const Avatar = forwardRef(({ models }, ref) => {
    const { mainModel, introModel, danceModel, dance2Model, dance3Model } = models;
    const [music] = useState(() => new Audio("/Bassthoven (Animated Music Video w_ _King Science )(MP3_320K).mp3")); // Replace with your actual music path
    const { scene: mainScene, animations: mainAnimations } = mainModel;
    const { scene: introScene, animations: introAnimation } = introModel;
    const { scene: danceScene, animations: danceAnimations } = danceModel;
    const { scene: dance2Scene, animations: dance2Animations } = dance2Model;
    const { scene: dance3Scene, animations: dance3Animations } = dance3Model;
    const { actions: mainActions } = useAnimations(mainAnimations, mainScene);
    const { actions: introActions } = useAnimations(introAnimation, introScene);
    const { actions: danceActions } = useAnimations(danceAnimations, danceScene);
    const { actions: dance2Actions } = useAnimations(dance2Animations, dance2Scene);
    const { actions: dance3Actions } = useAnimations(dance3Animations, dance3Scene);
    const [active, setActive] = useState(false);
    const [currentScene, setCurrentScene] = useState(mainScene);
    const [currentDanceScene, setCurrentDanceScene] = useState(danceScene);
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
                action.play();    action.getMixer().addEventListener("finished", () => {
                    console.log("Animation finished");
                    action.paused = true;
                });
            }, 2200);
        }

        if (danceActions) {
            danceActions[Object.keys(danceActions)[0]].play();
            danceActions[Object.keys(danceActions)[0]].paused = true;
        }

        if (dance2Actions) {
            dance2Actions[Object.keys(dance2Actions)[0]].play();
            dance2Actions[Object.keys(dance2Actions)[0]].paused = true;
        }

        if (dance3Actions) {
            dance3Actions[Object.keys(dance3Actions)[0]].play();
            dance3Actions[Object.keys(dance3Actions)[0]].paused = true;
        }
    }, [mainActions, danceActions, dance2Actions, dance3Actions]);

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
            dance2Actions[Object.keys(dance2Actions)[0]].paused = true;
            dance3Actions[Object.keys(dance3Actions)[0]].paused = true;
            return;
        }

        if (mainActions[Object.keys(mainActions)[0]].paused) {
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
                dance2Actions[Object.keys(dance2Actions)[0]].paused = true;
                dance3Actions[Object.keys(dance3Actions)[0]].paused = true;
            }, 30000);

            mainActions[Object.keys(mainActions)[0]].reset();
            mainActions[Object.keys(mainActions)[0]].paused = false;
            setActive(true);
            setTimeout(() => {
                setCurrentScene(danceScene);
                mainActions[Object.keys(mainActions)[0]].paused = true;
                danceActions[Object.keys(danceActions)[0]].paused = false;
                dance2Actions[Object.keys(dance2Actions)[0]].paused = true;
                dance3Actions[Object.keys(dance3Actions)[0]].paused = true;

                const interval = setInterval(() => {
                    setCurrentDanceScene(prevScene => {
                        if (prevScene === danceScene) {
                            danceActions[Object.keys(danceActions)[0]].paused = true;
                            dance2Actions[Object.keys(dance2Actions)[0]].paused = false;
                            dance3Actions[Object.keys(dance3Actions)[0]].paused = true;
                            return dance2Scene;
                        } else if (prevScene === dance2Scene) {
                            dance2Actions[Object.keys(dance2Actions)[0]].paused = true;
                            dance3Actions[Object.keys(dance3Actions)[0]].paused = false;
                            return dance3Scene;
                        } else {
                            dance3Actions[Object.keys(dance3Actions)[0]].paused = true;
                            danceActions[Object.keys(danceActions)[0]].paused = false;
                            return danceScene;
                        }
                    });
                }, 3000);

                return () => clearInterval(interval);
            }, 5000);
        } else {
            mainActions[Object.keys(mainActions)[0]].paused = true;
        }
    }, [active, mainActions, danceActions, dance2Actions, dance3Actions, music, mainScene, danceScene, dance2Scene, dance3Scene]);
    const zigzagPoints = [
        { x: -10, y: -2.4, z: -100 },
        { x: -5, y: -1.4, z: -12 },
        { x: 5, y: -0.4, z: -10 },
        { x: 0, y: 0, z: 0 },
    ];
    useEffect(() => {
        gsap.to(modelRef.current.position, {
            motionPath: {
                path: zigzagPoints,
                type: "cubic",
            },
            duration: 1.8,
            ease: "sine.inOut",
        });},[]);

    return (
        <primitive
            object={currentScene === mainScene ? mainScene : currentDanceScene}
            ref={modelRef}
            scale={5}
            position={[0, 0, 0]}
            onClick={handleClick}
        />
    );
});

const Base = forwardRef(({ scene }, ref) => {
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
            scale={1.8}
            position={[0, -4.3, -100]}
        />
    );
});

const Model = forwardRef(({ url,finish }) => {
    const mainModel = useGLTF(url);
    const introModel = useGLTF('/models/intro.glb');
    const danceModel = useGLTF('/models/dancing.glb');
    const dance2Model = useGLTF('/models/dance2.glb');
    const dance3Model = useGLTF('/models/dance3.glb');
    const baseModel = useGLTF('/models/ufo.glb');
    const models = {
        mainModel,
        introModel,
        danceModel,
        dance2Model,
        dance3Model,
    };

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
                    position={[0,26,0]}
                    intensity={1.3}
                    castShadow
                />
                <ambientLight intensity={1} />
            {  finish?<></>:<>  <Suspense fallback={null}>
                    <Avatar models={models} />
                </Suspense>
                <Suspense fallback={null}>
                    <Base scene={baseModel.scene} />
                </Suspense></>}
            </Canvas>
        </div>
    );
});

export default Model;
