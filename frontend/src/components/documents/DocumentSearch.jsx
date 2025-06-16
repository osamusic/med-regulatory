import React, { useState, useEffect, useRef } from 'react';
import axiosClient from '../../api/axiosClient';
import { FaSearch, FaPaperPlane } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';

const TOP_K_OPTIONS = [3, 5, 10, 20];

const highlightText = (text, query) => {
  if (!query) return text;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return <mark key={index} className="bg-yellow-200">{part}</mark>;
    }
    return part;
  });
};

const DocumentSearch = () => {
  const [chatMessages, setChatMessages] = useLocalStorageState('documentSearch_chatMessages', []);
  
  const [searchQuery, setSearchQuery] = useLocalStorageState('documentSearch_query', '');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [topK, setTopK] = useLocalStorageState('documentSearch_topK', 5);
  const [filters, setFilters] = useLocalStorageState('documentSearch_filters', {
    doc_title: ''
  });
  const [docTitles, setDocTitles] = useState([]);
  const [showFilters, setShowFilters] = useLocalStorageState('documentSearch_showFilters', false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const { user } = useAuth();
  const chatContainerRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setHasSearched(true);
    setIsSearching(true);
    setLoading(true);
    setError(null);
    

    try {
      const filterParams = filters.doc_title ? { "doc_title": filters.doc_title } : undefined;
      const response = await axiosClient.post('/index/search', {
        query: searchQuery,
        top_k: topK,
        filters: filterParams
      });
      setSearchResults(response.data);
    } catch (err) {
      console.error(err);
      setError('An error occurred during search.');
      setSearchResults([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const resetFilters = () => {
    setFilters({});
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
  };
  
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
     
    const userMessage = { role: 'user', content: chatInput.trim() };    
    const newMessagesWithUser = [...chatMessages, userMessage];
    setChatMessages(newMessagesWithUser);

    setChatInput('');
    setChatLoading(true);
    setChatError(null);
  
    try {
      const response = await axiosClient.post('/index/chat', {
        user_id: user.username || user.id || 'anonymous',
        question: chatInput.trim()
      });
      
      const botMessage = { role: 'assistant', content: response.data.answer };      
      const newMessagesWithBot = [...newMessagesWithUser, botMessage];
      setChatMessages(newMessagesWithBot);
    } catch (err) {
      console.error('Chat error:', err);
      setChatError('An error occurred during chat.');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    const fetchTitles = async () => {
      try {
        const res = await axiosClient.get('/index/metadata/values/doc_title');
        setDocTitles(res.data);
      } catch (err) {
        console.error('Failed to fetch document titles', err);
      }
    };
    fetchTitles();
  }, []); 
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const renderSearchResult = (result, index) => (
    <div key={index} className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold mb-2">{result.metadata?.title || 'No Title'}</h3>
        <div>
          {result.metadata?.source_type && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded mr-2">
              {result.metadata.source_type}
            </span>
          )}
          <span className="text-sm text-gray-500">Score: {Math.round(result.score * 100) / 100}</span>
        </div>
      </div>
      <div className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {highlightText(result.text, searchQuery)}
      </div>
      {result.metadata?.url && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <a href={result.metadata.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
            View Original
          </a>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Document Search</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
      )}
      
      {/* Chat Interface */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-4">Chat with Documents</h2>
        
        {chatError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{chatError}</div>
        )}
        
        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="h-64 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-800"
        >
          {chatMessages.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center">
              Start a conversation about the documents...
            </div>
          ) : (
            chatMessages.map((message, index) => (
              <div key={index} className={`mb-3 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))
          )}
          {chatLoading && (
            <div className="text-left mb-3">
              <div className="inline-block bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-600 mr-2"></div>
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Chat Input */}
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask a question about the documents..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            disabled={chatLoading}
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            className={`px-4 py-2 rounded-lg text-white font-medium flex items-center ${
              chatLoading || !chatInput.trim() ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <FaPaperPlane className="mr-2" />
            Send
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Search Settings</h2>
          <button 
            onClick={() => {
              const newShowFilters = !showFilters;
              setShowFilters(newShowFilters);
            }} 
            className="text-blue-600 hover:text-blue-800"
          >
            {showFilters ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className={`px-4 py-2 rounded-lg text-white font-medium flex items-center ${
              isSearching || !searchQuery.trim() ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            <FaSearch className="mr-2" />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 rounded-lg text-blue-600 border border-blue-600 hover:bg-blue-50"
          >
            Reset
          </button>
        </form>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Result Limit</label>
              <select
                value={topK}
                onChange={(e) => {
                  const newTopK = Number(e.target.value);
                  setTopK(newTopK);
                }}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TOP_K_OPTIONS.map((k) => (
                  <option key={k} value={k}>{k} items</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Source Type</label>
              <select
                value={filters.doc_title || ''}
                onChange={(e) => handleFilterChange('doc_title', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                {docTitles.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : hasSearched && searchResults.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-6 text-center">
          <h3 className="text-lg font-semibold mb-4">No results found</h3>
          <p className="text-gray-600 dark:text-gray-400">Please adjust your search filters and try again.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {searchResults.map(renderSearchResult)}
        </div>
      )}
    </div>
  );
};

export default DocumentSearch;
