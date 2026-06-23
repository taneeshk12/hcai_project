#!/bin/bash

# OmniHealth Diagnostics - System Startup Script
# This script starts both the backend Flask API and frontend Vite UI.

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================================="
echo "🩺 OmniHealth Diagnostics: Multi-Agent Triage Dashboard"
echo "=========================================================="
echo ""

# 1. Start Python Backend API
echo "Starting Backend API server..."
cd "$SCRIPT_DIR"

if [ -f "../.venv/bin/python" ]; then
    PYTHON_BIN="../.venv/bin/python"
else
    PYTHON_BIN="python3"
fi

# Run the backend in the background
# OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES is required on macOS to prevent
# joblib/loky from crashing when RandomForest spawns parallel workers via fork.
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES $PYTHON_BIN api_server.py > backend.log 2>&1 &
BACKEND_PID=$!

# Wait briefly and check if the backend started
sleep 2
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend API is running in background (PID: $BACKEND_PID, logging to hcai_project/backend.log)"
else
    echo "❌ Failed to start Backend API. Check hcai_project/backend.log for errors."
    exit 1
fi

# 2. Start React Frontend (production build — no HMR, no blank page issues)
echo ""
echo "Starting React Frontend (production preview)..."
cd "$SCRIPT_DIR/ui"

# Build fresh production bundle
npm run build >> "$SCRIPT_DIR/frontend.log" 2>&1

# Serve the production bundle (stable, no hot-reload)
npx vite preview --port 5173 --host >> "$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!


echo ""
echo "=========================================================="
echo "🚀 System is launching!"
echo "   - Backend API: http://localhost:8000"
echo "   - Frontend UI: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both backend and frontend servers."
echo "=========================================================="
echo ""

# Clean up background processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Done."
    exit 0
}

trap cleanup INT TERM

# Keep script running
while true; do
    sleep 1
done
