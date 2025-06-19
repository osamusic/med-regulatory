import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workflowAPI } from '../../api/workflow';
import { PhaseEnum } from '../../constants/enum';
import { useAuth } from '../../contexts/AuthContext';
import axiosClient from '../../api/axiosClient';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

const WorkflowDetail = ({ workflow, onBack }) => {
  const renderInstructions = (instructions) => {
    if (!instructions || typeof instructions !== 'object') {
      return <p className="text-gray-500 dark:text-gray-400">No instructions available</p>;
    }

    return Object.entries(instructions).map(([role, steps]) => (
      <div key={role} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {role}
        </h4>
        <ol className="space-y-2 mb-4">
          {Array.isArray(steps) ? steps.map((step, index) => (
            <li key={index} className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white text-sm rounded-full flex items-center justify-center mr-3 mt-0.5">
                {index + 1}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{step}</span>
            </li>
          )) : (
            <li className="text-gray-500 dark:text-gray-400">No steps defined for this role</li>
          )}
        </ol>
        
        {/* Input and Output for this role */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {workflow.input && workflow.input[role] && (
            <div>
              <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Input:</h5>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900 p-2 rounded">
                {workflow.input[role]}
              </p>
            </div>
          )}
          {workflow.output && workflow.output[role] && (
            <div>
              <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Output:</h5>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900 p-2 rounded">
                {workflow.output[role]}
              </p>
            </div>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Workflow: {workflow.phase} Phase
        </h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Workflows
        </button>
      </div>
      
      {/* Workflow Summary */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Workflow Summary
        </h3>
        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
          <div className="text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
              {workflow.workflow_text || 'No workflow summary available'}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Work Instructions */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Work Instructions by Role
        </h3>
        {renderInstructions(workflow.instructions)}
      </div>

      {/* Workflow Metadata */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Workflow Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Workflow ID:</span> {workflow.id}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Project ID:</span> {workflow.project_id}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Phase:</span> {workflow.phase}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Roles Count:</span> {Object.keys(workflow.instructions || {}).length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Input Items:</span> {workflow.input ? Object.keys(workflow.input).length : 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Output Items:</span> {workflow.output ? Object.keys(workflow.output).length : 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkflowManagementPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [project, setProject] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [creatingPhase, setCreatingPhase] = useState(null);

  useEffect(() => {
    if (projectId) {
      // Wait for auth to complete before fetching
      if (!authLoading && user) {
        fetchProject();
        fetchWorkflows();
      } else if (!authLoading && !user) {
        setLoading(false);
        setError('Authentication required');
      }
    }
  }, [projectId, authLoading, user]);

  const fetchProject = async () => {
    try {
      const response = await axiosClient.get(`/proc/projects/${projectId}`);
      setProject(response.data);
    } catch (err) {
      console.error('Error fetching project:', err);
      if (err.response?.status === 404) {
        setError('Project not found');
      } else {
        setError('Failed to load project details');
      }
    }
  };

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
      }
    } catch (err) {
      console.error('Error deleting workflow:', err);
      setError(`Failed to delete workflow for ${phase} phase`);
    }
  };

  const getWorkflowForPhase = (phase) => {
    return workflows.find(w => w.phase === phase);
  };

  if (!projectId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Project</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">No project ID provided</p>
          <button 
            onClick={() => navigate('/assessment/projects')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (selectedWorkflow) {
    return (
      <div className="container mx-auto px-4 py-8">
        <WorkflowDetail 
          workflow={selectedWorkflow} 
          onBack={() => setSelectedWorkflow(null)} 
        />
      </div>
    );
  }

  if (loading && workflows.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Workflow Management
          </h1>
          <button 
            onClick={() => navigate('/assessment/projects')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Projects
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Project: {project?.name || 'Loading...'}
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
                    {!workflow && !isAdmin && (
                      <div className="w-full px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-center">
                        No workflow available
                      </div>
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
    </div>
  );
};

export default WorkflowManagementPage;