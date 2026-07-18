// truevision/constants/supportCategories.js
//
// Client mirror of the SupportTicket category enum (Backend/models/SupportTicket.js).
// Used by the Contact and Report forms' category pickers.

export const CONTACT_CATEGORIES = [
  { key: 'account',       label: 'Account' },
  { key: 'videos',        label: 'Videos' },
  { key: 'comments',      label: 'Comments' },
  { key: 'messaging',     label: 'Messaging' },
  { key: 'privacy',       label: 'Privacy' },
  { key: 'security',      label: 'Security' },
  { key: 'uploads',       label: 'Uploads' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'payments',      label: 'Payments' },
  { key: 'other',         label: 'Other' },
];

// Report a Problem lets the user tag which area the bug is in (category stays
// 'bug' by default on the backend if none chosen).
export const REPORT_CATEGORIES = CONTACT_CATEGORIES.filter((c) => c.key !== 'payments');
