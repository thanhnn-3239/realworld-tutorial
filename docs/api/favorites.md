# Favorites

## Favorite Article

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/articles/:slug/favorite` |
| **Auth** | Yes |

**Response:** `Article` object with `favorited: true`.

---

## Unfavorite Article

| | |
|---|---|
| **Method** | `DELETE` |
| **Endpoint** | `/articles/:slug/favorite` |
| **Auth** | Yes |

**Response:** `Article` object with `favorited: false`.
