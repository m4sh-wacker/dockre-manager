#!/bin/bash
set -e

echo "🔧 Docker Manager - Setup"
echo "========================="
echo ""

# 1. MySQL
echo "1. Checking MySQL..."
if command -v mysql &> /dev/null && mysql -u root -e "SELECT 1" &> /dev/null; then
    echo "✅ MySQL is running and accessible"
else
    echo "⚠️  MySQL not accessible. Starting one via Docker..."
    docker run -d --name mysql \
        -e MYSQL_ROOT_PASSWORD=admin123 \
        -e MYSQL_DATABASE=docker_manager \
        -p 3306:3306 \
        mysql:8.0
    echo "   Waiting 10s for MySQL to initialize..."
    sleep 10
fi

# 2. Env file
echo ""
echo "2. Checking .env file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ .env created from .env.example"
else
    echo "✅ .env already exists"
fi

# 3. Frontend dependencies
echo ""
echo "3. Installing frontend dependencies..."
npm install
echo "✅ Dependencies installed"

# 4. Go backend
echo ""
echo "4. Building Go backend..."
cd mini-services/docker-manager
go mod tidy
go build -o docker-manager
cd ../..
echo "✅ Go backend built"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Run the app:"
echo "  1. Backend:  cd mini-services/docker-manager && ./docker-manager"
echo "  2. Frontend: npm run dev"
echo ""
echo "Default login → username: admin   password: admin123"
