import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import CreateProjectModal from './CreateProjectModal';
import { useAuth } from '../../contexts/AuthContext';

const AssessmentProjects = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/proc/projects');
      setProjects(response.data);
    } catch (err) {
      setError('Failed to load assessment projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId) => {
    try {
      await axiosClient.delete(`/proc/projects/${projectId}`);
      await fetchProjects();
      setShowDeleteModal(false);
      setProjectToDelete(null);
    } catch (err) {
      setError('Failed to delete project');
      console.error('Error deleting project:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Assessment Projects</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New Project
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {project.name}
            </h3>
            
            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {project.description}
              </p>
            )}

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Filter Criteria:</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {project.filter_criteria.subject && (
                  <div>Subject: {project.filter_criteria.subject}</div>
                )}
                {project.filter_criteria.phase && (
                  <div>Phase: {project.filter_criteria.phase}</div>
                )}
                {project.filter_criteria.role && (
                  <div>Role: {project.filter_criteria.role}</div>
                )}
                {project.filter_criteria.priority && (
                  <div>Priority: {project.filter_criteria.priority}</div>
                )}
                {project.filter_criteria.category && (
                  <div>Category: {project.filter_criteria.category}</div>
                )}
                {project.filter_criteria.standard && (
                  <div>Standard: {project.filter_criteria.standard}</div>
                )}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Status Summary:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(project.status_counts).map(([status, count]) => (
                  <div key={status} className={`px-2 py-1 rounded text-center ${getStatusColor(status)}`}>
                    {status}: {count}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                Total: {project.total_assessments}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/assessment/projects/${project.id}/assessments`)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Assessments
                </button>
                <button
                  onClick={() => navigate(`/workflow/${project.id}`)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Workflows
                </button>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setProjectToDelete(project);
                    setShowDeleteModal(true);
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Project
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Confirm Deletion
              </h2>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to delete the project &quot;{projectToDelete.name}&quot;? 
                This action will permanently delete the project and all its assessments.
              </p>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                This action cannot be undone.
              </p>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProjectToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProject(projectToDelete.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProjectCreated={() => {
          setShowCreateModal(false);
          fetchProjects();
        }}
      />
    </div>
  );
};

export default AssessmentProjects;