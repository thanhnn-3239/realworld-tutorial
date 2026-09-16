# Authentication

## Registration (Sign Up)

Creates a new user account.

|              |                     |
| ------------ | ------------------- |
| **Method**   | `POST`              |
| **Endpoint** | `/v1/auth/register` |
| **Auth**     | No                  |

**Request Body:**

```json
{
  "username": "jacob",
  "email": "jake@jake.jake",
  "password": "jakejake"
}
```

**Required Fields:** `email`, `username`, `password`

**Response:**

```json
{
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "email": "jake@jake.jake",
    "username": "jake",
    "accessToken": "jwt.access.token",
    "refreshToken": "q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU",
    "bio": null,
    "image": null
  }
}
```

---

## Login

Authenticates an existing user.

|              |                  |
| ------------ | ---------------- |
| **Method**   | `POST`           |
| **Endpoint** | `/v1/auth/login` |
| **Auth**     | No               |

**Request Body:**

```json
{
  "email": "jake@jake.jake",
  "password": "jakejake"
}
```

**Required Fields:** `email`, `password`

**Response:**

```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "email": "jake@jake.jake",
    "username": "jake",
    "accessToken": "jwt.access.token",
    "refreshToken": "q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU",
    "bio": "I work at statefarm",
    "image": null
  }
}
```

## Tokens

Register and login both return two tokens. They are not interchangeable.

|            | `accessToken`                         | `refreshToken`                      |
| ---------- | ------------------------------------- | ----------------------------------- |
| Send it as | `Authorization: Bearer <accessToken>` | the body of `POST /v1/auth/refresh` |
| Lifetime   | 15 minutes                            | 30 days                             |
| Reusable   | yes, until it expires                 | **no — single use**                 |
| Carries    | only the user id                      | nothing; it is opaque random bytes  |

The access token deliberately carries no email or username: both are mutable, so a token
holding them would serve stale values for as long as it lived. Read the current profile from
`GET /v1/user` instead.

---

## Refresh

Exchanges a refresh token for a new pair.

|              |                    |
| ------------ | ------------------ |
| **Method**   | `POST`             |
| **Endpoint** | `/v1/auth/refresh` |
| **Auth**     | No                 |

**Request Body:**

```json
{ "refreshToken": "q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU" }
```

**Response:** `200` with a new pair, and no profile fields — rotating a token says nothing
new about the profile.

```json
{
  "statusCode": 200,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "jwt.access.token",
    "refreshToken": "NEW-q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKl"
  }
}
```

**The presented token is spent.** Store the new one and discard the old immediately.

> **Never retry a failed refresh with the same value.** Presenting an already-rotated token is
> treated as a stolen copy: it revokes **every** session for that user, including the one the
> successful rotation just created. A 401 from this endpoint means start over at login.

**Errors:**

| Status | Cause                                             |
| ------ | ------------------------------------------------- |
| `401`  | Token unknown, expired, revoked, or already spent |
| `422`  | `refreshToken` missing or empty                   |

---

## Logout

Revokes one refresh token.

|              |                   |
| ------------ | ----------------- |
| **Method**   | `POST`            |
| **Endpoint** | `/v1/auth/logout` |
| **Auth**     | No                |

**Request Body:**

```json
{ "refreshToken": "q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU" }
```

**Response:** `204`, no body.

Idempotent: an unknown or already-revoked token also returns `204`, because the caller is
logged out either way. It revokes only the token presented — other sessions keep working.

---

## Google sign-in

Optional. All three of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL`
must be set; with any of them blank both routes return `404` and the rest of the API is
unaffected.

|              |                                                                    |
| ------------ | ------------------------------------------------------------------ |
| **Start**    | `GET /v1/auth/google` → `302` to the Google consent screen         |
| **Callback** | `GET /v1/auth/google/callback` → `200` with the same body as login |

The callback answers with JSON rather than redirecting with tokens in the query string, which
would put credentials into browser history and access logs.

### Account linking & collision handling

Signing in with Google using an address that matches an existing password account **requires
email confirmation** before the Google identity can be linked. An email collision **never**
clears passwords, revokes existing sessions, or issues application tokens.

1. **Collision callback:**
   When Google credentials match an existing account that has not yet linked this Google identity:
   - Returns `202 Accepted` with payload `{ "status": "confirmation_required" }`.
   - Generates a single-use 32-byte cryptographically random token valid for 15 minutes.
   - Enqueues a background email delivery job via BullMQ and Redis.
   - Enforces a 60-second resend cooldown before rotating the token.
   - The user receives an email containing a link to the frontend confirmation page with `?token=...`.

2. **Confirmation endpoint (`POST /v1/auth/google/link/confirm`):**
   The frontend posts the raw confirmation token to complete the link:

   |              |                                |
   | ------------ | ------------------------------ |
   | **Method**   | `POST`                         |
   | **Endpoint** | `/v1/auth/google/link/confirm` |
   | **Auth**     | No                             |

   **Request Body:**

   ```json
   {
     "token": "43-character-base64url-token"
   }
   ```

   **Response:** `200 OK`

   ```json
   {
     "statusCode": 200,
     "message": "Provider link confirmed successfully",
     "data": {
       "confirmed": true
     }
   }
   ```

   Confirmation creates the `AuthProvider` link atomically and consumes the pending token. It
   does **not** issue access or refresh tokens; the user starts Google login again to sign in.
   The account's existing password and active sessions remain intact throughout.

**Errors:**

| Status | Cause                                                                       |
| ------ | --------------------------------------------------------------------------- |
| `400`  | Token unknown, expired, or already consumed (generic error)                 |
| `404`  | Google OAuth is not configured on this deployment                           |
| `409`  | Google email unverified, or Google account already attached to another user |
| `422`  | `token` missing or invalid format (must be 43 characters)                   |
| `503`  | Queue backend unavailable during callback collision handling                |

### Queue & Email Operator Notes

- **Delivery semantics:** Email delivery is backgrounded via BullMQ and Redis with 3 retry
  attempts and exponential backoff. Delivery is at-least-once; transient SMTP network issues
  may cause duplicate delivery, but confirmation remains idempotent and single-use.
- **Environment configuration:**
  - `REDIS_URL`: Connection string for Redis queue backend (`redis://` or `rediss://`).
  - `REDIS_PREFIX`: Application-level prefix for Redis queue keys (default: `realworld`).
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: Outbound SMTP server settings.
  - `SMTP_SECURE`, `SMTP_REQUIRE_TLS`: TLS encryption flags (production enables at least one).
  - `MAIL_FROM`: Envelope sender address (e.g. `no-reply@realworld.test`).
  - `GOOGLE_LINK_CONFIRM_URL`: Trusted frontend confirmation base URL.
- **Production requirement:** Production deployments require managed Redis and SMTP services;
  local Docker Compose provides Redis and Mailpit for development and testing.
