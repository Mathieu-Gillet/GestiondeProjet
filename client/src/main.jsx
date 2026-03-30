import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initMsal } from './services/msalConfig'

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

// Initialise MSAL avant le rendu (obligatoire depuis MSAL v3)
// Si Azure AD n'est pas configuré, on démarre quand même l'app
initMsal().then(renderApp).catch(renderApp)
