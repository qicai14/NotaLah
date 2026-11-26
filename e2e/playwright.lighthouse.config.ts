import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Same stack as the E2E suite (seeded notalah_test_81, dev server, AI stub), but runs only e2e/lighthouse/ (#81).
export default defineConfig({ ...base, testDir: './lighthouse', reporter: [['list']], timeout: 15 * 60 * 1000 });
