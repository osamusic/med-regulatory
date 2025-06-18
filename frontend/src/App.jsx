import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProcessProvider } from './contexts/ProcessContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Header from './components/common/Header';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ChangePassword from './components/auth/ChangePassword';
import Dashboard from './components/dashboard/Dashboard';
import GuidelinesList from './components/guidelines/GuidelinesList';
import ClassificationsList from './components/guidelines/ClassificationsList';
import GuidelineDetail from './components/guidelines/GuidelineDetail';
import GuidelineForm from './components/guidelines/GuidelineForm';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminDocuments from './components/admin/AdminDocuments';
import NotFound from './components/common/NotFound';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import ProgressModal from './components/common/ProgressModal';
import DocumentSearch from './components/documents/DocumentSearch';
import NewsList from './components/news/NewsList';
import NewsDetail from './components/news/NewsDetail';
import Process from './components/process/Process';
import ProcessDetails from './components/process/ProcessDetails';
import AssessmentProjects from './components/assessment/AssessmentProjects';
import AssessmentDetail from './components/assessment/AssessmentDetail';
import WorkflowManagementPage from './components/workflow/WorkflowManagementPage';

function App() {
  return (
    <AuthProvider>
      <ProcessProvider>
        <ThemeProvider>
          <div className="min-h-screen bg-gray-100 dark:bg-gray-800 dark:bg-gray-900">
            <Header />
            <main className="container mx-auto px-4 py-8 text-gray-900 dark:text-gray-100 dark:text-gray-100">
            <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route 
              path="/change-password" 
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/process/matrix" 
              element={
                <ProtectedRoute>
                  <Process />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/process/details" 
              element={
                <ProtectedRoute>
                  <ProcessDetails />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/assessment/projects" 
              element={
                <ProtectedRoute>
                  <AssessmentProjects />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/assessment/projects/:projectId/assessments" 
              element={
                <ProtectedRoute>
                  <AssessmentDetail />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/workflow/:projectId" 
              element={
                <ProtectedRoute>
                  <WorkflowManagementPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/guidelines" 
              element={
                <ProtectedRoute>
                  <GuidelinesList />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/admin/classifications" 
              element={
                <AdminRoute>
                  <ClassificationsList />
                </AdminRoute>
              } 
            />
            
            {/* Redirect old classifications path to admin path */}
            <Route 
              path="/classifications" 
              element={<Navigate to="/admin/classifications" replace />} 
            />
            
            <Route 
              path="/guidelines/:id" 
              element={
                <ProtectedRoute>
                  <GuidelineDetail />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/guidelines/new" 
              element={
                <AdminRoute>
                  <GuidelineForm />
                </AdminRoute>
              } 
            />
            
            <Route 
              path="/guidelines/edit/:id" 
              element={
                <AdminRoute>
                  <GuidelineForm />
                </AdminRoute>
              } 
            />
            
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />
            
            <Route 
              path="/admin/users" 
              element={
                <AdminRoute>
                  <AdminUsers />
                </AdminRoute>
              } 
            />
            
            <Route 
              path="/admin/documents" 
              element={
                <AdminRoute>
                  <AdminDocuments />
                </AdminRoute>
              } 
            />
            
            <Route 
              path="/documents/search" 
              element={
                <ProtectedRoute>
                  <DocumentSearch />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/news" 
              element={
                <ProtectedRoute>
                  <NewsList />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/news/:id" 
              element={
                <ProtectedRoute>
                  <NewsDetail />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ProgressModal />
        </main>
      </div>
        </ThemeProvider>
      </ProcessProvider>
    </AuthProvider>
  );
}

export default App;
