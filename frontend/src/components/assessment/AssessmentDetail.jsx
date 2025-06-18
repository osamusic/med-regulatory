import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { StatusEnum } from '../../constants/enum';
import { useAuth } from '../../contexts/AuthContext';

const AssessmentDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [expandedAssessments, setExpandedAssessments] = useState(new Set());
  const pageSize = 50;

  const fetchProject = async () => {
    try {
      const response = await axiosClient.get(`/proc/projects/${projectId}`, {
        timeout: 30000
      });
      setProject(response.data);
    } catch (err) {
      setError('Failed to load project details');
      console.error('Error fetching project:', err);
    }
  };

  const fetchProjectAssessments = async (page = currentPage) => {
    setLoading(true);
    try {
      const skip = (page - 1) * pageSize;
      
      // First, get the total count
      const countResponse = await axiosClient.get(`/proc/projects/${projectId}/assessments/count`, {
        timeout: 30000
      });
      setTotalAssessments(countResponse.data.total);
      
      // Then fetch assessments with pagination
      const response = await axiosClient.get(`/proc/projects/${projectId}/assessments`, {
        params: { skip, limit: pageSize },
        timeout: 30000
      });
      setAssessments(response.data);
    } catch (err) {
      setError('Failed to load project assessments');
      console.error('Error fetching assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateAssessmentStatus = async (assessmentId, status, notes = '') => {
    try {
      await axiosClient.put(`/proc/assessments/${assessmentId}/status`, {
        status,
        notes
      });
      
      await fetchProjectAssessments(currentPage);
    } catch (err) {
      setError('Failed to update assessment status');
      console.error('Error updating assessment:', err);
    }
  };

  useEffect(() => {
    // Wait for auth to complete before fetching
    if (!authLoading && user && projectId) {
      fetchProject();
      fetchProjectAssessments();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Authentication required');
    }
  }, [authLoading, user, projectId]);

  // Handle page changes
  useEffect(() => {
    if (!authLoading && user && projectId) {
      fetchProjectAssessments(currentPage);
    }
  }, [currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const toggleAssessmentExpanded = (assessmentId) => {
    const newExpanded = new Set(expandedAssessments);
    if (newExpanded.has(assessmentId)) {
      newExpanded.delete(assessmentId);
    } else {
      newExpanded.add(assessmentId);
    }
    setExpandedAssessments(newExpanded);
  };

  const totalPages = Math.ceil(totalAssessments / pageSize);

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
          onClick={() => navigate('/assessment/projects')}
          className="mb-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </button>
        
        {project && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {project.description}
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {assessments.map((assessment, assessmentIndex) => {
          const isExpanded = expandedAssessments.has(assessment.id);
          const displayNumber = (currentPage - 1) * pageSize + assessmentIndex + 1;
          
          return (
            <div key={assessment.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Assessment Main Display */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start space-x-3 flex-1 mr-4">
                    <span className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-semibold px-2 py-1 rounded">
                      #{displayNumber}
                    </span>
                    <div className="flex-1">
                      <p className="text-lg text-gray-900 dark:text-gray-100 leading-relaxed mb-2">
                        {assessment.document.original_text}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                        <span><span className="font-medium">Phase:</span> {assessment.document.phase}</span>
                        <span><span className="font-medium">Role:</span> {assessment.document.role}</span>
                        <span><span className="font-medium">Priority:</span> {assessment.document.priority}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(assessment.status)}`}>
                      {assessment.status}
                    </div>
                    <button
                      onClick={() => toggleAssessmentExpanded(assessment.id)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 border border-blue-200 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                    >
                      {isExpanded ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                </div>
                
                {/* Assessment Details - Collapsible */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                          Document Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p><span className="font-medium text-gray-700 dark:text-gray-300">Category:</span> <span className="text-gray-600 dark:text-gray-400">{assessment.document.category}</span></p>
                          <p><span className="font-medium text-gray-700 dark:text-gray-300">Standard:</span> <span className="text-gray-600 dark:text-gray-400">{assessment.document.standard}</span></p>
                          <p><span className="font-medium text-gray-700 dark:text-gray-300">Subject:</span> <span className="text-gray-600 dark:text-gray-400">{assessment.document.subject}</span></p>
                          <p><span className="font-medium text-gray-700 dark:text-gray-300">Phase:</span> <span className="text-gray-600 dark:text-gray-400">{assessment.document.phase}</span></p>
                          <p><span className="font-medium text-gray-700 dark:text-gray-300">Role:</span> <span className="text-gray-600 dark:text-gray-400">{assessment.document.role}</span></p>
                          <p><span className="font-medium text-gray-700 dark:text-gray-300">Priority:</span> <span className="text-gray-600 dark:text-gray-400">{assessment.document.priority}</span></p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                          Assessment Management
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Status
                            </label>
                            <select
                              value={assessment.status}
                              onChange={(e) => updateAssessmentStatus(assessment.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                            >
                              {Object.values(StatusEnum).map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {assessment.notes && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes:</p>
                              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm text-gray-600 dark:text-gray-400">
                                {assessment.notes}
                              </div>
                            </div>
                          )}
                          
                          {assessment.assessed_at && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Last updated: {new Date(assessment.assessed_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
            Page {currentPage} of {totalPages} ({totalAssessments} total assessments)
          </span>
        </div>
      )}
    </div>
  );
};

export default AssessmentDetail;