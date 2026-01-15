# Comments

## Get Comments
Returns all comments for an article.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/articles/:slug/comments` |
| **Auth** | Optional |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Comments retrieved successfully",
  "data": [
    {
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
  ]
}
```

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
  "body": "His name was my name too."
}
```

**Required Fields:** `body`

**Response:**
```json
{
  "statusCode": 201,
  "message": "Comment created successfully",
  "data": {
    "id": 1,
    "createdAt": "2016-02-18T03:22:56.637Z",
    "updatedAt": "2016-02-18T03:22:56.637Z",
    "body": "His name was my name too.",
    "author": { ... }
  }
}
```

---

## Delete Comment

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/articles/:slug/comments/:id` |
| **Auth** | Yes |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Comment deleted successfully",
  "data": null
}
```
