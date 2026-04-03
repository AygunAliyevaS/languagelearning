const processSupportEmail = typeof process !== 'undefined' ? process.env?.SUPPORT_EMAIL : undefined;
const viteSupportEmail = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPPORT_EMAIL : undefined;

export const SUPPORT_EMAIL = (processSupportEmail || viteSupportEmail || 'aygunaliyeva@anas.az').trim();
export const SUPPORT_RESPONSE_HOURS = 24;
export const SUPPORT_SUBJECT_MAX_LENGTH = 120;
export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;
export const SUPPORT_REPLY_MAX_LENGTH = 1200;

export const SUPPORT_CATEGORIES = [
  {
    id: 'general',
    label: 'General help',
    description: 'Billing, account questions, and product guidance.',
  },
  {
    id: 'technical',
    label: 'Technical issue',
    description: 'Broken flows, sync issues, or unexpected errors.',
  },
  {
    id: 'content',
    label: 'Lesson feedback',
    description: 'Report incorrect translations or suggest improvements.',
  },
  {
    id: 'privacy',
    label: 'Privacy request',
    description: 'Data access, correction, export, or deletion requests.',
  },
];

export function formatSupportTicketReference(value) {
  const normalized = String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);

  return normalized ? `AZ-${normalized}` : 'AZ-PENDING';
}

export function normalizeSupportTicketReference(value) {
  const normalized = String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);

  return normalized ? `AZ-${normalized}` : '';
}

export function createSupportTicketReference() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return formatSupportTicketReference(globalThis.crypto.randomUUID());
  }

  return formatSupportTicketReference(`${Date.now()}${Math.random().toString(36).slice(2, 10)}`);
}