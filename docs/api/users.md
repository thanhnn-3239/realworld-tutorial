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

Accepts either `application/json` or `multipart/form-data`.

- Send JSON to update `username` and/or `bio`.
- Send `multipart/form-data` with a file in the `image` field to set or replace the avatar
  (see [Uploading an avatar](#uploading-an-avatar)).
- Send JSON with `image` set to `null` to remove the avatar. This is the only way `image`
  accepts a value directly — any other string returns `422`. `multipart/form-data` cannot
  express `null`, so removing an avatar is JSON-only.
- Omit `image` entirely to leave the avatar unchanged.

**Request Body:** every field is optional; only the fields you send are updated.

```json
{
  "username": "jake",
  "bio": "I like to skateboard"
}
```

To remove the avatar instead:

```json
{
  "image": null
}
```

**Accepted Fields:**

| Field      | Rules                                                    | Sending `null`             |
| ---------- | --------------------------------------------------------- | --------------------------- |
| `username` | 3-30 characters, unique across users                       | `422`                        |
| `bio`      | Any string                                                 | Clears the field             |
| `image`    | Set only via multipart file upload; JSON accepts only `null`, any other value returns `422` | Clears the field (removes the avatar) |

`username` maps to a non-nullable column, so `null` is rejected at validation rather
than silently ignored - omit the field instead to leave it unchanged. `bio` is nullable,
so `null` clears the stored value. `image` in a response is always an absolute URL,
regardless of how the avatar was set.

**Credentials are not profile fields.** `email` and `password` are no longer accepted
here. Sending them returns `200` and changes nothing: unknown fields are stripped before
validation, so no error says they were ignored. There is currently no endpoint for
changing either one.

### Uploading an avatar

Send the request as `multipart/form-data` with the file in the `image` field. The
other fields travel as ordinary form fields.

| Constraint     | Value                                                |
| -------------- | ---------------------------------------------------- |
| Field name     | `image`                                              |
| Maximum size   | 5 MiB                                                |
| Accepted types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |

The uploaded filename never appears in the returned URL. The response `image` is
always the current public URL of the stored avatar.

### Replacement lifecycle

Uploading a new avatar replaces the previous one; the previous avatar is removed
after the update succeeds. The ordering is deliberate:

1. The `username` conflict check runs first, so a rejected request never uploads
   a file.
2. The file is uploaded before the database transaction opens, so no row lock is
   held across the network call.
3. One transaction updates the user row with the new avatar. This serializes
   concurrent replacements of the same user, so two uploads racing for the same
   account are still applied one after the other.
4. Only after that transaction commits is the previous avatar deleted.

If the transaction fails, the newly uploaded file is deleted and the original
error is returned; the previous avatar is untouched. If deleting the previous
avatar fails after a successful update, the request still returns `200` —
cleanup failures are logged and never surface in the response.

**Errors:**

| Status | Cause                                                              |
| ------ | ------------------------------------------------------------------- |
| `401`  | Missing or invalid token                                            |
| `409`  | `username` already in use by another user                           |
| `413`  | Uploaded file exceeds 5 MiB                                         |
| `422`  | Validation error, including `null` for `username` and any non-`null` value for `image` |
| `400`  | Uploaded file has an unsupported MIME type                          |
| `502`  | The file upload was rejected by storage                             |

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
