import React from 'react'
import '../styles/journey.css'
import CallMe from '../components/CallMe'
import ContactMe from '../components/ContactMe'

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
