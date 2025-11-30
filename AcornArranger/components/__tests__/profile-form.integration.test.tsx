import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileForm } from '../profile-form';
import { createMockSupabaseClient } from '@/lib/__tests__/test-utils';
import { createClient } from '@/lib/supabase/client';

// Mock the Supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

describe('ProfileForm Integration Tests', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    aud: 'authenticated' as const,
    role: 'authenticated' as const,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };

  const mockProfile = {
    id: 'test-user-id',
    display_name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render profile form with user data for authenticated role', () => {
      const mockSupabase = createMockSupabaseClient({ role: 'authenticated' });
      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      render(
        <ProfileForm
          user={mockUser}
          profile={mockProfile}
          userRole="authenticated"
        />
      );

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    it('should render profile form with user data for authorized_user role', () => {
      const mockSupabase = createMockSupabaseClient({ role: 'authorized_user' });
      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      render(
        <ProfileForm
          user={mockUser}
          profile={mockProfile}
          userRole="authorized_user"
        />
      );

      expect(screen.getByText('Authorized User')).toBeInTheDocument();
    });

    it('should show pending activation status for authenticated role', () => {
      const mockSupabase = createMockSupabaseClient({ role: 'authenticated' });
      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      render(
        <ProfileForm
          user={mockUser}
          profile={mockProfile}
          userRole="authenticated"
        />
      );

      expect(screen.getByText('Awaiting Activation')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should successfully update profile with RLS-permitted fields', async () => {
      const mockSupabase = createMockSupabaseClient({ role: 'authenticated' });
      const mockUpdate = vi.fn().mockResolvedValue({ data: {}, error: null });

      mockSupabase.from = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: mockUpdate,
        })),
      })) as any;

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      render(
        <ProfileForm
          user={mockUser}
          profile={mockProfile}
          userRole="authenticated"
        />
      );

      const displayNameInput = screen.getByLabelText('Display Name');
      fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } });

      const submitButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith('id', 'test-user-id');
      });

      await waitFor(() => {
        expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle RLS permission denied gracefully', async () => {
      const mockSupabase = createMockSupabaseClient({ role: 'authenticated' });
      const mockUpdate = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy',
          code: '42501',
        },
      });

      mockSupabase.from = vi.fn(() => ({
        update: vi.fn(() => ({
          eq: mockUpdate,
        })),
      })) as any;

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      render(
        <ProfileForm
          user={mockUser}
          profile={mockProfile}
          userRole="authenticated"
        />
      );

      const displayNameInput = screen.getByLabelText('Display Name');
      fireEvent.change(displayNameInput, { target: { value: 'Blocked Update' } });

      const submitButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to update profile|violates row-level security/i)
        ).toBeInTheDocument();
      });
    });

    it('should disable submit button when no changes made', () => {
      const mockSupabase = createMockSupabaseClient({ role: 'authenticated' });
      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      render(
        <ProfileForm
          user={mockUser}
          profile={mockProfile}
          userRole="authenticated"
        />
      );

      const submitButton = screen.getByRole('button', { name: /save changes/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Email Field Security', () => {
    it('should disable email field to prevent unauthorized changes', () => {
      const mockSupabase = createMockSupabaseClient({ role: 'authenticated' });
      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      render(
        <ProfileForm
          user={mockUser}
          profile={mockProfile}
          userRole="authenticated"
        />
      );

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toBeDisabled();
    });
  });
});

