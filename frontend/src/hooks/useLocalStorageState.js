import { useState, useEffect } from 'react';

// Fallback state manager when React hooks fail
class LocalStorageStateManager {
  constructor(key, initialValue) {
    this.key = key;
    this.initialValue = initialValue;
    this.listeners = new Set();
    this.currentValue = this.getStoredValue();
  }

  getStoredValue() {
    if (typeof window === 'undefined') {
      return this.initialValue;
    }

    try {
      const item = window.localStorage.getItem(this.key);
      return item ? JSON.parse(item) : this.initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${this.key}":`, error);
      return this.initialValue;
    }
  }

  setValue(value) {
    try {
      const valueToStore = value instanceof Function ? value(this.currentValue) : value;
      this.currentValue = valueToStore;
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(this.key, JSON.stringify(valueToStore));
      }
      
      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(valueToStore);
        } catch (error) {
          console.error('Error in localStorage listener:', error);
        }
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${this.key}":`, error);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Cache for state managers
const stateManagers = new Map();

/**
 * Custom hook for managing state in localStorage
 * @param {string} key - The localStorage key to use
 * @param {any} initialValue - The initial value if no value exists in localStorage
 * @returns {Array} [storedValue, setStoredValue] - State and setter function
 */
export const useLocalStorageState = (key, initialValue) => {
  // Get or create state manager
  if (!stateManagers.has(key)) {
    stateManagers.set(key, new LocalStorageStateManager(key, initialValue));
  }
  
  const manager = stateManagers.get(key);
  
  // Try to use React hooks if available
  try {
    const [storedValue, setStoredValue] = useState(manager.currentValue);

    // Subscribe to manager changes
    useEffect(() => {
      const unsubscribe = manager.subscribe(setStoredValue);
      return unsubscribe;
    }, [manager]);

    // Listen for storage events from other tabs
    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }

      const handleStorageChange = (e) => {
        if (e.key === key && e.newValue !== null) {
          try {
            const newValue = JSON.parse(e.newValue);
            manager.currentValue = newValue;
            setStoredValue(newValue);
          } catch (error) {
            console.error(`Error parsing storage event for key "${key}":`, error);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }, [key, manager]);

    return [storedValue, (value) => manager.setValue(value)];
    
  } catch (error) {
    console.error('React hooks failed, using fallback state manager:', error);
    
    // Fallback: return current value and setter without React state
    return [
      manager.currentValue,
      (value) => manager.setValue(value)
    ];
  }
};