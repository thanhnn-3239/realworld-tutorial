# Profiles

## Get Profile

Returns a user's public profile.

|              |                       |
| ------------ | --------------------- |
| **Method**   | `GET`                 |
| **Endpoint** | `/profiles/:username` |
| **Auth**     | Optional              |

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

This operation is idempotent. Following an already-followed user returns the
current profile with `following: true` without creating another relation.

|              |                              |
| ------------ | ---------------------------- |
| **Method**   | `POST`                       |
| **Endpoint** | `/profiles/:username/follow` |
| **Auth**     | Yes                          |

**Response:**

```json
{
  "statusCode": 200,
  "message": "Followed successfully",
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

This operation is idempotent. Unfollowing a user who is not currently followed
returns the current profile with `following: false`.

|              |                              |
| ------------ | ---------------------------- |
| **Method**   | `DELETE`                     |
| **Endpoint** | `/profiles/:username/follow` |
| **Auth**     | Yes                          |

**Response:**

```json
{
  "statusCode": 200,
  "message": "Unfollowed successfully",
  "data": {
    "username": "jake",
    "bio": "I work at statefarm",
    "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
    "following": false
  }
}
```
