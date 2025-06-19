import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TagCloud } from 'react-tagcloud';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';
import { FaFileAlt, FaBook, FaChartBar, FaPlus } from 'react-icons/fa';
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

        // Always fetch public endpoints
        const requests = [
          axiosClient.get('/classifier/keywords'),
          axiosClient.get('/proc/projects')
        ];

        // Only fetch admin endpoints if user is admin
        if (isAdmin && user) {
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

    // Fetch data when auth is complete (with or without user)
    if (!authLoading) {
      fetchDashboardData();
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
    <div className="section-spacing fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-heading mb-2">
            Medical Device Cybersecurity Dashboard
          </h1>
          <p className="text-lg text-body">
            Comprehensive platform for medical device security assessment and compliance
          </p>
        </div>
      </div>

      {/* Welcome message for unauthenticated users */}
      {!user && (
        <div className="card card-hover p-8 mb-8 slide-up">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-heading mb-3">
                Welcome to MedShield AI
              </h2>
              <p className="text-body mb-6 text-lg leading-relaxed">
                Your comprehensive platform for medical device cybersecurity assessment and regulatory compliance. 
                Explore our extensive library of guidelines and process matrices to strengthen your device security posture.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link 
                  to="/login" 
                  className="btn btn-primary"
                >
                  Login for Full Access
                </Link>
                <Link 
                  to="/register" 
                  className="btn btn-secondary"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Metrics Cards - Admin Only */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card card-hover p-6 group">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-200">
                <FaBook className="text-xl text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-subheading mb-1">Guidelines</h3>
                <p className="text-3xl font-bold text-heading">{metrics.totalGuidelines}</p>
                <p className="text-caption">Active guidelines</p>
              </div>
            </div>
          </div>

          <div className="card card-hover p-6 group">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-200">
                <FaChartBar className="text-xl text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-subheading mb-1">Index Size</h3>
                <p className="text-3xl font-bold text-heading">
                  {metrics.indexStats?.total_documents || 0}
                </p>
                <p className="text-caption">Indexed documents</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tools Grid */}
      <div className="section-spacing">
        <div>
          <h2 className="text-2xl font-bold text-heading mb-6">Tools & Services</h2>
          <div className="grid-responsive">
            <Link 
              to="/process/matrix" 
              className="card card-hover p-8 text-center group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-accent-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                  <FaChartBar className="text-2xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-heading mb-3">Process Matrix</h3>
                <p className="text-body leading-relaxed">View and filter process documents for comprehensive device lifecycle management</p>
              </div>
            </Link>

            <Link 
              to="/guidelines" 
              className="card card-hover p-8 text-center group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-success-500/10 to-success-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-success-500 to-success-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                  <FaBook className="text-2xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-heading mb-3">Guidelines</h3>
                <p className="text-body leading-relaxed">Access cybersecurity guidelines and regulatory controls for medical devices</p>
              </div>
            </Link>

            {user ? (
              <Link 
                to="/documents/search" 
                className="card card-hover p-8 text-center group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-warning-500/10 to-warning-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-warning-500 to-warning-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                    <FaFileAlt className="text-2xl text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-heading mb-3">Document Search</h3>
                  <p className="text-body leading-relaxed">AI-powered document search and intelligent chat interface</p>
                </div>
              </Link>
            ) : (
              <div className="card p-8 text-center relative group cursor-pointer">
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-secondary-400 dark:bg-secondary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-60">
                    <FaFileAlt className="text-2xl text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-heading mb-3">Document Search</h3>
                  <p className="text-body leading-relaxed mb-4">AI-powered document search and intelligent chat interface</p>
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200">
                    Login Required
                  </div>
                </div>
                <Link to="/login" className="absolute inset-0 rounded-2xl"></Link>
              </div>
            )}
          </div>
        </div>

        {/* Assessment Projects Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-heading">Assessment Projects</h2>
            {user && isAdmin && (
              <Link
                to="/assessment/projects"
                className="btn btn-success inline-flex items-center"
              >
                <FaPlus className="mr-2 text-sm" />
                Create Project
              </Link>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {user ? (
              <Link 
                to="/assessment/projects" 
                className="card card-hover p-8 text-center group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent-500/10 to-accent-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                    <FaChartBar className="text-2xl text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-heading mb-3">View Projects</h3>
                  <p className="text-body leading-relaxed">Manage assessment projects and track compliance status</p>
                </div>
              </Link>
            ) : (
              <div className="card p-8 text-center relative group cursor-pointer">
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-secondary-400 dark:bg-secondary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-60">
                    <FaChartBar className="text-2xl text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-heading mb-3">View Projects</h3>
                  <p className="text-body leading-relaxed mb-4">Manage assessment projects and track compliance status</p>
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200">
                    Login Required
                  </div>
                </div>
                <Link to="/login" className="absolute inset-0 rounded-2xl"></Link>
              </div>
            )}
            
            {projects.length > 0 && (
              <div className="card p-6">
                <h3 className="text-xl font-bold text-heading mb-6">
                  Project Status Overview
                </h3>
                {renderProjectStatusChart(projects)}
                <div className="mt-6 pt-4 border-t border-secondary-200 dark:border-secondary-700">
                  <p className="text-caption">
                    Total Projects: <span className="font-semibold text-subheading">{projects.length}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keywords Word Cloud */}
      <div className="card p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-heading mb-2">
            Classification Keywords
          </h2>
          <p className="text-body">
            Interactive visualization of key terms used in document classification
          </p>
        </div>
        
        {displayTags.length > 0 ? (
          <div
            className="
              min-h-64 flex items-center justify-center
              bg-gradient-to-br from-primary-50/50 to-accent-50/50
              dark:bg-gradient-to-br dark:from-secondary-900/50 dark:to-secondary-800/50
              p-8 rounded-2xl border border-secondary-100 dark:border-secondary-700
            "
          >
            <TagCloud
              key={tick}
              minSize={10}
              maxSize={28}
              tags={displayTags}
              colorOptions={{ hue: 'blue' }}
              renderer={customRenderer}
            />
          </div>
        ) : (
          <div className="min-h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary-200 dark:bg-secondary-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaChartBar className="text-2xl text-secondary-400 dark:text-secondary-500" />
              </div>
              <p className="text-body">No classification keywords available yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
