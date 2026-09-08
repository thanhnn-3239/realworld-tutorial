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
  "username": "jake",
  "bio": "I like to skateboard",
  "image": "https://i.stack.imgur.com/xHWG8.jpg"
}
```

**Accepted Fields:**

| Field      | Rules                                | Sending `null`   |
| ---------- | ------------------------------------ | ---------------- |
| `username` | 3-30 characters, unique across users | `422`            |
| `bio`      | Any string                           | Clears the field |
| `image`    | Valid URL                            | Clears the field |

`username` maps to a non-nullable column, so `null` is rejected at validation rather
than silently ignored - omit the field instead to leave it unchanged. `bio` and `image`
are nullable, so `null` clears the stored value.

**Credentials are not profile fields.** `email` and `password` are no longer accepted
here. Sending them returns `200` and changes nothing: unknown fields are stripped before
validation, so no error says they were ignored. There is currently no endpoint for
changing either one.

**Errors:**

| Status | Cause                                                       |
| ------ | ----------------------------------------------------------- |
| `401`  | Missing or invalid token                                    |
| `409`  | `username` already in use by another user                   |
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
