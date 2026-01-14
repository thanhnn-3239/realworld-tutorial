# Profiles

## Get Profile
Returns a user's public profile.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/profiles/:username` |
| **Auth** | Optional |

**Response:** `Profile` object.

---

## Follow User
Follow another user.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/profiles/:username/follow` |
| **Auth** | Yes |

**Response:** `Profile` object with `following: true`.

---

## Unfollow User
Unfollow a user.

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/profiles/:username/follow` |
| **Auth** | Yes |

**Response:** `Profile` object with `following: false`.

---

## Response Format

```json
{
  "profile": {
    "username": "jake",
    "bio": "I work at statefarm",
    "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
    "following": false
  }
}
```
