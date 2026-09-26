// ---------------------------------------------------------------------------
// FEATURE: gives this browser a stable, persistent userId (a UUID stored in
// localStorage). This is how we recognize "the same person" across page
// refreshes/reconnects, and how the server decides who the host is.
// ---------------------------------------------------------------------------
export function getUserId() {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('userId', id);
  }
  return id;
}
