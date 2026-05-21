.PHONY: dev docker seed test clean

dev:
	@echo "Starting LogForge development environment..."
	@chmod +x scripts/start.sh && ./scripts/start.sh

docker:
	@echo "Starting with Docker Compose..."
	docker-compose up --build

docker-prod:
	@echo "Starting production stack..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

seed:
	@cd backend && python3 ../scripts/seed_demo_data.py

test:
	@cd backend && venv/bin/python -m pytest tests/ -v

clean:
	@find . -name "__pycache__" -exec rm -rf {} + 2>/dev/null; \
	find . -name "*.pyc" -delete 2>/dev/null; \
	rm -f backend/logforge.db; \
	echo "Cleaned!"

install-backend:
	@cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt

install-frontend:
	@cd frontend && npm install

install: install-backend install-frontend
	@echo "All dependencies installed!"

logs-nginx:
	@cd backend && venv/bin/python -c "
import asyncio
import sys; sys.path.insert(0,'.')
from app.services.log_processor import log_processor_service
import asyncio

async def main():
    await log_processor_service.start()
    with open('../sample_logs/nginx_access.log') as f:
        for line in f:
            await log_processor_service.ingest(line.strip(), 'nginx', 'nginx')
    await asyncio.sleep(2)
    await log_processor_service.stop()
    print('Nginx logs ingested!')

asyncio.run(main())
"
