# Articles

## List Articles (Paginated)

Returns a list of articles with filtering and pagination.

|              |             |
| ------------ | ----------- |
| **Method**   | `GET`       |
| **Endpoint** | `/articles` |
| **Auth**     | Optional    |

**Query Parameters:**
| Parameter | Description | Default |
|---|---|---|
| `tag` | Filter by tag | - |
| `author` | Filter by author username | - |
| `favorited` | Filter by user who favorited | - |
| `limit` | Number of articles to return | 10 |
| `page` | Page number | 1 |

Articles are always returned newest first (`createdAt` descending). Filters
combine with AND. A filter naming a tag or user that does not exist returns
`200` with an empty `data` and `total: 0` — not `404`. A `page` past
`last_page` also returns `200` with an empty `data`, but `meta` still reports
the real `total` — only the requested page comes back empty, `total` does not
drop to `0`. When `total` is `0`, `last_page` is `0` and `has_next_page` is
`false`. `has_prev_page` depends only on `page`, not on `total`: it is `false`
on page `1` and `true` on any higher page, even against a zero-match filter —
`?page=2&tag=nonexistent` still reports `has_prev_page: true`.

`tag` is trimmed and lowercased before matching, exactly as tags are on write,
so `?tag=Dragons` finds an article tagged `dragons`. A `tag` that normalizes to
nothing is treated as no filter. `author` and `favorited` match a username
exactly.

`limit` accepts `1..100` and `page` accepts `1` upwards; anything else answers
`422`.

> **Note:** `author.following` and `favorited` are viewer-aware: send a bearer
> token and they report whether you follow the author and whether you favorited
> the article, resolved in the same query as the article. Without a token both
> are `false`. `favoritesCount` is global — every viewer sees the same number.

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

|              |                  |
| ------------ | ---------------- |
| **Method**   | `GET`            |
| **Endpoint** | `/articles/feed` |
| **Auth**     | Yes              |

**Query Parameters:** `page` (default `1`), `limit` (default `10`, max `100`)

Returns articles whose author the caller follows, newest first. The caller's own
articles are excluded unless the caller follows themselves.

**Errors:** `401` missing or expired token, `422` invalid query parameter.

> **Note:** follow relationships are created by
> [#4 Public Profiles & Follow](https://github.com/thanhnn-3239/realworld-tutorial/issues/4),
> which is not yet implemented, so this endpoint returns an empty page for every
> caller until that lands.

**Response:** Same format as List Articles with pagination.

---

## Get Article

Returns a single article by slug.

|              |                   |
| ------------ | ----------------- |
| **Method**   | `GET`             |
| **Endpoint** | `/articles/:slug` |
| **Auth**     | Optional          |

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

**Errors:** `404` missing article.

---

## Create Article

|              |             |
| ------------ | ----------- |
| **Method**   | `POST`      |
| **Endpoint** | `/articles` |
| **Auth**     | Yes         |

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

**Errors:** `401` unauthenticated, `409` exhausted slug retry, `422` invalid
request.

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

|              |                   |
| ------------ | ----------------- |
| **Method**   | `PUT`             |
| **Endpoint** | `/articles/:slug` |
| **Auth**     | Yes               |

**Request Body:**

```json
{
  "title": "Did you train your dragon?"
}
```

**Optional Fields:** `title`, `description`, `body`, `tagList`

At least one optional field must be present. This endpoint performs a partial
update even though it uses `PUT`.

**Tag update semantics:**

- Omit `tagList` to preserve existing tags.
- Send `"tagList": []` to remove all tag links.
- Send a non-empty list to replace all tag links after normalization.

> **Note:** The `slug` is regenerated when the normalized title changes.

**Errors:** `401` unauthenticated, `403` non-author, `404` missing article,
`409` exhausted slug retry, `422` invalid or empty update.

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

|              |                   |
| ------------ | ----------------- |
| **Method**   | `DELETE`          |
| **Endpoint** | `/articles/:slug` |
| **Auth**     | Yes               |

**Response:**

```json
{
  "statusCode": 200,
  "message": "Article deleted successfully",
  "data": null
}
```

**Errors:** `401` unauthenticated, `403` non-author, `404` missing article.
