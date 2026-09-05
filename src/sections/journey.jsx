import React from 'react'
import '../styles/journey.css'
import CallMeView from '../scene/CallMeView'
import ContactMe from '../components/ContactMe'

const Journey = () => {

  return (
    <div className='journey-container'>
      <div className='journey-center'>
        <ContactMe />
      </div>
      <div className='journey-right'>
      <CallMeView />
      </div>
    </div>
  )
}

export default Journey
