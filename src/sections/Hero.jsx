import React, { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import "../styles/hero.css";
import "../styles/heroBubble.css";
import Model from "../components/Model";
import { TextPlugin } from "gsap/TextPlugin";
import Stars from "../components/Stars";
import star from "/star.svg";
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.registerPlugin(TextPlugin);

export default function Hero() {
    const Texts = [
        "Let me introduce myself.",
        "I am currently a student at the Higher Institute of Science and Technology of Sousse,Tunisia.",
        "Where I am pursuing a degree in Software Engineering.",
        "I am a self-taught developer who loves to learn new technologies and build projects that make a difference.",
        
        "I am familiar with several programming languages and frameworks.",
        "These include Express.js, React, and React Native.",
        "I also have experience with MongoDB and some knowledge of SQL and Python.",
        "One of my notable projects is a chess game that I built from scratch using the MERN stack.",

        "As a reward for your patience, I will show you a little dance.",
        "Click on the model"
    ];
    const imgRef = useRef();
    const [text, setText] = React.useState(Texts[0]);
    const textRef = useRef();
    const [finish, setFinish] = React.useState(true);
    const heroRef = useRef();
    const [active, setActive] = React.useState(true);
    const [active2, setActive2] = React.useState(true);

    useEffect(() => {
        setTimeout(() => {
            setActive2(false);
        }, 15400);
    }, []);

    let animationTimeout;

    const handleClick = useCallback(() => {
        if (Texts.indexOf(text) === Texts.length - 1) return;
    
        clearTimeout(animationTimeout);
        const temp = text;
        setText("");
    
        animationTimeout = setTimeout(() => {
            setText(Texts[Texts.indexOf(temp) + 1]);
        }, 700);
    }, [text, Texts]);
    

    useEffect(() => {
        setTimeout(() => {
            setFinish(false);
        }, 6000);
        setTimeout(() => {
            setActive(false);
        }, 8100);
    }, []);

    useEffect(() => {
        if (textRef.current && text !== "") {
            gsap.killTweensOf(textRef.current); 
            gsap.to(textRef.current, {
                duration: 2.2,
                text: active2 ? "" : text,
                delay: 0.2,
            });
        } else {
            if (textRef.current) {
                gsap.to(textRef.current, {
                    duration: 0.3,
                    text: "",
                });
            }
        }
    }, [text, active2]);

    useEffect(() => {
        gsap.to(".hero-name", {
            duration: 2,
            text: "Hi, I'm Nouri",
            delay: 1,
        });
        gsap.to(".hero-welcome", {
            duration: 2,
            text: "Welcome to my portfolio!",
            delay: 3.3,
        });
    }, []);

    useEffect(() => {
        const star = imgRef.current;
        if (star) {
            gsap.fromTo(star,
                { y: 0, rotation: 0 },
                {
                    rotation: 960,
                    y: 20,
                    duration: 3,
                    scrollTrigger: {
                        trigger: ".hero",
                        start: 'top ',
                        end: 'bottom',
                        toggleActions: 'restart pause reverse pause',
                        scrub: 1,
                    },
                });
        }
    
                gsap.fromTo(".hero-intro",{
                    x:0,
                    y:0,
                    scale:1,
                    
                } ,{
                    x:390,
                    y:-130,
                    scale:0.4,
                    scrollTrigger: {
                        trigger: ".hero",
                        start: 'top ',
                        end: 'bottom',
                        toggleActions: 'restart pause reverse pause',
                        scrub: 0,
                    },
                   
                });
                gsap.to(".hero-name",{
                    x:0,
                    y:-300,

                    scale:0.8,
                    scrollTrigger: {
                        trigger: ".hero",
                        start: 'top ',
                        end: 'bottom',
                        toggleActions: 'restart pause reverse pause',
                        scrub: 0,
                    },  
                }); 
                gsap.to(".hero-welcome",{
                    x:0,
                    y:-300,

                    scale:0.8,
                    scrollTrigger: {
                        trigger: ".hero",
                        start: 'top ',
                        end: 'bottom',
                        toggleActions: 'restart pause reverse pause',
                        scrub: 0,
                    },  
                }); 

    }, []);



    return (
        <section className="hero" >
            <div ref={heroRef} className={finish ? "full-hero" : "hero-left"}>
                <h1 className="hero-name"></h1>
                <p className="hero-welcome"></p>
            </div>

            <div className={finish ? "inv" : "hero-right"}>
                <div style={{ height: "100vh", width: "70vh"}}>
                    <Stars number={1000} />
                </div>
                <div ref={imgRef} className="hero-img" >
                    <img src={star} alt="star" />
                </div>

                    <Model
                       
                        finish={active}
                    />


                <div className="hero-intro">
                    {active2 ? <></> :
                        <div className={active2 ? "" : "bubble"} onClick={handleClick} ref={textRef}>
                            {text === Texts[0] ? text : ""}
                        </div>
                    }
                </div>
            </div>
        </section>
    );
}