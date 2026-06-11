# Student Performance Tracker - Core Module

A full-stack web application module built for teachers to manage students and enter weekly marks.

## Frontend (React + Vite + Tailwind)

### Features
- Dashboard with high-level statistics
- Student Management (Add / Delete)
- Weekly Mark Entry (Excel-like layout)
- Automatic Total Calculation

### Running Locally
1. Run `npm install` to install dependencies.
2. Run `npm run dev` to start the Vite development server.
3. Access the application at `http://localhost:5173`.
4. (To build for production, run `npm run build` followed by `npm run preview`).

*Note:* For demo purposes, this application uses a mock backend with `localStorage` to simulate a database.

## Backend (Node.js + Express) & Database

The full backend code, database schema (PostgreSQL), and REST API endpoints are provided in `backend-spec.md`.

In a production environment, you would:
1. Initialize a PostgreSQL database and apply the schema from `backend-spec.md`.
2. Create a new Node.js project.
3. Install dependencies: `npm i express pg dotenv`.
4. Run the Express server provided in the spec file.
5. Update the React frontend `api.ts` file to use `fetch()` calls to the real endpoints (`/api/students`, `/api/marks`) instead of using `localStorage`.
