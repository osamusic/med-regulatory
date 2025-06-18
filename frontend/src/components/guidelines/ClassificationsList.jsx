import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { FaChevronDown, FaChevronRight, FaPlus, FaTrash } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { useAuth } from '../../contexts/AuthContext';

const ClassificationDetail = ({ classification, onClose, onCreateMultipleGuidelines }) => {
  const [creatingGuideline, setCreatingGuideline] = useState(false);
  const [selectedRequirements, setSelectedRequirements] = useState([]);
  const { user, loading: authLoading, isAdmin } = useAuth();
  
  useEffect(() => {
    const checkIsAdmin = async () => {
      // Auth context already provides isAdmin, but keeping the API call for additional verification
      if (!authLoading && user) {
        try {
          await axiosClient.get('/me');
          // We can use the isAdmin from context or this API response
        } catch (err) {
          console.error('Error checking admin status:', err);
        }
      }
    };
    
    if (!authLoading && user) {
      checkIsAdmin();
    }
  }, [authLoading, user]);
  
  const toggleRequirement = (reqId) => {
    if (!isAdmin) return;
    
    if (selectedRequirements.includes(reqId)) {
      setSelectedRequirements(selectedRequirements.filter(id => id !== reqId));
    } else {
      setSelectedRequirements([...selectedRequirements, reqId]);
    }
  };
  
  useEffect(() => {
    if (classification && Array.isArray(classification.requirements)) {
      setSelectedRequirements(classification.requirements.map(req => req.id));
    }
  }, [classification]);
  
  if (!classification) return null;
  
  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold">Classification Details</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-300"
        >
          ✕
        </button>
      </div>

      <div className="mb-4">
        <h4 className="text-lg font-medium mb-2">Document Information</h4>
        <p><span className="font-medium">Title:</span> {classification.document_title}</p>
        <p><span className="font-medium">Created At:</span> {new Date(classification.created_at).toLocaleString('en-US')}</p>
      </div>

      <div className="mb-4">
        <h4 className="text-lg font-medium mb-2">Requirements List</h4>
          {Array.isArray(classification.requirements) ? (
            <div className="space-y-2">
              {classification.requirements.map((req) => (
                <div key={req.id} className="flex items-start">
                  <input
                    type="checkbox"
                    id={`req-${req.id}`}
                    className="mt-1 mr-2"
                    checked={selectedRequirements.includes(req.id)}
                    onChange={() => toggleRequirement(req.id)}
                    disabled={!isAdmin}
                  />
                  <label
                    htmlFor={`req-${req.id}`}
                    className={`${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'} flex flex-col`}
                  >
                    <div className="flex items-center space-x-2">
                      {/* カテゴリバッジ */}
                      <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {req.category}
                      </span>
                      {/* 種別 */}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">[{req.type}]</span>
                    </div>
                    {/* 本文 */}
                    <span className="mt-1 text-gray-800 dark:text-gray-200">{req.text}</span>
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <ReactMarkdown>{classification.requirements}</ReactMarkdown>
          )}
      </div>

      <div className="mt-6 flex justify-end space-x-2">
        <button
          onClick={() => {
            setCreatingGuideline(true);
            onCreateMultipleGuidelines(classification, selectedRequirements)
              .finally(() => setCreatingGuideline(false));
          }}
          className={`${
            isAdmin && selectedRequirements.length > 0
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-400 cursor-not-allowed'
          } text-white font-medium py-2 px-4 rounded flex items-center`}
          disabled={!isAdmin || creatingGuideline || selectedRequirements.length === 0}
          title={!isAdmin ? "Admin privileges required" : selectedRequirements.length === 0 ? "Select at least one requirement" : ""}
        >
          <FaPlus className="mr-2" /> Create Guidelines
        </button>
        
        {creatingGuideline && (
          <span className="flex items-center text-gray-600 dark:text-gray-400">
            <div className="mr-2 animate-spin h-4 w-4 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
            Creating...
          </span>
        )}
      </div>
    </div>
  );
};


ClassificationDetail.propTypes = {
  classification: PropTypes.shape({
    document_title: PropTypes.string.isRequired,
    original_title: PropTypes.string.isRequired,
    created_at:      PropTypes.string.isRequired,
    requirements: PropTypes.arrayOf(
      PropTypes.shape({
        id:       PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        category: PropTypes.string.isRequired,
        type:     PropTypes.string.isRequired,
        text:     PropTypes.string.isRequired,
        subject:  PropTypes.string,
      })
    ).isRequired,
    keywords: PropTypes.arrayOf(
      PropTypes.shape({
        keyword:     PropTypes.string.isRequired,
        importance:  PropTypes.number.isRequired,
        description: PropTypes.string,
      })
    ).isRequired,
  }).isRequired,

  onClose:                     PropTypes.func.isRequired,
  onCreateMultipleGuidelines:  PropTypes.func.isRequired,
};

const ClassificationsList = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [classifications, setClassifications] = useState([]);
  const [error, setError] = useState(null);
  const [selectedClassification, setSelectedClassification] = useState(null);
  const [showClassificationList, setShowClassificationList] = useLocalStorageState('classifications_showList', true);
  const [loadingClassifications, setLoadingClassifications] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [classificationToDelete, setClassificationToDelete] = useState(null);
  const [convertedClassifications, setConvertedClassifications] = useState({});
  const [expandedGroups, setExpandedGroups] = useLocalStorageState('classifications_expandedGroups', {});

  useEffect(() => {
    const checkConvertedClassifications = async () => {
      if (!classifications || classifications.length === 0) return;
      
      // Wait for auth to complete before making API calls
      if (!authLoading && user) {
        try {
          const pairs = [];
          classifications.forEach(classification => {
            if (classification && classification.requirements) {
              const reqIds = classification.requirements.map(req => req.id);
              pairs.push({
                document_id: classification.document_id,
                classification_id: classification.id,
                req_ids: reqIds
              });
            }
          });
          
          const response = await axiosClient.post('/guidelines/check-conversions', pairs);
          setConvertedClassifications(response.data || {});
        } catch (err) {
          console.error('Error checking converted classifications:', err);
        }
      }
    };
    
    checkConvertedClassifications();
  }, [authLoading, user, classifications]);

  useEffect(() => {
    const fetchClassifications = async () => {
      try {
        setLoadingClassifications(true);
        console.log('Loading classification data...');
        
        const response = await axiosClient.get('/classifier/all');
        console.log('Fetched classification data:', response.data);
        
        setClassifications(response.data || []);
      } catch (err) {
        console.error('Error loading classifications:', err);
        if (err.response) {
          console.error('Error response:', err.response.status, err.response.data);
        }
        setError('Authentication required');
      } finally {
        setLoadingClassifications(false);
      }
    };
    
    // Wait for auth to complete before fetching
    if (!authLoading && user) {
      fetchClassifications();
    } else if (!authLoading && !user) {
      setLoadingClassifications(false);
      setError('Authentication required');
    }
  }, [authLoading, user]);
  
  useEffect(() => {
    const checkIsAdmin = async () => {
      // Auth context already provides isAdmin, but keeping the API call for additional verification
      if (!authLoading && user) {
        try {
          await axiosClient.get('/me');
          // We can use the isAdmin from context or this API response
        } catch (err) {
          console.error('Error checking admin status:', err);
        }
      }
    };
    
    if (!authLoading && user) {
      checkIsAdmin();
    }
  }, [authLoading, user]);

  
  const createMultipleGuidelinesFromClassification = async (classification, selectedReqs = []) => {
    if (!classification) return;
    
    setError(null);
    let createdCount = 0;
    let failedCount = 0;
    const errors = [];
    
    try {
      let documentUrl = '';
      let documentTitle = '';
      try {
        const documentResponse = await axiosClient.get(`/admin/documents/${classification.document_id}`);
        documentUrl = classification.source_url || documentResponse.data.url || '';
        documentTitle = documentResponse.data.original_title || documentResponse.data.title || '';
        classification.original_title = documentResponse.data.original_title; // Store original_title in classification
      } catch (docErr) {
        console.warn('Error fetching document information:', docErr);
        documentUrl = classification.source_url || 'Error';
        documentTitle = 'Error';
      }
      
      const requirements = Array.isArray(classification.requirements) 
        ? classification.requirements.filter(req => selectedReqs.includes(req.id))
        : [];
        
      if (requirements.length === 0) {
        setError('No requirements selected. Please select at least one requirement.');
        return null;
      }
      
      const creationPromises = requirements.map(async (req) => {
        const guidelineId = `${classification.document_id}-${req.id}`;
        const guidelineData = {
          guideline_id: guidelineId,
          category: req.category || 'Unknown',
          control_text: req.text || '',
          standard: documentTitle,
          source_url: documentUrl,
          subject: req.subject || 'General'
        };
        
        try {
          const response = await axiosClient.post('/guidelines/create', guidelineData);
          return { 
            success: true, 
            data: response.data,
            requirement: req
          };
        } catch (err) {
          let errorMessage = '';
          if (err.response && err.response.status === 400 && 
              err.response.data.detail && 
              err.response.data.detail.includes('already exists')) {
            errorMessage = `ガイドライン ID '${guidelineId}' は既に存在しています`;
          } else {
            errorMessage = `エラー: ${err.response?.status || ''} ${err.response?.data?.detail || err.message || '不明なエラー'}`;
          }
          
          return { 
            success: false, 
            error: errorMessage,
            requirement: req,
            guidelineId: guidelineId
          };
        }
      });
      
      const results = await Promise.allSettled(creationPromises);
      
      const processedResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: '処理に失敗しました' }
      );
      
      createdCount = processedResults.filter(result => result.success).length;
      failedCount = processedResults.filter(result => !result.success).length;
      
      errors.push(...processedResults
        .filter(result => !result.success)
        .map(result => result.error));
      
      if (createdCount > 0 && failedCount > 0) {
        setSelectedClassification(null);
        setSuccessMessage(`${createdCount}件のガイドラインが正常に作成されました。${failedCount}件は作成に失敗しました。`);
        setError(errors.join('\n• '));
      } else if (createdCount > 0) {
        setSelectedClassification(null);
        setSuccessMessage(`${createdCount}件のガイドラインが正常に作成されました。ガイドラインページで確認できます。`);
      } else {
        setError('ガイドラインの作成に失敗しました。以下のエラーを確認してください：\n• ' + errors.join('\n• '));
      }
      
      return processedResults.filter(result => result.success).map(result => result.data);
    } catch (err) {
      console.error('Error creating multiple guidelines:', err);
      let errorMessage = 'ガイドライン作成中にエラーが発生しました。';
      if (err.response) {
        errorMessage = `エラー (${err.response.status}): ${err.response.data.detail || errorMessage}`;
      }
      setError(errorMessage);
      return null;
    }
  };

  const createGuidelinesFromAllClassifications = async () => {
    setError(null);
    let totalCreated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const errors = [];
    
    try {
      setLoadingClassifications(true);
      
      let allClassifications = classifications;
      if (!allClassifications || allClassifications.length === 0) {
        const response = await axiosClient.get('/classifier/all');
        allClassifications = response.data || [];
      }
      
      if (allClassifications.length === 0) {
        setError('No classifications found.');
        setLoadingClassifications(false);
        return;
      }
      
      for (const classification of allClassifications) {
        if (!classification || !Array.isArray(classification.requirements) || classification.requirements.length === 0) {
          continue;
        }
        
        if (convertedClassifications[classification.id]) {
          totalSkipped++;
          continue;
        }
        
        let documentUrl = '';
        let documentTitle = '';
        try {
          const documentResponse = await axiosClient.get(`/admin/documents/${classification.document_id}`);
          documentUrl = classification.source_url || documentResponse.data.url || '';
          documentTitle = documentResponse.data.original_title || documentResponse.data.title || '';
          classification.original_title = documentResponse.data.original_title; // Store original_title in classification
        } catch (docErr) {
          console.warn('Error fetching document information:', docErr);
          documentUrl = classification.source_url || 'Error';
          documentTitle = 'Error';
        }
        
        const requirements = classification.requirements;
        
        const creationPromises = requirements.map(async (req) => {
          const guidelineId = `${classification.document_id}-${req.id}`;
          const guidelineData = {
            guideline_id: guidelineId,
            category: req.category || 'Unknown',
            control_text: req.text || '',
            standard: documentTitle,
            source_url: documentUrl,
            subject: req.subject || 'General'
          };
          
          try {
            const response = await axiosClient.post('/guidelines/create', guidelineData);
            return { 
              success: true, 
              data: response.data,
              requirement: req
            };
          } catch (err) {
            let errorMessage = '';
            if (err.response && err.response.status === 400 && 
                err.response.data.detail && 
                err.response.data.detail.includes('already exists')) {
              errorMessage = `Guideline ID '${guidelineId}' already exists`;
            } else {
              errorMessage = `Error: ${err.response?.status || ''} ${err.response?.data?.detail || err.message || 'Unknown error'}`;
            }
            
            return { 
              success: false, 
              error: errorMessage,
              requirement: req,
              guidelineId: guidelineId
            };
          }
        });
        
        const results = await Promise.allSettled(creationPromises);
        
        const processedResults = results.map(result => 
          result.status === 'fulfilled' ? result.value : { success: false, error: 'Processing failed' }
        );
        
        const createdCount = processedResults.filter(result => result.success).length;
        const failedCount = processedResults.filter(result => !result.success).length;
        
        totalCreated += createdCount;
        totalFailed += failedCount;
        
        errors.push(...processedResults
          .filter(result => !result.success)
          .map(result => result.error));
      }
      
      if (totalCreated > 0 && totalFailed > 0) {
        setSuccessMessage(`${totalCreated} guidelines were successfully created. ${totalFailed} failed. ${totalSkipped} were skipped (already converted).`);
        setError(errors.join('\n• '));
      } else if (totalCreated > 0) {
        setSuccessMessage(`${totalCreated} guidelines were successfully created. ${totalSkipped} were skipped (already converted). Check the Guidelines page.`);
      } else if (totalSkipped > 0 && totalFailed === 0) {
        setSuccessMessage(`All ${totalSkipped} classifications have already been converted to guidelines.`);
      } else {
        setError('Failed to create guidelines. Check the following errors:\n• ' + errors.join('\n• '));
      }
      
      const fetchClassifications = async () => {
        try {
          setLoadingClassifications(true);
          const response = await axiosClient.get('/classifier/all');
          setClassifications(response.data || []);
        } catch (err) {
          console.error('Error loading classifications:', err);
        } finally {
          setLoadingClassifications(false);
        }
      };
      
      await fetchClassifications();
      
    } catch (err) {
      console.error('Error creating guidelines from all classifications:', err);
      setError(`Error creating guidelines: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingClassifications(false);
    }
  };

  const handleDeleteClassification = async (classification) => {
    if (!classification) return;
    
    try {
      setLoadingClassifications(true);
      await axiosClient.delete(`/classifier/results/${classification.id}`);
      
      setClassifications(prev => prev.filter(c => c.id !== classification.id));
      
      setSuccessMessage(`Classification data "${classification.document_title}" was successfully deleted.`);
      
      setClassificationToDelete(null);
    } catch (err) {
      console.error('Error deleting classification:', err);
      let errorMessage = 'An error occurred while deleting classification data.';
      if (err.response) {
        errorMessage = `Error (${err.response.status}): ${err.response.data.detail || errorMessage}`;
      }
      setError(errorMessage);
      setClassificationToDelete(null);
    } finally {
      setLoadingClassifications(false);
    }
  };

  const groupClassificationsByOriginalTitle = () => {
    const groups = {};
    
    classifications.forEach(classification => {
      let groupTitle = classification.original_title || classification.document_title;
      
      if (!groups[groupTitle]) {
        groups[groupTitle] = [];
      }
      
      groups[groupTitle].push(classification);
    });
    
    return groups;
  };

  const toggleGroup = (groupTitle) => {
    setExpandedGroups(prev => {
      const newExpandedGroups = {
        ...prev,
        [groupTitle]: !prev[groupTitle]
      };
      
      return newExpandedGroups;
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Medical Device Cybersecurity Classifications</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <pre className="whitespace-pre-wrap font-sans text-sm">{error}</pre>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
          <button onClick={() => setSuccessMessage('')} className="float-right">✕</button>
        </div>
      )}

      {/* Link to Guidelines page */}
      <div className="mb-4 flex justify-between items-center">
        <Link to="/guidelines" className="text-blue-600 hover:text-blue-800 font-medium">
          Go to Guidelines
        </Link>
        
        {isAdmin && (
          <button
            onClick={createGuidelinesFromAllClassifications}
            className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg inline-flex items-center"
            disabled={loadingClassifications}
          >
            <FaPlus className="mr-2" /> Create Guidelines from All Classifications
          </button>
        )}
      </div>

      {/* Classification Data List */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <div
          className="flex justify-between items-center cursor-pointer"
          onClick={() => {
            const newShowList = !showClassificationList;
            setShowClassificationList(newShowList);
          }}
        >
          <h2 className="text-lg font-semibold">Classification Data</h2>
          {showClassificationList ? <FaChevronDown /> : <FaChevronRight />}
        </div>

        {showClassificationList && (
          <div className="mt-4">
            {loadingClassifications ? (
              <div className="flex justify-center items-center h-24">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : classifications.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No classification data available</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupClassificationsByOriginalTitle()).map(([groupTitle, groupClassifications]) => (
                  <div key={groupTitle} className="border rounded-lg overflow-hidden">
                    <div 
                      className="p-3 bg-gray-50 dark:bg-gray-700 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleGroup(groupTitle)}
                    >
                      <div className="flex items-center">
                        <div className="mr-2">
                          {expandedGroups[groupTitle] ? <FaChevronDown /> : <FaChevronRight />}
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{groupTitle}</h3>
                        <span className="ml-2 text-sm text-gray-500">({groupClassifications.length} items)</span>
                      </div>
                    </div>
                    
                    {expandedGroups[groupTitle] && (
                      <div className="grid grid-cols-1 gap-3 p-3">
                        {groupClassifications.map((classification) => (
                          <div
                            key={classification.id}
                            className="border rounded-lg transition-colors overflow-hidden"
                          >
                            <div
                              className={`p-3 cursor-pointer ${
                                selectedClassification && selectedClassification.id === classification.id
                                  ? 'border-blue-500 dark:border-blue-300 bg-blue-50 dark:bg-blue-800'
                                  : 'border-gray-200 dark:border-grazy-700 hover:bg-gray-50 dark:bg-gray-800'
                              }`}
                              onClick={() => {
                                if (selectedClassification && selectedClassification.id === classification.id) {
                                  setSelectedClassification(null);
                                } else {
                                  setSelectedClassification(classification);
                                }
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center flex-1 justify-between">
                                  <h3 className="font-medium max-w-[400px] overflow-hidden whitespace-normal line-clamp-3">{classification.document_title}</h3>
                                  {convertedClassifications[classification.id] && (
                                    <span className="ml-auto bg-green-100 text-green-800 text-[10px] px-0.5 py-px rounded">
                                      created
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  {isAdmin && ( 
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setClassificationToDelete(classification);
                                      }}
                                      className="text-red-500 hover:text-red-600 ml-2"
                                      title="Delete"
                                    >
                                      <FaTrash />
                                    </button>
                                  )}
                                  <span className="text-xs text-gray-500 ml-2">
                                    {new Date(classification.created_at).toLocaleDateString('en-US')}
                                  </span>
                                </div>
                              </div>

                            {classification.keywords && classification.keywords.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {classification.keywords.map((kw, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-blue-100 text-gray-800 dark:bg-blue-900 dark:text-gray-100 text-sm px-2 py-1 rounded-full"
                                  >
                                    {typeof kw === 'object' ? kw.keyword : kw}
                                  </span>
                                ))}
                              </div>
                            )}
                            </div>

                            {/* Inline detail view */}
                            {selectedClassification && selectedClassification.id === classification.id && (
                              <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                                <ClassificationDetail
                                  classification={classification}
                                  onClose={() => setSelectedClassification(null)}
                                  onCreateMultipleGuidelines={createMultipleGuidelinesFromClassification}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!loadingClassifications && !error && classifications.length === 0 && (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-4">No classifications found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No classification data available.
          </p>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {classificationToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Delete this classification data?</h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete classification data &quot;{classificationToDelete.document_title}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setClassificationToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClassification(classificationToDelete)}
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

export default ClassificationsList;
