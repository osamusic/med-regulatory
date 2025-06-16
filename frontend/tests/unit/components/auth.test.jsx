import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../utils/testUtils'
import Login from '../../../src/components/auth/Login'
import Register from '../../../src/components/auth/Register'

// Mock axios client
vi.mock('../../../src/api/axiosClient', () => ({
  default: {
    post: vi.fn(),
  }
}))

// Mock fetch for Firebase config checks
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: false, // Simulate Firebase not available
    json: () => Promise.resolve({}),
  })
)

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
  }
})

describe('Auth Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Login Component', () => {
    it('renders login form elements', async () => {
      renderWithProviders(<Login />, {
        authValue: { user: null, login: vi.fn(), logout: vi.fn() }
      })

      // Wait for component to load
      await screen.findByRole('heading', { name: /login/i })

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    })

    it('validates required fields', async () => {
      const user = userEvent.setup()
      
      renderWithProviders(<Login />, {
        authValue: { user: null, login: vi.fn(), logout: vi.fn() }
      })

      // Wait for component to load
      await screen.findByRole('button', { name: /login/i })
      
      await user.click(screen.getByRole('button', { name: /login/i }))

      expect(screen.getByLabelText(/username/i)).toBeInvalid()
      expect(screen.getByLabelText(/password/i)).toBeInvalid()
    })
  })

  describe('Register Component', () => {
    it('renders registration form elements when Firebase is not available', async () => {
      // Mock fetch to simulate Firebase not available (503 response)
      global.fetch = vi.fn().mockResolvedValue({
        status: 503,
        ok: false
      })

      renderWithProviders(<Register />, {
        authValue: { user: null, register: vi.fn(), logout: vi.fn() }
      })

      // Wait for the component to finish loading and checking Firebase availability
      await screen.findByText(/create account/i)
      
      // When Firebase is not available, should show JWT form directly
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
    })

    it('validates required fields', async () => {
      const user = userEvent.setup()
      
      // Mock fetch to simulate Firebase not available (503 response)
      global.fetch = vi.fn().mockResolvedValue({
        status: 503,
        ok: false
      })
      
      renderWithProviders(<Register />, {
        authValue: { user: null, register: vi.fn(), logout: vi.fn() }
      })

      // Wait for form to load
      await screen.findByLabelText(/username/i)
      
      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: /register/i }))

      expect(screen.getByLabelText(/username/i)).toBeInvalid()
      expect(screen.getByLabelText(/^password$/i)).toBeInvalid()
    })
  })
})