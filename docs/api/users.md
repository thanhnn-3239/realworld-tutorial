# Users

## Get Current User

Returns the currently logged-in user.

|              |         |
| ------------ | ------- |
| **Method**   | `GET`   |
| **Endpoint** | `/user` |
| **Auth**     | Yes     |

**Response:**

```json
{
  "statusCode": 200,
  "message": "User retrieved successfully",
  "data": {
    "email": "jake@jake.jake",
    "username": "jake",
    "bio": "I work at statefarm",
    "image": null
  }
}
```

---

## Update User (Settings)

Updates user profile settings.

|              |         |
| ------------ | ------- |
| **Method**   | `PUT`   |
| **Endpoint** | `/user` |
| **Auth**     | Yes     |

**Request Body:** every field is optional; only the fields you send are updated.

```json
{
  "email": "jake@jake.jake",
  "username": "jake",
  "password": "new-password",
  "bio": "I like to skateboard",
  "image": "https://i.stack.imgur.com/xHWG8.jpg"
}
```

**Accepted Fields:**

| Field      | Rules                                                              | Sending `null`   |
| ---------- | ------------------------------------------------------------------ | ---------------- |
| `email`    | Valid email address, unique across users                           | `422`            |
| `username` | 3-30 characters, unique across users                               | `422`            |
| `password` | 6-30 characters. Hashed with bcrypt before storage; never returned | `422`            |
| `bio`      | Any string                                                         | Clears the field |
| `image`    | Valid URL                                                          | Clears the field |

`email`, `username` and `password` map to non-nullable columns, so `null` is rejected
at validation rather than silently ignored - omit the field instead to leave it
unchanged. `bio` and `image` are nullable, so `null` clears the stored value.

**Errors:**

| Status | Cause                                                       |
| ------ | ----------------------------------------------------------- |
| `401`  | Missing or invalid token                                    |
| `409`  | `email` or `username` already in use by another user        |
| `422`  | Validation error, including `null` for a non-nullable field |

**Response:**

```json
{
  "statusCode": 200,
  "message": "User updated successfully",
  "data": {
    "email": "jake@jake.jake",
    "username": "jake",
    "bio": "I like to skateboard",
    "image": "https://i.stack.imgur.com/xHWG8.jpg"
  }
}
```
