import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axiosClient from '../../api/axiosClient';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const NewsSettingsForm = ({ onSettingsUpdated }) => {
  const { user, loading: authLoading } = useAuth();
  const [newsSites, setNewsSites] = useState([]);
  const [filterKeywords, setFilterKeywords] = useState([]);
  const [newSite, setNewSite] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Wait for auth to complete before fetching
    if (!authLoading && user) {
      fetchSettings();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Authentication required');
    }
  }, [authLoading, user]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [sitesRes, keywordsRes] = await Promise.all([
        axiosClient.get('/news/settings/sites'),
        axiosClient.get('/news/settings/keywords')
      ]);
      
      setNewsSites(sitesRes.data);
      setFilterKeywords(keywordsRes.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching news settings:', err);
      setError('Failed to load news settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSite = () => {
    if (!newSite) return;
    if (!newSite.startsWith('http')) {
      setError('URL must start with http:// or https://');
      return;
    }
    setNewsSites([...newsSites, newSite]);
    setNewSite('');
  };

  const handleRemoveSite = (index) => {
    const updatedSites = [...newsSites];
    updatedSites.splice(index, 1);
    setNewsSites(updatedSites);
  };

  const handleAddKeyword = () => {
    if (!newKeyword) return;
    setFilterKeywords([...filterKeywords, newKeyword]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (index) => {
    const updatedKeywords = [...filterKeywords];
    updatedKeywords.splice(index, 1);
    setFilterKeywords(updatedKeywords);
  };

  const handleSaveSettings = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      await Promise.all([
        axiosClient.put('/news/settings/sites', newsSites),
        axiosClient.put('/news/settings/keywords', filterKeywords)
      ]);
      
      setSuccessMessage('News settings updated successfully');
      
      if (onSettingsUpdated) {
        onSettingsUpdated();
      }
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error updating news settings:', err);
      setError('Failed to update news settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-lg font-semibold mb-4">News Collection Settings</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      <div className="mb-6">
        <h3 className="font-medium mb-2">News Sites</h3>
        
        <div className="flex mb-2">
          <input
            type="url"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddSite}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-lg"
          >
            <FaPlus />
          </button>
        </div>
        
        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {newsSites.length === 0 ? (
            <li className="text-gray-500 italic">No news sites configured</li>
          ) : (
            newsSites.map((site, index) => (
              <li key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <a 
                  href={site} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {site}
                </a>
                <button
                  onClick={() => handleRemoveSite(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FaTrash />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
      
      <div className="mb-6">
        <h3 className="font-medium mb-2">Filter Keywords</h3>
        
        <div className="flex mb-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Enter keyword"
            className="flex-1 px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddKeyword}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-lg"
          >
            <FaPlus />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
          {filterKeywords.length === 0 ? (
            <div className="text-gray-500 italic">No filter keywords configured</div>
          ) : (
            filterKeywords.map((keyword, index) => (
              <div 
                key={index} 
                className="flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full"
              >
                <span className="mr-2">{keyword}</span>
                <button
                  onClick={() => handleRemoveKeyword(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  <FaTrash />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      <button
        onClick={handleSaveSettings}
        disabled={isSubmitting}
        className={`w-full py-2 px-4 rounded text-white font-medium ${
          isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isSubmitting ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
};

NewsSettingsForm.propTypes = {
  onSettingsUpdated: PropTypes.func
};

export default NewsSettingsForm;
