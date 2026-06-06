import { NextResponse } from 'next/server';
import { readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

// GET /api/templates - List templates from Example/ directory
export async function GET() {
  try {
    const exampleDir = join(process.cwd(), 'Example');

    if (!existsSync(exampleDir)) {
      return NextResponse.json([]);
    }

    const entries = readdirSync(exampleDir).filter((name) => {
      const fullPath = join(exampleDir, name);
      return statSync(fullPath).isDirectory();
    });

    const templates = entries.map((name) => {
      const templatePath = join(exampleDir, name);
      const hasDockerfile = existsSync(join(templatePath, 'Dockerfile'));
      const hasCompose = existsSync(join(templatePath, 'docker-compose.yml'));

      return {
        id: name,
        name,
        path: templatePath,
        has_dockerfile: hasDockerfile,
        has_compose: hasCompose,
      };
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
