# Profiles

## Get Profile
Returns a user's public profile.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/profiles/:username` |
| **Auth** | Optional |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "username": "jake",
    "bio": "I work at statefarm",
    "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
    "following": false
  }
}
```

---

## Follow User
Follow another user.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/profiles/:username/follow` |
| **Auth** | Yes |

**Response:**
```json
{
  "statusCode": 200,
  "message": "User followed successfully",
  "data": {
    "username": "jake",
    "bio": "I work at statefarm",
    "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
    "following": true
  }
}
```

---

## Unfollow User
Unfollow a user.

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/profiles/:username/follow` |
| **Auth** | Yes |

**Response:**
```json
{
  "statusCode": 200,
  "message": "User unfollowed successfully",
  "data": {
    "username": "jake",
    "bio": "I work at statefarm",
    "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
    "following": false
  }
}
```
