/**
 * @file ciWorkflow.test.js
 * @description Unit tests validating the GitHub Actions CI/CD deployment configuration (US4.3 / T5).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('CI/CD Workflow Configuration Unit Tests (US4.3 / T5)', () => {
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'deploy.yml');

  it('should find deploy.yml in .github/workflows directory', () => {
    assert.ok(existsSync(workflowPath), '.github/workflows/deploy.yml must exist');
  });

  it('should trigger on push to main branch and workflow_dispatch', () => {
    const content = readFileSync(workflowPath, 'utf8');
    assert.match(content, /push:\s*\n\s*branches:\s*\n\s*-\s*main/);
    assert.ok(content.includes('workflow_dispatch:'), 'Workflow should support manual dispatch');
  });

  it('should define required permissions for GitHub Pages deployment and OIDC token', () => {
    const content = readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('pages: write'));
    assert.ok(content.includes('id-token: write'));
    assert.ok(content.includes('contents: read'));
  });

  it('should validate test suite with node --test prior to deployment', () => {
    const content = readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('run: node --test tests/*.test.js'));
    assert.ok(content.includes('needs: test'), 'deploy job must depend on test job succeeding');
  });

  it('should inject Supabase secrets into src/env.local.js during deployment job', () => {
    const content = readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('src/env.local.js'));
    assert.ok(content.includes('${{ secrets.SUPABASE_URL }}'));
    assert.ok(content.includes('${{ secrets.SUPABASE_ANON_KEY }}'));
  });

  it('should configure and deploy static assets to GitHub Pages environment', () => {
    const content = readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('actions/configure-pages@v5'));
    assert.ok(content.includes('actions/upload-pages-artifact@v3'));
    assert.ok(content.includes('actions/deploy-pages@v4'));
    assert.ok(content.includes('name: github-pages'));
  });
});
