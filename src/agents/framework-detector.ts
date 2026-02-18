import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface ProjectFramework {
  language: 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java' | 'ruby' | 'unknown';
  framework?: string;
  testFramework?: string;
  buildTool?: string;
  packageManager?: string;
}

/**
 * Detect the project's language, framework, test runner, and build tool
 * by scanning config files at the project root.
 */
export function detectFramework(projectRoot: string): ProjectFramework {
  const result: ProjectFramework = { language: 'unknown' };

  try {
    // Check for package.json (JS/TS ecosystem)
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Language detection
      result.language = allDeps.typescript || fs.existsSync(path.join(projectRoot, 'tsconfig.json'))
        ? 'typescript'
        : 'javascript';

      // Framework detection
      if (allDeps.next) result.framework = 'nextjs';
      else if (allDeps.nuxt) result.framework = 'nuxt';
      else if (allDeps.svelte || allDeps['@sveltejs/kit']) result.framework = 'svelte';
      else if (allDeps.express) result.framework = 'express';
      else if (allDeps.fastify) result.framework = 'fastify';
      else if (allDeps.hono) result.framework = 'hono';
      else if (allDeps.react && !allDeps.next) result.framework = 'react';
      else if (allDeps.vue && !allDeps.nuxt) result.framework = 'vue';
      else if (allDeps['@angular/core']) result.framework = 'angular';
      else if (allDeps.electron) result.framework = 'electron';

      // Test framework detection
      if (allDeps.vitest) result.testFramework = 'vitest';
      else if (allDeps.jest) result.testFramework = 'jest';
      else if (allDeps.mocha) result.testFramework = 'mocha';
      else if (allDeps.ava) result.testFramework = 'ava';
      else if (allDeps['@playwright/test']) result.testFramework = 'playwright';
      else if (allDeps.cypress) result.testFramework = 'cypress';

      // Build tool detection
      if (allDeps.tsup) result.buildTool = 'tsup';
      else if (allDeps.vite || allDeps['@vitejs/plugin-react']) result.buildTool = 'vite';
      else if (allDeps.webpack) result.buildTool = 'webpack';
      else if (allDeps.esbuild) result.buildTool = 'esbuild';
      else if (allDeps.rollup) result.buildTool = 'rollup';
      else if (allDeps.turbopack || allDeps.turbo) result.buildTool = 'turbo';

      // Package manager
      if (fs.existsSync(path.join(projectRoot, 'bun.lockb'))) result.packageManager = 'bun';
      else if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) result.packageManager = 'pnpm';
      else if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) result.packageManager = 'yarn';
      else result.packageManager = 'npm';

      return result;
    }

    // Python projects
    if (fs.existsSync(path.join(projectRoot, 'requirements.txt')) ||
        fs.existsSync(path.join(projectRoot, 'pyproject.toml')) ||
        fs.existsSync(path.join(projectRoot, 'setup.py'))) {
      result.language = 'python';

      // Check for frameworks
      const reqFiles = ['requirements.txt', 'pyproject.toml', 'setup.py']
        .map(f => path.join(projectRoot, f))
        .filter(f => fs.existsSync(f))
        .map(f => fs.readFileSync(f, 'utf-8').toLowerCase());
      const reqs = reqFiles.join('\n');

      if (reqs.includes('django')) result.framework = 'django';
      else if (reqs.includes('fastapi')) result.framework = 'fastapi';
      else if (reqs.includes('flask')) result.framework = 'flask';
      else if (reqs.includes('streamlit')) result.framework = 'streamlit';

      if (reqs.includes('pytest')) result.testFramework = 'pytest';
      else if (reqs.includes('unittest')) result.testFramework = 'unittest';

      if (fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
        result.packageManager = reqs.includes('poetry') ? 'poetry' : 'pip';
      } else {
        result.packageManager = 'pip';
      }

      return result;
    }

    // Rust projects
    if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
      result.language = 'rust';
      result.testFramework = 'cargo test';
      result.buildTool = 'cargo';
      result.packageManager = 'cargo';

      const cargo = fs.readFileSync(path.join(projectRoot, 'Cargo.toml'), 'utf-8').toLowerCase();
      if (cargo.includes('actix')) result.framework = 'actix';
      else if (cargo.includes('axum')) result.framework = 'axum';
      else if (cargo.includes('rocket')) result.framework = 'rocket';
      else if (cargo.includes('tauri')) result.framework = 'tauri';

      return result;
    }

    // Go projects
    if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
      result.language = 'go';
      result.testFramework = 'go test';
      result.buildTool = 'go';
      result.packageManager = 'go';

      const gomod = fs.readFileSync(path.join(projectRoot, 'go.mod'), 'utf-8').toLowerCase();
      if (gomod.includes('gin-gonic')) result.framework = 'gin';
      else if (gomod.includes('fiber')) result.framework = 'fiber';
      else if (gomod.includes('echo')) result.framework = 'echo';

      return result;
    }

    // Java projects
    if (fs.existsSync(path.join(projectRoot, 'pom.xml')) ||
        fs.existsSync(path.join(projectRoot, 'build.gradle')) ||
        fs.existsSync(path.join(projectRoot, 'build.gradle.kts'))) {
      result.language = 'java';

      if (fs.existsSync(path.join(projectRoot, 'build.gradle')) || fs.existsSync(path.join(projectRoot, 'build.gradle.kts'))) {
        result.buildTool = 'gradle';
        result.packageManager = 'gradle';
      } else {
        result.buildTool = 'maven';
        result.packageManager = 'maven';
      }

      result.testFramework = 'junit';
      return result;
    }

    // Ruby projects
    if (fs.existsSync(path.join(projectRoot, 'Gemfile'))) {
      result.language = 'ruby';
      result.packageManager = 'bundler';

      const gemfile = fs.readFileSync(path.join(projectRoot, 'Gemfile'), 'utf-8').toLowerCase();
      if (gemfile.includes('rails')) result.framework = 'rails';
      else if (gemfile.includes('sinatra')) result.framework = 'sinatra';

      if (gemfile.includes('rspec')) result.testFramework = 'rspec';
      else result.testFramework = 'minitest';

      return result;
    }

  } catch (err) {
    logger.warn('framework-detector', `Detection failed: ${(err as Error).message}`);
  }

  return result;
}

/**
 * Format the detected framework info as a human-readable string for prompts.
 */
export function formatFrameworkInfo(fw: ProjectFramework): string {
  if (fw.language === 'unknown') return '';

  const parts: string[] = [`Language: ${fw.language}`];
  if (fw.framework) parts.push(`Framework: ${fw.framework}`);
  if (fw.testFramework) parts.push(`Test runner: ${fw.testFramework}`);
  if (fw.buildTool) parts.push(`Build tool: ${fw.buildTool}`);
  if (fw.packageManager) parts.push(`Package manager: ${fw.packageManager}`);

  return parts.join('\n');
}
