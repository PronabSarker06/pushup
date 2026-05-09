import { useEffect, useState } from 'react';

const CLIENT_ID = '2291067f5818463c9184ae005db885c3';
const REDIRECT_URI = 'https://isolative-gemmiferous-shalonda.ngrok-free.dev';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const SCOPES = ['user-read-currently-playing', 'user-read-playback-state'];

// Generate PKCE code verifier and challenge
const generateCodeChallenge = async () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode.apply(null, array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const codeChallenge = btoa(String.fromCharCode.apply(null, hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return { codeVerifier, codeChallenge };
};

export const useSpotifyAuth = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Check for code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    let token = localStorage.getItem('spotifyToken');
    let tokenExpiry = localStorage.getItem('spotifyTokenExpiry');

    // Check if we got a code from redirect
    if (code) {
      const codeVerifier = localStorage.getItem('spotifyCodeVerifier');
      if (codeVerifier) {
        exchangeCodeForToken(code, codeVerifier);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (token && tokenExpiry) {
      // Check if stored token is still valid
      if (new Date().getTime() < parseInt(tokenExpiry)) {
        setAccessToken(token);
        setIsConnected(true);
      } else {
        // Token expired
        localStorage.removeItem('spotifyToken');
        localStorage.removeItem('spotifyTokenExpiry');
      }
    }
  }, []);

  const exchangeCodeForToken = async (code, codeVerifier) => {
    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier
        })
      });

      const data = await response.json();
      if (data.access_token) {
        const expiryTime = new Date().getTime() + data.expires_in * 1000;
        localStorage.setItem('spotifyToken', data.access_token);
        localStorage.setItem('spotifyTokenExpiry', expiryTime);
        localStorage.removeItem('spotifyCodeVerifier');
        setAccessToken(data.access_token);
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Token exchange error:', err);
      localStorage.removeItem('spotifyCodeVerifier');
    }
  };

  const connectSpotify = async () => {
    if (!CLIENT_ID || CLIENT_ID === 'YOUR_SPOTIFY_CLIENT_ID') {
      alert('Please set your Spotify Client ID in useSpotifyAuth.js');
      return;
    }

    try {
      const { codeVerifier, codeChallenge } = await generateCodeChallenge();
      localStorage.setItem('spotifyCodeVerifier', codeVerifier);

      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        scope: SCOPES.join(' '),
        show_dialog: 'true'
      });

      window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
    } catch (err) {
      console.error('Auth error:', err);
      alert('Error initiating Spotify authentication');
    }
  };

  const disconnect = () => {
    localStorage.removeItem('spotifyToken');
    localStorage.removeItem('spotifyTokenExpiry');
    localStorage.removeItem('spotifyCodeVerifier');
    setAccessToken(null);
    setIsConnected(false);
  };

  return {
    accessToken,
    isConnected,
    connectSpotify,
    disconnect
  };
};
