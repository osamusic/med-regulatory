import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { FaTrash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const NewsList = () => {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchNews();
  }, []);
  
  useEffect(() => {
    if (user) {
      setIsAdmin(user.is_admin || false);
    }
  }, [user]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/news/all');
      setNewsList(res.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch news', err);
      setError('An error occurred while fetching news');
      setNewsList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectNews = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.post('/news/collect');
      alert(res.data.message || 'News collection task started');
      setTimeout(() => {
        fetchNews();
      }, 5000);
    } catch (err) {
      console.error('Failed to collect news', err);
      alert('Failed to collect news');
      setLoading(false);
    }
  };
  
  const handleDeleteAllNews = async () => {
    if (!window.confirm('Are you sure you want to delete all news articles? This cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await axiosClient.delete('/news/all');
      setNewsList([]);
      alert('All news articles have been deleted');
    } catch (err) {
      console.error('Failed to delete news articles', err);
      alert('Failed to delete news articles');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading news...</div>;
  
  if (error) return (
    <div className="p-6 text-center">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    </div>
  );
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Security News</h1>
      
      {newsList.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg text-center">
          <h3 className="text-lg mb-4">No security news available</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please collect data</p>
          {isAdmin && (
            <button
              onClick={handleCollectNews}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Collect News
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {newsList.map((item) => (
              <li
                key={item.id}
                className="p-4 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => navigate(`/news/${item.id}`)}
              >
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.saved_at}</p>
              </li>
            ))}
          </ul>

          {isAdmin && (
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleCollectNews}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Collect New Articles
              </button>
              <button
                onClick={handleDeleteAllNews}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center justify-center"
              >
                <FaTrash className="mr-2" /> Delete All Articles
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NewsList;
