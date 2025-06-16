import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

const GuidelineForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEdit, setIsEdit] = useState(false);

  const [formData, setFormData] = useState({
    guideline_id: '',
    category: '',
    standard: '',
    control_text: '',
    source_url: '',
    subject: 'International'
  });

  useEffect(() => {
    const fetchGuideline = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axiosClient.get(`/guidelines/${id}`);
        
        const found = response.data;
        if (found) {
          setFormData({
            guideline_id: found.guideline_id,
            category: found.category,
            standard: found.standard,
            control_text: found.control_text,
            source_url: found.source_url,
            subject: found.subject || found.region || 'International'
          });
          setIsEdit(true);
        } else {
          setError('Guideline not found');
          navigate('/guidelines');
        }
      } catch (err) {
        console.error('Error fetching guideline:', err);
        if (err.response && err.response.status === 404) {
          setError('Guideline not found');
          navigate('/guidelines');
        } else {
          setError('An error occurred while fetching the guideline');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGuideline();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.guideline_id || !formData.category || !formData.standard || !formData.control_text) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      if (isEdit) {
        await axiosClient.put(`/guidelines/${formData.guideline_id}`, formData);
        navigate(`/guidelines/${id}`, {
          state: { message: 'Guideline updated successfully' }
        });
      } else {
        const response = await axiosClient.post('/guidelines/create', formData);
        navigate(`/guidelines/${response.data.id}`, {
          state: { message: 'Guideline created successfully' }
        });
      }
    } catch (err) {
      console.error('Error saving guideline:', err);
      let msg = 'An error occurred while saving the guideline';
      if (err.response) {
        msg = `Error (${err.response.status}): ${err.response.data.detail || msg}`;
      }
      setError(msg);
    } finally {
      setSaving(false);
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
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-bold mb-6">
        {isEdit ? 'Edit Guideline' : 'Create New Guideline'}
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="guideline_id" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Guideline ID *
            </label>
            <input
              type="text"
              id="guideline_id"
              name="guideline_id"
              value={formData.guideline_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isEdit}
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Category *
            </label>
            <input
              type="text"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="standard" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Standard *
            </label>
            <input
              type="text"
              id="standard"
              name="standard"
              value={formData.standard}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="subject" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Subject
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="source_url" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Source URL
            </label>
            <input
              type="url"
              id="source_url"
              name="source_url"
              value={formData.source_url}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="control_text" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Control Text *
            </label>
            <textarea
              id="control_text"
              name="control_text"
              value={formData.control_text}
              onChange={handleChange}
              rows={6}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-2 rounded-lg text-white font-medium ${
              saving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GuidelineForm;
