import { ProjectFramework } from '../framework-detector.js';

/**
 * Get framework-specific guidance for the builder agent.
 */
export function getBuilderFrameworkGuidance(fw: ProjectFramework): string {
  const parts: string[] = [];

  if (fw.framework === 'nextjs') {
    parts.push(`## Next.js Conventions
- Use the App Router (\`app/\` directory) for new routes
- Server Components are the default; add \`'use client'\` only when needed
- Use \`page.tsx\` for routes, \`layout.tsx\` for layouts, \`loading.tsx\` for loading states
- API routes go in \`app/api/\` as \`route.ts\` files
- Use \`next/image\` for images, \`next/link\` for links
- Server Actions for mutations: \`'use server'\` at top of function`);
  }

  if (fw.framework === 'express') {
    parts.push(`## Express Conventions
- Use Router for modular route files
- Middleware chain: error handlers have 4 params (err, req, res, next)
- Use async/await with try-catch or express-async-errors
- Validate request body/params before processing`);
  }

  if (fw.framework === 'django') {
    parts.push(`## Django Conventions
- Views in \`views.py\`, URLs in \`urls.py\`, models in \`models.py\`
- Use class-based views for CRUD operations
- Migrations: \`python manage.py makemigrations && python manage.py migrate\`
- Templates in \`templates/\` directory
- Settings in \`settings.py\`, use \`django-environ\` for env vars`);
  }

  if (fw.framework === 'fastapi') {
    parts.push(`## FastAPI Conventions
- Use Pydantic models for request/response schemas
- Dependency injection via \`Depends()\`
- Async endpoints with \`async def\`
- Use \`APIRouter\` for modular route organization`);
  }

  if (fw.framework === 'react') {
    parts.push(`## React Conventions
- Functional components with hooks
- Use \`useState\`, \`useEffect\`, \`useMemo\`, \`useCallback\` appropriately
- Prefer composition over inheritance
- Co-locate components, styles, and tests`);
  }

  if (fw.language === 'rust') {
    parts.push(`## Rust Conventions
- Use \`Result<T, E>\` for error handling, not unwrap in production code
- Derive common traits: Debug, Clone, Serialize, Deserialize
- Use \`mod.rs\` or file-as-module pattern for organization
- Run \`cargo clippy\` and \`cargo fmt\` after changes`);
  }

  if (fw.language === 'go') {
    parts.push(`## Go Conventions
- Error handling: always check returned errors
- Use \`context.Context\` for cancellation and deadlines
- Package names are lowercase, short, single-word
- Run \`go fmt\` and \`go vet\` after changes`);
  }

  return parts.join('\n\n');
}

/**
 * Get framework-specific test guidance.
 */
export function getTesterFrameworkGuidance(fw: ProjectFramework): string {
  const parts: string[] = [];

  if (fw.testFramework === 'vitest') {
    parts.push(`## Test Framework: Vitest
- Test files: \`*.test.ts\` or \`*.spec.ts\`
- Run: \`npx vitest run\` (or \`npm test\`)
- Coverage: \`npx vitest run --coverage\`
- Use \`describe\`, \`it\`, \`expect\` from 'vitest'
- Mocking: \`vi.fn()\`, \`vi.mock()\`, \`vi.spyOn()\``);
  }

  if (fw.testFramework === 'jest') {
    parts.push(`## Test Framework: Jest
- Test files: \`*.test.ts\`, \`*.test.js\`, \`*.spec.*\`
- Run: \`npx jest\` or \`npm test\`
- Coverage: \`npx jest --coverage\`
- Mocking: \`jest.fn()\`, \`jest.mock()\`, \`jest.spyOn()\``);
  }

  if (fw.testFramework === 'pytest') {
    parts.push(`## Test Framework: pytest
- Test files: \`test_*.py\` or \`*_test.py\`
- Run: \`pytest\` or \`python -m pytest\`
- Coverage: \`pytest --cov=src\`
- Fixtures: \`@pytest.fixture\`
- Parametrize: \`@pytest.mark.parametrize\``);
  }

  if (fw.testFramework === 'cargo test') {
    parts.push(`## Test Framework: cargo test
- Tests in \`#[cfg(test)] mod tests { ... }\` at bottom of each file
- Integration tests in \`tests/\` directory
- Run: \`cargo test\`
- Use \`assert!\`, \`assert_eq!\`, \`assert_ne!\` macros`);
  }

  if (fw.testFramework === 'go test') {
    parts.push(`## Test Framework: go test
- Test files: \`*_test.go\` in same package
- Functions: \`func TestXxx(t *testing.T)\`
- Run: \`go test ./...\`
- Coverage: \`go test -cover ./...\`
- Use \`t.Error()\`, \`t.Fatal()\`, \`t.Run()\` for subtests`);
  }

  return parts.join('\n\n');
}
