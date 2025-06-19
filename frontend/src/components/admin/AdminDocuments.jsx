import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { FaChevronDown, FaChevronRight, FaEdit } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const AdminDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [groupDeleteConfirmation, setGroupDeleteConfirmation] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [editMode, setEditMode] = useState({ docId: null, field: null });
  const [editValue, setEditValue] = useState('');
  const [groupEditMode, setGroupEditMode] = useState(null);
  const [groupEditValue, setGroupEditValue] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50); // Documents per page
  const [totalDocuments, setTotalDocuments] = useState(0);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Wait for auth to complete before fetching
    if (!authLoading && user) {
      fetchDocuments();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Authentication required');
    }
  }, [authLoading, user, currentPage]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, get the total count
      const countResponse = await axiosClient.get('/admin/documents/count');
      const totalCount = countResponse.data.total;
      setTotalDocuments(totalCount);
      
      // If current page is beyond available data, go to last page
      const maxPage = Math.max(0, Math.ceil(totalCount / pageSize) - 1);
      const actualPage = Math.min(currentPage, maxPage);
      const actualSkip = actualPage * pageSize;
      
      // Update current page if it was adjusted
      if (actualPage !== currentPage) {
        setCurrentPage(actualPage);
      }
      
      // Then fetch documents with correct pagination
      const documentsResponse = await axiosClient.get('/admin/documents', {
        params: { skip: actualSkip, limit: pageSize }
      });
      
      setDocuments(documentsResponse.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      if (err.response?.status === 422) {
        setError('Authentication error. Please check your admin privileges.');
      } else {
        setError('An error occurred while fetching document information');
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (docId) => {
    setDeleteConfirmation(docId);
  };

  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const deleteDocument = async (docId) => {
    try {
      setActionInProgress(true);
      await axiosClient.delete(`/admin/documents/${docId}`, { data: { confirmed: true } });
      
      // Always refresh data after deletion - fetchDocuments will handle page adjustment
      await fetchDocuments();
      
      setDeleteConfirmation(null);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('An error occurred while deleting the document');
    } finally {
      setActionInProgress(false);
    }
  };

  const confirmDeleteGroup = (groupTitle) => {
    setGroupDeleteConfirmation(groupTitle);
  };

  const cancelDeleteGroup = () => {
    setGroupDeleteConfirmation(null);
  };

  const deleteGroup = async (groupTitle) => {
    try {
      setActionInProgress(true);
      const groups = groupDocumentsByOriginalTitle();
      const docsToDelete = groups[groupTitle] || [];
      await Promise.all(
        docsToDelete.map(doc =>
          axiosClient.delete(`/admin/documents/${doc.doc_id}`, { data: { confirmed: true } })
        )
      );
      
      // Always refresh data after deletion - fetchDocuments will handle page adjustment
      await fetchDocuments();
      
      setGroupDeleteConfirmation(null);
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('An error occurred while deleting the document group');
    } finally {
      setActionInProgress(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const toggleGroup = (groupTitle) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }));
  };

  const handleEditClick = (docId, field, value) => {
    setEditMode({ docId, field });
    setEditValue(value);
  };

  const handleEditCancel = () => {
    setEditMode({ docId: null, field: null });
    setEditValue('');
  };

  const handleSaveEdit = async (docId) => {
    try {
      setActionInProgress(true);
      
      const updateData = {};
      updateData[editMode.field] = editValue;
      
      await axiosClient.put(`/admin/documents/${docId}`, updateData);
      
      setEditMode({ docId: null, field: null });
      setEditValue('');
      
      // Refresh data to show updated information
      await fetchDocuments();
    } catch (err) {
      console.error('Error updating document:', err);
      setError('An error occurred while updating the document');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleGroupEditClick = (groupTitle) => {
    setGroupEditMode(groupTitle);
    setGroupEditValue(groupTitle);
  };

  const handleGroupEditCancel = () => {
    setGroupEditMode(null);
    setGroupEditValue('');
  };

  const handleGroupEditSave = async (groupTitle) => {
    try {
      setActionInProgress(true);
      
      const groups = groupDocumentsByOriginalTitle();
      const docsToUpdate = groups[groupTitle] || [];
      
      await Promise.all(
        docsToUpdate.map(doc =>
          axiosClient.put(`/admin/documents/${doc.doc_id}`, { original_title: groupEditValue })
        )
      );
      
      setGroupEditMode(null);
      setGroupEditValue('');
      
      // Refresh data to show updated group information
      await fetchDocuments();
    } catch (err) {
      console.error('Error updating group:', err);
      setError('An error occurred while updating the document group');
    } finally {
      setActionInProgress(false);
    }
  };

  const groupDocumentsByOriginalTitle = () => {
    const groups = {};
    documents.forEach(doc => {
      const groupTitle = doc.original_title || doc.title;
      if (!groups[groupTitle]) {
        groups[groupTitle] = [];
      }
      groups[groupTitle].push(doc);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const documentGroups = groupDocumentsByOriginalTitle();
  const totalPages = Math.ceil(totalDocuments / pageSize);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Document Management</h1>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Pagination info */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalDocuments)} of {totalDocuments} documents
        </div>
        {totalPages > 1 && (
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0 || loading}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === 0 || loading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Previous
            </button>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1 || loading}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === totalPages - 1 || loading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden">
        {Object.keys(documentGroups).length === 0 ? (
          <div className="px-6 py-4 text-center text-gray-500">
            No documents found
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(documentGroups).map(([groupTitle, docs]) => (
              <div key={groupTitle} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <div
                  className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleGroup(groupTitle)}
                >
                  <div className="flex items-center">
                    <div className="mr-2">
                      {expandedGroups[groupTitle] ? <FaChevronDown /> : <FaChevronRight />}
                    </div>
                    {groupEditMode === groupTitle ? (
                      <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={groupEditValue}
                          onChange={(e) => setGroupEditValue(e.target.value)}
                          className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleGroupEditSave(groupTitle)}
                          disabled={actionInProgress}
                          className={`text-green-600 hover:text-green-900 ${
                            actionInProgress ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleGroupEditCancel}
                          disabled={actionInProgress}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{groupTitle}</h3>
                    )}
                    <span className="ml-2 text-sm text-gray-500">({docs.length} items)</span>
                  </div>
                  <div className="flex items-center">
                    {docs.length > 0 && (
                      <>
                        <span className="text-sm text-gray-500 mr-4">
                          Source:
                          <a
                            href={docs[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={e => e.stopPropagation()}
                          >
                            {docs[0].source_type}
                          </a>
                        </span>
                        <span className="text-sm text-gray-500 mr-4">
                          Downloaded At: {formatDate(docs[0].downloaded_at)}
                        </span>
                      </>
                    )}
                    {groupDeleteConfirmation === groupTitle ? (
                      <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => deleteGroup(groupTitle)}
                          disabled={actionInProgress}
                          className={`text-red-600 hover:text-red-900 ${
                            actionInProgress ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={cancelDeleteGroup}
                          disabled={actionInProgress}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); handleGroupEditClick(groupTitle); }}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <FaEdit className="inline mr-1" /> Edit Group
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); confirmDeleteGroup(groupTitle); }}
                          className="text-red-600 hover:text-red-900 mr-4"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {expandedGroups[groupTitle] && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Original Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200">
                        {docs.map((doc) => (
                          <tr key={doc.id || doc.doc_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {doc.doc_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                              {editMode.docId === doc.doc_id && editMode.field === 'original_title' ? (
                                <div className="flex space-x-2">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveEdit(doc.doc_id)}
                                    disabled={actionInProgress}
                                    className={`text-green-600 hover:text-green-900 ${
                                      actionInProgress ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleEditCancel}
                                    disabled={actionInProgress}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div
                                  className="cursor-pointer hover:text-blue-600"
                                  onClick={() => handleEditClick(doc.doc_id, 'original_title', doc.original_title || '')}
                                >
                                  {doc.original_title || '-'}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                              {editMode.docId === doc.doc_id && editMode.field === 'title' ? (
                                <div className="flex space-x-2">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveEdit(doc.doc_id)}
                                    disabled={actionInProgress}
                                    className={`text-green-600 hover:text-green-900 ${
                                      actionInProgress ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleEditCancel}
                                    disabled={actionInProgress}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div
                                  className="cursor-pointer hover:text-blue-600"
                                  onClick={() => handleEditClick(doc.doc_id, 'title', doc.title)}
                                >
                                  {doc.title}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {deleteConfirmation === doc.doc_id ? (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => deleteDocument(doc.doc_id)}
                                    disabled={actionInProgress}
                                    className={`text-red-600 hover:text-red-900 ${
                                      actionInProgress ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={cancelDelete}
                                    disabled={actionInProgress}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => confirmDelete(doc.doc_id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDocuments;
