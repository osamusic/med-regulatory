import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { FaArrowLeft, FaExternalLinkAlt, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const NewsDetail = () => {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/news/${id}`);
        setArticle(res.data);
        setError('');
      } catch (err) {
        console.error('Failed to fetch article', err);
        setError('An error occurred while fetching the article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);
  
  useEffect(() => {
    if (user) {
      setIsAdmin(user.is_admin || false);
    }
  }, [user]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this article?')) {
      return;
    }

    try {
      await axiosClient.delete(`/news/${id}`);
      alert('Article deleted successfully');
      navigate('/news');
    } catch (err) {
      console.error('Failed to delete article', err);
      alert('Failed to delete article');
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;
  if (!article) return <div className="p-6 text-center">Article not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link to="/news" className="text-blue-500 hover:text-blue-700 flex items-center">
          <FaArrowLeft className="mr-2" /> Back to List
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{article.saved_at}</p>

      <div className="flex items-center mb-6">
        <a 
          href={article.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-500 hover:text-blue-700 flex items-center mr-4"
        >
          <FaExternalLinkAlt className="mr-2" /> Open Original Article
        </a>
        {isAdmin && (
          <button 
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 flex items-center"
          >
            <FaTrash className="mr-2" /> Delete
          </button>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Summary</h2>
        <p>{article.summary}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Keywords</h2>
        <div className="flex flex-wrap gap-2">
          {article.keywords.split(',').map((keyword, index) => (
            <span 
              key={index} 
              className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
            >
              {keyword.trim()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsDetail;
