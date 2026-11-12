# Layout rules
- Shared dialogs constrain width and height to the dynamic viewport and scroll internally so all forms remain reachable on phones.
- Wide data tables and tab strips scroll within their own container rather than widening the page; page grids and flex children must permit shrinking.
- Mobile adaptations preserve desktop layouts and existing permissions and business logic.
- Manual controller actions use an authenticated edge function and a permission-checked transactional RPC, then the existing dispatcher; ON always queues a capped stop timer, and OFF cancels queued starts. This keeps credentials server-side and preserves scheduled retries.
- Sidebar alert notifications use user-and-organisation-scoped query caching with polling and refresh on opening, rather than realtime channels, to avoid duplicate subscription callbacks; read actions invalidate that cache.
- Alert feeds use server-side organisation, read-status and sensor filtering with counted pagination; zone filters resolve to the zone's sensors so every unread alert remains accessible beyond the recent feed limit.
- Shared CardContent includes top padding by default because standalone cards have no header; header-based compact sections may explicitly opt out to keep card content clear of borders.
- Field-map reading dialogs fetch the selected sensor's latest organisation-scoped reading with polling while open; distinguish taps from drags so viewing data never changes placement.

