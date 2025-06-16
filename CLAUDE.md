# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a medical device cybersecurity expert system (MedShield AI) that automatically collects, analyzes, and provides AI-assisted recommendations for medical device cybersecurity information. The system consists of a FastAPI backend and React frontend that work together to provide document crawling, indexing, guideline management, and assessment capabilities.

## Architecture

### Backend (FastAPI)
- **Main App**: `backend/src/main.py` - FastAPI application with JWT authentication, Redis caching, and modular router architecture
- **Authentication**: JWT-based auth with Firebase integration, protected/public router separation
- **Database**: SQLAlchemy ORM with SQLite storage in `backend/storage/`
- **Caching**: Redis backend with custom key generation for API response caching
- **Core Modules**:
  - `auth/`: User authentication and authorization with Firebase
  - `crawler/`: Document collection from FDA, NIST, PMDA sources
  - `indexer/`: LlamaIndex-based vector search and document indexing
  - `classifier/`: AI-powered document classification
  - `guidelines/`: Guideline management and search
  - `news_collector/`: News article collection and processing
  - `process/`: Document processing workflows
  - `admin/`: Administrative functions
  - `workflow/`: Workflow management and automation

### Frontend (React/Vite)
- **Main App**: `frontend/src/App.jsx` with React Router for navigation
- **Architecture**: Context-based state management (`AuthContext`, `ProcessContext`, `ThemeContext`)
- **Components**: Modular component structure under `components/` organized by feature
- **API Integration**: Axios client in `api/axiosClient.js` for backend communication
- **Styling**: Tailwind CSS with responsive design

### Integration Points
- Backend serves API at port 8000, frontend at port 5173
- Authentication flow uses JWT tokens stored in localStorage
- Vector search powered by LlamaIndex with OpenAI embeddings
- Document storage in shared volumes between containers

## Development Commands

### Docker Development (Recommended)
```bash
# Start full stack with hot reload
docker-compose up --build

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
docker-compose logs -f redis

# Stop services
docker-compose down

# Clean rebuild
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

# Testing
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end tests
npm run test:coverage      # Generate coverage report
npm run test:watch         # Watch mode
npm run test:ui            # Interactive test UI
npm run test:run           # Run once without watch
```

## Key Environment Variables

### Backend
- `OPENAI_API_KEY`: Required for AI features and embeddings
- `ADMIN_REGISTRATION_SECRET`: Admin user registration (default: admin123)
- `USER_REGISTRATION_SECRET`: User registration (default: user123)
- `ALLOWED_ORIGINS`: CORS origins (default: http://localhost:5173)
- `ALLOWED_HOSTS`: Host whitelist (default: localhost)
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration for caching
- `FIREBASE_API_KEY`: Firebase Web API key for authentication
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase Admin SDK service account JSON
- `DATABASE_URL`: Database connection string (default: SQLite)

### Frontend
- `VITE_API_URL`: Backend API URL (default: http://localhost:8000)
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth client ID for authentication

## Database Management
- Database tables are auto-created on startup via SQLAlchemy
- Storage location: `backend/storage/` (SQLite files)
- Admin user creation scripts in `backend/src/scripts/`

## Common Development Tasks

### Adding New API Endpoints
1. Create router in appropriate module (e.g., `backend/src/newmodule/router.py`)
2. Add router to either protected or public router in `main.py`
3. Update frontend API client if needed

### Adding New React Components
1. Create component in appropriate `frontend/src/components/` subdirectory
2. Follow existing patterns for props, state management, and styling
3. Import and use in parent components or routing

### Database Schema Changes
1. Modify models in `backend/src/db/models.py`
2. Restart backend to auto-create tables (SQLAlchemy handles this)

### Adding New Document Sources
1. Extend crawler module in `backend/src/crawler/`
2. Update indexer to handle new document types
3. Add corresponding frontend UI if needed

### Google OAuth Setup
1. **Firebase Console**:
   - Enable Google Sign-In in Authentication > Sign-in method
   - Configure OAuth consent screen in Google Cloud Console
   - Create OAuth 2.0 client ID for web application
   - Add authorized origins: `http://localhost:5173`, `https://yourdomain.com`

2. **Environment Variables**:
   - Backend: Set `FIREBASE_API_KEY` from Firebase project settings
   - Frontend: Set `VITE_GOOGLE_CLIENT_ID` from Google Cloud Console

3. **Testing**: Use `/firebase/google-auth` endpoint with Google credential token