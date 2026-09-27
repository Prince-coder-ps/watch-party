# Test case purposes

## permissions.test.js

| Test | Purpose |
| --- | --- |
| `canControlPlayback allows host and moderator` | Confirms Host and Moderator are both allowed to control playback |
| `canControlPlayback denies a plain participant` | Confirms a Participant is blocked from controlling playback |
| `canControlPlayback denies unknown/garbage roles` | Confirms unrecognized/empty/undefined roles are safely denied, not accidentally allowed |
| `canManageParticipants allows only the host` | Confirms only the Host (not Moderator, not Participant) can manage participants |

## youtube.test.js

| Test | Purpose |
| --- | --- |
| `accepts a bare video ID` | Confirms a raw 11-char video ID passes through unchanged |
| `parses the standard watch URL` | Confirms `youtube.com/watch?v=...` links are parsed correctly |
| `parses a watch URL with extra query params` | Confirms extra params like `&t=` or `&list=` don't break ID extraction |
| `parses the youtu.be short link` | Confirms the `youtu.be/...` short-link format is parsed correctly |
| `parses youtu.be with a trailing query string` | Confirms a `?t=` timestamp on a short link doesn't break ID extraction |
| `parses embed / shorts / live URLs` | Confirms `/embed/`, `/shorts/`, and `/live/` URL forms all extract the ID |
| `parses mobile (m.youtube.com) and music.youtube.com hosts` | Confirms alternate YouTube subdomains are recognized |
| `works without an explicit https:// prefix` | Confirms a URL pasted without `https://` still parses |
| `rejects empty/missing input` | Confirms empty string, `null`, and `undefined` all safely return `null` |
| `rejects a non-YouTube URL` | Confirms links from other sites (e.g. Vimeo) are rejected |
| `rejects a YouTube URL with no video id` | Confirms a YouTube URL that isn't actually pointing at a video returns `null` |
| `rejects garbage text` | Confirms non-URL text doesn't crash the parser and returns `null` |

## room.test.js

| Test | Purpose |
| --- | --- |
| `the host gets role "host" the first time they join` | Confirms the room creator is auto-assigned the Host role on first join |
| `everyone else starts as a plain participant` | Confirms any non-host joiner defaults to the Participant role |
| `a reconnecting user keeps whatever role they already had` | Confirms rejoining (e.g. after a refresh) doesn't reset a promoted user back to Participant |
| `getParticipantList never leaks the internal socketId` | Confirms the participant list sent to clients only exposes `userId`, `username`, `role` |
| `isEmpty reflects participant count` | Confirms the room correctly reports empty vs. non-empty as people join/leave |
| `play/pause/seek set the position and state exactly as given` | Confirms the three core playback actions update time/state correctly |
| `an invalid time (negative/NaN) falls back to the current extrapolated time instead of corrupting state` | Confirms bad/malicious time values can't corrupt the room's playback state |
| `getCurrentTime extrapolates forward while playing` | Confirms elapsed-time extrapolation gives the correct "live" position while playing |
| `getCurrentTime does NOT extrapolate while paused` | Confirms the position stays frozen when playback is paused |
| `changeVideo resets position to 0 and pauses` | Confirms switching videos always starts the new one from 0:00, paused |
| `getSyncState shape matches what clients expect` | Confirms the broadcast payload has exactly the fields the client relies on |
| `addRequest queues a request with a generated id` | Confirms a Participant's action gets queued with a unique request ID |
| `removeRequest drops just that one request` | Confirms approving/rejecting one request doesn't affect other pending requests |
| `removeRequestsByUser clears all of one user's pending requests (e.g. on removal/leave)` | Confirms a user's requests don't linger in the queue after they leave/are removed |
| `transferHost promotes the target and demotes the old host` | Confirms host transfer correctly swaps both users' roles |
| `transferHost fails cleanly if the target is not in the room` | Confirms transferring to a nonexistent user fails safely without changing state |
| `addChatMessage appends and getChatMessages returns them in order` | Confirms chat messages are stored and returned in the order they were sent |
| `chat history is capped at 50 messages, oldest dropped first` | Confirms chat memory usage stays bounded by trimming the oldest messages |
