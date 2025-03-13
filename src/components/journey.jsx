import React from 'react'
import '../styles/journey.css'
import CallMe from './CallMe'
import ContactMe from './ContactMe'

const Journey = () => {

  return (
    <div className='journey-container'>
      <div className='journey-center'>
        <ContactMe />
      </div>
      <div className='journey-right'>
      <CallMe />
      </div>
    </div>
  )
}

export default Journey
