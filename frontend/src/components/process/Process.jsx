import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { PhaseEnum, RoleEnum, SubjectEnum, PriorityEnum } from '../../constants/enum';
import CreateProjectModal from '../assessment/CreateProjectModal';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { useAuth } from '../../contexts/AuthContext';

const Process = () => {
  const { isAdmin } = useAuth();
  const [subjectOptions, setSubjectOptions] = useState([{ value: '', label: 'All' }]);
  const [priorityOptions, setPriorityOptions] = useState([{ value: '', label: 'All' }]);
  const [categoryOptions, setCategoryOptions] = useState([{ value: '', label: 'All' }]);
  const [standardOptions, setStandardOptions] = useState([{ value: '', label: 'All' }]);

  const [matrixData, setMatrixData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [selectedSubject, setSelectedSubject] = useLocalStorageState('process_subject', '');
  const [selectedCategory, setSelectedCategory] = useLocalStorageState('process_category', '');
  const [selectedStandard, setSelectedStandard] = useLocalStorageState('process_standard', '');
  const [selectedPriority, setSelectedPriority] = useLocalStorageState('process_priority', '');
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

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
    setLoading(true);
    setError(null);
    
    try {
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

      for (const phase of PhaseEnum) {
        if (phase === 'unknown') continue;
        for (const role of RoleEnum) {
          if (role === 'unknown') continue;
          
          try {
            const params = { phase, role };
            if (selectedSubject) params.subject = selectedSubject;
            if (selectedCategory) params.category = selectedCategory;
            if (selectedStandard) params.standard = selectedStandard;
            if (selectedPriority) params.priority = selectedPriority;
            
            const response = await axiosClient.get('/proc/count', { params });
            matrix[phase][role] = response.data;
          } catch (err) {
            console.error(`Error fetching count for ${phase}/${role}:`, err);
            matrix[phase][role] = 0;
          }
        }
      }
      
      setMatrixData(matrix);
    } catch (err) {
      console.error('Error building matrix:', err);
      setError('Failed to load process data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailData = async (phase, role) => {
    try {
      const params = { phase, role, limit: 1000 };
      if (selectedSubject) params.subject = selectedSubject;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedStandard) params.standard = selectedStandard;
      if (selectedPriority) params.priority = selectedPriority;
      
      const response = await axiosClient.get('/proc/list', { params });
      
      setDetailData(response.data);
      setSelectedCell({ phase, role });
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error fetching detail data:', err);
      setError('Failed to load detailed data');
    }
  };

  useEffect(() => {
    fetchFilterOptions();
    fetchMatrixData();
  }, []);

  useEffect(() => {
    fetchMatrixData();
  }, [selectedSubject, selectedCategory, selectedStandard, selectedPriority]);

  const handleCellClick = (phase, role, count) => {
    if (count > 0) {
      fetchDetailData(phase, role);
    }
  };

  const closeModal = () => {
    setShowDetailModal(false);
    setSelectedCell(null);
    setDetailData([]);
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Process Matrix</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreateProjectModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Assessment Project
          </button>
        )}
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

      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Details: {selectedCell?.phase} - {selectedCell?.role}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {detailData.map((cluster, clusterIndex) => (
                  <div key={cluster.cluster_id || clusterIndex} className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Cluster {cluster.cluster_id}
                      </h3>
                      <p className="text-sm text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-800 p-3 rounded">
                        <span className="font-medium">Representative Text:</span> {cluster.rep_text}
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        Documents ({cluster.documents.length})
                      </h4>
                      {cluster.documents.map((doc, docIndex) => (
                        <div key={doc.id || docIndex} className="bg-white dark:bg-gray-800 rounded-lg p-4 ml-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Document Details</h5>
                              <p><span className="font-medium">ID:</span> {doc.id}</p>
                              <p><span className="font-medium">Priority:</span> {doc.priority}</p>
                              <p><span className="font-medium">Subject:</span> {doc.subject}</p>
                              <p><span className="font-medium">Category:</span> {doc.category}</p>
                              <p><span className="font-medium">Standard:</span> {doc.standard}</p>
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Content</h5>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                                <span className="font-medium">Original Text:</span> {doc.original_text}
                              </p>
                              {doc.processed_text && (
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  <span className="font-medium">Processed Text:</span> {doc.processed_text}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
