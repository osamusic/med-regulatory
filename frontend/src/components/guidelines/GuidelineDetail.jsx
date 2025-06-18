import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const GuidelineDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [guideline, setGuideline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchGuideline = async () => {
      try {
        setLoading(true);
        const response = await axiosClient.get(`/guidelines/${id}`);
        setGuideline(response.data);
      } catch (err) {
        console.error('Error fetching guideline:', err);
        if (err.response && err.response.status === 404) {
          setError('Guideline not found');
        } else {
          setError('An error occurred while fetching the guideline');
        }
      } finally {
        setLoading(false);
      }
    };

    // Wait for auth to complete before fetching
    if (!authLoading && user) {
      fetchGuideline();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Authentication required');
    }
  }, [id, authLoading, user]);

  useEffect(() => {
    if (user) {
      setIsAdmin(user.is_admin || false);
    }
  }, [user]);

  const handleDelete = async () => {
    if (!guideline) return;

    try {
      setLoading(true);
      await axiosClient.delete(`/guidelines/${guideline.guideline_id}`);
      navigate('/guidelines', {
        state: {
          message: `Guideline "${guideline.guideline_id}" was successfully deleted`
        }
      });
    } catch (err) {
      console.error('Error deleting guideline:', err);
      let errorMessage = 'An error occurred while deleting the guideline';
      if (err.response) {
        errorMessage = `Error (${err.response.status}): ${err.response.data.detail || errorMessage}`;
      }
      setError(errorMessage);
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !guideline) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <p>{error || 'Guideline not found'}</p>
        <Link to="/guidelines" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to Guideline List
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <Link to="/guidelines" className="text-blue-600 hover:underline">
          ← Back to Guidelines
        </Link>

        {isAdmin && (
          <div className="float-right">
            <Link
              to={`/guidelines/edit/${id}`}
              className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg inline-flex items-center mr-2"
            >
              <FaEdit className="mr-2" /> Edit
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg inline-flex items-center"
            >
              <FaTrash className="mr-2" /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between items-start mb-4">
        <h1 className="text-2xl font-bold">
          {guideline.standard}: {guideline.guideline_id}
        </h1>
        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
          {guideline.category}
        </span>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Control Measures</h2>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded border">
          <p className="whitespace-pre-line">{guideline.control_text}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Details</h2>
          <table className="w-full">
            <tbody>
              <tr className="border-b">
                <td className="py-2 font-medium">Standard</td>
                <td className="py-2">{guideline.standard}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-medium">Internal-ID</td>
                <td className="py-2">{guideline.guideline_id}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-medium">Category</td>
                <td className="py-2">{guideline.category}</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Subject</td>
                <td className="py-2">{guideline.subject || guideline.region}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Source</h2>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded border">
            <p className="mb-2">
              <span className="font-medium">URL: </span>
              <a
                href={guideline.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all dark:text-blue-400 dark:hover:text-blue-300"
              >
                {guideline.source_url}
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Are you sure you want to delete this guideline?</h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete guideline {guideline.guideline_id}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuidelineDetail;
