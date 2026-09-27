
export function getUserId() {
  let id = sessionStorage.getItem('userId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('userId', id);
  }
  return id;
}
