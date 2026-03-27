import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initMsal } from './services/msalConfig'

// Initialise MSAL avant le rendu (obligatoire depuis MSAL v3)
initMsal().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
