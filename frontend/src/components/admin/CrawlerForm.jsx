import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';

const CrawlerForm = ({ onCrawlComplete }) => {
  const { user, loading: authLoading } = useAuth();
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(2);
  const [mimeTypes, setMimeTypes] = useState(['application/pdf', 'text/html']);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isFileUpload, setIsFileUpload] = useState(false);

  useEffect(() => {
    // Check auth status and show error if not authenticated
    if (!authLoading && !user) {
      setError('Authentication required');
    }
  }, [authLoading, user]);

  const handleMimeTypeChange = (type) => {
    if (mimeTypes.includes(type)) {
      setMimeTypes(mimeTypes.filter(t => t !== type));
    } else {
      setMimeTypes([...mimeTypes, type]);
    }
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    
    if (file) {
      setIsFileUpload(true);
    }
  };

  const toggleMode = () => {
    setIsFileUpload(!isFileUpload);
    if (!isFileUpload) {
      setUrl(''); // ファイルアップロードモードに切り替える場合はURLをクリア
    } else {
      setSelectedFile(null); // URLモードに切り替える場合はファイル選択をクリア
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatusMessage('');

    if (!user) {
      setError('Authentication required');
      return;
    }

    if (isFileUpload) {
      if (!selectedFile) {
        setError('Please select a PDF file');
        return;
      }

      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are allowed');
        return;
      }

      try {
        setIsSubmitting(true);
        setStatusMessage('Uploading PDF file...');

        const formData = new FormData();
        formData.append('file', selectedFile);

        await axiosClient.post('/crawler/upload-pdf', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        setStatusMessage('PDF file uploaded. Processing...');

        setTimeout(async () => {
          try {
            const statusRes = await axiosClient.get('/crawler/status');
            if (onCrawlComplete) {
              onCrawlComplete(statusRes.data);
            }
          } catch (err) {
            console.error('Error checking crawler status:', err);
          } finally {
            setIsSubmitting(false);
          }
        }, 5000);
      } catch (err) {
        console.error('Error uploading PDF:', err);
        setError(err.response?.data?.detail || 'An error occurred while uploading the PDF file');
        setIsSubmitting(false);
      }
    } else {
      if (!url) {
        setError('Please enter a URL');
        return;
      }

      try {
        setIsSubmitting(true);
        setStatusMessage('Running crawler...');

        await axiosClient.post('/crawler/run', {
          url,
          depth: parseInt(depth),
          mime_filters: mimeTypes,
          name: `Crawl of ${url}`,
          update_existing: updateExisting
        });

        setStatusMessage('Crawler started. Please wait until the process completes.');

        setTimeout(async () => {
          try {
            const statusRes = await axiosClient.get('/crawler/status');
            if (onCrawlComplete) {
              onCrawlComplete(statusRes.data);
            }
          } catch (err) {
            console.error('Error checking crawler status:', err);
          } finally {
            setIsSubmitting(false);
          }
        }, 5000);

      } catch (err) {
        console.error('Error running crawler:', err);
        setError(err.response?.data?.detail || 'An error occurred while running the crawler');
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">Run Crawler</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
          {statusMessage}
        </div>
      )}

      <div className="flex items-center mb-4">
        <button
          type="button"
          onClick={toggleMode}
          className={`mr-4 px-4 py-2 rounded-lg ${
            !isFileUpload
              ? 'bg-blue-600 text-white'
              : 'bg-blue-900 text-gray-700 dark:text-gray-300'
          }`}
        >
          URL Crawl
        </button>
        <button
          type="button"
          onClick={toggleMode}
          className={`px-4 py-2 rounded-lg ${
            isFileUpload
              ? 'bg-blue-600 text-white'
              : 'bg-blue-900 text-gray-700 dark:text-gray-300'
          }`}
        >
          PDF Upload
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {!isFileUpload ? (
          <div className="mb-4">
            <label htmlFor="url" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              URL to Crawl
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com"
              required={!isFileUpload}
            />
          </div>
        ) : (
          <div className="mb-4">
            <label htmlFor="pdfFile" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Upload PDF File
            </label>
            <input
              type="file"
              id="pdfFile"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={isFileUpload}
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>
        )}

        {!isFileUpload && (
          <>
            <div className="mb-4">
              <label htmlFor="depth" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                Crawl Depth
              </label>
              <select
                id="depth"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1 - Only initial page</option>
                <option value="2">2 - Up to one link level</option>
                <option value="3">3 - Up to two link levels</option>
                <option value="4">4 - Up to three link levels</option>
                <option value="5">5 - Up to four link levels</option>
              </select>
            </div>

            <div className="mb-4">
              <span className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                File Types
              </span>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mimeTypes.includes('application/pdf')}
                    onChange={() => handleMimeTypeChange('application/pdf')}
                    className="mr-2"
                  />
                  PDF
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mimeTypes.includes('text/html')}
                    onChange={() => handleMimeTypeChange('text/html')}
                    className="mr-2"
                  />
                  HTML
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mimeTypes.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                    onChange={() => handleMimeTypeChange('application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                    className="mr-2"
                  />
                  Word (DOCX)
                </label>
              </div>
            </div>

            <div className="mb-4">
              <span className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                Options
              </span>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={() => setUpdateExisting(!updateExisting)}
                    className="mr-2"
                  />
                  Update existing documents (disable to skip duplicates)
                </label>
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-2 px-4 rounded-lg text-white font-medium ${
            isSubmitting
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSubmitting
            ? (isFileUpload ? 'Uploading...' : 'Running...')
            : (isFileUpload ? 'Upload PDF' : 'Run Crawler')}
        </button>
      </form>
    </div>
  );
};

CrawlerForm.propTypes = {
  onCrawlComplete: PropTypes.func
};

export default CrawlerForm;
