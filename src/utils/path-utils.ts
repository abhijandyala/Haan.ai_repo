import path from 'path';
import fs from 'fs';

let projectRoot = process.cwd();

export function setProjectRoot(root: string) {
  projectRoot = path.resolve(root);
}

export function getProjectRoot(): string {
  return projectRoot;
}

export function safePath(filePath: string): string {
  const resolved = path.resolve(projectRoot, filePath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Path "${filePath}" is outside the project root`);
  }
  return resolved;
}

export function haanDir(): string {
  const dir = path.join(projectRoot, '.haan');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function haanSubDir(sub: string): string {
  const dir = path.join(haanDir(), sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function relativePath(absPath: string): string {
  return path.relative(projectRoot, absPath);
}
