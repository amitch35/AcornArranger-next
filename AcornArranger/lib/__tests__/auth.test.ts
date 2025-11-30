import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasAtLeastRole, type Role } from '../auth';

describe('auth helpers', () => {
  describe('hasAtLeastRole', () => {
    it('should return true when roles are equal', () => {
      expect(hasAtLeastRole('authenticated', 'authenticated')).toBe(true);
      expect(hasAtLeastRole('authorized_user', 'authorized_user')).toBe(true);
    });

    it('should return true when current role is higher than required', () => {
      expect(hasAtLeastRole('authorized_user', 'authenticated')).toBe(true);
    });

    it('should return false when current role is lower than required', () => {
      expect(hasAtLeastRole('authenticated', 'authorized_user')).toBe(false);
    });

    it('should handle role hierarchy correctly', () => {
      const roles: Role[] = ['authenticated', 'authorized_user'];
      
      // Test all combinations
      for (let i = 0; i < roles.length; i++) {
        for (let j = 0; j < roles.length; j++) {
          const result = hasAtLeastRole(roles[i], roles[j]);
          expect(result).toBe(i >= j);
        }
      }
    });
  });

  describe('Role hierarchy', () => {
    it('should maintain correct order for future admin role', () => {
      // This test documents the expected behavior when 'admin' is added
      // Order should be: authenticated < authorized_user < admin (future)
      expect(hasAtLeastRole('authorized_user', 'authenticated')).toBe(true);
      
      // When admin is added, these should also be true:
      // hasAtLeastRole('admin', 'authenticated') => true
      // hasAtLeastRole('admin', 'authorized_user') => true
    });
  });
});

