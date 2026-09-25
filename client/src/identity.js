// ek browser = ek userId. Reconnect/refresh pe same rehta hai
export function getUserId() {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('userId', id);
  }
  return id;
}