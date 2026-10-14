# Production Status

As confirmed by the owner on 2026-10-14, Parads has launched to the group.
People are registering and actively using the production app at parads.com.br.
Treat existing accounts, invitations, matches, reports, statistics, balances,
inventories and purchases as real data, not disposable test fixtures.

## Change Safety

- Preserve existing user data and compatibility with the deployed app.
- Do not reset, delete or bulk rewrite production data without explicit approval
  for the exact operation and scope. Previous test-cleanup approvals do not apply
  to current data.
- Test with mocks, emulators or explicitly designated test accounts. Do not reset
  a real user's password or modify their data just to validate a feature.
- Assess migrations and Firestore rule changes against existing accounts and
  workflows. Do not assume every user has newly introduced fields.
- Validate affected flows before publishing. Identify deployment dependencies,
  migration requirements and rollback options for changes that require them.
- Never commit credentials or expose server secrets to the browser.

Feature discussions are not implementation approval. In particular, the proposed
Community account type and its rewards remain ideas until explicitly requested.
