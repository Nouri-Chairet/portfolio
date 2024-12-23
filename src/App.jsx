import React ,{ useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Hero from './components/Hero';
import Journey from './components/journey';
import './App.css';

gsap.registerPlugin(ScrollTrigger);

function App() {
  const pan1=React.useRef();
  const pan2=React.useRef();
  const pan3=React.useRef();
  useEffect(() => { 
    const panels = gsap.utils.toArray('.panel');
    panels.forEach((panel) => {
      ScrollTrigger.create({
        trigger: panel,
        start: 'top top',
        pin: true,
        pinSpacing: false,

        snap: 1,
      });
    });

    // Clean-up function to remove ScrollTriggers on component unmount
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <>
      <div ref={pan1} className='panel'><Hero /></div>
      <div ref ={pan2} className='panel'><Journey /></div>
    </>
  );
}

export default App;


