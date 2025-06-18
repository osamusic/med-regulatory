import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { FaMoon, FaSun, FaBars, FaTimes } from 'react-icons/fa';
import SystemStatus from './SystemStatus';

const Header = () => {
  const { isAuthenticated, isAdmin, logout, user } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="bg-blue-800 dark:bg-blue-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center text-xl font-bold">
            <img src="/images/medshield-icon.png" alt="MedShield AI" className="h-8 w-8 mr-3" />
            MedShield AI
          </Link>
          {isAuthenticated && (
            <div className="hidden md:block">
              <SystemStatus />
            </div>
          )}
        </div>
        
        <nav className="flex items-center">
          {/* Mobile menu button */}
          <button 
            className="md:hidden mr-2 text-xl focus:outline-none" 
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
          
          <ul className={`${mobileMenuOpen ? 'block' : 'hidden'} md:flex absolute md:relative top-16 left-0 right-0 md:top-auto md:space-x-6 bg-blue-800 dark:bg-blue-900 md:bg-transparent md:dark:bg-transparent shadow-md md:shadow-none flex-col md:flex-row w-full md:w-auto z-10`}>
            {isAuthenticated ? (
              <>
                <li className="md:hidden px-4 py-3 border-b border-blue-700">
                  <button
                    onClick={toggleDarkMode}
                    className="flex items-center hover:text-blue-200"
                    aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {darkMode ? <FaSun /> : <FaMoon />}
                  </button>
                </li>

                <li className="relative group">
                  <button className="block w-full text-left px-4 py-3 md:p-0 hover:bg-blue-700 md:hover:bg-transparent md:hover:text-blue-200 border-b border-blue-700 md:border-none">
                    Project Menu
                  </button>
                  <ul className="md:absolute md:right-0 md:mt-2 w-full md:w-48 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded shadow-lg md:hidden group-hover:block z-10">
                    <li>
                      <Link to="/process/matrix" className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900">
                        Process Matrix
                      </Link>
                    </li>
                    <li>
                      <Link to="/assessment/projects" className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900">
                        Assessment Projects
                      </Link>
                    </li>
                  </ul>
                </li>

                <li className="relative group">
                  <button className="block w-full text-left px-4 py-3 md:p-0 hover:bg-blue-700 md:hover:bg-transparent md:hover:text-blue-200 border-b border-blue-700 md:border-none">
                    Guideline Menu
                  </button>
                  <ul className="md:absolute md:right-0 md:mt-2 w-full md:w-48 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded shadow-lg md:hidden group-hover:block z-10">
                    <li>
                      <Link to="/guidelines" className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900">
                        Guidelines
                      </Link>
                    </li>
                    <li>
                      <Link to="/documents/search" className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900">
                        Document Search
                      </Link>
                    </li>
                  </ul>
                </li>
                
                {isAdmin && (
                  <li className="relative group">
                    <button className="block w-full text-left px-4 py-3 md:p-0 hover:bg-blue-700 md:hover:bg-transparent md:hover:text-blue-200 border-b border-blue-700 md:border-none">
                      Admin Menu
                    </button>
                    <ul className="md:absolute md:right-0 md:mt-2 w-full md:w-48 bg-white dark:bg-gray-900 dark:bg-gray-800 text-gray-800 dark:text-gray-200 dark:text-gray-200 rounded shadow-lg md:hidden group-hover:block z-10">
                      <li>
                        <Link 
                          to="/admin" 
                          className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900"
                        >
                          Dashboard
                        </Link>
                      </li>
                      <li>
                        <Link 
                          to="/admin/users" 
                          className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900"
                        >
                          User Management
                        </Link>
                      </li>
                      <li>
                        <Link 
                          to="/admin/documents" 
                          className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900"
                        >
                          Document Management
                        </Link>
                      </li>
                      <li>
                        <Link 
                          to="/admin/classifications" 
                          className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900"
                        >
                          Classifications
                        </Link>
                      </li>
                    </ul>
                  </li>
                )}
                
                <li className="hidden md:flex md:items-center">
                  <button
                    onClick={toggleDarkMode}
                    className="flex items-center hover:text-blue-200 mr-4"
                    aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {darkMode ? <FaSun /> : <FaMoon />}
                  </button>
                </li>
                
                <li className="relative group">
                  <button className="flex items-center px-4 py-3 md:p-0 hover:bg-blue-700 md:hover:bg-transparent md:hover:text-blue-200 border-b border-blue-700 md:border-none">
                    <span className="mr-2">{user?.username}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <ul className="md:absolute md:right-0 md:mt-2 w-full md:w-48 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded shadow-lg md:hidden group-hover:block z-10">
                    <li>
                      <Link to="/change-password" className="block px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900">
                        Change Password
                      </Link>
                    </li>
                    <li>
                      <button 
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/login" className="block px-4 py-3 md:p-0 hover:bg-blue-700 md:hover:bg-transparent md:hover:text-blue-200 border-b border-blue-700 md:border-none">
                    Login
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="block px-4 py-3 md:p-0 hover:bg-blue-700 md:hover:bg-transparent md:hover:text-blue-200 border-b border-blue-700 md:border-none">
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
