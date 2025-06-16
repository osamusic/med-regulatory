import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get('/admin/users');
      setUsers(response.data);
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

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
