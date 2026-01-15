# Users

## Get Current User
Returns the currently logged-in user.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/user` |
| **Auth** | Yes |

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

| | |
|---|---|
| **Method** | `PUT` |
| **Endpoint** | `/user` |
| **Auth** | Yes |

**Request Body:**
```json
{
  "email": "jake@jake.jake",
  "bio": "I like to skateboard",
  "image": "https://i.stack.imgur.com/xHWG8.jpg"
}
```

**Accepted Fields:** `email`, `username`, `password`, `image`, `bio`

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
