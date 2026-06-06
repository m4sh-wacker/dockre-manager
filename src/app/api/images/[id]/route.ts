import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// Base image data used for simulation
const baseImages: Record<string, {
  name: string;
  tag: string;
  sizeBytes: number;
  created: string;
  status: string;
}> = {
  img1: { name: 'nginx', tag: 'latest', sizeBytes: 142000000, created: '2 days ago', status: 'available' },
  img2: { name: 'node', tag: '18-alpine', sizeBytes: 180000000, created: '5 days ago', status: 'available' },
  img3: { name: 'python', tag: '3.11-slim', sizeBytes: 152000000, created: '1 week ago', status: 'available' },
  img4: { name: 'postgres', tag: '15', sizeBytes: 379000000, created: '3 days ago', status: 'available' },
  img5: { name: 'redis', tag: '7-alpine', sizeBytes: 30000000, created: '1 day ago', status: 'available' },
  img6: { name: 'mongo', tag: '6', sizeBytes: 695000000, created: '1 week ago', status: 'available' },
  img7: { name: 'mysql', tag: '8.0', sizeBytes: 573000000, created: '4 days ago', status: 'available' },
  img8: { name: 'alpine', tag: '3.18', sizeBytes: 7300000, created: '2 weeks ago', status: 'available' },
};

function generateLayerData(imageName: string) {
  const hash = imageName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const layerSets: Record<string, Array<{ instruction: string; command: string; sizeBytes: number; createdAgo: string }>> = {
    nginx: [
      { instruction: 'FROM', command: 'debian:bookworm-slim', sizeBytes: 74300000, createdAgo: '3 weeks ago' },
      { instruction: 'ENV', command: 'NGINX_VERSION=1.25.4', sizeBytes: 0, createdAgo: '3 weeks ago' },
      { instruction: 'RUN', command: 'apt-get update && apt-get install -y --no-install-recommends nginx=${NGINX_VERSION} && rm -rf /var/lib/apt/lists/*', sizeBytes: 35200000, createdAgo: '3 weeks ago' },
      { instruction: 'COPY', command: 'docker-entrypoint.sh /', sizeBytes: 368, createdAgo: '3 weeks ago' },
      { instruction: 'RUN', command: 'chmod +x /docker-entrypoint.sh', sizeBytes: 4096, createdAgo: '3 weeks ago' },
      { instruction: 'EXPOSE', command: '80/tcp', sizeBytes: 0, createdAgo: '3 weeks ago' },
      { instruction: 'STOPSIGNAL', command: 'SIGQUIT', sizeBytes: 0, createdAgo: '3 weeks ago' },
      { instruction: 'CMD', command: '["nginx", "-g", "daemon off;"]', sizeBytes: 0, createdAgo: '3 weeks ago' },
    ],
    node: [
      { instruction: 'FROM', command: 'alpine:3.19', sizeBytes: 7300000, createdAgo: '4 weeks ago' },
      { instruction: 'ENV', command: 'NODE_VERSION=18.20.0', sizeBytes: 0, createdAgo: '4 weeks ago' },
      { instruction: 'RUN', command: 'addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node && apk add --no-cache libstdc++ && apk add --no-cache --virtual .build-deps curl && curl -fsSLO https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz && tar -xJf node-v${NODE_VERSION}-linux-x64.tar.xz -C /usr/local --strip-components=1 && apk del .build-deps', sizeBytes: 142000000, createdAgo: '4 weeks ago' },
      { instruction: 'ENV', command: 'YARN_VERSION=1.22.19', sizeBytes: 0, createdAgo: '4 weeks ago' },
      { instruction: 'RUN', command: 'apk add --no-cache --virtual .build-deps-yarn curl && corepack enable', sizeBytes: 8900000, createdAgo: '4 weeks ago' },
      { instruction: 'COPY', command: 'docker-entrypoint.sh /usr/local/bin/', sizeBytes: 388, createdAgo: '4 weeks ago' },
      { instruction: 'EXPOSE', command: '3000/tcp', sizeBytes: 0, createdAgo: '4 weeks ago' },
      { instruction: 'CMD', command: '["node"]', sizeBytes: 0, createdAgo: '4 weeks ago' },
    ],
    python: [
      { instruction: 'FROM', command: 'debian:bookworm-slim', sizeBytes: 74300000, createdAgo: '2 weeks ago' },
      { instruction: 'ENV', command: 'PYTHON_VERSION=3.11.8', sizeBytes: 0, createdAgo: '2 weeks ago' },
      { instruction: 'RUN', command: 'apt-get update && apt-get install -y --no-install-recommends python3=${PYTHON_VERSION}-1 && rm -rf /var/lib/apt/lists/*', sizeBytes: 52000000, createdAgo: '2 weeks ago' },
      { instruction: 'RUN', command: 'pip install --no-cache-dir --upgrade pip setuptools wheel', sizeBytes: 18500000, createdAgo: '2 weeks ago' },
      { instruction: 'COPY', command: 'docker-entrypoint.sh /usr/local/bin/', sizeBytes: 412, createdAgo: '2 weeks ago' },
      { instruction: 'EXPOSE', command: '8000/tcp', sizeBytes: 0, createdAgo: '2 weeks ago' },
      { instruction: 'CMD', command: '["python3"]', sizeBytes: 0, createdAgo: '2 weeks ago' },
    ],
    postgres: [
      { instruction: 'FROM', command: 'debian:bookworm-slim', sizeBytes: 74300000, createdAgo: '5 days ago' },
      { instruction: 'ENV', command: 'PG_MAJOR=15', sizeBytes: 0, createdAgo: '5 days ago' },
      { instruction: 'ENV', command: 'PG_VERSION=15.6-1.pgdg120+2', sizeBytes: 0, createdAgo: '5 days ago' },
      { instruction: 'RUN', command: 'apt-get update && apt-get install -y --no-install-recommends postgresql-common && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh && apt-get install -y postgresql-${PG_MAJOR}=${PG_VERSION} && rm -rf /var/lib/apt/lists/*', sizeBytes: 245000000, createdAgo: '5 days ago' },
      { instruction: 'RUN', command: 'mkdir -p /var/run/postgresql && chown -R postgres:postgres /var/run/postgresql', sizeBytes: 4096, createdAgo: '5 days ago' },
      { instruction: 'COPY', command: 'docker-entrypoint.sh /usr/local/bin/', sizeBytes: 8192, createdAgo: '5 days ago' },
      { instruction: 'EXPOSE', command: '5432/tcp', sizeBytes: 0, createdAgo: '5 days ago' },
      { instruction: 'CMD', command: '["postgres"]', sizeBytes: 0, createdAgo: '5 days ago' },
    ],
    redis: [
      { instruction: 'FROM', command: 'alpine:3.19', sizeBytes: 7300000, createdAgo: '2 days ago' },
      { instruction: 'RUN', command: 'apk add --no-cache redis', sizeBytes: 8700000, createdAgo: '2 days ago' },
      { instruction: 'COPY', command: 'redis.conf /etc/redis/redis.conf', sizeBytes: 61440, createdAgo: '2 days ago' },
      { instruction: 'RUN', command: 'mkdir -p /data && chown redis:redis /data', sizeBytes: 4096, createdAgo: '2 days ago' },
      { instruction: 'EXPOSE', command: '6379/tcp', sizeBytes: 0, createdAgo: '2 days ago' },
      { instruction: 'CMD', command: '["redis-server", "/etc/redis/redis.conf"]', sizeBytes: 0, createdAgo: '2 days ago' },
    ],
    mongo: [
      { instruction: 'FROM', command: 'ubuntu:jammy', sizeBytes: 77000000, createdAgo: '1 week ago' },
      { instruction: 'RUN', command: 'apt-get update && apt-get install -y --no-install-recommends gnupg curl && rm -rf /var/lib/apt/lists/*', sizeBytes: 32000000, createdAgo: '1 week ago' },
      { instruction: 'RUN', command: 'curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list', sizeBytes: 12288, createdAgo: '1 week ago' },
      { instruction: 'RUN', command: 'apt-get update && apt-get install -y mongodb-org && rm -rf /var/lib/apt/lists/*', sizeBytes: 520000000, createdAgo: '1 week ago' },
      { instruction: 'RUN', command: 'mkdir -p /data/db /data/configdb && chown -R mongodb:mongodb /data/db /data/configdb', sizeBytes: 4096, createdAgo: '1 week ago' },
      { instruction: 'COPY', command: 'docker-entrypoint.sh /usr/local/bin/', sizeBytes: 6144, createdAgo: '1 week ago' },
      { instruction: 'EXPOSE', command: '27017/tcp', sizeBytes: 0, createdAgo: '1 week ago' },
      { instruction: 'CMD', command: '["mongod"]', sizeBytes: 0, createdAgo: '1 week ago' },
    ],
    mysql: [
      { instruction: 'FROM', command: 'debian:bookworm-slim', sizeBytes: 74300000, createdAgo: '6 days ago' },
      { instruction: 'ENV', command: 'MYSQL_MAJOR=8.0', sizeBytes: 0, createdAgo: '6 days ago' },
      { instruction: 'ENV', command: 'MYSQL_VERSION=8.0.36-1debian12', sizeBytes: 0, createdAgo: '6 days ago' },
      { instruction: 'RUN', command: 'apt-get update && apt-get install -y --no-install-recommends gnupg && rm -rf /var/lib/apt/lists/*', sizeBytes: 8900000, createdAgo: '6 days ago' },
      { instruction: 'RUN', command: 'apt-get update && apt-get install -y mysql-community-server=${MYSQL_VERSION} && rm -rf /var/lib/apt/lists/* && rm -rf /var/lib/mysql && mkdir -p /var/lib/mysql /var/run/mysqld && chown -R mysql:mysql /var/lib/mysql /var/run/mysqld', sizeBytes: 420000000, createdAgo: '6 days ago' },
      { instruction: 'COPY', command: 'docker-entrypoint.sh /usr/local/bin/', sizeBytes: 12288, createdAgo: '6 days ago' },
      { instruction: 'EXPOSE', command: '3306/tcp', sizeBytes: 0, createdAgo: '6 days ago' },
      { instruction: 'CMD', command: '["mysqld"]', sizeBytes: 0, createdAgo: '6 days ago' },
    ],
    alpine: [
      { instruction: 'FROM', command: 'scratch', sizeBytes: 0, createdAgo: '3 weeks ago' },
      { instruction: 'ADD', command: 'alpine-minirootfs-3.18.6-x86_64.tar.gz /', sizeBytes: 7300000, createdAgo: '3 weeks ago' },
      { instruction: 'CMD', command: '["/bin/sh"]', sizeBytes: 0, createdAgo: '3 weeks ago' },
    ],
  };

  // Default layers for unknown images
  const defaultLayers = [
    { instruction: 'FROM', command: 'ubuntu:22.04', sizeBytes: 77000000, createdAgo: '2 weeks ago' },
    { instruction: 'RUN', command: 'apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*', sizeBytes: 12000000, createdAgo: '2 weeks ago' },
    { instruction: 'COPY', command: '. /app', sizeBytes: 45000000, createdAgo: '1 week ago' },
    { instruction: 'RUN', command: 'chmod +x /app/entrypoint.sh', sizeBytes: 4096, createdAgo: '1 week ago' },
    { instruction: 'EXPOSE', command: '8080/tcp', sizeBytes: 0, createdAgo: '1 week ago' },
    { instruction: 'CMD', command: '["/app/entrypoint.sh"]', sizeBytes: 0, createdAgo: '1 week ago' },
  ];

  const layers = layerSets[imageName] || defaultLayers;
  // Add some deterministic variation based on hash
  const extraLayers: Array<{ instruction: string; command: string; sizeBytes: number; createdAgo: string }> = [];
  if (hash % 3 === 0) {
    extraLayers.push({ instruction: 'LABEL', command: `maintainer=Docker Manager <dev@docker-mgr.io>`, sizeBytes: 0, createdAgo: '1 week ago' });
  }
  if (hash % 5 === 0) {
    extraLayers.push({ instruction: 'HEALTHCHECK', command: 'CMD curl -f http://localhost/ || exit 1', sizeBytes: 0, createdAgo: '1 week ago' });
  }

  return [...extraLayers.slice(0, 1), ...layers, ...extraLayers.slice(1)];
}

function generateImageDetail(imageId: string) {
  const base = baseImages[imageId];
  if (!base) {
    // For unknown IDs, generate a default image detail
    return generateDefaultImageDetail(imageId);
  }

  const hash = base.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const arch = hash % 3 === 0 ? 'arm64' : 'amd64';
  const os = hash % 5 === 0 ? 'windows' : 'linux';
  const layers = generateLayerData(base.name);
  const totalLayerSize = layers.reduce((sum, l) => sum + l.sizeBytes, 0);
  const virtualSize = base.sizeBytes + Math.floor(base.sizeBytes * 0.15);
  const createdDate = new Date(Date.now() - (hash % 14 + 1) * 24 * 3600000);
  const dockerVersion = hash % 2 === 0 ? '20.10.24' : '24.0.7';

  // All tags for this image
  const tagsMap: Record<string, string[]> = {
    nginx: ['nginx:latest', 'nginx:1.25', 'nginx:1.25.4', 'nginx:stable', 'nginx:mainline'],
    node: ['node:18-alpine', 'node:18', 'node:lts-alpine', 'node:hydrogen-alpine'],
    python: ['python:3.11-slim', 'python:3.11', 'python:3-slim', 'python:slim'],
    postgres: ['postgres:15', 'postgres:15.6', 'postgres:latest'],
    redis: ['redis:7-alpine', 'redis:7', 'redis:alpine', 'redis:latest'],
    mongo: ['mongo:6', 'mongo:6.0', 'mongo:latest'],
    mysql: ['mysql:8.0', 'mysql:8', 'mysql:latest', 'mysql:oracle'],
    alpine: ['alpine:3.18', 'alpine:3', 'alpine:latest'],
  };

  const allTags = tagsMap[base.name] || [`${base.name}:${base.tag}`];

  // Push/pull history
  const history = [
    { action: 'pull', tag: `${base.name}:${base.tag}`, timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), user: 'admin', registry: 'Docker Hub' },
    { action: 'push', tag: `${base.name}:${base.tag}`, timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), user: 'ci-pipeline', registry: 'Private Registry' },
    { action: 'pull', tag: `${base.name}:${base.tag}`, timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), user: 'admin', registry: 'Docker Hub' },
    { action: 'push', tag: `${base.name}:${base.tag}`, timestamp: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), user: 'build-bot', registry: 'GitHub Container Registry' },
  ];

  return {
    id: `sha256:${imageId}${Math.random().toString(16).substring(2, 14).padEnd(52, '0')}`,
    name: base.name,
    tag: base.tag,
    fullName: `${base.name}:${base.tag}`,
    sizeBytes: base.sizeBytes,
    virtualSizeBytes: virtualSize,
    created: createdDate.toISOString(),
    createdAgo: base.created,
    status: base.status,
    pullCount: Math.floor(Math.random() * 10000000) + 500000,
    architecture: arch,
    os: os,
    dockerVersion: dockerVersion,
    author: hash % 3 === 0 ? 'Docker Inc. <info@docker.com>' : '',
    description: getDescription(base.name),
    digest: `sha256:${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    layers: layers,
    totalLayerSize: totalLayerSize,
    allTags: allTags,
    history: history,
  };
}

function generateDefaultImageDetail(imageId: string) {
  const hash = imageId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const sizeBytes = 50000000 + (hash % 10) * 50000000;
  const layers = generateLayerData('default');
  const totalLayerSize = layers.reduce((sum, l) => sum + l.sizeBytes, 0);

  return {
    id: `sha256:${imageId}${Math.random().toString(16).substring(2, 14).padEnd(52, '0')}`,
    name: `custom-image-${imageId.substring(0, 6)}`,
    tag: 'latest',
    fullName: `custom-image-${imageId.substring(0, 6)}:latest`,
    sizeBytes: sizeBytes,
    virtualSizeBytes: sizeBytes + Math.floor(sizeBytes * 0.12),
    created: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    createdAgo: '1 week ago',
    status: 'available',
    pullCount: Math.floor(Math.random() * 500000) + 1000,
    architecture: 'amd64',
    os: 'linux',
    dockerVersion: '24.0.7',
    author: '',
    description: 'A custom Docker image',
    digest: `sha256:${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    layers: layers,
    totalLayerSize: totalLayerSize,
    allTags: [`custom-image-${imageId.substring(0, 6)}:latest`],
    history: [
      { action: 'pull', tag: `custom-image-${imageId.substring(0, 6)}:latest`, timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), user: 'admin', registry: 'Docker Hub' },
    ],
  };
}

function getDescription(name: string): string {
  const descriptions: Record<string, string> = {
    nginx: 'Official build of Nginx - a high performance reverse proxy and web server',
    node: 'Node.js is a JavaScript-based platform for server-side and networking applications',
    python: 'Python is an interpreted, interactive, object-oriented, open-source programming language',
    postgres: 'The PostgreSQL object-relational database system provides reliability and data integrity',
    redis: 'Redis is an open source key-value store that functions as a data structure server',
    mongo: 'MongoDB document databases provide high availability and easy scalability',
    mysql: 'MySQL is a widely used, open-source relational database management system (RDBMS)',
    alpine: 'A minimal Docker image based on Alpine Linux with a complete index for a small footprint',
  };
  return descriptions[name] || 'A Docker container image';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Image ID is required' },
      { status: 400 }
    );
  }

  const imageDetail = generateImageDetail(id);

  return NextResponse.json(imageDetail);
}
