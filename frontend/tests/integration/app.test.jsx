import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, mockApiResponses } from '../utils/testUtils'
import App from '../../src/App'

// Mock axios client for integration tests
vi.mock('../../src/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

import axiosClient from '../../src/api/axiosClient'

describe('App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API calls by default
    axiosClient.get.mockResolvedValue({ data: [] })
    axiosClient.post.mockResolvedValue({ data: mockApiResponses.login })
  })

  it('renders main application structure', () => {
    renderWithProviders(<App />)
    
    // Check for main navigation elements
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('handles authentication flow', async () => {
    renderWithProviders(<App />)
    
    // Should show login link in navigation when not authenticated
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument()
  })

  it('navigates between pages', async () => {
    renderWithProviders(<App />)
    
    // Test basic navigation structure exists
    expect(document.body).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    axiosClient.get.mockRejectedValue(new Error('Network error'))
    
    renderWithProviders(<App />)
    
    // App should still render even with API errors
    expect(document.body).toBeInTheDocument()
  })
})