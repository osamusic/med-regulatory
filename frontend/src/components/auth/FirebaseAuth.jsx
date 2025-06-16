import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';

const FirebaseAuth = ({ onSuccess, onError, mode = 'login' }) => {
  const { loginWithFirebase } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [firebaseLoaded, setFirebaseLoaded] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Check if Firebase is enabled via environment variables
    const hasGoogleClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (hasGoogleClientId) {
      // If Google Client ID is configured, assume Firebase is available
      setFirebaseLoaded(true);
      console.log('Firebase enabled via environment configuration');
    } else {
      // If no Google Client ID, Firebase is not available
      setFirebaseLoaded(false);
      console.log('Firebase disabled - no VITE_GOOGLE_CLIENT_ID');
    }
  }, []);

  // Auto-initialize Google Sign-In when Firebase is loaded
  useEffect(() => {
    if (firebaseLoaded && !showEmailForm) {
      initializeGoogleSignIn();
    }
  }, [firebaseLoaded, showEmailForm, mode]); // Added mode dependency

  const initializeGoogleSignIn = async () => {
    if (!firebaseLoaded) {
      return;
    }

    try {
      // Load Google Identity Services
      if (!window.google) {
        await loadGoogleScript();
      }

      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if element exists
      const buttonContainer = document.getElementById('google-signin-button');
      if (!buttonContainer) {
        return; // Container not yet rendered
      }

      // Clear any existing content
      buttonContainer.innerHTML = '';

      // Initialize Google OAuth
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        use_fedcm_for_prompt: false, // Disable FedCM to avoid CORS issues
      });

      // Show Google sign-in button instead of prompt to avoid CORS issues
      window.google.accounts.id.renderButton(
        buttonContainer,
        { 
          type: 'standard',
          size: 'large',
          text: mode === 'login' ? 'signin_with' : 'signup_with',
          shape: 'rectangular',
          theme: 'outline',
          width: 320 // Use fixed pixel width instead of percentage
        }
      );
    } catch (error) {
      console.error('Google sign-in initialization error:', error);
    }
  };

  const loadGoogleScript = () => {
    return new Promise((resolve, reject) => {
      if (window.google) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleGoogleCallback = async (response) => {
    try {
      // Send Google credential to backend
      const backendResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/firebase/google-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();
        throw new Error(errorData.detail || 'Google authentication failed');
      }

      const tokenData = await backendResponse.json();
      
      // Send token to auth context
      const success = await loginWithFirebase(tokenData.access_token);
      
      if (success) {
        onSuccess?.();
      } else {
        onError?.('Failed to authenticate with backend');
      }
    } catch (error) {
      console.error('Google callback error:', error);
      onError?.(error.message || 'Google authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'login') {
      await handleEmailSignIn(email, password);
    } else {
      await handleEmailSignUp(email, password);
    }
  };

  const handleEmailSignIn = async (email, password) => {
    if (!firebaseLoaded) {
      onError?.('Firebase is not available');
      return;
    }

    setIsLoading(true);

    try {
      // Use backend Firebase email authentication
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/firebase/email-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Authentication failed');
      }

      const tokenData = await response.json();
      
      // Send token to auth context
      const success = await loginWithFirebase(tokenData.access_token);
      
      if (success) {
        onSuccess?.();
      } else {
        onError?.('Failed to authenticate with backend');
      }
    } catch (error) {
      console.error('Email sign-in error:', error);
      onError?.(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (email, password) => {
    if (!firebaseLoaded) {
      onError?.('Firebase is not available');
      return;
    }

    setIsLoading(true);

    try {
      // Use backend Firebase email registration
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/firebase/email-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const tokenData = await response.json();
      
      // Send token to auth context
      const success = await loginWithFirebase(tokenData.access_token);
      
      if (success) {
        onSuccess?.();
      } else {
        onError?.('Failed to authenticate with backend');
      }
    } catch (error) {
      console.error('Email sign-up error:', error);
      onError?.(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render anything if Firebase is not available
  if (!firebaseLoaded) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!showEmailForm ? (
        <>
          {isLoading ? (
            <div className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-100 dark:bg-gray-700">
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </div>
          ) : (
            <div className="w-full">
              <div 
                id="google-signin-button" 
                className="w-full"
                style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}
              />
            </div>
          )}
          
          <button
            onClick={() => setShowEmailForm(true)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {mode === 'login' ? 'Sign in with email' : 'Sign up with email'}
          </button>
        </>
      ) : (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
              required
            />
          </div>
          
          <div>
            <label htmlFor="firebase-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              id="firebase-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
              required
              minLength={6}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-lg text-white font-medium ${
              isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading 
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...') 
              : (mode === 'login' ? 'Sign in' : 'Sign up')
            }
          </button>
          
          <button
            type="button"
            onClick={() => setShowEmailForm(false)}
            className="w-full text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Back to other options
          </button>
        </form>
      )}
    </div>
  );
};

FirebaseAuth.propTypes = {
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  mode: PropTypes.oneOf(['login', 'register'])
};

export default FirebaseAuth;