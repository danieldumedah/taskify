const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(express.json());

// Initialize DB
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ tasks: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Validation middleware
function validateTask(req, res, next) {
  const { title, priority, category } = req.body;
  const errors = [];

  if (!title || title.trim().length === 0) {
    errors.push('Task title is required');
  }
  if (title && title.trim().length > 120) {
    errors.push('Title must be under 120 characters');
  }
  if (priority && !['low', 'medium', 'high'].includes(priority)) {
    errors.push('Priority must be low, medium, or high');
  }
  if (category && category.trim().length > 50) {
    errors.push('Category must be under 50 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
}

// GET all tasks
app.get('/api/tasks', (req, res) => {
  try {
    const db = loadDB();
    const { status, priority, category, search } = req.query;

    let tasks = db.tasks;

    if (status) tasks = tasks.filter(t => t.status === status);
    if (priority) tasks = tasks.filter(t => t.priority === priority);
    if (category) tasks = tasks.filter(t => t.category?.toLowerCase() === category.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    tasks = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: tasks, total: tasks.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET single task
app.get('/api/tasks/:id', (req, res) => {
  const db = loadDB();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  res.json({ success: true, data: task });
});

// POST create task
app.post('/api/tasks', validateTask, (req, res) => {
  const db = loadDB();
  const { title, description, priority = 'medium', category = '', dueDate = null } = req.body;

  const newTask = {
    id: uuidv4(),
    title: title.trim(),
    description: description ? description.trim() : '',
    priority,
    category: category.trim(),
    status: 'pending',
    dueDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tasks.push(newTask);
  saveDB(db);

  res.status(201).json({ success: true, data: newTask, message: 'Task created' });
});

// PUT update task
app.put('/api/tasks/:id', validateTask, (req, res) => {
  const db = loadDB();
  const idx = db.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Task not found' });

  const { title, description, priority, category, status, dueDate } = req.body;

  if (status && !['pending', 'in-progress', 'completed'].includes(status)) {
    return res.status(400).json({ success: false, errors: ['Invalid status value'] });
  }

  db.tasks[idx] = {
    ...db.tasks[idx],
    title: title.trim(),
    description: description ? description.trim() : db.tasks[idx].description,
    priority: priority || db.tasks[idx].priority,
    category: category !== undefined ? category.trim() : db.tasks[idx].category,
    status: status || db.tasks[idx].status,
    dueDate: dueDate !== undefined ? dueDate : db.tasks[idx].dueDate,
    updatedAt: new Date().toISOString()
  };

  saveDB(db);
  res.json({ success: true, data: db.tasks[idx], message: 'Task updated' });
});

// PATCH status only
app.patch('/api/tasks/:id/status', (req, res) => {
  const db = loadDB();
  const idx = db.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Task not found' });

  const { status } = req.body;
  if (!['pending', 'in-progress', 'completed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  db.tasks[idx].status = status;
  db.tasks[idx].updatedAt = new Date().toISOString();
  saveDB(db);

  res.json({ success: true, data: db.tasks[idx], message: 'Status updated' });
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  const db = loadDB();
  const idx = db.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Task not found' });

  db.tasks.splice(idx, 1);
  saveDB(db);

  res.json({ success: true, message: 'Task deleted' });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const db = loadDB();
  const tasks = db.tasks;

  res.json({
    success: true,
    data: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      highPriority: tasks.filter(t => t.priority === 'high').length,
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Taskify API running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints: GET/POST /api/tasks | PUT/DELETE /api/tasks/:id`);
});