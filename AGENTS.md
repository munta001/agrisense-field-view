# Layout rules
- Shared dialogs constrain width and height to the dynamic viewport and scroll internally so all forms remain reachable on phones.
- Wide data tables and tab strips scroll within their own container rather than widening the page; page grids and flex children must permit shrinking.
- Mobile adaptations preserve desktop layouts and existing permissions and business logic.
- WhatsApp alert notifications: an AFTER INSERT trigger on alerts calls the send-whatsapp-alert function, which claims the alert via whatsapp_sent_at and sends the approved Meta template to active org admins' profile phones — keeps alert creation non-blocking and sends at most once.
- Manual controller actions use an authenticated edge function and a permission-checked transactional RPC, then the existing dispatcher; ON always queues a capped stop timer, and OFF cancels queued starts. This keeps credentials server-side and preserves scheduled retries.
- Sidebar alert notifications use user-and-organisation-scoped query caching with polling and refresh on opening, rather than realtime channels, to avoid duplicate subscription callbacks; read actions invalidate that cache.

