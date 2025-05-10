import React from 'react';
import styled from 'styled-components';

const SpaceCard = ({url,ProjectName,link="#",description,date=2023}) => {
    const [descriptionShown, setDescriptionShown] = React.useState(false);
    const handleDescriptionToggle = () => {
        setDescriptionShown(!descriptionShown);
    }
  return (
    <StyledWrapper>
      <div className="card" onClick={handleDescriptionToggle}>
 {  descriptionShown ? <>
      <h1 className='title'>{ProjectName}</h1>
      <h3>{description}</h3>
      <h4 >{link==""?<></>:<a href={link} className='link-header'>visit here !</a>}</h4>

 </>:   <> <img src={url} alt="" className="image" />
        <div className="heading"></div>
        <h2>{ProjectName}</h2>
        <h3>Created at : {date}</h3>
        </>
      }
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
    .link-header{
      color: white;
        text-decoration: underline;
      }
        .title{
          font-size:2rem;
          font-weight: bold;
           text-shadow: #ff218589;
        }
  .card {
    position: relative;
    width: 19em;
    height: 25em;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: Montserrat;
    font-weight: bold;
    padding: 1em 2em 1em 1em;
    border-radius: 20px;
    overflow: hidden;
    z-index: 1;
    row-gap: 1em;
    background: rgba(25, 55, 5, 0.1);
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
    border: 1.5px solid rgba(255, 255, 255, 0.13);
  }
  .card img {
    width: 300px;
    margin-right: 1em;
    animation: move 10s ease-in-out infinite;
    z-index: 5;
  }
  .image:hover {
    cursor: -webkit-grab;
    cursor: grab;
  }



  .card::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    inset: -3px;
    border-radius: 10px;
    background: radial-gradient(#c340da, transparent, transparent);
    transform: translate(-5px, 250px);
    transition: 0.4s ease-in-out;
    z-index: -1;
  }
  .card:hover::before {
    width: 150%;
    height: 100%;
    margin-left: -4.25em;
  }
  .card::after {
    content: "";
    position: absolute;
    inset: 2px;
    border-radius: 20px;
    transition: all 0.4s ease-in-out;
    z-index: -1;
  }

  .heading {
    z-index: 2;
    transition: 0.4s ease-in-out;
  }
  .card:hover .heading {
    letter-spacing: 0.025em;
  }

  .heading::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: 2px;
    border-radius: 50%;
    opacity: 1;
    box-shadow: 220px 118px #fff, 280px 176px #fff, 40px 50px #fff,
      60px 180px #fff, 120px 130px #fff, 180px 176px #fff, 220px 290px #fff,
      520px 250px #fff, 400px 220px #fff, 50px 350px #fff, 10px 230px #fff;
    z-index: -1;
    transition: 1s ease;
    animation: 1s glowing-stars linear alternate infinite;
    animation-delay: 0s;
  }
  
  
  .card:hover .heading::before,
  .card:hover .icons::before,
  .card:hover .icons::after {
    filter: blur(2px);
  }

  .image:active {
    cursor: -webkit-grabbing;
    cursor: grabbing;
  }
  .image:active + .heading::before {
    box-shadow: 240px 20px #9b40fc, 240px 25px #9b40fc, 240px 30px #9b40fc,
      240px 35px #9b40fc, 240px 40px #9b40fc, 242px 45px #9b40fc,
      246px 48px #9b40fc, 251px 49px #9b40fc, 256px 48px #9b40fc,
      260px 45px #9b40fc, 262px 40px #9b40fc;
    animation: none;
    filter: blur(0);
    border-radius: 2px;
    width: 0.45em;
    height: 0.45em;
    scale: 0.65;
    transform: translateX(9em) translateY(1em);
  }
  .image:active ~ .icons::before {
    box-shadow: 262px 35px #9b40fc, 262px 30px #9b40fc, 262px 25px #9b40fc,
      262px 20px #9b40fc, 275px 20px #9b40fc, 275px 24px #9b40fc,
      275px 28px #9b40fc, 275px 32px #9b40fc, 275px 36px #9b40fc,
      275px 40px #9b40fc, 275px 44px #9b40fc, 275px 48px #9b40fc;
    animation: none;
    filter: blur(0);
    border-radius: 2px;
    width: 0.45em;
    height: 0.45em;
    scale: 0.65;
    transform: translateX(9em) translateY(1em);
  }
  .image:active ~ .icons::after {
    box-shadow: 238px 60px #9b40fc, 242px 60px #9b40fc, 246px 60px #9b40fc,
      250px 60px #9b40fc, 254px 60px #9b40fc, 258px 60px #9b40fc,
      262px 60px #9b40fc, 266px 60px #9b40fc, 270px 60px #9b40fc,
      274px 60px #9b40fc, 278px 60px #9b40fc, 282px 60px #9b40fc,
      234px 60px #9b40fc, 234px 60px #9b40fc;
    animation: none;
    filter: blur(0);
    border-radius: 2px;
    width: 0.45em;
    height: 0.45em;
    scale: 0.65;
    transform: translateX(9em) translateY(1.25em);
  }

  .heading::after {
    content: "";
    top: -8.5%;
    left: -8.5%;
    position: absolute;
    width: 7.5em;
    height: 7.5em;
    border: none;
    outline: none;
    border-radius: 50%;
      z-index: -1;
    transition: all 0.4s ease-in-out;
  }
  .card:hover .heading::after {
    box-shadow: 0px 0px 200px rgba(193, 119, 241, 1),
      0px 0px 200px rgba(135, 42, 211, 1), inset #9b40fc 0px 0px 40px -12px;
  }

  .card:hover .instagram::before,
  .card:hover .x::before,
  .card:hover .discord::before {
    filter: blur(3px);
  }
  

  @keyframes shootingStar {
    0% {
      transform: translateX(0) translateY(0);
      opacity: 1;
    }
    50% {
      transform: translateX(-55em) translateY(0);
      opacity: 1;
    }
    70% {
      transform: translateX(-70em) translateY(0);
      opacity: 0;
    }
    100% {
      transform: translateX(0) translateY(0);
      opacity: 0;
    }
  }

  @keyframes move {
    0% {
      transform: translateX(0em) translateY(0em);
    }
    25% {
      transform: translateY(-1em) translateX(-1em);
      rotate: -10deg;
    }
    50% {
      transform: translateY(1em) translateX(-1em);
    }
    75% {
      transform: translateY(-1.25em) translateX(1em);
      rotate: 10deg;
    }
    100% {
      transform: translateX(0em) translateY(0em);
    }
  }

  @keyframes glowing-stars {
    0% {
      opacity: 0;
    }

    50% {
      opacity: 1;
    }

    100% {
      opacity: 0;
    }
  }
    @keyframes glowing-lune {
    0% {
    font-size: 1rem;
    }
    50% {
        font-size: 1.005rem;
    }
    100% {
        font-size: 1.01rem;
    }
    }
    .card h3 {
    color: #e0e0ff;
    font-size: 1.08rem;
    text-align: center;
    margin: 1.2em 0 0 0;
    font-weight: 400;
    line-height: 1.6;
    letter-spacing: 0.01em;
    padding: 0 0.5em;
  }

  @media (max-width: 900px) {
  .card {
    width: 95vw;
    min-width: 0;
    max-width: 98vw;
    height: auto;
    padding: 1em 0.5em;
  }
  .card img {
    width: 80vw;
    max-width: 260px;
  }
  h1, h2, h3, h4 {
    font-size: 1.1em;
    word-break: break-word;
    text-align: center;
  }
}
    `;
  

export default SpaceCard;
