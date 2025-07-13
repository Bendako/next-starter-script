export const config = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || (
    typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}` 
      : 'http://localhost:3001'
  ),
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || (
    typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001`
      : 'ws://localhost:3001'
  ),
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || (
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000'
  ),
};

export default config; 