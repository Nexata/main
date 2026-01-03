const API_URL = "http://localhost:3000";
const TENANT = "test";
const FLOW = "login";
const FRONTEND_CALLBACK = "http://localhost:5173/callback";

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
