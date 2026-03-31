import { PublicClientApplication } from '@azure/msal-browser'

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

export const loginRequest = {
  scopes: ['User.Read', 'GroupMember.Read.All'],
}

// MSAL nécessite window.crypto.subtle (disponible uniquement en HTTPS ou localhost).
// On instancie de manière conditionnelle pour éviter un crash en HTTP.
let msalInstance = null
try {
  msalInstance = new PublicClientApplication(msalConfig)
} catch (e) {
  console.warn('MSAL non disponible (contexte non sécurisé ou crypto absent) :', e.message)
}

export { msalInstance }

// Initialisation obligatoire avant tout usage
export async function initMsal() {
  if (!msalInstance) return
  await msalInstance.initialize()
  // Gérer la réponse de redirection si elle existe
  await msalInstance.handleRedirectPromise()
}
