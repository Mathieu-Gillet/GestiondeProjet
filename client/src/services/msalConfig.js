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

export const msalInstance = new PublicClientApplication(msalConfig)

// Initialisation obligatoire avant tout usage
export async function initMsal() {
  await msalInstance.initialize()
  // Gérer la réponse de redirection si elle existe
  await msalInstance.handleRedirectPromise()
}
