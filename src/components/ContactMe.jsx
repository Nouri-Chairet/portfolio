import React from 'react'
import '../styles/contact.css'
import githubIcon from '../assets/github_logo.svg'
import linkedinIcon from '../assets/linkedin.png'
const ContactMe = () => {
  return (
    <div className='contact-container'>

  <h2 className='contact-title'>Contact Me</h2>
  <p className='contact-text'>You can reach me at my email: <br/> nouric576@gmail.com</p>
  <div className='contact-links'>
    <a href='https://www.linkedin.com/in/nouri-ch-554021266/' target='_blank' rel='noopener noreferrer'>
      <img src={linkedinIcon} alt='LinkedIn'  height={110} />
    </a>
    

    <a href='https://github.com/Nouri-Chairet' target='_blank' rel='noopener noreferrer'>
      <img src={githubIcon} alt='GitHub' height={70} />
    </a>
   

  </div>
    </div> 
  )
}

export default ContactMe
