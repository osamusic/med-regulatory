import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { workflowAPI } from '../../api/workflow';
import { PhaseEnum } from '../../constants/enum';
import { useAuth } from '../../contexts/AuthContext';
import WorkflowDetail from './WorkflowDetail';

const WorkflowManagement = ({ projectId, projectName }) => {
  const { isAdmin } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [creatingPhase, setCreatingPhase] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchWorkflows();
    }
  }, [projectId]);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await workflowAPI.listWorkflows(projectId);
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async (phase) => {
    if (creatingPhase) return; // Prevent multiple clicks
    
    setCreatingPhase(phase);
    setError(null);
    
    try {
      const workflow = await workflowAPI.createWorkflow(projectId, phase);
      setWorkflows(prev => [...prev, workflow]);
      setSelectedWorkflow(workflow);
      setShowDetail(true);
    } catch (err) {
      console.error('Error creating workflow:', err);
      if (err.response?.status === 400) {
        setError(`Workflow already exists for ${phase} phase`);
      } else {
        setError(`Failed to create workflow for ${phase} phase`);
      }
    } finally {
      setCreatingPhase(null);
    }
  };

  const handleViewWorkflow = async (projectId, phase) => {
    try {
      const workflow = await workflowAPI.getWorkflow(projectId, phase);
      setSelectedWorkflow(workflow);
      setShowDetail(true);
    } catch (err) {
      console.error('Error fetching workflow:', err);
      setError(`Failed to load workflow for ${phase} phase`);
    }
  };

  const handleDeleteWorkflow = async (projectId, phase) => {
    if (!confirm(`Are you sure you want to delete the workflow for ${phase} phase?`)) {
      return;
    }

    try {
      await workflowAPI.deleteWorkflow(projectId, phase);
      setWorkflows(prev => prev.filter(w => w.phase !== phase));
      if (selectedWorkflow?.phase === phase) {
        setSelectedWorkflow(null);
        setShowDetail(false);
      }
    } catch (err) {
      console.error('Error deleting workflow:', err);
      setError(`Failed to delete workflow for ${phase} phase`);
    }
  };

  const getWorkflowForPhase = (phase) => {
    return workflows.find(w => w.phase === phase);
  };

  if (loading && workflows.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Workflow Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Project: {projectName}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Phase Workflows
          </h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PhaseEnum.filter(phase => phase !== 'unknown').map(phase => {
              const workflow = getWorkflowForPhase(phase);
              const isCreating = creatingPhase === phase;

              return (
                <div key={phase} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {phase}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {workflow ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full dark:bg-green-800 dark:text-green-100">
                          Ready
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full dark:bg-gray-700 dark:text-gray-300">
                          Not Created
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {workflow ? (
                      <>
                        <button
                          onClick={() => handleViewWorkflow(projectId, phase)}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Workflow
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteWorkflow(projectId, phase)}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Delete Workflow
                          </button>
                        )}
                      </>
                    ) : (
                      isAdmin && (
                        <button
                          onClick={() => handleCreateWorkflow(phase)}
                          disabled={isCreating}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isCreating ? 'Creating...' : 'Generate Workflow'}
                        </button>
                      )
                    )}
                  </div>

                  {workflow && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Roles:</span> {Object.keys(workflow.instructions || {}).length}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {workflow.workflow_text?.substring(0, 100)}...
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workflow Detail Modal */}
      {showDetail && selectedWorkflow && (
        <WorkflowDetail
          workflow={selectedWorkflow}
          onClose={() => {
            setShowDetail(false);
            setSelectedWorkflow(null);
          }}
        />
      )}
    </div>
  );
};

WorkflowManagement.propTypes = {
  projectId: PropTypes.string.isRequired,
  projectName: PropTypes.string.isRequired
};

export default WorkflowManagement;