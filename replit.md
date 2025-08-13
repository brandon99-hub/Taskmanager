# AppKings Task Allocation & Project Progress Dashboard

## Overview

This is a full-stack project management application built to replace manual project tracking with an automated platform. The system enables real-time project monitoring, task assignment, deadline management, and performance analytics. The application features a modern React frontend with a Node.js/Express backend, utilizing PostgreSQL for data persistence and implementing comprehensive authentication through Replit's OIDC system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development practices
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: Radix UI primitives with shadcn/ui components for accessible, customizable interfaces
- **Styling**: Tailwind CSS with CSS custom properties for theming and responsive design
- **Form Management**: React Hook Form with Zod validation for robust form handling
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API endpoints
- **Language**: TypeScript for type safety across the entire stack
- **Database ORM**: Drizzle ORM with Neon serverless PostgreSQL for type-safe database operations
- **Authentication**: Passport.js with OpenID Connect strategy for Replit integration
- **Session Management**: Express sessions with PostgreSQL store for secure user sessions
- **API Design**: RESTful endpoints following conventional HTTP methods and status codes

### Database Schema Design
- **Users Table**: Stores user profiles with Replit auth integration (id, email, names, role, profile images)
- **Projects Table**: Core project entities with metadata (name, description, dates, budget, status, client info)
- **Tasks Table**: Granular task management with priorities, status tracking, and time estimates
- **Teams Table**: Team organization with descriptions and member management
- **Relationships**: Foreign keys linking users to teams, projects to managers, tasks to projects and assignees
- **Enums**: Predefined status and priority values for data consistency
- **Sessions Table**: Required for Replit authentication session persistence

### Authentication & Authorization
- **Provider**: Replit OIDC (OpenID Connect) for seamless platform integration
- **Session Strategy**: Server-side sessions stored in PostgreSQL with configurable TTL
- **Security**: HTTP-only cookies, CSRF protection, secure session configuration
- **User Management**: Automatic user creation/updates on first login with profile synchronization

### UI/UX Architecture
- **Design System**: Consistent component library with dark/light theme support
- **Accessibility**: ARIA-compliant components from Radix UI primitives
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **User Experience**: Dashboard-centric design with quick actions, metrics cards, and visual data representations
- **Component Organization**: Atomic design principles with reusable UI components

### Data Flow & State Management
- **Server State**: TanStack Query for API data fetching, caching, and synchronization
- **Client State**: React hooks for local component state
- **Real-time Updates**: Optimistic updates with automatic cache invalidation
- **Error Handling**: Centralized error boundaries with user-friendly error messages
- **Loading States**: Skeleton components and loading indicators for better user experience

## External Dependencies

### Database & Storage
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe database operations with migration support
- **Database URL**: Environment-based connection string configuration

### Authentication Services
- **Replit OIDC**: Primary authentication provider using OpenID Connect protocol
- **Session Storage**: PostgreSQL-backed session store with automatic cleanup

### UI & Styling Libraries
- **Radix UI**: Headless UI primitives for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Lucide React**: Consistent icon library for UI elements
- **React Hook Form**: Form state management with validation integration

### Build & Development Tools
- **Vite**: Modern build tool with HMR and optimized bundling
- **TypeScript**: Static type checking across frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

### Runtime Dependencies
- **Express.js**: Web application framework for Node.js
- **Passport.js**: Authentication middleware with OIDC strategy
- **Class Variance Authority**: Utility for managing component variants
- **Date-fns**: Date manipulation and formatting utilities

### Development Environment
- **Replit Integration**: Platform-specific plugins and development tools
- **Environment Variables**: Secure configuration management for sensitive data
- **Hot Module Replacement**: Development-time code updates without full page reloads