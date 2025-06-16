import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Custom hook for managing state in localStorage with page-specific keys
 * @param {string} pageKey - Unique key to distinguish state between different pages
 * @returns {Object} Object containing functions to get, set, and clear state
 */
export const useUrlState = (pageKey = 'default') => {
  // Keep useSearchParams for backward compatibility, but primarily use localStorage
  const [, setSearchParams] = useSearchParams();

  /**
   * Get a value from localStorage
   * @param {string} key - The parameter key to get
   * @param {string} defaultValue - Default value if parameter doesn't exist
   * @returns {string} The stored value or default value
   */
  const getUrlState = useCallback((key, defaultValue = '') => {
    try {
      const stored = localStorage.getItem(`urlState_${pageKey}_${key}`);
      console.log(`Reading state for "${pageKey}_${key}":`, stored || defaultValue);
      return stored || defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage for ${key}:`, error);
      return defaultValue;
    }
  }, [pageKey]);

  /**
   * Set one or more state values in localStorage
   * @param {Object} updates - Object with key-value pairs to update
   */
  const setUrlState = useCallback((updates) => {
    console.log(`Setting state for page "${pageKey}":`, updates);
    
    Object.entries(updates).forEach(([key, value]) => {
      try {
        if (value === null || value === undefined || value === '') {
          localStorage.removeItem(`urlState_${pageKey}_${key}`);
          console.log(`Removed state for "${pageKey}_${key}"`);
        } else {
          localStorage.setItem(`urlState_${pageKey}_${key}`, String(value));
          console.log(`Stored state for "${pageKey}_${key}":`, String(value));
        }
      } catch (error) {
        console.error(`Error setting localStorage for ${key}:`, error);
      }
    });
    
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      return newParams;
    });
  }, [setSearchParams, pageKey]);

  /**
   * Clear all state values for this page from localStorage
   */
  const clearUrlState = useCallback(() => {
    console.log(`Clearing all state for page "${pageKey}"`);
    
    try {
      const keys = Object.keys(localStorage);
      
      keys.forEach(storageKey => {
        if (storageKey.startsWith(`urlState_${pageKey}_`)) {
          localStorage.removeItem(storageKey);
          console.log(`Removed state for "${storageKey}"`);
        }
      });
    } catch (error) {
      console.error(`Error clearing localStorage for page ${pageKey}:`, error);
    }
    
    // Clear URL parameters for backward compatibility
    setSearchParams({});
  }, [setSearchParams, pageKey]);

  return { getUrlState, setUrlState, clearUrlState };
};
