import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';

const ProcessDetails = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [detailData, setDetailData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const pageSize = 50;

  // Get filter parameters from URL
  const phase = searchParams.get('phase');
  const role = searchParams.get('role');
  const subject = searchParams.get('subject');
  const category = searchParams.get('category');
  const standard = searchParams.get('standard');
  const priority = searchParams.get('priority');

  const fetchData = async (page = currentPage) => {
    if (!phase || !role) {
      setError('Phase and role parameters are required');
      return;
    }

    setLoading(true);
    try {
      const skip = (page - 1) * pageSize;
      const params = { 
        phase, 
        role, 
        skip, 
        limit: pageSize 
      };
      
      if (subject) params.subject = subject;
      if (category) params.category = category;
      if (standard) params.standard = standard;
      if (priority) params.priority = priority;

      // First get count
      const countParams = { phase, role };
      if (subject) countParams.subject = subject;
      if (category) countParams.category = category;
      if (standard) countParams.standard = standard;
      if (priority) countParams.priority = priority;

      const countResponse = await axiosClient.get('/proc/count', { 
        params: countParams,
        timeout: 30000 
      });
      setTotalCount(countResponse.data);

      // Then get data
      const response = await axiosClient.get('/proc/list', { 
        params,
        timeout: 30000 
      });
      
      setDetailData(response.data);
    } catch (err) {
      console.error('Error fetching detail data:', err);
      setError('Failed to load detailed data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchData(currentPage);
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Authentication required');
    }
  }, [authLoading, user, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const toggleClusterExpanded = (clusterId) => {
    const newExpanded = new Set(expandedClusters);
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId);
    } else {
      newExpanded.add(clusterId);
    }
    setExpandedClusters(newExpanded);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/process/matrix')}
          className="mb-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Process Matrix
        </button>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Process Details: {phase} - {role}
        </h1>
        
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {subject && <span className="mr-4">Subject: {subject}</span>}
          {category && <span className="mr-4">Category: {category}</span>}
          {standard && <span className="mr-4">Standard: {standard}</span>}
          {priority && <span className="mr-4">Priority: {priority}</span>}
        </div>

        <div className="text-sm text-gray-700 dark:text-gray-300">
          Total documents: {totalCount}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 dark:bg-red-900 dark:border-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {detailData.map((cluster, clusterIndex) => {
          const clusterId = cluster.cluster_id || clusterIndex;
          const isExpanded = expandedClusters.has(clusterId);
          
          return (
            <div key={clusterId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Representative Text - Main Display */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 mr-4">
                    <p className="text-lg text-gray-900 dark:text-gray-100 leading-relaxed">
                      {cluster.rep_text}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {cluster.documents.length} documents
                    </span>
                    <button
                      onClick={() => toggleClusterExpanded(clusterId)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 border border-blue-200 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                    >
                      {isExpanded ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                </div>
                
                {/* Document Details - Collapsible */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                      Documents ({cluster.documents.length})
                    </h4>
                    {cluster.documents.map((doc, docIndex) => (
                      <div key={doc.id || docIndex} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <div className="space-y-2 text-sm">
                              <p><span className="font-medium text-gray-700 dark:text-gray-300">ID:</span> <span className="text-gray-600 dark:text-gray-400">{doc.id}</span></p>
                              <p><span className="font-medium text-gray-700 dark:text-gray-300">Priority:</span> <span className="text-gray-600 dark:text-gray-400">{doc.priority}</span></p>
                              <p><span className="font-medium text-gray-700 dark:text-gray-300">Subject:</span> <span className="text-gray-600 dark:text-gray-400">{doc.subject}</span></p>
                              <p><span className="font-medium text-gray-700 dark:text-gray-300">Category:</span> <span className="text-gray-600 dark:text-gray-400">{doc.category}</span></p>
                              <p><span className="font-medium text-gray-700 dark:text-gray-300">Standard:</span> <span className="text-gray-600 dark:text-gray-400">{doc.standard}</span></p>
                            </div>
                          </div>
                          <div>
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Original Text:</p>
                                <p className="text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded text-xs leading-relaxed">
                                  {doc.original_text}
                                </p>
                              </div>
                              {doc.processed_text && (
                                <div>
                                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Processed Text:</p>
                                  <p className="text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded text-xs leading-relaxed">
                                    {doc.processed_text}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            Previous
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
            if (page > totalPages) return null;
            
            return (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-2 text-sm font-medium border ${
                  currentPage === page
                    ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900 dark:border-blue-500 dark:text-blue-300'
                    : 'text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
                }`}
              >
                {page}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            Next
          </button>
          
          <span className="ml-4 text-sm text-gray-700 dark:text-gray-300">
            Page {currentPage} of {totalPages} ({totalCount} total documents)
          </span>
        </div>
      )}
    </div>
  );
};

export default ProcessDetails;