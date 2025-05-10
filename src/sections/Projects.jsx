import React, { useEffect, useRef, useState } from 'react';
import '../styles/Projects.css';
import HandwritingSVG from '../components/ui/HandWriting';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SpaceCard from '../components/ui/SpaceCard';
gsap.registerPlugin(ScrollTrigger);
import chess from '/chess.png'
import car from '/car.png'
import school from '/edu.png'
import Lottie from 'lottie-react';
import lottieBg from '../assets/lottie.json';
import { useNavigate } from 'react-router-dom';

const Projects = () => {
  const containerRef = useRef(null);
  const titleRef = useRef(null);





  const greeceProjects = [
    {
      id: 'chessiworld',
      title: 'Chessiworld',
      description:
        'A fully functional, real-time chess game with a 3D chessboard model. This full-stack application enables online play via WebSocket, providing users with an interactive and engaging chess experience.',
      link: 'https://www.chessiworld.com',
      image: chess,
      date:2023
    },
    {
      id: 'car-estimator',
      title: 'Car Price Estimator',
      description:
        'An AI-driven car price estimation tool that leverages PyTorch and FastAPI. By considering various car features (make, model, year, mileage, and more), it generates an estimated market value. The project is hosted on Google Cloud.',
      link: 'https://car-estimation.vercel.app/',
      image: car, 
      date:2025
    },
    {
      id: 'school-manager',
      title: 'School Management ',
      description:
        'A comprehensive student management system designed to streamline attendance tracking, student performance, and scheduling for educational institutions. The system includes three user interfaces (admin, teacher, student) and is currently under development.\nTech Stack used React,Django,PostgreSql',
      link: '',
      image: school, 
      date:2025
    },
  ];
  const navigate =useNavigate();

  return (
    <section className="projects-container" ref={containerRef} style={{ position: 'relative', overflow: 'hidden' }}>
      <Lottie
        animationData={lottieBg}
        loop
        autoplay
       style={
        {
          zIndex: 0,
          position: 'absolute',
        }
       }
      />
      <div className="projects-content">
        <button className='return-back' onClick={()=>{navigate('/')}}>Return</button>
      <div className="projects-title" ref={titleRef}>
        <HandwritingSVG />
      </div>
        <div className="space-cards">
          {greeceProjects.map((project) => (
            <SpaceCard
              key={project.id}
              url={project.image}
              ProjectName={project.title}
              link={project.link}
              description={project.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Projects;
