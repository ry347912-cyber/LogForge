#!/bin/bash
# LogForge Quick Start Script
# Usage: chmod +x scripts/start.sh && ./scripts/start.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════╗"
echo "║   LogForge — AI Log Aggregator       ║"
echo "║   Starting development environment   ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}Python 3.10+ required${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js 18+ required${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm required${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Backend Setup ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Setting up Python backend...${NC}"
cd "$ROOT_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Created Python virtual environment"
fi

source venv/bin/activate
pip install -q -r requirements.txt
echo -e "${GREEN}  ✓ Backend dependencies installed${NC}"

# Seed demo data
echo -e "${YELLOW}[2/4] Seeding demo data...${NC}"
cd "$ROOT_DIR"
python3 scripts/seed_demo_data.py 2>/dev/null || echo "  (Skipped - already seeded)"
echo -e "${GREEN}  ✓ Demo data ready${NC}"

# ── Frontend Setup ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Setting up React frontend...${NC}"
cd "$ROOT_DIR/frontend"
npm install --silent
echo -e "${GREEN}  ✓ Frontend dependencies installed${NC}"

# ── Start Services ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Starting services...${NC}"

# Start backend
cd "$ROOT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo -e "${GREEN}  ✓ Backend started (PID: $BACKEND_PID)${NC}"

# Start frontend
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}  ✓ Frontend started (PID: $FRONTEND_PID)${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   LogForge is running!                       ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Dashboard:  http://localhost:3000          ║${NC}"
echo -e "${GREEN}║   API Docs:   http://localhost:8000/api/docs ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║   Login: admin / admin123                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and cleanup
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Stopped. Goodbye!${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM
wait
