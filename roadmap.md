# Mobile responsiveness
- [x] Open latest sensor readings from field-map markers and device buttons; verified real readings, refresh, dragging without opening the dialog, and phone layout without overflow.
- [x] Correct shared card spacing, narrow metric grids, and administration navigation/table layouts; organisation pages verified at 320, 390, 768 and 1280px. Signed-in master-admin verification remains blocked as noted below.
- [x] Show all unread alerts and add sensor and zone filters; verified all 245 Green Valley Farm unread alerts through the final page and both filters with real organisation data.
- [x] Improve shared layouts, navigation, dialogs, tabs, and table scrolling.
- [x] Adapt every farm page and its forms, charts, maps, and actions for phones.
- [x] Adapt all master-admin, profile, and sign-in pages for phones.
- [x] Verify organisation pages at 320, 768, and 1280px, including dialogs, sidebar navigation, report generation/download, and profile save.
- [ ] Verify master-admin pages with real data in the browser — blocked because approval to sign in as a master admin was declined. Source audit and navigation regression tests cover these changes instead.

# Manual automation and notifications
- [x] Add secure manual On/Off actions and zone alerts to Automation.
- [x] Add a sidebar bell with an unread badge and scrollable alert list matching the new reference; verified with real organisation alerts on desktop and phone, including navigation to Alerts.

- [x] Test role rules, alert-zone matching, and authenticated validation without sending physical commands.
- [ ] Verify physical controller On/Off end-to-end — requires permission to activate real equipment; organisation pages now verified signed-in, but physical commands have not been sent for testing.

# Integrations
- [x] Redeploy dispatch-automation so it loads the current secrets; 403 guard verified.
- [ ] Add organisation-admin WhatsApp settings and delivery verification using one platform Twilio account — waiting for the platform account connection.
- [x] Guide the user through creating the platform Twilio account, testing WhatsApp, registering a sender, preparing a template, and entering credentials privately.
