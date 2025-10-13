// Enable React's act() test environment hint for React 19
// See: https://react.dev/reference/react/act
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import '@testing-library/jest-dom';
// msw server setup (opt-in per test)
// Tests can import server from lib/hooks/test-utils/msw and call server.use(...)

// jest-axe a11y matchers
import { toHaveNoViolations } from 'jest-axe';
expect.extend({ toHaveNoViolations });


