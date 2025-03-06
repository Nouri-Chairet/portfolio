import React from 'react';
import styled from 'styled-components';

const Loader = () => {
  return (
    <StyledWrapper>
      <div className="loader" />
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .loader {
    width: fit-content;
    font-size: 50px;
    font-family: monospace;
    font-weight: bold;
    text-transform: uppercase;
    color: #0000;
    -webkit-text-stroke: 1px #000;
    background: linear-gradient(90deg, #0000 33%, #000 0 67%, #0000 0) 100%/300%
      100% no-repeat text;
    animation: l12 4s steps(14) infinite;
  }
  .loader:before {
    content: "Loading";
  }
  @keyframes l12 {
    to {
      background-position: 0;
    }
  }`;

export default Loader;
