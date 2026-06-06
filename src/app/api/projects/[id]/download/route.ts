import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Get project from database
  const project = await db.project.findUnique({
    where: { id },
    include: { containers: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    const zip = new JSZip();

    // Add project configuration as JSON
    const projectConfig = {
      id: project.id,
      name: project.name,
      template: project.template,
      status: project.status,
      frontend_port: project.frontendPort,
      backend_port: project.backendPort,
      cpu: project.cpu,
      memory: project.memory,
      expires_at: project.expiresAt.toISOString(),
      always_on: project.alwaysOn,
      created_at: project.createdAt.toISOString(),
      updated_at: project.updatedAt.toISOString(),
      containers: project.containers.map(c => ({
        id: c.id,
        name: c.name,
        image: c.image,
        status: c.status,
        ports: c.ports,
        cpu: c.cpu,
        memory: c.memory,
      })),
    };

    zip.file('project-config.json', JSON.stringify(projectConfig, null, 2));

    // Add docker-compose.yml
    zip.file('docker-compose.yml', generateDockerCompose(project));

    // Add Dockerfile based on template
    zip.file('Dockerfile', generateDockerfile(project));

    // Add .env.example
    zip.file('.env.example', generateEnvExample(project));

    // Add README
    zip.file('README.md', generateReadme(project));

    // Try to include template source files if they exist
    const exampleDir = process.env.EXAMPLE_DIR || '/home/z/my-project/Example';
    const templatePath = path.join(exampleDir, project.template);
    if (fs.existsSync(templatePath)) {
      const stat = fs.statSync(templatePath);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(templatePath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(templatePath, entry.name);
          if (entry.isFile()) {
            try {
              const content = fs.readFileSync(fullPath);
              zip.file(`src/${entry.name}`, content);
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    }

    // Add a deployment script
    zip.file('deploy.sh', generateDeployScript(project));

    // Generate zip buffer
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // Return zip file
    const fileName = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}-project.zip`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Archive error:', error);
    return NextResponse.json(
      { error: 'Failed to archive project files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function generateDockerCompose(project: {
  id: string;
  name: string;
  template: string;
  frontendPort: number | null;
  backendPort: number | null;
  alwaysOn: boolean;
  containers: { name: string; image: string; ports: string; status: string }[];
}): string {
  const serviceName = project.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const image = getImageForTemplate(project.template);
  const port = project.frontendPort || 3000;

  let compose = `version: '3.8'

services:
  ${serviceName}:
    image: ${image}
    container_name: ${serviceName}
    restart: ${project.alwaysOn ? 'unless-stopped' : 'no'}
    ports:
      - "${port}:3000"
`;

  if (project.backendPort) {
    compose += `      - "${project.backendPort}:8000"
`;
  }

  compose += `
  # Environment variables
  # env_file:
  #   - .env

  # Volume mounts (uncomment as needed)
  # volumes:
  #   - ./src:/app

  # Resource limits
  # deploy:
  #   resources:
  #     limits:
  #       cpus: '0.50'
  #       memory: 512M
`;

  return compose;
}

function generateDockerfile(project: {
  template: string;
  name: string;
}): string {
  switch (project.template) {
    case 'nextjs-app':
      return `FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
`;
    case 'python-api':
      return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
    case 'nginx-static':
      return `FROM nginx:alpine
COPY src/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
    default:
      return `FROM alpine:latest
WORKDIR /app
COPY . .
# Add your build steps here
EXPOSE 3000
CMD ["./start.sh"]
`;
  }
}

function generateEnvExample(project: {
  name: string;
  template: string;
  frontendPort: number | null;
  backendPort: number | null;
}): string {
  return `# Environment variables for ${project.name}
# Copy this file to .env and update values

# Application
APP_NAME=${project.name}
APP_PORT=${project.frontendPort || 3000}
NODE_ENV=production

# Database (if needed)
# DATABASE_URL=sqlite:///data/app.db

# API (if needed)
# API_PORT=${project.backendPort || 8000}

# Docker Manager
# DM_PROJECT_ID=
# DM_TEMPLATE=${project.template}
`;
}

function generateReadme(project: {
  id: string;
  name: string;
  template: string;
  status: string;
  frontendPort: number | null;
  backendPort: number | null;
  alwaysOn: boolean;
  expiresAt: Date;
  createdAt: Date;
}): string {
  return `# ${project.name}

## Project Info

- **Template**: ${project.template}
- **Status**: ${project.status}
- **Frontend Port**: ${project.frontendPort || 'N/A'}
- **Backend Port**: ${project.backendPort || 'N/A'}
- **Always On**: ${project.alwaysOn ? 'Yes' : 'No'}
- **Created**: ${project.createdAt.toLocaleDateString()}
- **Expires**: ${project.expiresAt.toLocaleDateString()}

## Quick Start

### Using Docker Compose (Recommended)

\`\`\`bash
# Copy environment file
cp .env.example .env

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f
\`\`\`

### Using Dockerfile

\`\`\`bash
# Build the image
docker build -t ${project.name.toLowerCase()} .

# Run the container
docker run -d -p ${project.frontendPort || 3000}:3000 --name ${project.name.toLowerCase()} ${project.name.toLowerCase()}
\`\`\`

### Using Deploy Script

\`\`\`bash
chmod +x deploy.sh
./deploy.sh
\`\`\`

## Files Included

- \`project-config.json\` - Full project configuration export
- \`docker-compose.yml\` - Docker Compose configuration
- \`Dockerfile\` - Docker build configuration
- \`.env.example\` - Environment variables template
- \`deploy.sh\` - Quick deployment script
- \`src/\` - Template source files (if available)

## Ports

| Service | Port |
|---------|------|
| Frontend | ${project.frontendPort || 3000} |
${project.backendPort ? `| Backend API | ${project.backendPort} |` : ''}

## Notes

- This project was exported from Docker Manager
- The configuration includes all container settings and resource allocations
- Review and update environment variables before deploying
`;
}

function generateDeployScript(project: {
  name: string;
  template: string;
  frontendPort: number | null;
  backendPort: number | null;
  alwaysOn: boolean;
}): string {
  const serviceName = project.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  return `#!/bin/bash
# Deploy script for ${project.name}


set -e

echo "🚀 Deploying ${project.name}..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Copy env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration before continuing."
    echo "   Run: nano .env"
    exit 0
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build and start
echo "📦 Building and starting services..."
docker compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check status
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:${project.frontendPort || 3000}"
${project.backendPort ? `echo "   Backend:  http://localhost:${project.backendPort}"` : ''}
echo ""
echo "📋 Useful commands:"
echo "   View logs:    docker compose logs -f"
echo "   Stop:         docker compose down"
echo "   Restart:      docker compose restart"
echo "   Status:       docker compose ps"
`;
}

function getImageForTemplate(template: string): string {
  switch (template) {
    case 'nextjs-app':
      return 'node:18-alpine';
    case 'python-api':
      return 'python:3.11-slim';
    case 'nginx-static':
      return 'nginx:alpine';
    default:
      return 'alpine:latest';
  }
}
