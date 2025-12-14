/**
 * Staff feature module exports
 * 
 * Provides Zod schemas, types, and utilities for staff management
 */

export {
  // Schemas
  RoleSchema,
  StatusSchema,
  StaffSchema,
  StaffListResponseSchema,
  StaffDetailResponseSchema,
  CapabilitySchema,
  
  // Types
  type Role,
  type Status,
  type Staff,
  type StaffListResponse,
  type StaffDetailResponse,
  type Capability,
  
  // Utilities
  deriveCapabilities,
  hasCapability,
  formatStaffName,
} from "./schemas";
