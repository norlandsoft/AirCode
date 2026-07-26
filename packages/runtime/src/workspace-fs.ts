import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileContentDto, FileTreeNodeDto } from '@aircode/shared';

const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.next',
  'coverage',
  '.cache',
]);

function resolveSafePath(root: string, relPath: string): { abs: string; normalized: string } {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = path.resolve(root, normalized);
  const rootAbs = path.resolve(root);
  if (!abs.startsWith(rootAbs + path.sep) && abs !== rootAbs) {
    throw new Error('非法路径');
  }
  return { abs, normalized };
}

export async function readFileTree(
  root: string,
  rel = '',
  depth = 0,
  maxDepth = 3,
): Promise<FileTreeNodeDto[]> {
  if (depth > maxDepth) return [];
  const abs = path.join(root, rel);
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileTreeNodeDto[] = [];
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.aircode') {
      continue;
    }
    if (IGNORE.has(entry.name)) continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: childRel,
        type: 'directory',
        children: await readFileTree(root, childRel, depth + 1, maxDepth),
      });
    } else {
      nodes.push({ name: entry.name, path: childRel, type: 'file' });
    }
  }
  return nodes;
}

const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  py: 'python',
  go: 'go',
  rs: 'rust',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  toml: 'toml',
};

export async function readWorkspaceFile(
  root: string,
  relPath: string,
): Promise<FileContentDto> {
  const { abs, normalized } = resolveSafePath(root, relPath);
  const content = await fs.readFile(abs, 'utf8');
  const ext = path.extname(abs).slice(1).toLowerCase();
  return {
    path: normalized,
    content,
    language: LANG_BY_EXT[ext],
  };
}

export async function writeWorkspaceFile(
  root: string,
  relPath: string,
  content: string,
): Promise<FileContentDto> {
  const { abs, normalized } = resolveSafePath(root, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  const ext = path.extname(abs).slice(1).toLowerCase();
  return {
    path: normalized,
    content,
    language: LANG_BY_EXT[ext],
  };
}
