# Student Performance Tracker - Backend & Schema

## Database Schema (PostgreSQL)

```sql
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    class VARCHAR(50) NOT NULL,
    section VARCHAR(10) NOT NULL,
    parent_mobile VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    marks DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject, week_number)
);
```

## API Endpoints

1. `GET /api/students` - Retrieve all students
2. `POST /api/students` - Add a new student
   - Body: `{ name, roll_number, class, section, parent_mobile }`
3. `GET /api/marks?week_number=1` - Retrieve marks for a specific week
4. `POST /api/marks` - Save/Update marks
   - Body: `{ marks: [ { student_id, subject, week_number, marks } ] }`
5. `POST /api/auth/parent/login` - Authenticate parent
   - Body: `{ roll_number, parent_mobile }`
   - Returns JWT Token + Student Details
6. `GET /api/parent/dashboard` - Get dashboard data (requires JWT)
   - Returns student marks, class topper data, rank, and AI insights.

## Node.js + Express Code (Snippet)

```javascript
const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Get all students
app.get('/api/students', async (req, res) => {
  const result = await pool.query('SELECT * FROM students ORDER BY name ASC');
  res.json(result.rows);
});

// Create student
app.post('/api/students', async (req, res) => {
  const { name, roll_number, class_name, section } = req.body;
  const result = await pool.query(
    'INSERT INTO students (name, roll_number, class, section) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, roll_number, class_name, section]
  );
  res.json(result.rows[0]);
});

// Save marks (Upsert)
app.post('/api/marks', async (req, res) => {
  const { marks } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    for (const m of marks) {
      await client.query(
        `INSERT INTO marks (student_id, subject, week_number, marks) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, subject, week_number) 
         DO UPDATE SET marks = EXCLUDED.marks`,
        [m.student_id, m.subject, m.week_number, m.marks]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Marks saved successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```
