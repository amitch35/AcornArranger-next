// Enable React's act() test environment hint for React 19
// See: https://react.dev/reference/react/act
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import '@testing-library/jest-dom';

// MSW server setup with entity handlers
import { server } from '@/lib/hooks/test-utils/msw';
import { entityHandlers } from '@/lib/mocks/entityHandlers';

beforeAll(() => {
  // Register entity handlers and start server
  server.use(...entityHandlers);
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  // Reset handlers after each test to ensure isolation
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// jest-axe a11y matchers
import { toHaveNoViolations } from 'jest-axe';
expect.extend({ toHaveNoViolations });


