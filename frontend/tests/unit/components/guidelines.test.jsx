import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, testUser } from '../../utils/testUtils'
import GuidelinesList from '../../../src/components/guidelines/GuidelinesList'
import GuidelineDetail from '../../../src/components/guidelines/GuidelineDetail'

// Mock axios client
vi.mock('../../../src/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  }
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
  }
})

import axiosClient from '../../../src/api/axiosClient'

describe('Guidelines Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GuidelinesList Component', () => {
    it('displays loading spinner initially', () => {
      axiosClient.get.mockImplementation(() => new Promise(() => {})) // Never resolves
      
      renderWithProviders(<GuidelinesList />, {
        authValue: { user: testUser, login: vi.fn(), logout: vi.fn() }
      })

      // Look for the loading spinner div instead of text
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('handles API error gracefully', async () => {
      axiosClient.get.mockRejectedValue(new Error('API Error'))

      renderWithProviders(<GuidelinesList />, {
        authValue: { user: testUser, login: vi.fn(), logout: vi.fn() }
      })

      await waitFor(() => {
        expect(screen.getByText(/failed to load filter options/i)).toBeInTheDocument()
      })
    })

    it('displays empty state when no guidelines found', async () => {
      // Mock the required API calls that the component makes
      axiosClient.get.mockImplementation((url) => {
        if (url.includes('/count')) {
          return Promise.resolve({ data: { total: 0 } })
        }
        return Promise.resolve({ data: [] })
      })

      renderWithProviders(<GuidelinesList />, {
        authValue: { user: testUser, login: vi.fn(), logout: vi.fn() }
      })

      await waitFor(() => {
        expect(screen.getByText(/no guidelines found/i)).toBeInTheDocument()
      })
    })
  })

  describe('GuidelineDetail Component', () => {
    it('renders loading state initially', () => {
      axiosClient.get.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithProviders(<GuidelineDetail />, {
        authValue: { user: testUser, login: vi.fn(), logout: vi.fn() }
      })

      // Should show loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })
})