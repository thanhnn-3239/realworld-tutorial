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
