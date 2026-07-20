#!/bin/sh
# Arranca la copia local de Carnet B en Linux, macOS o Android (Termux).
# Si Python no esta instalado, intenta instalarlo con el gestor del sistema.
cd "$(dirname "$0")" || exit 1

buscar_python() {
    command -v python3 2>/dev/null || command -v python 2>/dev/null
}

PY=$(buscar_python)
if [ -z "$PY" ]; then
    echo "Python no esta instalado. Intentando instalarlo..."
    if command -v pkg >/dev/null 2>&1; then
        pkg install -y python            # Android (Termux)
    elif command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update && sudo apt-get install -y python3
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y python3
    elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -S --noconfirm python
    elif command -v zypper >/dev/null 2>&1; then
        sudo zypper install -y python3
    elif command -v apk >/dev/null 2>&1; then
        sudo apk add python3
    elif command -v brew >/dev/null 2>&1; then
        brew install python              # macOS con Homebrew
    fi
    PY=$(buscar_python)
fi

if [ -z "$PY" ]; then
    echo "No se pudo instalar Python automaticamente."
    echo "Instalalo desde https://www.python.org y vuelve a ejecutar este script."
    exit 1
fi

URL=http://localhost:8724
if command -v termux-open-url >/dev/null 2>&1; then termux-open-url "$URL" &
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" &
elif command -v open >/dev/null 2>&1; then open "$URL" &
fi

exec "$PY" servidor.py
