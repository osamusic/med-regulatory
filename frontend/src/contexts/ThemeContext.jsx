import React, { createContext, useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Auto-detect system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [systemPreference, setSystemPreference] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      setSystemPreference(e.matches);
      // Only auto-switch if user hasn't set a preference
      if (!localStorage.getItem('theme')) {
        setDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      // Smooth transition for theme switch
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };

  const resetToSystemPreference = () => {
    localStorage.removeItem('theme');
    setDarkMode(systemPreference);
  };

  const value = {
    darkMode,
    toggleDarkMode,
    resetToSystemPreference,
    systemPreference,
    isUsingSystemPreference: !localStorage.getItem('theme')
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default ThemeContext;
