import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';

const GoogleAuthContext = createContext(null);

export const useGoogleAuth = () => useContext(GoogleAuthContext);

export const GoogleAuthProvider = ({ children }) => {
  const [clientId, setClientId] = useState(() => {
    return localStorage.getItem('google_client_id') || '';
  });
  
  const [clientSecret, setClientSecret] = useState(() => {
    return localStorage.getItem('google_client_secret') || '';
  });
  
  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem('google_access_token') || '';
  });
  
  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem('google_refresh_token') || '';
  });
  
  const [tokenExpiry, setTokenExpiry] = useState(() => {
    return Number(localStorage.getItem('google_token_expiry')) || 0;
  });
  
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamic redirect URI suitable for local host and GitHub Pages
  const getRedirectUri = () => {
    return window.location.origin + window.location.pathname;
  };

  // Save/change Google OAuth Client ID
  const updateClientId = (id) => {
    const cleanId = id.trim();
    setClientId(cleanId);
    if (cleanId) {
      localStorage.setItem('google_client_id', cleanId);
    } else {
      localStorage.removeItem('google_client_id');
      logout();
    }
  };

  // Save/change Google OAuth Client Secret
  const updateClientSecret = (secret) => {
    const cleanSecret = secret.trim();
    setClientSecret(cleanSecret);
    if (cleanSecret) {
      localStorage.setItem('google_client_secret', cleanSecret);
    } else {
      localStorage.removeItem('google_client_secret');
    }
  };

  // Logout function
  const logout = useCallback(() => {
    setAccessToken('');
    setRefreshToken('');
    setTokenExpiry(0);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_refresh_token');
    localStorage.removeItem('google_token_expiry');
  }, []);

  // Fetch Google User Profile Info
  const fetchUserProfile = useCallback(async (token) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Не вдалося отримати профіль користувача Google');
      }

      const data = await response.json();
      setUser({
        name: data.name,
        email: data.email,
        picture: data.picture,
      });
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err.message);
      // If token is invalid/expired, logout
      logout();
    }
  }, [logout]);

  // Refresh access token using refresh token
  const refreshGoogleToken = useCallback(async () => {
    if (!refreshToken || !clientId) {
      logout();
      return null;
    }

    try {
      const bodyParams = {
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      };
      if (clientSecret) {
        bodyParams.client_secret = clientSecret;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error_description || 'Не вдалося оновити токен доступу');
      }

      const data = await response.json();
      const newAccessToken = data.access_token;
      const newExpiry = Date.now() + data.expires_in * 1000;

      setAccessToken(newAccessToken);
      setTokenExpiry(newExpiry);
      localStorage.setItem('google_access_token', newAccessToken);
      localStorage.setItem('google_token_expiry', String(newExpiry));

      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
        localStorage.setItem('google_refresh_token', data.refresh_token);
      }

      return newAccessToken;
    } catch (err) {
      console.error('Error refreshing token:', err);
      setError('Сесія застаріла. Будь ласка, увійдіть знову.');
      logout();
      return null;
    }
  }, [clientId, clientSecret, refreshToken, logout]);

  // Initiate OAuth 2.0 PKCE login redirect
  const login = async () => {
    if (!clientId) {
      setError('Будь ласка, спочатку вкажіть Google Client ID в налаштуваннях.');
      return;
    }

    setError(null);
    try {
      const verifier = generateCodeVerifier();
      sessionStorage.setItem('oauth_code_verifier', verifier);

      const challenge = await generateCodeChallenge(verifier);
      const redirectUri = getRedirectUri();
      
      const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ].join(' ');

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type', 'offline'); // To get refresh token
      authUrl.searchParams.set('prompt', 'consent');      // Ensure refresh token is sent

      // Redirect to Google Login
      window.location.href = authUrl.toString();
    } catch (err) {
      console.error('Login redirection error:', err);
      setError('Помилка підготовки авторизації: ' + err.message);
    }
  };

  // Handle URL callback containing authorization code
  const handleAuthCallback = useCallback(async (code) => {
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    if (!codeVerifier) {
      setError('Відсутній перевірочний ключ авторизації (code verifier). Спробуйте ще раз.');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const redirectUri = getRedirectUri();
      
      const bodyParams = {
        client_id: clientId,
        code_verifier: codeVerifier,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      if (clientSecret) {
        bodyParams.client_secret = clientSecret;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error_description || 'Не вдалося обміняти код на токен');
      }

      const data = await response.json();
      const token = data.access_token;
      const expiry = Date.now() + data.expires_in * 1000;

      setAccessToken(token);
      setTokenExpiry(expiry);
      localStorage.setItem('google_access_token', token);
      localStorage.setItem('google_token_expiry', String(expiry));

      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
        localStorage.setItem('google_refresh_token', data.refresh_token);
      }

      sessionStorage.removeItem('oauth_code_verifier');
      
      // Clean query parameters from URL
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      await fetchUserProfile(token);
    } catch (err) {
      console.error('Callback token exchange error:', err);
      setError('Помилка авторизації Google: ' + err.message);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [clientId, clientSecret, fetchUserProfile, logout]);

  // Initial load check
  useEffect(() => {
    const initAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        // We have redirected back with auth code
        if (clientId) {
          await handleAuthCallback(code);
        } else {
          setError('Вхід скасовано. Будь ласка, вкажіть Google Client ID.');
          setIsLoading(false);
        }
      } else if (accessToken && tokenExpiry) {
        // Check if token has expired or is close to expiring (within 2 mins)
        const isExpired = Date.now() > tokenExpiry - 120000;
        
        if (isExpired) {
          if (refreshToken) {
            const newToken = await refreshGoogleToken();
            if (newToken) {
              await fetchUserProfile(newToken);
            }
          } else {
            logout();
          }
        } else {
          await fetchUserProfile(accessToken);
        }
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [accessToken, tokenExpiry, refreshToken, clientId, handleAuthCallback, refreshGoogleToken, fetchUserProfile, logout]);

  // Periodically check/refresh token expiry
  useEffect(() => {
    if (!accessToken || !tokenExpiry || !refreshToken) return;

    const interval = setInterval(async () => {
      const isExpired = Date.now() > tokenExpiry - 120000;
      if (isExpired) {
        console.log('Access token expiring soon, refreshing...');
        await refreshGoogleToken();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [accessToken, tokenExpiry, refreshToken, refreshGoogleToken]);

  return (
    <GoogleAuthContext.Provider
      value={{
        clientId,
        clientSecret,
        accessToken,
        user,
        isAuthenticated,
        isLoading,
        error,
        updateClientId,
        updateClientSecret,
        login,
        logout,
        refreshGoogleToken,
        getRedirectUri
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
};
