import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { testUser, testAdmin } from '../../utils/testUtils'
import Header from '../../../src/components/common/Header'
import NotFound from '../../../src/components/common/NotFound'

// Mock the auth context
const mockUseAuth = vi.fn()
const mockUseTheme = vi.fn()

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}))

vi.mock('../../../src/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme()
}))

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('Common Components', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      darkMode: false,
      toggleDarkMode: vi.fn()
    })
  })

  describe('Header Component', () => {
    it('shows login link when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn()
      })

      renderWithRouter(<Header />)

      expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument()
    })

    it('shows user info when authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: false,
        user: testUser,
        login: vi.fn(),
        logout: vi.fn()
      })

      renderWithRouter(<Header />)

      expect(screen.getByText('testuser')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })

    it('shows admin menu for admin users', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isAdmin: true,
        user: testAdmin,
        login: vi.fn(),
        logout: vi.fn()
      })

      renderWithRouter(<Header />)

      expect(screen.getByRole('button', { name: /admin menu/i })).toBeInTheDocument()
    })
  })

  describe('NotFound Component', () => {
    it('renders 404 message', () => {
      renderWithRouter(<NotFound />)

      expect(screen.getByText(/404/i)).toBeInTheDocument()
      expect(screen.getByText(/page not found/i)).toBeInTheDocument()
    })

    it('provides link to home page', () => {
      renderWithRouter(<NotFound />)

      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    })
  })
})