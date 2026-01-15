# Articles

## List Articles (Paginated)
Returns a list of articles with filtering and pagination.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/articles` |
| **Auth** | Optional |

**Query Parameters:**
| Parameter | Description | Default |
|---|---|---|
| `tag` | Filter by tag | - |
| `author` | Filter by author username | - |
| `favorited` | Filter by user who favorited | - |
| `limit` | Number of articles to return | 10 |
| `page` | Page number | 1 |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Articles retrieved successfully",
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "last_page": 10,
    "limit": 10,
    "has_next_page": true,
    "has_prev_page": false
  }
}
```

---

## Feed Articles
Returns articles from followed users only.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/articles/feed` |
| **Auth** | Yes |

**Query Parameters:** `limit`, `page`

**Response:** Same format as List Articles with pagination.

---

## Get Article
Returns a single article by slug.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/articles/:slug` |
| **Auth** | No |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Article retrieved successfully",
  "data": {
    "slug": "how-to-train-your-dragon",
    "title": "How to train your dragon",
    "description": "Ever wonder how?",
    "body": "It takes a Jacobian",
    "tagList": ["dragons", "training"],
    "createdAt": "2016-02-18T03:22:56.637Z",
    "updatedAt": "2016-02-18T03:48:35.824Z",
    "favorited": false,
    "favoritesCount": 0,
    "author": {
      "username": "jake",
      "bio": "I work at statefarm",
      "image": "https://i.stack.imgur.com/xHWG8.jpg",
      "following": false
    }
  }
}
```

---

## Create Article

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/articles` |
| **Auth** | Yes |

**Request Body:**
```json
{
  "title": "How to train your dragon",
  "description": "Ever wonder how?",
  "body": "You have to believe",
  "tagList": ["reactjs", "angularjs", "dragons"]
}
```

**Required Fields:** `title`, `description`, `body`
**Optional Fields:** `tagList`

**Response:**
```json
{
  "statusCode": 201,
  "message": "Article created successfully",
  "data": { ... }
}
```

---

## Update Article

| | |
|---|---|
| **Method** | `PUT` |
| **Endpoint** | `/articles/:slug` |
| **Auth** | Yes |

**Request Body:**
```json
{
  "title": "Did you train your dragon?"
}
```

**Optional Fields:** `title`, `description`, `body`

> **Note:** The `slug` is regenerated when the `title` changes.

**Response:**
```json
{
  "statusCode": 200,
  "message": "Article updated successfully",
  "data": { ... }
}
```

---

## Delete Article

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/articles/:slug` |
| **Auth** | Yes |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Article deleted successfully",
  "data": null
}
```
