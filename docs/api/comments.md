# Comments

## Get Comments

Returns all comments for an article.

Comments are returned newest first (`createdAt` descending, then `id`
descending to keep equal timestamps deterministic). A missing article returns
`404`; an article without comments returns `200` with an empty `data` array.

|              |                            |
| ------------ | -------------------------- |
| **Method**   | `GET`                      |
| **Endpoint** | `/articles/:slug/comments` |
| **Auth**     | Optional                   |

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

|              |                            |
| ------------ | -------------------------- |
| **Method**   | `POST`                     |
| **Endpoint** | `/articles/:slug/comments` |
| **Auth**     | Yes                        |

**Request Body:**

```json
{
  "body": "His name was my name too."
}
```

**Required Fields:** `body`

`body` must be a string containing at least one non-whitespace character and
must not exceed 255 characters.

**Errors:** `401` unauthenticated, `404` missing article, `422` invalid body.

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

|              |                                |
| ------------ | ------------------------------ |
| **Method**   | `DELETE`                       |
| **Endpoint** | `/articles/:slug/comments/:id` |
| **Auth**     | Yes                            |

Only the user who created the comment can delete it. A comment ID belonging to
another article is treated as not found, so it cannot be deleted through a
different article URL.

**Errors:** `401` unauthenticated, `403` non-author, `404` missing article or
comment.

**Response:**

```json
{
  "statusCode": 200,
  "message": "Comment deleted successfully",
  "data": null
}
```
