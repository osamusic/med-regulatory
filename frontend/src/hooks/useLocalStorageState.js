import { useState, useEffect } from 'react';

/**
 * Custom hook for managing state in localStorage
 * @param {string} key - The localStorage key to use
 * @param {any} initialValue - The initial value if no value exists in localStorage
 * @returns {Array} [storedValue, setStoredValue] - State and setter function
 */
export const useLocalStorageState = (key, initialValue) => {
  const readValue = () => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      const parsedValue = item ? JSON.parse(item) : initialValue;
      console.log(`Reading localStorage key "${key}":`, parsedValue);
      return parsedValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState(readValue);

  const setValue = (value) => {
    try {
      console.log(`Setting localStorage key "${key}" with value:`, value);
      
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      console.log(`Processed value to store for "${key}":`, valueToStore);
      
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        console.log(`Successfully stored to localStorage key "${key}":`, valueToStore);
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
        console.log(`useEffect: Updated localStorage key "${key}":`, storedValue);
      } catch (error) {
        console.error(`useEffect: Error updating localStorage key "${key}":`, error);
      }
    }
  }, [storedValue, key]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        console.log(`Storage event detected for key "${key}":`, e.newValue);
        try {
          const newValue = e.newValue ? JSON.parse(e.newValue) : initialValue;
          console.log(`Parsed new value for "${key}":`, newValue);
          setStoredValue(newValue);
        } catch (error) {
          console.error(`Error parsing storage event value for "${key}":`, error);
          setStoredValue(initialValue);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
};
