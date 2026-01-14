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
| `limit` | Number of articles to return | 20 |
| `offset` | Number of articles to skip | 0 |

**Response:** `{ articles: [...], articlesCount: number }`

---

## Feed Articles
Returns articles from followed users only.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/articles/feed` |
| **Auth** | Yes |

**Query Parameters:** `limit`, `offset`

**Response:** `{ articles: [...], articlesCount: number }`

---

## Get Article
Returns a single article by slug.

| | |
|---|---|
| **Method** | `GET` |
| **Endpoint** | `/articles/:slug` |
| **Auth** | No |

**Response:** `Article` object.

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
  "article": {
    "title": "How to train your dragon",
    "description": "Ever wonder how?",
    "body": "You have to believe",
    "tagList": ["reactjs", "angularjs", "dragons"]
  }
}
```

**Required Fields:** `title`, `description`, `body`
**Optional Fields:** `tagList`

**Response:** Created `Article` object.

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
  "article": {
    "title": "Did you train your dragon?"
  }
}
```

**Optional Fields:** `title`, `description`, `body`

> **Note:** The `slug` is regenerated when the `title` changes.

**Response:** Updated `Article` object.

---

## Delete Article

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/articles/:slug` |
| **Auth** | Yes |

**Response:** `204 No Content`

---

## Response Format

```json
{
  "article": {
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
