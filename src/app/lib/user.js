export const DEFAULT_ADMIN_EMAIL = 'aygunaliyeva@anas.az';
export const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
export const USER_ROLE_ADMIN = 'admin';
export const USER_ROLE_LEARNER = 'learner';

export function normalizeUserRole(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_LEARNER;
}

export function isAdminRole(value) {
  return normalizeUserRole(value) === USER_ROLE_ADMIN;
}