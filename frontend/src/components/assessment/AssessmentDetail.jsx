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

  const fetchProject = async () => {
    try {
      const response = await axiosClient.get(`/proc/projects/${projectId}`);
      setProject(response.data);
    } catch (err) {
      setError('Failed to load project details');
      console.error('Error fetching project:', err);
    }
  };

  const fetchProjectAssessments = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get(`/proc/projects/${projectId}/assessments`);
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
      
      await fetchProjectAssessments();
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

      <div className="space-y-6">
        {(() => {
          const groupedByPhase = assessments.reduce((groups, assessment) => {
            const phase = assessment.document.phase || 'Unknown Phase';
            if (!groups[phase]) {
              groups[phase] = [];
            }
            groups[phase].push(assessment);
            return groups;
          }, {});

          const sortedPhases = Object.keys(groupedByPhase).sort();

          return sortedPhases.map((phase) => (
            <div key={phase} className="bg-white dark:bg-gray-900 rounded-lg shadow-lg">
              <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {phase} ({groupedByPhase[phase].length} assessments)
                </h2>
              </div>
              <div className="p-6 space-y-6">
                {groupedByPhase[phase].map((assessment) => (
                  <div key={assessment.id} className="bg-blue-50 dark:bg-blue-900 rounded-lg p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Document Details
                        </h3>
                        <div className="text-sm space-y-2 mb-4">
                          <div><span className="font-medium">Category:</span> {assessment.document.category}</div>
                          <div><span className="font-medium">Standard:</span> {assessment.document.standard}</div>
                          <div><span className="font-medium">Role:</span> {assessment.document.role}</div>
                          <div><span className="font-medium">Priority:</span> {assessment.document.priority}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Original Text:</span> {assessment.document.original_text}
                          </p>
                          {assessment.document.processed_text && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                              <span className="font-medium">Processed Text:</span> {assessment.document.processed_text}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Assessment Status
                        </h3>
                        <div className="space-y-4">
                          <div className={`px-4 py-3 rounded text-center ${getStatusColor(assessment.status)}`}>
                            Current: {assessment.status}
                          </div>
                          
                          <select
                            value={assessment.status}
                            onChange={(e) => updateAssessmentStatus(assessment.id, e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                          >
                            {Object.values(StatusEnum).map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          
                          {assessment.notes && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded text-sm">
                              <span className="font-medium">Notes:</span> {assessment.notes}
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
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export default AssessmentDetail;