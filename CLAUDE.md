# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Install dependencies**: `cd src && npm install`
- **Start application**: `cd src && npm start` (runs on port 8080)
- **No test command**: Tests are not configured (`npm test` will fail)

## Application Architecture

This is a Node.js news portal application built with Express.js, PostgreSQL, and EJS templates.

### Core Structure
- **Entry point**: `src/server.js` - Main Express server configuration
- **Database models**: `src/models/post.js` - Sequelize model for news posts
- **Health checks**: `src/system-life.js` - Health/readiness endpoints and chaos engineering features
- **Metrics**: `src/middleware.js` - Prometheus metrics collection
- **Views**: `src/views/` - EJS templates for frontend
- **Static files**: `src/static/` - CSS and static assets

### Key Components

**Database Model (Post)**:
- Fields: title (≤30 chars), summary (≤50 chars), content (≤2000 chars), publishDate
- Uses Sequelize ORM with PostgreSQL
- Database auto-syncs with `alter: true`

**Health & Monitoring**:
- `/health` - Returns application status and hostname
- `/ready` - Readiness probe (can be temporarily disabled)
- `/metrics` - Prometheus metrics via express-prom-bundle
- `/unhealth` (PUT) - Forces health check failures
- `/unreadyfor/:seconds` (PUT) - Temporarily marks as not ready

**Main Routes**:
- `GET /` - Lists all news posts
- `GET /post` - New post form
- `POST /post` - Create single post (with validation)
- `GET /post/:id` - View specific post
- `POST /api/post` - Bulk create posts (expects `artigos` array)

### Environment Configuration
Required environment variables for database connection:
- `DB_DATABASE` (default: kubedevnews)
- `DB_USERNAME` (default: kubedevnews) 
- `DB_PASSWORD` (default: Pg#123)
- `DB_HOST` (default: localhost)
- `DB_PORT` (default: 5432)
- `DB_SSL_REQUIRE` (default: false)

### Monitoring Features
- Prometheus metrics collection for HTTP requests
- Custom counter middleware tracking method/path combinations
- Health check middleware that can simulate failures for testing
- Designed for Kubernetes deployment with proper liveness/readiness probes

The application is containerization-ready and includes chaos engineering features for testing resilience in cloud environments.