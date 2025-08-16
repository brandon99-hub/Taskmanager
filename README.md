# TaskFlow - Project Management Dashboard

A comprehensive task allocation and project progress dashboard built for managing teams, projects, and tasks with real-time tracking capabilities.

## Features

- **Project Management**: Create and manage projects with teams, budgets, and timelines
- **Task Management**: Kanban-style task board with priorities and status tracking
- **Team Management**: Organize users into teams with role-based permissions
- **Dashboard Analytics**: Real-time metrics and team workload visualization
- **Notifications**: Task assignment and deadline alerts
- **User Authentication**: Secure login/register system with password hashing

## Tech Stack

- **Backend**: Express.js, TypeScript, PostgreSQL, Drizzle ORM
- **Frontend**: React, TypeScript, Tailwind CSS, Radix UI
- **Authentication**: Passport.js with local strategy
- **Database**: Supabase PostgreSQL

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase PostgreSQL database

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="your-postgresql-connection-string"

# Application Configuration
NODE_ENV="development"
PORT="5000"

# Session Configuration
SESSION_SECRET="your-super-secure-session-secret-change-this-in-production"

# Local Auth Configuration
JWT_SECRET="your-jwt-secret-key-change-this-in-production"
BCRYPT_ROUNDS="12"

# Security Configuration
RATE_LIMIT_WINDOW_MS="900000"  # 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"  # Max requests per window
AUTH_RATE_LIMIT_MAX="5"        # Max auth attempts per window
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Push the database schema to your Supabase database:

```bash
npm run db:push
```

### 4. Create Admin User

Create an initial admin user to access the system:

```bash
npm run setup:admin
```

This will create an admin user with:
- Email: `admin@taskflow.com`
- Password: `Admin123!`

**Important**: Change this password after first login!

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Usage

### Initial Setup

1. Navigate to `http://localhost:5000`
2. Login with the admin credentials created above
3. Create teams and add team members
4. Start creating projects and assigning tasks

### User Roles

- **Admin**: Full system access, can manage all users, teams, and projects
- **Manager**: Can create projects, assign tasks, and manage their teams
- **Employee**: Can view assigned tasks and update task status

### Key Features

#### Dashboard
- View active projects, completed tasks, and overdue items
- Team workload visualization
- Upcoming deadlines
- Interactive Kanban board

#### Project Management
- Create projects with detailed information
- Assign teams and managers
- Track progress automatically based on task completion
- Set budgets and deadlines

#### Task Management
- Kanban-style task board (To Do, In Progress, Review, Done)
- Priority levels (Low, Medium, High, Critical)
- Task assignment and due dates
- Task dependencies support

#### Team Management
- Create teams and assign members
- Role-based access control
- Team workload analytics

## Production Deployment

### 1. Build the Application

```bash
npm run build
```

### 2. Set Environment Variables

Update your `.env` file for production:

```env
NODE_ENV="production"
SESSION_SECRET="your-production-session-secret"
JWT_SECRET="your-production-jwt-secret"
```

### 3. Start Production Server

```bash
npm start
```

## Database Schema

The application uses the following main entities:

- **Users**: Authentication and user profiles
- **Teams**: Team organization and membership
- **Projects**: Project information with manager and team assignment
- **Tasks**: Individual work items with status and priority
- **Notifications**: In-app notification system
- **Sessions**: User session management

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task details
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Teams
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create new team
- `GET /api/teams/:id` - Get team details
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

### Dashboard
- `GET /api/dashboard/metrics` - Get dashboard metrics
- `GET /api/dashboard/workload` - Get team workload data
- `GET /api/dashboard/upcoming-tasks` - Get upcoming tasks
- `GET /api/dashboard/overdue-tasks` - Get overdue tasks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure code quality
5. Submit a pull request

## License

MIT License
