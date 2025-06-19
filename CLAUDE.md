# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedShield AI is a medical device cybersecurity expert system that automatically collects, analyzes, and provides AI-assisted recommendations for medical device cybersecurity information. The system consists of a FastAPI backend and React frontend that work together to provide document crawling, indexing, guideline management, and assessment capabilities.

## Architecture

### Backend (FastAPI)
- **Main App**: `backend/src/main.py` - FastAPI application with hybrid authentication, Redis caching, and modular router architecture
- **Authentication**: Hybrid auth system supporting both JWT and Firebase via `X-Auth-Type` header, with protected/public router separation
- **Database**: SQLAlchemy ORM with SQLite storage in `backend/storage/` (Cloud SQL support available with automatic fallback)
- **Caching**: Redis backend with custom key generation and safe fallback patterns for API response caching
- **Router Architecture**: Two-tier routing system:
  - `protected_router`: All endpoints requiring authentication (guidelines POST/PUT/DELETE, admin, indexer, crawler, classifier, news, process, workflow)
  - `public_router`: Public endpoints (auth, health check, debug, guidelines GET, process GET, classifier keywords, indexer stats)

#### Core Modules
- `auth/`: Hybrid authentication (JWT + Firebase) and authorization with role-based access
- `crawler/`: Document collection from FDA, NIST, PMDA sources with automated workflows
- `indexer/`: LlamaIndex-based vector search and document indexing with OpenAI embeddings
- `classifier/`: AI-powered document classification using OpenAI with structured results storage
- `guidelines/`: Guideline management with search, filtering, and classification-to-guideline conversion
- `news_collector/`: News article collection and processing with automated workflows
- `process/`: Document processing workflows with matrix visualization and project management
- `admin/`: Administrative functions with proper access control and user management
- `workflow/`: Workflow management and automation with project-based assessments

### Frontend (React/Vite)
- **Main App**: `frontend/src/App.jsx` with React Router for SPA navigation
- **State Management**: Context-based architecture (`AuthContext`, `ProcessContext`, `ThemeContext`)
- **Components**: Feature-organized modular structure under `components/`
- **API Integration**: Axios client in `api/axiosClient.js` with hybrid auth support and timeout handling
- **Styling**: Tailwind CSS with responsive design and comprehensive dark mode support

#### Key Architectural Patterns
- **Public/Protected Access**: Dashboard, Guidelines, and Process Matrix are public; Document Search and Project Management require authentication
- **Pagination**: All list components use server-side pagination with count endpoints to prevent timeouts
- **Authentication Flow**: JWT tokens stored in localStorage with hybrid auth type management
- **Protected Routes**: Route-level access control with admin-specific routes and public fallbacks
- **Error Handling**: Comprehensive error states and loading indicators across components

### Integration Points
- Backend serves API at port 8000, frontend at port 5173, nginx proxy at port 80/443
- Hybrid authentication flow supports both JWT and Firebase with automatic auth type detection
- Vector search powered by LlamaIndex with OpenAI embeddings for semantic document search
- Document storage in shared volumes between containers with automatic processing workflows
- Redis caching for API responses with custom key builders and safe fallback mechanisms

## Development Commands

### Docker Development (Recommended)
```bash
# Start full stack with hot reload
docker-compose up --build

# Start with Cloud SQL support (requires service-account.json)
docker-compose --profile cloud-sql up --build

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
docker-compose logs -f redis

# Stop services
docker-compose down

# Clean rebuild (removes volumes)
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Backend Development
```bash
cd backend

# Install dependencies (Poetry recommended)
poetry install
# OR
pip install -r requirements.txt

# Run development server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Run with specific environment
OPENAI_API_KEY=your_key uvicorn src.main:app --reload

# Code formatting and linting
poetry run black src/
poetry run isort src/
poetry run flake8 src/

# Testing
poetry run pytest                     # All tests
poetry run pytest tests/unit         # Unit tests only
poetry run pytest tests/integration  # Integration tests only
poetry run pytest --cov=src          # With coverage
poetry run pytest -m unit            # Unit tests by marker
poetry run pytest -m integration     # Integration tests by marker

# Admin scripts
python src/scripts/create_admin_user.py
python src/scripts/update_admin_password.py
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Linting (using ESLint flat config)
npx eslint src/

# Testing (using Vitest)
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end tests
npm run test:coverage      # Generate coverage report
npm run test:watch         # Watch mode
npm run test:ui            # Interactive test UI
npm run test:run           # Run once without watch

# Run specific test file
npm test -- auth.test.jsx
```

## Critical Development Patterns

### API Pagination Implementation
**Always use pagination for list endpoints to prevent timeouts:**

Backend pattern:
```python
@router.get("/items")
async def get_items(skip: int = 0, limit: int = 50):
    return db.query(Model).offset(skip).limit(limit).all()

@router.get("/items/count")
async def get_items_count():
    return {"total": db.query(Model).count()}
```

Frontend pattern:
```javascript
const fetchData = async () => {
  // 1. Get count first
  const countRes = await axiosClient.get('/api/items/count');
  setTotal(countRes.data.total);
  
  // 2. Then get paginated data
  const dataRes = await axiosClient.get('/api/items', {
    params: { skip: currentPage * pageSize, limit: pageSize }
  });
  setItems(dataRes.data);
};
```

### Router Order Dependencies (FastAPI)
**Critical: Specific routes must come before parameterized routes:**
```python
@router.get("/items/count")      # MUST come first
@router.get("/items/{item_id}")  # Parameterized route comes after
```

### Public vs Protected Endpoint Pattern
**Split routers for public GET and protected non-GET endpoints:**
```python
# Public router for GET endpoints
public_router = APIRouter(prefix="/module", tags=["module"])

# Protected router for non-GET endpoints  
protected_router = APIRouter(
    prefix="/module", 
    tags=["module"],
    dependencies=[Depends(get_current_active_user)]
)

# Export public router as default for backward compatibility
router = public_router
```

### Authentication Patterns
**Frontend components must wait for auth before API calls:**
```javascript
const { user, loading: authLoading } = useAuth();

useEffect(() => {
  if (!authLoading) {
    fetchData(); // Call API when auth is resolved (with or without user)
  }
}, [authLoading]);

// For protected features, check user existence
if (!authLoading && !user) {
  return <LoginRequiredMessage />;
}
```

### Hybrid Authentication Support
**Backend supports both JWT and Firebase authentication:**
```python
# Request headers determine auth type
auth_type = request.headers.get("X-Auth-Type", "jwt").lower()
if auth_type == "firebase":
    # Firebase authentication flow
else:
    # JWT authentication flow (default)
```

### Environment Configuration
Backend uses environment variables with fallbacks:
```python
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Required
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # With default
```

Frontend uses Vite environment variables:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

## Key Environment Variables

### Backend (Required)
- `OPENAI_API_KEY`: Required for AI features and embeddings
- `ADMIN_REGISTRATION_SECRET`: Admin user registration (default: admin123)
- `USER_REGISTRATION_SECRET`: User registration (default: user123)

### Backend (Optional)
- `OPENAI_MODEL`: OpenAI model to use (default: gpt-4o-mini)
- `ALLOWED_ORIGINS`: CORS origins (default: http://localhost:5173)
- `ALLOWED_HOSTS`: Host whitelist (default: localhost)
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration for caching
- `FIREBASE_API_KEY`: Firebase Web API key for authentication
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase Admin SDK service account JSON
- `DATABASE_URL`: Database connection string (default: SQLite)
- `CLOUD_SQL_CONNECTION_NAME`: For Google Cloud SQL connection

### Frontend
- `VITE_API_URL`: Backend API URL (default: http://localhost:8000)
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth client ID for authentication
- `VITE_ALLOWED_HOSTS`: Allowed hosts for development server

## Database Management
- Database tables are auto-created on startup via SQLAlchemy
- Default storage: SQLite in `backend/storage/`
- Cloud SQL support: SQL Server via Cloud SQL Auth Proxy with automatic fallback
- Admin user creation scripts in `backend/src/scripts/`
- Automatic fallback from Cloud SQL to SQLite if connection fails

## Testing Architecture

### Backend Testing (pytest)
```bash
# Test organization with markers
poetry run pytest -m unit            # Unit tests only
poetry run pytest -m integration     # Integration tests only
poetry run pytest --cov=src          # With coverage

# Test structure
backend/tests/
├── conftest.py          # Shared fixtures
├── unit/                # Unit tests by module
└── integration/         # Integration tests by module
```

### Frontend Testing (Vitest)
```bash
# Comprehensive test types
npm run test:unit          # Component and utility unit tests
npm run test:integration   # Cross-component integration tests
npm run test:e2e          # End-to-end user workflow tests
npm run test:ui           # Interactive test UI
npm run test:coverage     # Coverage reports

# Test structure
frontend/tests/
├── setup.js             # Global test setup
├── utils/testUtils.jsx  # Custom render utilities
├── unit/                # Unit tests
├── integration/         # Integration tests
└── e2e/                 # End-to-end tests
```

## Adding New Features

### New API Endpoints
1. Create router in appropriate module (e.g., `backend/src/newmodule/router.py`)
2. Implement split router pattern: public for GET, protected for non-GET
3. Add router to both `protected_router` and `public_router` in `main.py`
4. **Important**: Add count endpoint if it returns lists: `/items/count`
5. **Important**: Ensure specific routes come before parameterized routes
6. Add admin dependency `get_admin_user` for admin-only endpoints
7. Update frontend API client if needed

### New React Components
1. Create component in appropriate `frontend/src/components/` subdirectory
2. Implement authentication waiting pattern for API calls
3. Use pagination pattern for any list displays with count endpoints
4. Add proper error handling and loading states
5. Follow existing patterns for props, state management, and styling
6. Consider public vs protected access patterns

### Database Schema Changes
1. Modify models in `backend/src/db/models.py`
2. Restart backend to auto-create tables (SQLAlchemy handles this)
3. For production, consider migration scripts

### SSL/TLS and Production Deployment
- Use `./scripts/init-letsencrypt.sh your-email@example.com` for SSL setup
- Nginx configuration supports automatic certificate renewal
- Security headers and rate limiting configured in nginx
- Environment-based docs URL disabling in production

### Performance Considerations
- All list endpoints must use pagination (skip/limit) to prevent timeouts
- Redis caching enabled for frequently accessed endpoints with safe fallbacks
- Frontend uses Vite code splitting for optimized bundle sizes
- Database health checker monitors connection status with idle detection