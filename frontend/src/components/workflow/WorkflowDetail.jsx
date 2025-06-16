import React from 'react';
import PropTypes from 'prop-types';

const WorkflowDetail = ({ workflow, onClose }) => {
  const renderInstructions = (instructions) => {
    if (!instructions || typeof instructions !== 'object') {
      return <p className="text-gray-500 dark:text-gray-400">No instructions available</p>;
    }

    return Object.entries(instructions).map(([role, steps]) => (
      <div key={role} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {role}
        </h4>
        <ol className="space-y-2">
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
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Workflow: {workflow.phase} Phase
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Workflow Summary */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Workflow Summary
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {workflow.workflow_text || 'No workflow summary available'}
              </p>
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
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
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
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Phase:</span> {workflow.phase}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Roles Count:</span> {Object.keys(workflow.instructions || {}).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

WorkflowDetail.propTypes = {
  workflow: PropTypes.shape({
    id: PropTypes.string.isRequired,
    project_id: PropTypes.string.isRequired,
    phase: PropTypes.string.isRequired,
    workflow_text: PropTypes.string.isRequired,
    instructions: PropTypes.object.isRequired
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

export default WorkflowDetail;