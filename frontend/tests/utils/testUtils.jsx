import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/contexts/AuthContext'
import { ThemeProvider } from '../../src/contexts/ThemeContext'
import { ProcessProvider } from '../../src/contexts/ProcessContext'
import { vi } from 'vitest'

// Custom render function that includes providers
export function renderWithProviders(ui, options = {}) {
  const {
    authValue = { user: null, login: vi.fn(), logout: vi.fn() },
    themeValue = { theme: 'light', toggleTheme: vi.fn() },
    processValue = { isProcessing: false, startProcess: vi.fn(), stopProcess: vi.fn() },
    ...renderOptions
  } = options

  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <AuthProvider value={authValue}>
          <ThemeProvider value={themeValue}>
            <ProcessProvider value={processValue}>
              {children}
            </ProcessProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    authValue,
    themeValue,
    processValue
  }
}

// Mock API responses
export const mockApiResponses = {
  login: {
    access_token: 'mock-token',
    token_type: 'bearer',
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      is_admin: false
    }
  },
  guidelines: [
    {
      id: 1,
      guideline_id: 'nist-1',
      control_text: 'This guideline covers cybersecurity best practices',
      standard: 'NIST',
      category: 'security',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      guideline_id: 'fda-1',
      control_text: 'This covers medical device requirements',
      standard: 'FDA',
      category: 'medical',
      created_at: '2024-01-02T00:00:00Z'
    }
  ],
  documents: [
    {
      id: 1,
      title: 'Test Document 1',
      content: 'Document content 1',
      source_type: 'PDF',
      created_at: '2024-01-01T00:00:00Z'
    }
  ],
  news: [
    {
      id: 1,
      title: 'Security Alert',
      summary: 'Important security update',
      url: 'https://example.com/news/1',
      saved_at: '2024-01-01T00:00:00Z'
    }
  ]
}

// Common test data
export const testUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  is_admin: false
}

export const testAdmin = {
  id: 2,
  username: 'admin',
  email: 'admin@example.com',
  is_admin: true
}

// Mock functions for API calls
export const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

// Test helpers
export const waitForLoadingToFinish = () => new Promise(resolve => setTimeout(resolve, 0))

export const createMockIntersectionObserver = () => {
  const mockIntersectionObserver = vi.fn()
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null
  })
  window.IntersectionObserver = mockIntersectionObserver
  window.IntersectionObserverEntry = vi.fn()
}

// Setup function for common test scenarios
export const setupAuthenticatedUser = (user = testUser) => ({
  authValue: {
    user,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true
  }
})

export const setupUnauthenticatedUser = () => ({
  authValue: {
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false
  }
})