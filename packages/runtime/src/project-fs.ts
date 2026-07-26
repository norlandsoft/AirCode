import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { BrowseEntryDto, BrowseResultDto } from '@aircode/shared';
import { expandUserPath } from './settings-service.js';

/** 浏览本机目录（仅列出子目录，供选择项目） */
export async function browseDirectories(inputPath?: string): Promise<BrowseResultDto> {
  const target = expandUserPath(inputPath?.trim() || homedir());
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    throw new Error(`路径不存在：${target}`);
  }
  if (!stat.isDirectory()) throw new Error(`不是目录：${target}`);

  const entries = await fs.readdir(target, { withFileTypes: true });
  const dirs: BrowseEntryDto[] = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({
      name: e.name,
      path: path.join(target, e.name),
      type: 'directory' as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parent = path.dirname(target);
  return {
    path: target,
    parent: parent !== target ? parent : null,
    entries: dirs,
  };
}
