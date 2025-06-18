 
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const highlightText = (text, query) => {
  if (!query) return text;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return <mark key={index} className="bg-yellow-200">{part}</mark>;
    }
    return part;
  });
};

const GuidelinesList = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [availableStandards, setAvailableStandards] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);

  const [selectedStandard, setSelectedStandard] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalGuidelines, setTotalGuidelines] = useState(0);
  const pageSize = 50; // Reduced page size for better performance


  const [isAdmin, setIsAdmin] = useState(false);
  const [guidelineToDelete, setGuidelineToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedGuidelines, setSelectedGuidelines] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });

  const fetchFilterOptions = async (filters = {}) => {
    setLoading(true);
    try {
      const categoryParams = {};
      const standardParams = {};
      const subjectParams = {};
      
      if (filters.standard) {
        categoryParams.standard = filters.standard;
        subjectParams.standard = filters.standard;
      }
      if (filters.subject) {
        categoryParams.subject = filters.subject;
        standardParams.subject = filters.subject;
      }
      if (filters.category) {
        standardParams.category = filters.category;
        subjectParams.category = filters.category;
      }

      const [stdRes, subjRes, catRes] = await Promise.all([
        axiosClient.get('/guidelines/standards', { params: standardParams }),
        axiosClient.get('/guidelines/subjects', { params: subjectParams }),
        axiosClient.get('/guidelines/categories', { params: categoryParams }),
      ]);
      setAvailableStandards(stdRes.data || []);
      setAvailableSubjects(subjRes.data || []);
      setAvailableCategories(catRes.data || []);
    } catch (err) {
      console.error('Failed to load filter options', err);
      setError('Failed to load filter options.');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (selectedStandard) params.standard = selectedStandard;
      if (selectedSubject) params.subject = selectedSubject;

      // Calculate pagination
      const skip = (currentPage - 1) * pageSize;
      
      let fetchedGuidelines = [];
      let totalCount = 0;

      if (searchQuery.trim()) {
        // Use search endpoint for text search (no pagination support yet)
        const searchRes = await axiosClient.post('/guidelines/search', {
          query: searchQuery.trim(),
          category: selectedCategory || undefined,
          standard: selectedStandard || undefined,
          subject: selectedSubject || undefined,
        });
        
        const allResults = searchRes.data || [];
        totalCount = allResults.length;
        
        // Apply client-side pagination for search results
        const startIndex = skip;
        const endIndex = startIndex + pageSize;
        fetchedGuidelines = allResults.slice(startIndex, endIndex);
      } else {
        // Use regular paginated endpoint
        const countRes = await axiosClient.get('/guidelines/count', { params });
        totalCount = countRes.data.total;

        const dataRes = await axiosClient.get('/guidelines/all', {
          params: {
            skip,
            limit: pageSize,
            ...params,
          },
        });
        
        fetchedGuidelines = dataRes.data || [];
      }

      setTotalGuidelines(totalCount);
      setGuidelines(fetchedGuidelines);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch guidelines', err);
      if (err.response) {
        setError(`Error (${err.response.status}): ${err.response.data.detail || ''}`);
      } else {
        setError('Failed to connect to server.');
      }
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    // Wait for auth to complete before fetching
    if (!authLoading && user) {
      fetchFilterOptions();
    }
  }, [authLoading, user]);

  useEffect(() => {
    // Wait for auth to complete before fetching
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Authentication required');
    }
  }, [authLoading, user, selectedStandard, selectedSubject, selectedCategory, currentPage]);
  
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    setIsSearching(true);
    setCurrentPage(1); // Reset to first page when search changes
    
    const timeout = setTimeout(() => {
      fetchData();
    }, 500); // Debounce server-side search
    
    setSearchTimeout(timeout);
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery]);
  
  useEffect(() => {
    const checkIsAdmin = async () => {
      try {
        const response = await axiosClient.get('/me');
        setIsAdmin(response.data.is_admin);
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      }
    };
    
    checkIsAdmin();
  }, []);
  
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);


  const resetFilters = async () => {
    setSelectedStandard('');
    setSelectedSubject('');
    setSelectedCategory('');
    setSearchQuery('');
    setCurrentPage(1);
    setIsSearching(true);
    
    try {
      await fetchFilterOptions();
      await fetchData();
    } catch (err) {
      console.error('Failed to reset filters', err);
      setError('Failed to reset filters.');
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleCategoryChange = async (value) => {
    setSelectedCategory(value);
    setCurrentPage(1); // Reset to first page when filter changes
    
    // Update filter options based on new selection
    await fetchFilterOptions({
      category: value,
      standard: selectedStandard,
      subject: selectedSubject
    });
    
    // Update total count when filter changes
    try {
      const countParams = {
        category: value || undefined,
        standard: selectedStandard || undefined,
        subject: selectedSubject || undefined
      };
      
      const countRes = await axiosClient.get('/guidelines/count', { params: countParams });
      setTotalGuidelines(countRes.data.total);
    } catch (err) {
      console.error('Failed to update count after category change', err);
    }
  };
  
  const handleStandardChange = async (value) => {
    setSelectedStandard(value);
    setCurrentPage(1); // Reset to first page when filter changes
    
    // Update filter options based on new selection
    await fetchFilterOptions({
      category: selectedCategory,
      standard: value,
      subject: selectedSubject
    });
    
    // Update total count when filter changes
    try {
      const countParams = {
        category: selectedCategory || undefined,
        standard: value || undefined,
        subject: selectedSubject || undefined
      };
      
      const countRes = await axiosClient.get('/guidelines/count', { params: countParams });
      setTotalGuidelines(countRes.data.total);
    } catch (err) {
      console.error('Failed to update count after standard change', err);
    }
  };
  
  const handleSubjectChange = async (value) => {
    setSelectedSubject(value);
    setCurrentPage(1); // Reset to first page when filter changes
    
    // Update filter options based on new selection
    await fetchFilterOptions({
      category: selectedCategory,
      standard: selectedStandard,
      subject: value
    });
    
    // Update total count when filter changes
    try {
      const countParams = {
        category: selectedCategory || undefined,
        standard: selectedStandard || undefined,
        subject: value || undefined
      };
      
      const countRes = await axiosClient.get('/guidelines/count', { params: countParams });
      setTotalGuidelines(countRes.data.total);
    } catch (err) {
      console.error('Failed to update count after subject change', err);
    }
  };
  
  const handleDeleteGuideline = async (guideline) => {
    if (!guideline) return;
    
    try {
      setLoading(true);
      await axiosClient.delete(`/guidelines/${guideline.guideline_id}`);
      
      setGuidelines(prev => prev.filter(g => g.id !== guideline.id));
      
      setSuccessMessage(`Guideline "${guideline.guideline_id}" was successfully deleted.`);
      
      setGuidelineToDelete(null);
      
      await fetchFilterOptions();
    } catch (err) {
      console.error('Error deleting guideline:', err);
      let errorMessage = 'An error occurred while deleting the guideline.';
      if (err.response) {
        errorMessage = `Error (${err.response.status}): ${err.response.data.detail || errorMessage}`;
      }
      setError(errorMessage);
      setGuidelineToDelete(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleGuidelineSelection = (guidelineId) => {
    setSelectedGuidelines(prev => 
      prev.includes(guidelineId) 
        ? prev.filter(id => id !== guidelineId)
        : [...prev, guidelineId]
    );
  };

  const toggleAllGuidelines = () => {
    if (selectedGuidelines.length === guidelines.length) {
      setSelectedGuidelines([]);
    } else {
      setSelectedGuidelines(guidelines.map(g => g.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedGuidelines.length === 0) return;
    
    setBulkDeleteLoading(true);
    setError(null);
    setBulkDeleteProgress({ current: 0, total: selectedGuidelines.length });
    
    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    
    try {
      const deletePromises = selectedGuidelines.map(async (guidelineId, index) => {
        const guideline = guidelines.find(g => g.id === guidelineId);
        if (!guideline) {
          setBulkDeleteProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return { success: false, error: 'Guideline not found' };
        }
        
        try {
          await axiosClient.delete(`/guidelines/${guideline.guideline_id}`);
          setBulkDeleteProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return { success: true, id: guidelineId };
        } catch (err) {
          let errorMessage = `Error deleting guideline ${guideline.guideline_id}`;
          if (err.response) {
            errorMessage = `Error (${err.response.status}): ${err.response.data.detail || errorMessage}`;
          }
          setBulkDeleteProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return { success: false, error: errorMessage };
        }
      });
      
      const results = await Promise.allSettled(deletePromises);
      const processedResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: 'Processing failed' }
      );
      
      successCount = processedResults.filter(result => result.success).length;
      failedCount = processedResults.filter(result => !result.success).length;
      
      errors.push(...processedResults
        .filter(result => !result.success)
        .map(result => result.error));
      
      const successfulIds = processedResults
        .filter(result => result.success)
        .map(result => result.id);
      
      setGuidelines(prev => prev.filter(g => !successfulIds.includes(g.id)));
      setSelectedGuidelines([]);
      
      if (successCount > 0 && failedCount > 0) {
        setSuccessMessage(`${successCount} guidelines were successfully deleted. ${failedCount} failed.`);
        setError(errors.join('\n'));
      } else if (successCount > 0) {
        setSuccessMessage(`${successCount} guidelines were successfully deleted.`);
      } else {
        setError('Failed to delete guidelines:\n' + errors.join('\n'));
      }
      
      await fetchFilterOptions();
    } catch (err) {
      console.error('Error during bulk delete:', err);
      setError('An unexpected error occurred during bulk deletion.');
    } finally {
      setBulkDeleteLoading(false);
      setBulkDeleteProgress({ current: 0, total: 0 });
      setGuidelineToDelete(null);
    }
  };

  const handleDeleteAllFiltered = async () => {
    if (!selectedCategory && !selectedStandard && !selectedSubject) {
      setError('Please apply at least one filter before using "Delete All Filtered" to prevent accidentally deleting all guidelines.');
      return;
    }

    setBulkDeleteLoading(true);
    setError(null);
    setBulkDeleteProgress({ current: 0, total: 0 });
    
    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    
    try {
      // Get total count for filtered results
      const countParams = {};
      if (selectedCategory) countParams.category = selectedCategory;
      if (selectedStandard) countParams.standard = selectedStandard;
      if (selectedSubject) countParams.subject = selectedSubject;
      
      const countRes = await axiosClient.get('/guidelines/count', { params: countParams });
      const totalFiltered = countRes.data.total;
      setBulkDeleteProgress({ current: 0, total: totalFiltered });
      
      // Fetch all filtered guidelines in batches to avoid timeout
      const batchSize = 100;
      let allFilteredGuidelines = [];
      
      for (let offset = 0; offset < totalFiltered; offset += batchSize) {
        const response = await axiosClient.get('/guidelines/all', {
          params: {
            skip: offset,
            limit: batchSize,
            ...countParams
          }
        });
        allFilteredGuidelines.push(...(response.data || []));
        setBulkDeleteProgress({ current: Math.min(offset + batchSize, totalFiltered), total: totalFiltered });
      }
      
      const filteredGuidelines = allFilteredGuidelines;
      
      if (filteredGuidelines.length === 0) {
        setError('No guidelines found matching the current filters.');
        setBulkDeleteLoading(false);
        setGuidelineToDelete(null);
        return;
      }

      const deletePromises = filteredGuidelines.map(async (guideline, index) => {
        try {
          await axiosClient.delete(`/guidelines/${guideline.guideline_id}`);
          setBulkDeleteProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return { success: true, id: guideline.id };
        } catch (err) {
          let errorMessage = `Error deleting guideline ${guideline.guideline_id}`;
          if (err.response) {
            errorMessage = `Error (${err.response.status}): ${err.response.data.detail || errorMessage}`;
          }
          setBulkDeleteProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return { success: false, error: errorMessage };
        }
      });
      
      const results = await Promise.allSettled(deletePromises);
      const processedResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: 'Processing failed' }
      );
      
      successCount = processedResults.filter(result => result.success).length;
      failedCount = processedResults.filter(result => !result.success).length;
      
      errors.push(...processedResults
        .filter(result => !result.success)
        .map(result => result.error));
      
      await fetchData();
      
      await fetchFilterOptions();
      
      if (successCount > 0 && failedCount > 0) {
        setSuccessMessage(`${successCount} filtered guidelines were successfully deleted. ${failedCount} failed.`);
        setError(errors.join('\n'));
      } else if (successCount > 0) {
        setSuccessMessage(`${successCount} filtered guidelines were successfully deleted.`);
      } else {
        setError('Failed to delete filtered guidelines:\n' + errors.join('\n'));
      }
      
    } catch (err) {
      console.error('Error during filtered delete:', err);
      setError('An unexpected error occurred during filtered deletion.');
    } finally {
      setBulkDeleteLoading(false);
      setBulkDeleteProgress({ current: 0, total: 0 });
      setGuidelineToDelete(null);
    }
  };


  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Medical Device Cybersecurity Guidelines</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
          <button onClick={() => setSuccessMessage('')} className="float-right">✕</button>
        </div>
      )}


      {/* Create New Guideline Button (admin only) */}
      {isAdmin && (
        <div className="mb-4">
          <Link
            to="/guidelines/new"
            className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg inline-flex items-center"
          >
            <FaPlus className="mr-2" /> Create New Guideline
          </Link>
        </div>
      )}

      {/* Bulk Selection Controls (admin only) */}
      {isAdmin && guidelines.length > 0 && (
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedGuidelines.length === guidelines.length && guidelines.length > 0}
                onChange={toggleAllGuidelines}
                className="mr-2"
              />
              <label className="text-sm font-medium">
                Select All ({selectedGuidelines.length} of {guidelines.length} selected)
              </label>
            </div>
            {selectedGuidelines.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setGuidelineToDelete('bulk')}
                  disabled={bulkDeleteLoading}
                  className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg inline-flex items-center disabled:opacity-50"
                >
                  <FaTrash className="mr-2" />
                  {bulkDeleteLoading ? 'Deleting...' : `Delete Selected (${selectedGuidelines.length})`}
                </button>
                {bulkDeleteLoading && bulkDeleteProgress.total > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500 mr-2"></div>
                      <span>{bulkDeleteProgress.current} / {bulkDeleteProgress.total}</span>
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Metrics */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-4">Category Metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {availableCategories.map((category, index) => (
            <div 
              key={index} 
              className={`p-2 rounded-lg text-center cursor-pointer ${
                selectedCategory === (category.name || category) 
                  ? 'bg-blue-100 dark:bg-blue-800 border-blue-500 dark:border-blue-600 border' 
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => handleCategoryChange(selectedCategory === (category.name || category) ? '' : (category.name || category))}
            >
              <div className="font-medium">{category.name || category}</div>
              <div className="text-lg font-bold">{category.count || 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

          {/* Category filter */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {availableCategories.map((category, index) => (
                <option key={index} value={category.name || category}>
                  {category.name || category} {category.count ? `(${category.count})` : ''}
                </option>
              ))}
            </select>
            {/* Category filter info */}
          </div>

          {/* Standard filter */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Standard
            </label>
            <select
              value={selectedStandard}
              onChange={(e) => handleStandardChange(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {availableStandards.map((standard, index) => (
                <option key={index} value={standard.name || standard}>
                  {standard.name || standard} {standard.count ? `(${standard.count})` : ''}
                </option>
              ))}
            </select>
            {/* Standard filter info */}
          </div>

          {/* Subject filter */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {availableSubjects.map((subject, index) => (
                <option key={index} value={subject.name || subject}>
                  {subject.name || subject} {subject.count ? `(${subject.count})` : ''}
                </option>
              ))}
            </select>
            {/* Subject filter info */}
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guidelines..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isSearching && (
            <div className="flex items-center px-4">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 rounded-lg text-blue-600 border border-blue-600 hover:bg-blue-50"
          >
            Reset
          </button>
          {isAdmin && (selectedCategory || selectedStandard || selectedSubject) && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setGuidelineToDelete('filtered')}
                disabled={bulkDeleteLoading}
                className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDeleteLoading ? 'Deleting...' : 'Delete All Filtered'}
              </button>
              {bulkDeleteLoading && bulkDeleteProgress.total > 0 && (
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500 mr-2"></div>
                    <span>{bulkDeleteProgress.current} / {bulkDeleteProgress.total}</span>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Guidelines list */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : guidelines.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-6 text-center">
          <h3 className="text-lg font-semibold mb-4">No guidelines found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery ? 
              "No guidelines match your search query and selected filters." : 
              "No guidelines match the selected filters."}
          </p>
          <button
            onClick={resetFilters}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {guidelines.map((guideline) => (
            <div
              key={guideline.id}
              className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedGuidelines.includes(guideline.id)}
                      onChange={() => toggleGuidelineSelection(guideline.id)}
                      className="mr-3 mt-1"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      <Link
                        to={`/guidelines/${guideline.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {guideline.id}: {highlightText(guideline.control_text, searchQuery)}
                      </Link>
                    </h3>
                  </div>
                </div>
                <div>
                  {isAdmin && (
                    <>
                      <Link to={`/guidelines/edit/${guideline.id}`} className="text-yellow-500 hover:text-yellow-600 mx-2">
                        <FaEdit />
                      </Link>
                      <button 
                        onClick={() => setGuidelineToDelete(guideline)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <FaTrash />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {highlightText(guideline.category, searchQuery)}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {highlightText(guideline.standard, searchQuery)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex flex-wrap gap-1">
                  {guideline.keywords && guideline.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs px-2 py-1 rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>

                <span className="text-sm text-gray-500">
                  {highlightText(guideline.subject, searchQuery)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalGuidelines > 0 && (
        <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md">
          <div className="text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalGuidelines)} of {totalGuidelines} guidelines
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                const newPage = Math.max(currentPage - 1, 1);
                setCurrentPage(newPage);
              }}
              disabled={currentPage === 1 || loading}
              className={`px-4 py-2 rounded-lg ${
                currentPage === 1 || loading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Previous
            </button>
            <span className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              Page {currentPage} of {Math.ceil(totalGuidelines / pageSize) || 1}
            </span>
            <button
              onClick={() => {
                const newPage = currentPage + 1;
                setCurrentPage(newPage);
              }}
              disabled={currentPage >= Math.ceil(totalGuidelines / pageSize) || loading}
              className={`px-4 py-2 rounded-lg ${
                currentPage >= Math.ceil(totalGuidelines / pageSize) || loading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {guidelineToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">
              {guidelineToDelete === 'bulk' 
                ? `Delete ${selectedGuidelines.length} Guidelines?` 
                : guidelineToDelete === 'filtered'
                ? 'Delete All Filtered Guidelines?'
                : 'Delete This Guideline?'
              }
            </h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              {guidelineToDelete === 'bulk'
                ? `Are you sure you want to delete ${selectedGuidelines.length} selected guidelines? This action cannot be undone.`
                : guidelineToDelete === 'filtered'
                ? `Are you sure you want to delete ALL guidelines matching the current filters? This action cannot be undone.`
                : `Are you sure you want to delete guideline "${guidelineToDelete.guideline_id}"? This action cannot be undone.`
              }
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setGuidelineToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800"
                disabled={bulkDeleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => guidelineToDelete === 'bulk' ? handleBulkDelete() : guidelineToDelete === 'filtered' ? handleDeleteAllFiltered() : handleDeleteGuideline(guidelineToDelete)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                disabled={bulkDeleteLoading}
              >
                {bulkDeleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

};


export default GuidelinesList;
