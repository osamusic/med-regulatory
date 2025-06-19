import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { PhaseEnum, RoleEnum, SubjectEnum, PriorityEnum } from '../../constants/enum';
import CreateProjectModal from '../assessment/CreateProjectModal';
import { useAuth } from '../../contexts/AuthContext';

const Process = () => {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [subjectOptions, setSubjectOptions] = useState([{ value: '', label: 'All' }]);
  const [priorityOptions, setPriorityOptions] = useState([{ value: '', label: 'All' }]);
  const [categoryOptions, setCategoryOptions] = useState([{ value: '', label: 'All' }]);
  const [standardOptions, setStandardOptions] = useState([{ value: '', label: 'All' }]);

  const [matrixData, setMatrixData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStandard, setSelectedStandard] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  
  // Cache for matrix data
  const matrixCache = useRef(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Generate cache key from current filters
  const getCacheKey = () => {
    return JSON.stringify({
      subject: selectedSubject,
      category: selectedCategory,
      standard: selectedStandard,
      priority: selectedPriority
    });
  };

  // Check if cached data is still valid
  const getCachedData = (key) => {
    const cached = matrixCache.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  };

  // Store data in cache
  const setCachedData = (key, data) => {
    matrixCache.current.set(key, {
      data,
      timestamp: Date.now()
    });
  };


  // Force refresh (bypass cache)
  const forceRefresh = async () => {
    const cacheKey = getCacheKey();
    matrixCache.current.delete(cacheKey);
    await fetchMatrixData();
  };

  // Check if current data is from cache
  const isDataFromCache = () => {
    const cacheKey = getCacheKey();
    return getCachedData(cacheKey) !== null;
  };

  const fetchFilterOptions = async () => {
    try {
      const subjects = Object.values(SubjectEnum).map(subject => ({
        value: subject,
        label: subject
      }));
      setSubjectOptions([{ value: '', label: 'All' }, ...subjects]);

      const priorities = Object.values(PriorityEnum).map(priority => ({
        value: priority,
        label: priority
      }));
      setPriorityOptions([{ value: '', label: 'All' }, ...priorities]);

      const categoriesResponse = await axiosClient.get('/proc/categories');
      const categories = categoriesResponse.data.map(category => ({
        value: category,
        label: category
      }));
      setCategoryOptions([{ value: '', label: 'All' }, ...categories]);

      const standardsResponse = await axiosClient.get('/proc/standards');
      const standards = standardsResponse.data.map(standard => ({
        value: standard,
        label: standard
      }));
      setStandardOptions([{ value: '', label: 'All' }, ...standards]);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchMatrixData = async () => {
    const cacheKey = getCacheKey();
    
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      setMatrixData(cachedData);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Try to use batch API if available
      const params = {};
      if (selectedSubject) params.subject = selectedSubject;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedStandard) params.standard = selectedStandard;
      if (selectedPriority) params.priority = selectedPriority;

      try {
        // Try new batch matrix endpoint
        const response = await axiosClient.get('/proc/matrix', { 
          params,
          timeout: 15000 
        });
        setMatrixData(response.data);
        setCachedData(cacheKey, response.data);
      } catch {
        // Fall back to individual requests with reduced concurrency
        console.warn('Batch API not available, falling back to individual requests');
        await fetchMatrixDataIndividual(cacheKey);
      }
    } catch (err) {
      console.error('Error building matrix:', err);
      setError('Failed to load process data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrixDataIndividual = async (cacheKey) => {
    const matrix = {};
    
    PhaseEnum.forEach(phase => {
      if (phase !== 'unknown') {
        matrix[phase] = {};
        RoleEnum.forEach(role => {
          if (role !== 'unknown') {
            matrix[phase][role] = 0;
          }
        });
      }
    });

    // Limit concurrent requests to avoid overwhelming the server
    const BATCH_SIZE = 3;
    const requests = [];
    
    for (const phase of PhaseEnum) {
      if (phase === 'unknown') continue;
      for (const role of RoleEnum) {
        if (role === 'unknown') continue;
        
        const params = { phase, role };
        if (selectedSubject) params.subject = selectedSubject;
        if (selectedCategory) params.category = selectedCategory;
        if (selectedStandard) params.standard = selectedStandard;
        if (selectedPriority) params.priority = selectedPriority;
        
        requests.push({ phase, role, params });
      }
    }

    // Process requests in batches
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async ({ phase, role, params }) => {
        try {
          const response = await axiosClient.get('/proc/count', { 
            params,
            timeout: 10000 
          });
          return { phase, role, count: response.data };
        } catch (err) {
          console.error(`Error fetching count for ${phase}/${role}:`, err);
          return { phase, role, count: 0 };
        }
      });

      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const { phase, role, count } = result.value;
          matrix[phase][role] = count;
        }
      });
      
      // Add small delay between batches to avoid overwhelming server
      if (i + BATCH_SIZE < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setMatrixData(matrix);
    setCachedData(cacheKey, matrix);
  };


  useEffect(() => {
    // Fetch data when auth is complete (with or without user)
    if (!authLoading) {
      fetchFilterOptions();
      fetchMatrixData();
    }
  }, [authLoading]);

  useEffect(() => {
    // Fetch matrix data when auth is complete (with or without user)
    if (!authLoading) {
      fetchMatrixData();
    }
  }, [authLoading, user, selectedSubject, selectedCategory, selectedStandard, selectedPriority]);

  const handleCellClick = (phase, role, count) => {
    if (count > 0) {
      // ナビゲーションパラメータとして現在の選択されたフィルターを含める
      const params = new URLSearchParams({
        phase,
        role,
        ...(selectedSubject && { subject: selectedSubject }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedStandard && { standard: selectedStandard }),
        ...(selectedPriority && { priority: selectedPriority }),
      });
      navigate(`/process/details?${params.toString()}`);
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Process Matrix</h1>
          {isDataFromCache() && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Using cached data (refreshes every 5 minutes)
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={forceRefresh}
            disabled={loading}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
          >
            <svg className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCreateProjectModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Assessment Project
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Subject filter */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              {subjectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Standard filter */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Standard
            </label>
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              {standardOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Priority
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedSubject('');
              setSelectedCategory('');
              setSelectedStandard('');
              setSelectedPriority('');
            }}
            className="px-4 py-2 rounded-lg text-blue-600 border border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50 dark:bg-blue-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Phase / Role
                </th>
                {RoleEnum.filter(role => role !== 'unknown').map(role => (
                  <th key={role} className="px-4 py-4 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[120px]">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {PhaseEnum.filter(phase => phase !== 'unknown').map(phase => (
                <tr key={phase} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 bg-blue-50 dark:bg-blue-900">
                    {phase}
                  </td>
                  {RoleEnum.filter(role => role !== 'unknown').map(role => {
                    const count = matrixData[phase]?.[role] || 0;
                    return (
                      <td key={role} className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleCellClick(phase, role, count)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            count > 0
                              ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-800 dark:hover:bg-blue-700 dark:text-blue-100 cursor-pointer'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-default'
                          }`}
                          disabled={count === 0}
                        >
                          {count}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      {/* Create Assessment Project Modal */}
      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onProjectCreated={() => {
          setShowCreateProjectModal(false);
        }}
        initialFilters={{
          subject: selectedSubject,
          phase: null, // Will be set based on matrix selection
          role: null,  // Will be set based on matrix selection
          priority: selectedPriority,
          category: selectedCategory,
          standard: selectedStandard
        }}
      />
    </div>
  );
};

export default Process;
