import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import FirebaseAuth from './FirebaseAuth';
import PasswordMeter from '../common/PasswordMeter';
import { validatePassword } from '../../utils/passwordValidation';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userRegistrationCode, setUserRegistrationCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firebaseError, setFirebaseError] = useState('');
  const [showJwtForm, setShowJwtForm] = useState(false);
  const [firebaseAvailable, setFirebaseAvailable] = useState(null);
  const { register, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if Firebase is available on backend
    const checkFirebaseAvailability = async () => {
      try {
        // Try a simple POST to check if Firebase endpoints are available
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/firebase/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: 'test' })
        });
        // If we get 503, Firebase is not available
        // If we get 401, Firebase is available but token is invalid (expected)
        const isAvailable = response.status !== 503;
        setFirebaseAvailable(isAvailable);
        // If Firebase is not available, show JWT form by default
        if (!isAvailable) {
          setShowJwtForm(true);
        }
      } catch {
        setFirebaseAvailable(false);
        setShowJwtForm(true);
      }
    };

    checkFirebaseAvailability();
  }, []);

  const validateForm = () => {
    setPasswordError('');
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    
    // Check password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(`Password requirements not met: ${passwordValidation.errors.join(', ')}`);
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const success = await register(username, password, userRegistrationCode, adminCode || null);
      if (success) {
        navigate('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden mt-16">
      <div className="px-6 py-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-8">
          Create Account
        </h2>

        {(error || firebaseError) && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
            {error || firebaseError}
          </div>
        )}

        {!showJwtForm && firebaseAvailable ? (
          <div className="space-y-4">
            <FirebaseAuth 
              mode="register"
              onSuccess={() => navigate('/')}
              onError={(error) => setFirebaseError(error)}
            />
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">Or</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setShowJwtForm(true)}
              className="w-full py-2 px-4 rounded-lg text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
            >
              Register with Username & Password
            </button>
          </div>
        ) : (
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <PasswordMeter password={password} />
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {passwordError && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{passwordError}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Registration Code (Required)
            </label>
            <div className="space-y-4">
              <div>
                <label htmlFor="userRegistrationCode" className="flex items-center text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="codeType"
                    checked={!!userRegistrationCode && !adminCode}
                    onChange={() => {
                      setAdminCode('');
                      if (!userRegistrationCode) setUserRegistrationCode('');
                    }}
                    className="mr-2"
                  />
                  User Registration Code
                </label>
                {(!adminCode) && (
                  <input
                    type="password"
                    id="userRegistrationCode"
                    value={userRegistrationCode}
                    onChange={(e) => setUserRegistrationCode(e.target.value)}
                    className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={!adminCode}
                  />
                )}
              </div>
              
              <div>
                <label htmlFor="adminCode" className="flex items-center text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="codeType"
                    checked={!!adminCode && !userRegistrationCode}
                    onChange={() => {
                      setUserRegistrationCode('');
                      if (!adminCode) setAdminCode('');
                    }}
                    className="mr-2"
                  />
                  Admin Code
                </label>
                {(!userRegistrationCode) && (
                  <input
                    type="password"
                    id="adminCode"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={!userRegistrationCode}
                  />
                )}
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">
              Enter either User Registration Code or Admin Code
            </p>
            <p className="text-red-500 dark:text-red-400 text-sm mt-3">
              Note: After registration, your account requires activation by an administrator.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 px-4 rounded-lg text-white font-medium ${
              isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
          
          {firebaseAvailable && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowJwtForm(false)}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
              >
                ← Back to other options
              </button>
            </div>
          )}
        </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
              Login
            </Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
