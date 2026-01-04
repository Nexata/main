const API_URL = "http://localhost:3000";
const TENANT = "test";
const FLOW = "login";
const FRONTEND_CALLBACK = "http://localhost:5173/callback";
const FRONTEND_CREDENTIAL_CALLBACK = "http://localhost:5173/credential-callback";

export function getGoogleLoginUrl() {
  return `${API_URL}/api/auth/google/login?flow=${FLOW}&tenant=${TENANT}&redirect=${encodeURIComponent(
    FRONTEND_CALLBACK
  )}`;
}

export function getDropboxLoginUrl() {
  return `${API_URL}/api/auth/dropbox/login?flow=${FLOW}&tenant=${TENANT}&redirect=${encodeURIComponent(
    FRONTEND_CALLBACK
  )}`;
}

function getUserIdFromStorage(): string {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    throw new Error("UserId not found in localStorage");
  }
  return userId;
}

export function getGoogleCredentialUrl(
  scope: GoogleScope
) {
  const userId = getUserIdFromStorage();

  return `${API_URL}/api/auth/google/?flow=credential&scopes=${scope}&userId=${encodeURIComponent(
    userId
  )}&redirect=${encodeURIComponent(FRONTEND_CREDENTIAL_CALLBACK)}`;
}
export type GoogleScope = "gmail" | "calendar" | "drive"

export function getDropboxCredentialUrl() {
  const userId = getUserIdFromStorage();

  return `${API_URL}/api/auth/dropbox/?flow=credential&scopes=dropbox&userId=${encodeURIComponent(
    userId
  )}&redirect=${encodeURIComponent(FRONTEND_CREDENTIAL_CALLBACK)}`;
}
