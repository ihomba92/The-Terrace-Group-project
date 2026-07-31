The-Terrace-Group-project

A full-stack web application combining workout tracking, sports articles, and match predictions with real-time updates.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [Frontend Structure](#frontend-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The **Workout & Sports Prediction Platform** is a modern web application that allows users to:

-  **Read and write articles** about workouts, fitness, and sports
- **Make predictions** on sports matches
-  **Track workout progress** and share insights
-  **Engage with the community** through comments and reactions
-  **Admin dashboard** for content and user management

---

##  Features

### Core Features
- ✅ **User Authentication** - JWT-based login/register with refresh tokens
- ✅ **Role-Based Access Control** - Admin, Moderator, User roles
- ✅ **Article Management** - Create, read, update, delete articles
- ✅ **Categories** - Organize articles by categories
- ✅ **Comments System** - Nested comments with reactions
- ✅ **Reactions** - Like/dislike articles and comments
- ✅ **Bookmarks** - Save articles for later (localStorage)
- ✅ **User Profiles** - Customizable user profiles
- ✅ **Social Features** - Follow/unfollow users
- ✅ **Match Predictions** - Predict sports match outcomes
- ✅ **Admin Dashboard** - User and content management

### Sports Features
-  **League Management** - Create and manage sports leagues
-  **Team Management** - Add teams to leagues
-  **Match Management** - Schedule and track matches
-  **Match Predictions** - Users can predict match outcomes
-  **Prediction History** - Track prediction accuracy

### UI/UX Features
-  **Custom Design Tokens** - Floodlight, night-pitch, terracing theme
-  **Responsive Design** - Mobile-first approach
-  **Dark Mode Ready** - Built-in dark theme support
-  **Real-time Updates** - Live scores and match status
-  **Infinite Scroll** - Seamless article feed
-  **Optimistic Updates** - Instant UI feedback

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI Framework |
| Vite | 8 | Build Tool |
| React Router | 7 | Routing |
| Tailwind CSS | v4 | Styling |
| Axios | Latest | HTTP Client |
| oxlint | Latest | Linting |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Flask | 3 | Web Framework |
| Flask-RESTful | Latest | API Resources |
| Flask-SQLAlchemy | Latest | ORM |
| Flask-JWT-Extended | Latest | Authentication |
| Flask-Bcrypt | Latest | Password Hashing |
| Flask-Cors | Latest | CORS Handling |
| Flask-Migrate | Latest | Database Migrations |
| Marshmallow | Latest | Serialization/Validation |
| structlog | Latest | Structured Logging |

### Database
- **SQLite** (development) via SQLAlchemy
- **PostgreSQL** (production ready)
- **Alembic** for migrations

---

## Architecture
