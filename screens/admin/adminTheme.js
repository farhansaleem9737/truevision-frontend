// truevision/screens/admin/adminTheme.js
// Fixed dark palette for the hidden admin panel — deliberately independent of
// the user-facing ThemeContext so the panel always looks like an admin console.

export const A = {
  bg:      '#0B0F14',
  card:    '#151B23',
  card2:   '#1C242E',
  border:  '#232C38',
  text:    '#E7EDF3',
  sub:     '#A7B4C2',
  dim:     '#6B7A8B',
  accent:  '#3B82F6',
  green:   '#22C55E',
  red:     '#EF4444',
  amber:   '#F59E0B',
};

// Per-review-state accent.
export const STATE_COLOR = {
  processing:        A.amber,
  pending_review:    A.amber,
  blocked:           A.red,
  rejected:          A.red,
  changes_requested: A.amber,
  approved:          A.green,
  pending:           A.amber,
};
