# Users

## Get Current User
Returns the currently logged-in user.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/user` |
| **Auth** | Yes |

**Response:** `User` object.

---

## Update User (Settings)
Updates user profile settings.

| | |
|---|---|
| **Method** | `PUT` |
| **Endpoint** | `/user` |
| **Auth** | Yes |

**Request Body:**
```json
{
  "user": {
    "email": "jake@jake.jake",
    "bio": "I like to skateboard",
    "image": "https://i.stack.imgur.com/xHWG8.jpg"
  }
}
```

**Accepted Fields:** `email`, `username`, `password`, `image`, `bio`

**Response:** Updated `User` object.

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
