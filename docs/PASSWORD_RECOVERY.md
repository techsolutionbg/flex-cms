# Password recovery

The admin login contains a forgotten-password flow: email, six-digit code, new password. No automatic login follows a reset.

## Local development

Mailpit is already part of `compose.yaml`. Its published SMTP and web ports bind to 127.0.0.1. There is no configured relay or forwarding to real recipients.

```
MAILER_DSN=smtp://mailpit:1025
MAIL_FROM_ADDRESS=noreply@localhost
MAIL_FROM_NAME="Flex CMS"
```

When PHP runs outside Docker, use `smtp://127.0.0.1:1025` instead. Open http://localhost:8025 to inspect captured messages. Start the service with `docker compose up -d mailpit`.

## Production

Use the same Symfony Mailer implementation with a real SMTP DSN and an authorized sender, by changing the active environment file only:

```
MAILER_DSN="smtp://USERNAME:URL_ENCODED_PASSWORD@smtp.example.com:587?require_tls=true"
MAIL_FROM_ADDRESS=noreply@example.com
MAIL_FROM_NAME="Flex CMS"
```

Credentials containing reserved URI characters must be URL encoded. Follow the provider's TLS/port requirements (e.g. `smtps://` for implicit TLS). Never use `verify_peer=0` in production. Mailpit is for local development and should not be exposed publicly.

The application loads `storage/.env` in preference to a root `.env` when present. Change the active file, and refresh any enabled configuration cache/restart long-running processes after changing mail settings. No PHP or React edits are required to switch transport.

## Security and behavior

- Requests return the same 202 message for unknown, deleted, disabled, non-admin and eligible email addresses.
- Codes expire after 15 minutes, allow at most five verification attempts, and are stored as HMAC hashes using APP_KEY.
- Resend requires at least 60 seconds; at most five requests per email and twenty per IP are accepted per 15 minutes. Verification and reset each allow thirty requests per IP per 15 minutes.
- A successful code verification consumes the code and returns a random reset grant lasting five minutes. Only its HMAC hash is stored in the database. The raw grant stays in React memory, never localStorage or a URL.
- Password reset is transactional, invalidates all outstanding recovery requests and increments `users.auth_version`; existing sessions are rejected on their next request. Existing version-zero sessions remain compatible before the first reset.
- Passwords must match, contain at least twelve characters, and fit within the password hasher's 72-byte input limit.
- The three POST endpoints `/api/auth/password/request`, `/verify` and `/reset` require CSRF protection. They do not require a logged-in session.
- Failed SMTP delivery invalidates the generated code and logs a generic operational error without a code, password or mail credentials. The user-facing request response remains uniform.
- Recovery does not activate an account or bypass required email verification.

Apply migrations through the regular deployment migration process. Development migration was applied with `vendor/bin/phinx migrate -c phinx.php`.

## Validation

`vendor/bin/phpunit tests/Auth` covers the full service flow, expiry, replay, retries, missing/disabled users, password confirmation and session invalidation. A temporary local HTTP probe additionally verified delivery to Mailpit, old-session rejection, old/new-password login and reset-token replay; its account, message and script were removed.