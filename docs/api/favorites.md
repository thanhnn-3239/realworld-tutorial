# Favorites

## Favorite Article

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/articles/:slug/favorite` |
| **Auth** | Yes |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Article favorited successfully",
  "data": {
    "slug": "how-to-train-your-dragon",
    "title": "How to train your dragon",
    "favorited": true,
    "favoritesCount": 1,
    ...
  }
}
```

---

## Unfavorite Article

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/articles/:slug/favorite` |
| **Auth** | Yes |

**Response:**
```json
{
  "statusCode": 200,
  "message": "Article unfavorited successfully",
  "data": {
    "slug": "how-to-train-your-dragon",
    "title": "How to train your dragon",
    "favorited": false,
    "favoritesCount": 0,
    ...
  }
}
```

---

## Semantics

`favorited` is resolved against the **bearer token of the request**, never against
the article's author. Without a token it is always `false`. `favoritesCount` is
global — every viewer sees the same number for the same article.

Both endpoints are idempotent. Favoriting an already-favorited article returns
`200` with `favorited: true`; unfavoriting an article you never favorited returns
`200` with `favorited: false`. Neither no-op is an error.

Favoriting **your own article is allowed**. This differs from `POST
/profiles/:username/follow`, which rejects the self-edge with `422`.

### Error Cases

| Error                      | Status | Message             |
| -------------------------- | ------ | ------------------- |
| Missing or malformed token | 401    | `Unauthorized`      |
| Article not found          | 404    | `Article not found` |
