import subprocess
import os

def build_apk(server_url):
    print(f"🚀 Iniciando compilación para: {server_url}")
    
    # Ruta de la carpeta del proyecto Android
    project_dir = 'agent-src'
    
    try:
        # Ejecutamos gradlew pasando la propiedad SERVER_URL
        # El comando equivale a: ./gradlew assembleDebug -PSERVER_URL="http://..."
        subprocess.check_call([
            './gradlew', 
            'assembleDebug', 
            f'-PSERVER_URL={server_url}'
        ], cwd=project_dir)
        
        apk_path = os.path.join(project_dir, "app/build/outputs/apk/debug/app-debug.apk")
        
        if os.path.exists(apk_path):
            return apk_path
        return None

    except subprocess.CalledProcessError as e:
        print(f"❌ Error en Gradle: {e}")
        return None
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return None
