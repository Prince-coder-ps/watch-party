// kaun kya kar sakta hai, ek hi jagah define
const CONTROL_ROLES = ['host', 'moderator'];

function canControlPlayback(role) {
  return CONTROL_ROLES.includes(role);
}

function canManageParticipants(role) {
  return role === 'host';
}

module.exports = { canControlPlayback, canManageParticipants };