import React, { createContext, useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authType, setAuthType] = useState('jwt'); // 'jwt' or 'firebase'

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      const savedAuthType = localStorage.getItem("authType");
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Restore auth type from localStorage
      if (savedAuthType) {
        setAuthType(savedAuthType);
      }

      try {
        // Explicitly pass token to ensure Authorization header is set
        const response = await axiosClient.get("/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data);
      } catch (err) {
        if (err.response?.status === 401) {
          console.warn("Unauthorized: token may be expired");
          // トークンは残す（あとで自動リフレッシュや再試行できる）
          setUser(null);
        } else {
          console.error("Unexpected auth error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const response = await axiosClient.post("/token", formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const token = response.data?.access_token;

      if (!token) {
        setError("No token returned from authentication server");
        return false;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("authType", "jwt");
      setAuthType("jwt");
      
      await fetchAndSetUser(username, token);

      return true;
    } catch (err) {
      const errorMessage =
        err.response?.data?.detail || "An error occurred during login";
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fetchAndSetUser = async (fallbackUsername, token = null) => {
    try {
      const config = {};
      if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
      }
      const userResponse = await axiosClient.get("/me", config);
      setUser(userResponse.data);
    } catch  {
      console.warn("Unable to fetch user info from /me");
      setUser({ username: fallbackUsername }); // Fallback only username
    }
  };

  const register = async (username, password, userRegistrationCode = null, adminCode = null) => {
    setError(null);
    try {
      const registerData = { 
        username, 
        password
      };
      
      if (userRegistrationCode) {
        registerData.user_registration_code = userRegistrationCode;
      }
      
      if (adminCode) {
        registerData.admin_code = adminCode;
      }

      await axiosClient.post('/register', registerData);
      return await login(username, password);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.detail || 'Registration failed');
      return false;
    }
  };

  const loginWithFirebase = async (accessToken) => {
    setLoading(true);
    setError(null);

    try {
      // Store the access token and get user info
      localStorage.setItem("token", accessToken);
      localStorage.setItem("authType", "firebase");
      setAuthType('firebase');
      
      // Get user info using the token with explicit header
      const userResponse = await axiosClient.get("/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setUser(userResponse.data);

      return true;
    } catch (err) {
      const errorMessage =
        err.response?.data?.detail || "Firebase authentication failed";
      setError(errorMessage);
      localStorage.removeItem("token"); // Clean up on failure
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authType');
    setUser(null);
    setAuthType('jwt');
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    loginWithFirebase,
    logout,
    authType,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthContext;
