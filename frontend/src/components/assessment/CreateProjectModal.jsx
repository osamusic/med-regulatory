import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axiosClient from '../../api/axiosClient';
import { PhaseEnum, RoleEnum, SubjectEnum, PriorityEnum } from '../../constants/enum';
import { useAuth } from '../../contexts/AuthContext';

const CreateProjectModal = ({ isOpen, onClose, onProjectCreated, initialFilters = {} }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    phase: '',
    role: '',
    priority: '',
    category: '',
    standard: ''
  });
  
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [standardOptions, setStandardOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (isOpen) {
      // Wait for auth to complete before fetching
      if (!authLoading && user) {
        fetchFilterOptions();
      } else if (!authLoading && !user) {
        setError('Authentication required');
      }
      
      if (initialFilters) {
        setFormData(prev => ({
          ...prev,
          subject: initialFilters.subject || '',
          phase: initialFilters.phase || '',
          role: initialFilters.role || '',
          priority: initialFilters.priority || '',
          category: initialFilters.category || '',
          standard: initialFilters.standard || ''
        }));
      }
    }
  }, [isOpen, initialFilters, authLoading, user]);

  const fetchFilterOptions = async () => {
    try {
      const [categoriesResponse, standardsResponse] = await Promise.all([
        axiosClient.get('/proc/categories'),
        axiosClient.get('/proc/standards')
      ]);
      
      setCategoryOptions(categoriesResponse.data);
      setStandardOptions(standardsResponse.data);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axiosClient.post('/proc/projects', {
        name: formData.name,
        description: formData.description,
        subject: formData.subject || null,
        phase: formData.phase || null,
        role: formData.role || null,
        priority: formData.priority || null,
        category: formData.category || null,
        standard: formData.standard || null
      });

      onProjectCreated(response.data);
      onClose();
      
      setFormData({
        name: '',
        description: '',
        subject: '',
        phase: '',
        role: '',
        priority: '',
        category: '',
        standard: ''
      });
    } catch (err) {
      setError('Failed to create project');
      console.error('Error creating project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Create Assessment Project
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
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                placeholder="Enter project name"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                placeholder="Enter project description"
                rows={3}
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Filter Criteria (Optional)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Subject */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    {Object.values(SubjectEnum).map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phase */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                    Phase
                  </label>
                  <select
                    value={formData.phase}
                    onChange={(e) => handleChange('phase', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    {PhaseEnum.filter(phase => phase !== 'unknown').map((phase) => (
                      <option key={phase} value={phase}>
                        {phase}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    {RoleEnum.filter(role => role !== 'unknown').map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    {Object.values(PriorityEnum).map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Standard */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                    Standard
                  </label>
                  <select
                    value={formData.standard}
                    onChange={(e) => handleChange('standard', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="">All</option>
                    {standardOptions.map((standard) => (
                      <option key={standard} value={standard}>
                        {standard}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

CreateProjectModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onProjectCreated: PropTypes.func.isRequired,
  initialFilters: PropTypes.object
};

CreateProjectModal.defaultProps = {
  initialFilters: {}
};

export default CreateProjectModal;
