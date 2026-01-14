# Comments

## Get Comments
Returns all comments for an article.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/articles/:slug/comments` |
| **Auth** | Optional |

**Response:** `{ comments: [...] }`

---

## Add Comment

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/articles/:slug/comments` |
| **Auth** | Yes |

**Request Body:**
```json
{
  "comment": {
    "body": "His name was my name too."
  }
}
```

**Required Fields:** `body`

**Response:** Created `Comment` object.

---

## Delete Comment

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/articles/:slug/comments/:id` |
| **Auth** | Yes |

**Response:** `204 No Content`

---

## Response Format

```json
{
  "comment": {
    "id": 1,
    "createdAt": "2016-02-18T03:22:56.637Z",
    "updatedAt": "2016-02-18T03:22:56.637Z",
    "body": "It takes a Jacobian",
    "author": {
      "username": "jake",
      "bio": "I work at statefarm",
      "image": "https://i.stack.imgur.com/xHWG8.jpg",
      "following": false
    }
  }
}
```
