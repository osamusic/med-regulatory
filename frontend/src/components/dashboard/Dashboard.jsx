import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TagCloud } from 'react-tagcloud';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';
import { FaFileAlt, FaBook, FaChartBar, FaEye, FaPlus } from 'react-icons/fa';
import { motion } from 'framer-motion';


const Dashboard = () => {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({
    totalGuidelines: 0,
    indexStats: null
  });
  const [keywords, setKeywords] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user is authenticated before making requests
        if (!user) {
          console.warn('User not authenticated, skipping dashboard data fetch');
          setLoading(false);
          return;
        }

        // Additional check to ensure token is available in localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn('No token in localStorage, skipping dashboard data fetch');
          setLoading(false);
          return;
        }

        const requests = [
          axiosClient.get('/classifier/keywords'),
          axiosClient.get('/proc/projects')
        ];

        if (isAdmin) {
          requests.push(
            axiosClient.get('/guidelines/count'),
            axiosClient.get('/index/stats')
          );
        }

        const responses = await Promise.all(requests);
        
        const keywordData = responses[0].data;
        const keywordCloud = keywordData.map(keyword => ({
          value: keyword,
          count: Math.floor(Math.random() * 20) + 5, // Random count for demo, replace with real frequency data
        }));
        setKeywords(keywordCloud);

        const projectsData = responses[1].data;
        setProjects(projectsData);

        if (isAdmin && responses.length > 2) {
          setMetrics({
            totalGuidelines: responses[2].data.total || 0,
            indexStats: responses[3].data || null
          });
        }

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch data when auth is complete and user is available
    if (!authLoading && user) {
      console.debug('🚀 Dashboard: User authenticated, fetching data', { user: user.username, token: !!localStorage.getItem('token') });
      fetchDashboardData();
    } else if (!authLoading && !user) {
      console.debug('⚠️ Dashboard: No user found after auth loading completed');
    }
  }, [isAdmin, user, authLoading]);

  const customRenderer = (tag, size) => {
    const x = (Math.random() - 0.5) * 20;
    const y = (Math.random() - 0.5) * 20;
    return (
      <motion.span
        key={tag.value}
        animate={{ x: [0, x, 0], y: [0, y, 0], rotate: [0, 8, -8, 0] }}
        transition={{ repeat: Infinity, duration: 8 + Math.random() * 4, ease: 'easeInOut' }}
        style={{ fontSize: `${size}px` }}
        className={`
          inline-block cursor-pointer rounded-2xl
          px-3 py-1 m-1
          transition-transform
          bg-blue-100 border border-blue-300 text-blue-800
          shadow-md
          hover:scale-110
          dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200
        `}
      >
        {tag.value}
      </motion.span>
    );
  };

  const SAMPLE_SIZE = 32;
  const sampleTags = (arr) => {
    if (arr.length <= SAMPLE_SIZE) return arr;
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, SAMPLE_SIZE);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Not Started':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-300';
      case 'Compliant':
        return 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-300';
      case 'Non-Compliant':
        return 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-300';
      case 'Not Applicable':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const renderProjectStatusChart = (projects) => {
    const totalCounts = { 'Not Started': 0, 'In Progress': 0, 'Compliant': 0, 'Non-Compliant': 0, 'Not Applicable': 0 };
    
    projects.forEach(project => {
      Object.entries(project.status_counts).forEach(([status, count]) => {
        totalCounts[status] = (totalCounts[status] || 0) + count;
      });
    });

    const total = Object.values(totalCounts).reduce((sum, count) => sum + count, 0);
    
    return (
      <div className="space-y-2">
        {Object.entries(totalCounts).map(([status, count]) => (
          <div key={status} className="flex items-center justify-between">
            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(status)}`}>
              {status}
            </span>
            <div className="flex-1 mx-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getStatusColor(status).split(' ')[0]}`}
                style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-sm font-medium">{count}</span>
          </div>
        ))}
      </div>
    );
  };

  const [displayTags, setDisplayTags] = useState(() => sampleTags(keywords));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // keywords 自体が変わったらすぐ更新
    setDisplayTags(sampleTags(keywords));
    setTick(t => t + 1);
  }, [keywords]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setDisplayTags(sampleTags(keywords));
      setTick(t => t + 1);
    }, 20000);
    return () => clearInterval(intervalId);
  }, [keywords]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Medical Device Cybersecurity Dashboard
        </h1>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Metrics Cards - Admin Only */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <FaBook className="text-3xl text-green-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Guidelines</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.totalGuidelines}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <FaChartBar className="text-3xl text-orange-600 mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Index Size</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.indexStats?.total_documents || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tools Grid */}
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Tools & Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link 
              to="/process/matrix" 
              className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg shadow-md text-center transition-colors group"
            >
              <FaChartBar className="text-4xl mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">Process Matrix</h3>
              <p className="text-blue-100 text-sm">View and filter process documents</p>
            </Link>

            <Link 
              to="/guidelines" 
              className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-lg shadow-md text-center transition-colors group"
            >
              <FaBook className="text-4xl mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">Guidelines</h3>
              <p className="text-green-100 text-sm">View cybersecurity guidelines and controls</p>
            </Link>

            <Link 
              to="/documents/search" 
              className="bg-orange-600 hover:bg-orange-700 text-white p-6 rounded-lg shadow-md text-center transition-colors group"
            >
              <FaFileAlt className="text-4xl mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">Document Search</h3>
              <p className="text-orange-100 text-sm">AI-powered document search and chat</p>
            </Link>
          </div>
        </div>

        {/* Assessment Projects Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Assessment Projects</h2>
            {isAdmin && (
              <Link
                to="/assessment/projects"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <FaPlus className="mr-2 text-xs" />
                Create Project
              </Link>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Link 
              to="/assessment/projects" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-6 rounded-lg shadow-md text-center transition-colors group"
            >
              <FaChartBar className="text-4xl mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">View Projects</h3>
              <p className="text-indigo-100 text-sm">Manage assessment projects and status</p>
            </Link>
            
            {projects.length > 0 && (
              <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Project Status Overview
                </h3>
                {renderProjectStatusChart(projects)}
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Total Projects: {projects.length}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keywords Word Cloud */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Classification Keywords
          </h2>
        </div>
        
        {displayTags.length > 0 ? (
          <div
            className="
              min-h-48 flex items-center justify-center
              bg-gradient-to-r from-blue-50 to-blue-100
              dark:bg-gradient-to-r dark:from-gray-900 dark:to-gray-800
              p-6 rounded-2xl
            "
          >
            <TagCloud
              key={tick}
              minSize={8}
              maxSize={24}
              tags={displayTags}
              colorOptions={{ hue: 'blue' }}
              renderer={customRenderer}
            />
          </div>
        ) : (
          <div className="min-h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <FaChartBar className="text-4xl mb-4 mx-auto opacity-50" />
              <p>No classification keywords available yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
