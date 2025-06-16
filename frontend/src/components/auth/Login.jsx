import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import FirebaseAuth from './FirebaseAuth';
import SystemStatus from '../common/SystemStatus';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firebaseError, setFirebaseError] = useState('');
  const [firebaseAvailable, setFirebaseAvailable] = useState(null);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const { login, error, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if Firebase is enabled via environment variables
    const hasGoogleClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
    setFirebaseAvailable(hasGoogleClientId);
    
    if (hasGoogleClientId) {
      console.log('Firebase available - Google Client ID configured');
    } else {
      console.log('Firebase not available - no VITE_GOOGLE_CLIENT_ID');
    }
  }, []);

  // Navigate when user is successfully authenticated
  useEffect(() => {
    if (shouldNavigate && user) {
      console.debug('🎉 Login: User authenticated, navigating to dashboard', { user: user.username });
      navigate('/');
      setShouldNavigate(false);
    }
  }, [user, shouldNavigate, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setIsSubmitting(true);
    try {
      const success = await login(username, password);
      if (success) {
        // Set flag to navigate once user state is updated
        setShouldNavigate(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden mt-16">
      <div className="px-6 py-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-8">
          Login
        </h2>

        {(error || firebaseError) && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error || firebaseError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="username" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 px-4 rounded-lg text-white font-medium ${
              isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-4 flex justify-center">
          <SystemStatus />
        </div>

        {firebaseAvailable && (
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <FirebaseAuth 
                onSuccess={() => setShouldNavigate(true)}
                onError={(error) => setFirebaseError(error)}
              />
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Don’t have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline">
              Register
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;