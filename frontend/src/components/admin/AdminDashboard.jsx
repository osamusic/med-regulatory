import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';
import CrawlerForm from './CrawlerForm';
import ClassificationForm from './ClassificationForm';
import NewsSettingsForm from './NewsSettingsForm';

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalUsers: 0,
    totalGuidelines: 0,
    indexStats: {
      total_documents: 0,
      total_chunks: 0,
      last_updated: null
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCrawlerForm, setShowCrawlerForm] = useState(false);
  const [showClassificationForm, setShowClassificationForm] = useState(false);
  const [showNewsSettingsForm, setShowNewsSettingsForm] = useState(false);
  const [updatingIndex, setUpdatingIndex] = useState(false);
  const [indexUpdateMessage, setIndexUpdateMessage] = useState(null);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(true);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [healthCheckMessage, setHealthCheckMessage] = useState(null);

  const handleUpdateIndex = async () => {
    try {
      setUpdatingIndex(true);
      setIndexUpdateMessage({
        type: 'info',
        text: 'Updating index...'
      });
      
      const response = await axiosClient.post('/index/documents');
      
      setIndexUpdateMessage({
        type: 'success',
        text: response.data.message || 'Index updated successfully'
      });
      
      await fetchStats(); // will be debounced
      
    } catch (err) {
      console.error('Error updating index:', err);
      setIndexUpdateMessage({
        type: 'error',
        text: err.response?.data?.detail || 'An error occurred while updating the index'
      });
    } finally {
      setUpdatingIndex(false);
      
      setTimeout(() => {
        setIndexUpdateMessage(null);
      }, 5000);
    }
  };

  // Debounce fetchStats to prevent multiple rapid calls
  const fetchStatsTimeoutRef = React.useRef(null);
  
  const fetchStats = React.useCallback(async (immediate = false) => {
    // If there's a pending call and this isn't immediate, ignore it
    if (fetchStatsTimeoutRef.current && !immediate) {
      return;
    }
    
    // Clear any existing timeout
    if (fetchStatsTimeoutRef.current) {
      clearTimeout(fetchStatsTimeoutRef.current);
    }
    
    const executeRequest = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [usersRes, guidelinesCountRes, indexStatsRes, classifierStatsRes, healthCheckRes] = await Promise.all([
          axiosClient.get('/admin/users', { timeout: 10000 }),
          axiosClient.get('/guidelines/count', { timeout: 10000 }),
          axiosClient.get('/index/stats', { timeout: 10000 }),
          axiosClient.get('/classifier/stats', { timeout: 10000 }),
          axiosClient.get('/admin/settings/health-check', { timeout: 10000 }).catch(() => ({ data: { value: "true" } }))
        ]);
        
        setStats({
          totalUsers: usersRes.data.length,
          totalGuidelines: guidelinesCountRes.data.total,
          totalDocuments: classifierStatsRes.data.total_documents,
          indexStats: indexStatsRes.data
        });
        
        setHealthCheckEnabled(healthCheckRes.data.value === "true");
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('An error occurred while fetching stats');
      } finally {
        setLoading(false);
        fetchStatsTimeoutRef.current = null;
      }
    };
    
    if (immediate) {
      await executeRequest();
    } else {
      // Debounce non-immediate calls by 500ms
      fetchStatsTimeoutRef.current = setTimeout(executeRequest, 500);
    }
  }, []);

  const handleToggleHealthCheck = async () => {
    try {
      setHealthCheckLoading(true);
      setHealthCheckMessage({ type: 'info', text: 'Updating health check setting...' });
      
      const newValue = !healthCheckEnabled;
      await axiosClient.put('/admin/settings/health-check', { 
        value: newValue.toString() 
      });
      
      setHealthCheckEnabled(newValue);
      setHealthCheckMessage({
        type: 'success',
        text: `Health check monitoring ${newValue ? 'enabled' : 'disabled'} successfully`
      });
      
    } catch (err) {
      console.error('Error updating health check setting:', err);
      setHealthCheckMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update health check setting'
      });
    } finally {
      setHealthCheckLoading(false);
      setTimeout(() => setHealthCheckMessage(null), 5000);
    }
  };

  // Prevent React StrictMode double execution by using a ref
  const hasFetchedRef = React.useRef(false);
  
  useEffect(() => {
    // Wait for auth to complete before fetching
    if (!authLoading && user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchStats(true); // immediate = true for initial load
    }
    
    // Cleanup function to clear any pending timeouts
    return () => {
      if (fetchStatsTimeoutRef.current) {
        clearTimeout(fetchStatsTimeoutRef.current);
      }
    };
  }, [authLoading, user, fetchStats]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2">Users</h2>
          <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
          <Link 
            to="/admin/users" 
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            Manage Users →
          </Link>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2">Guidelines</h2>
          <p className="text-3xl font-bold text-blue-600">{stats.totalGuidelines}</p>
          <Link 
            to="/guidelines" 
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            View Guidelines →
          </Link>
        </div>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2">Documents</h2>
          <p className="text-3xl font-bold text-blue-600">{stats.totalDocuments}</p>
          <Link 
            to="/admin/documents" 
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            Manage Documents →
          </Link>
        </div>
      </div>
      
      {/* Index stats */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4">Index Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="font-medium text-gray-500">Total Documents</h3>
            <p className="text-xl font-semibold">{stats.indexStats.total_documents}</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-500">Total Chunks</h3>
            <p className="text-xl font-semibold">{stats.indexStats.total_chunks}</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-500">Last Updated</h3>
            <p className="text-xl font-semibold">
              {stats.indexStats.last_updated 
                ? new Date(stats.indexStats.last_updated).toLocaleString('ja-JP')
                : 'No updates'}
            </p>
          </div>
        </div>
      </div>
      
      {/* System Settings */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4">System Settings</h2>
        
        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-medium">Database Health Check</h3>
            <p className="text-sm text-gray-500">Monitor database connection status</p>
          </div>
          <button 
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              healthCheckEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
            } ${healthCheckLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
            onClick={handleToggleHealthCheck}
            disabled={healthCheckLoading}
          >
            <span 
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                healthCheckEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          <button 
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
            onClick={() => setShowCrawlerForm(!showCrawlerForm)}
          >
            {showCrawlerForm ? 'Close Form' : 'Run Crawler'}
          </button>
          <button 
            className={`bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded ${
              updatingIndex ? 'opacity-75 cursor-not-allowed' : ''
            }`}
            onClick={handleUpdateIndex}
            disabled={updatingIndex}
          >
            {updatingIndex ? 'Updating index...' : 'Update Index'}
          </button>
          <button 
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded"
            onClick={() => setShowClassificationForm(!showClassificationForm)}
          >
            {showClassificationForm ? 'Close Form' : 'Classify Documents'}
          </button>
          <button 
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded"
            onClick={() => setShowNewsSettingsForm(!showNewsSettingsForm)}
          >
            {showNewsSettingsForm ? 'Close Settings' : 'News Settings'}
          </button>
        </div>
      </div>

      {indexUpdateMessage && (
        <div className={`mt-4 px-4 py-3 rounded ${
          indexUpdateMessage.type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : indexUpdateMessage.type === 'error'
              ? 'bg-red-100 border border-red-400 text-red-700'
              : 'bg-blue-100 border border-blue-400 text-blue-700'
        }`}>  
          {indexUpdateMessage.text}
        </div>
      )}

      {healthCheckMessage && (
        <div className={`mt-4 px-4 py-3 rounded ${
          healthCheckMessage.type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : healthCheckMessage.type === 'error'
              ? 'bg-red-100 border border-red-400 text-red-700'
              : 'bg-blue-100 border border-blue-400 text-blue-700'
        }`}>  
          {healthCheckMessage.text}
        </div>
      )}

      {showCrawlerForm && (
        <CrawlerForm 
          onCrawlComplete={(hasNewData = false) => {
            setShowCrawlerForm(false);
            if (hasNewData) {
              fetchStats();
            }
          }}
        />
      )}
      
      {showClassificationForm && (
        <ClassificationForm 
          onClassifyComplete={(hasNewData = false) => {
            setShowClassificationForm(false);
            if (hasNewData) {
              fetchStats();
            }
          }}
        />
      )}
      
      {showNewsSettingsForm && (
        <NewsSettingsForm 
          onSettingsUpdated={() => {
            setShowNewsSettingsForm(false);
            // News settings typically don't affect stats, so we don't need to refresh
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
