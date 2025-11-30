import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withAuth, withMinRole } from '../apiGuard';

// Mock the auth module
vi.mock('../auth', () => ({
  getCurrentRole: vi.fn(),
  hasAtLeastRole: vi.fn(),
}));

describe('apiGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withAuth', () => {
    it('should call handler when user is authenticated', async () => {
      const { getCurrentRole } = await import('../auth');
      vi.mocked(getCurrentRole).mockResolvedValue('authenticated');

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const wrappedHandler = withAuth(mockHandler);
      const req = new Request('http://localhost/api/test');
      const response = await wrappedHandler(req);

      expect(getCurrentRole).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(req, { role: 'authenticated' });
      expect(response.status).toBe(200);
    });

    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentRole } = await import('../auth');
      vi.mocked(getCurrentRole).mockRejectedValue(new Error('UNAUTH'));

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const req = new Request('http://localhost/api/test');
      const response = await wrappedHandler(req);

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Unauthorized');
    });

    it('should provide role context to handler', async () => {
      const { getCurrentRole } = await import('../auth');
      vi.mocked(getCurrentRole).mockResolvedValue('authorized_user');

      const mockHandler = vi.fn(async (req, { role }) => {
        return new Response(JSON.stringify({ role }), { status: 200 });
      });

      const wrappedHandler = withAuth(mockHandler);
      const req = new Request('http://localhost/api/test');
      const response = await wrappedHandler(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('role', 'authorized_user');
    });
  });

  describe('withMinRole', () => {
    it('should allow access when role meets minimum', async () => {
      const { getCurrentRole, hasAtLeastRole } = await import('../auth');
      vi.mocked(getCurrentRole).mockResolvedValue('authorized_user');
      vi.mocked(hasAtLeastRole).mockReturnValue(true);

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const wrappedHandler = withMinRole(mockHandler, { minRole: 'authorized_user' });
      const req = new Request('http://localhost/api/test');
      const response = await wrappedHandler(req);

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should return 403 when role is insufficient', async () => {
      const { getCurrentRole, hasAtLeastRole } = await import('../auth');
      vi.mocked(getCurrentRole).mockResolvedValue('authenticated');
      vi.mocked(hasAtLeastRole).mockReturnValue(false);

      const mockHandler = vi.fn();
      const wrappedHandler = withMinRole(mockHandler, { minRole: 'authorized_user' });
      const req = new Request('http://localhost/api/test');
      const response = await wrappedHandler(req);

      expect(response.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Forbidden');
      expect(body).toHaveProperty('userRole', 'authenticated');
    });
  });
});

