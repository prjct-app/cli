import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Set dark mode by default
if (!localStorage.getItem('theme')) {
  localStorage.setItem('theme', 'dark')
  document.documentElement.classList.add('dark')
} else if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)