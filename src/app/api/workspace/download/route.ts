import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Auth check
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const zip = new JSZip();

    // Define directories and files to include
    const projectRoot = '/home/z/my-project';
    const includePaths = [
      // Core source code
      { src: 'src', dest: 'src', type: 'directory' },
      { src: 'prisma', dest: 'prisma', type: 'directory' },
      { src: 'public', dest: 'public', type: 'directory' },
      { src: 'Example', dest: 'Example', type: 'directory' },
      // Mini-services source (excluding binaries and data)
      { src: 'mini-services/terminal-ws', dest: 'mini-services/terminal-ws', type: 'directory' },
      { src: 'mini-services/docker-manager', dest: 'mini-services/docker-manager', type: 'directory' },
      // Config files
      { src: 'package.json', dest: 'package.json', type: 'file' },
      { src: 'tsconfig.json', dest: 'tsconfig.json', type: 'file' },
      { src: 'next.config.ts', dest: 'next.config.ts', type: 'file' },
      { src: 'tailwind.config.ts', dest: 'tailwind.config.ts', type: 'file' },
      { src: 'postcss.config.mjs', dest: 'postcss.config.mjs', type: 'file' },
      { src: 'components.json', dest: 'components.json', type: 'file' },
      { src: 'eslint.config.mjs', dest: 'eslint.config.mjs', type: 'file' },
      { src: 'Caddyfile', dest: 'Caddyfile', type: 'file' },
    ];

    // Directories/files to exclude
    const excludePatterns = [
      'node_modules',
      '.next',
      '.git',
      'download',
      'agent-ctx',
    ];

    // File extensions to exclude
    const excludeExtensions = [
      '.db', '.db-journal', '.db-shm', '.db-wal',
      '.log', '.png', '.jpg', '.jpeg', '.gif', '.webp',
    ];

    // Binary file names to exclude
    const excludeFileNames = [
      'docker-manager', // Go binary
      'docker-manager.db',
    ];

    function shouldExclude(filePath: string): boolean {
      for (const pattern of excludePatterns) {
        if (filePath.includes(pattern)) return true;
      }

      const fileName = path.basename(filePath);
      if (excludeFileNames.includes(fileName)) return true;

      for (const ext of excludeExtensions) {
        if (fileName.endsWith(ext)) return true;
      }

      // Exclude upload directory
      const parts = filePath.split(path.sep);
      if (parts.includes('upload')) return true;

      // Exclude Go binary and data directories
      if (parts.includes('data') && parts.includes('docker-manager')) return true;

      return false;
    }

    let fileCount = 0;
    let totalSize = 0;

    function addDirectoryToZip(dirPath: string, zipPath: string) {
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const zipEntryPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
        if (shouldExclude(fullPath)) continue;
        if (entry.isDirectory()) {
          addDirectoryToZip(fullPath, zipEntryPath);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(fullPath);
            zip.file(zipEntryPath, content);
            fileCount++;
            totalSize += content.length;
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }

    for (const item of includePaths) {
      const fullPath = path.join(projectRoot, item.src);
      try {
        if (item.type === 'directory' && fs.existsSync(fullPath)) {
          addDirectoryToZip(fullPath, item.dest);
        } else if (item.type === 'file' && fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath);
          zip.file(item.dest, content);
          fileCount++;
          totalSize += content.length;
        }
      } catch {
        // Skip if file/dir doesn't exist
      }
    }

    // Add a workspace info file with stats
    const workspaceInfo = {
      name: 'Docker Manager Workspace',
      version: '2.11.0',
      exportedAt: new Date().toISOString(),
      description: 'Full workspace export of the Docker Manager application',
      stats: {
        totalFiles: fileCount,
        totalSizeBytes: totalSize,
        totalSizeFormatted: `${(totalSize / 1024).toFixed(1)} KB`,
      },
      included: includePaths.map(p => p.dest),
      instructions: {
        setup: '1. Install Node.js and Bun 2. Run bun install 3. Run bun run db:push 4. Run bun run dev',
        goBackend: 'cd mini-services/docker-manager && go build -o docker-manager && ./start.sh',
        terminalWS: 'cd mini-services/terminal-ws && bun install && bun run dev',
      },
    };
    zip.file('workspace-info.json', JSON.stringify(workspaceInfo, null, 2));

    // Generate zip buffer
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Return zip file
    const fileName = `docker-manager-workspace-${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
        'X-File-Count': fileCount.toString(),
        'X-Total-Size': totalSize.toString(),
      },
    });
  } catch (error) {
    console.error('Workspace archive error:', error);
    return NextResponse.json(
      { error: 'Failed to archive workspace files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
