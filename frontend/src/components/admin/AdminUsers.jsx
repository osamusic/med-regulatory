import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';

const AdminUsers = () => {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50); // Users per page
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    // Wait for auth to complete before fetching
    if (!authLoading && user) {
      fetchUsers();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('Authentication required');
    }
  }, [authLoading, user, currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, get the total count
      const countResponse = await axiosClient.get('/admin/users/count');
      const totalCount = countResponse.data.total;
      setTotalUsers(totalCount);
      
      // Calculate pagination parameters based on total count
      const skip = currentPage * pageSize;
      
      // If current page is beyond available data, go to last page
      const maxPage = Math.max(0, Math.ceil(totalCount / pageSize) - 1);
      const actualPage = Math.min(currentPage, maxPage);
      const actualSkip = actualPage * pageSize;
      
      // Update current page if it was adjusted
      if (actualPage !== currentPage) {
        setCurrentPage(actualPage);
      }
      
      // Then fetch users with correct pagination
      const usersResponse = await axiosClient.get('/admin/users', {
        params: { skip: actualSkip, limit: pageSize }
      });
      
      setUsers(usersResponse.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('An error occurred while fetching user information');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminStatus = async (userId) => {
    try {
      setActionInProgress(true);
      await axiosClient.put(`/admin/users/${userId}/admin`);
      await fetchUsers();
    } catch (err) {
      console.error('Error toggling admin status:', err);
      setError('An error occurred while changing admin privileges');
    } finally {
      setActionInProgress(false);
    }
  };
  
  const toggleActivationStatus = async (userId) => {
    try {
      setActionInProgress(true);
      await axiosClient.put(`/admin/users/${userId}/activate`);
      await fetchUsers();
    } catch (err) {
      console.error('Error toggling activation status:', err);
      setError('An error occurred while changing the account activation status');
    } finally {
      setActionInProgress(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("本当にこのユーザーを削除しますか？")) return;

    try {
      setActionInProgress(true);
      await axiosClient.delete(`/admin/users/${userId}`);
      await fetchUsers();  // 一覧を再読み込み
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Error deleting user:');
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Pagination info */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalUsers)} of {totalUsers} users
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
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin Privileges
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activation Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.is_admin ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Yes
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.is_active ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => toggleAdminStatus(user.id)}
                        disabled={actionInProgress}
                        className={`text-blue-600 hover:text-blue-900 ${
                          actionInProgress ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {user.is_admin ? 'Revoke Admin' : 'Grant Admin'}
                      </button>
                      <button
                        onClick={() => toggleActivationStatus(user.id)}
                        disabled={actionInProgress}
                        className={`text-blue-600 hover:text-blue-900 ${
                          actionInProgress ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {user.is_active ? 'Deactivate Account' : 'Activate Account'}
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        disabled={actionInProgress}
                        className={`text-red-600 hover:text-red-900 ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
