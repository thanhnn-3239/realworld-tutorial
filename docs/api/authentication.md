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

| | `accessToken` | `refreshToken` |
| --- | --- | --- |
| Send it as | `Authorization: Bearer <accessToken>` | the body of `POST /v1/auth/refresh` |
| Lifetime | 15 minutes | 30 days |
| Reusable | yes, until it expires | **no — single use** |
| Carries | only the user id | nothing; it is opaque random bytes |

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

| Status | Cause                                                              |
| ------ | ------------------------------------------------------------------ |
| `401`  | Token unknown, expired, revoked, or already spent                  |
| `422`  | `refreshToken` missing or empty                                    |

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

| | |
| --- | --- |
| **Start** | `GET /v1/auth/google` → `302` to the Google consent screen |
| **Callback** | `GET /v1/auth/google/callback` → `200` with the same body as login |

The callback answers with JSON rather than redirecting with tokens in the query string, which
would put credentials into browser history and access logs.

### Account linking

Signing in with Google using an address that already has a password account **links the two
and removes password login from that account**. This is deliberate: nothing in this API
verifies email ownership at registration, so anyone can register an address they do not own.
Clearing the password evicts whoever set the account up, at the moment the verified owner
arrives. Every existing session for that account is revoked in the same transaction.

There is currently **no endpoint to set a password again**, so such an account is Google-only
from then on.

If Google reports the address as unverified, the request fails with `409` and nothing changes.

**Errors:**

| Status | Cause                                                                     |
| ------ | ------------------------------------------------------------------------- |
| `404`  | Google is not configured on this deployment                               |
| `409`  | The email already has an account and Google did not verify the address    |
