import React from 'react'
import '../styles/contact.css'
import githubIcon from '../assets/GitHub-Symbol.png'
import linkedinIcon from '../assets/linkedin.png'
const ContactMe = () => {
  return (
    <div className='contact-container'>

  <h2 className='contact-title'>Contact Me</h2>
  <p className='contact-text'>You can reach me at my email: <br/> nouric576@gmail.com</p>
  <div className='contact-links'>
    <a href='https://www.linkedin.com/in/yourprofile' target='_blank' rel='noopener noreferrer'>
      <img src={linkedinIcon} alt='LinkedIn' className='contact-icon' />
    </a>
    <div className='contact-divider'>

    <a href='https://github.com/yourprofile' target='_blank' rel='noopener noreferrer'>
      <img src={githubIcon} alt='GitHub' height={70} />
    </a>
    </div>

  </div>
    </div> 
  )
}

export default ContactMe
