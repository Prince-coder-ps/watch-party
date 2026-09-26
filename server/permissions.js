// ---------------------------------------------------------------------------
// FEATURE: Role-based access control (RBAC) rules, kept in one place.
// Every handler that needs a permission check imports from here instead of
// hardcoding role names, so the rules are easy to change/audit.
// ---------------------------------------------------------------------------

// Roles allowed to control playback (play/pause/seek/change video) directly
const CONTROL_ROLES = ['host', 'moderator'];

function canControlPlayback(role) {
  return CONTROL_ROLES.includes(role);
}

// Only the host can assign roles or remove participants
function canManageParticipants(role) {
  return role === 'host';
}

module.exports = { canControlPlayback, canManageParticipants };
