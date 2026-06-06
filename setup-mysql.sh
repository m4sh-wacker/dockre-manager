#!/bin/bash

echo "🔧 Docker Manager - MySQL Setup Script"
echo "========================================"
echo ""

# Check if MySQL is running
echo "1. Checking MySQL connection..."
if command -v mysql &> /dev/null; then
    if mysql -u root -e "SELECT 1" &> /dev/null; then
        echo "✅ MySQL is running and accessible"
    else
        echo "⚠️  MySQL is installed but not accessible. Please check your credentials."
        echo "   You can also use Docker: docker run -d --name mysql -e MYSQL_ROOT_PASSWORD=yourpassword -p 3306:3306 mysql:8.0"
    fi
else
    echo "⚠️  MySQL not found. Installing via Docker..."
    docker run -d --name mysql \
        -e MYSQL_ROOT_PASSWORD=admin123 \
        -e MYSQL_DATABASE=docker_manager \
        -p 3306:3306 \
        mysql:8.0
    echo "✅ MySQL container started"
    echo "   Waiting 10 seconds for MySQL to initialize..."
    sleep 10
fi

echo ""
echo "2. Checking .env file..."
if [ -f .env ]; then
    if grep -q "DATABASE_URL=mysql://" .env; then
        echo "✅ .env file has correct MySQL URL format"
    else
        echo "⚠️  Updating .env file with MySQL URL..."
        sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL=mysql://root:@127.0.0.1:3306/docker_manager|' .env
        echo "✅ .env updated"
    fi
else
    echo "⚠️  .env file not found, copying from .env.example..."
    cp .env.example .env
    echo "✅ .env created"
fi

echo ""
echo "3. Installing Node.js dependencies..."
if command -v npm &> /dev/null; then
    npm install
    echo "✅ Dependencies installed"
else
    echo "⚠️  npm not found. Please install Node.js first."
    exit 1
fi

echo ""
echo "4. Generating Prisma client..."
npm run db:generate
echo "✅ Prisma client generated"

echo ""
echo "5. Building Go backend..."
cd mini-services/docker-manager
if command -v go &> /dev/null; then
    go mod tidy
    go build
    echo "✅ Go backend built successfully"
    cd ../..
else
    echo "⚠️  Go not found. Please install Go first."
    cd ../..
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "  1. Start backend:  ./mini-services/docker-manager/docker-manager"
echo "  2. Start frontend: npm run dev"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
