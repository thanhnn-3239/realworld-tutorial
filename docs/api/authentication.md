# Authentication

## Registration (Sign Up)
Creates a new user account.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/users` |
| **Auth** | No |

**Request Body:**
```json
{
  "user": {
    "username": "jacob",
    "email": "jake@jake.jake",
    "password": "jakejake"
  }
}
```

**Required Fields:** `email`, `username`, `password`

**Response:** `User` object with JWT token.

---

## Login
Authenticates an existing user.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/users/login` |
| **Auth** | No |

**Request Body:**
```json
{
  "user": {
    "email": "jake@jake.jake",
    "password": "jakejake"
  }
}
```

**Required Fields:** `email`, `password`

**Response:** `User` object with JWT token.

---

## Response Format

```json
{
  "user": {
    "email": "jake@jake.jake",
    "token": "jwt.token.here",
    "username": "jake",
    "bio": "I work at statefarm",
    "image": null
  }
}
```
