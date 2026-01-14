# API Documentation

This folder contains the API documentation for the RealWorld application.

**Base URL:** `/api`
**API Version Prefix:** `/v1`

## Authentication Header
All authenticated endpoints require:
```
Authorization: Token jwt.token.here
```

## Endpoints

| File | Description |
|------|-------------|
| [authentication.md](./authentication.md) | Login & Registration |
| [users.md](./users.md) | Current User & Settings |
| [profiles.md](./profiles.md) | User Profiles & Following |
| [articles.md](./articles.md) | CRUD Articles & Pagination |
| [comments.md](./comments.md) | Article Comments |
| [favorites.md](./favorites.md) | Favorite/Unfavorite Articles |
| [tags.md](./tags.md) | Tags List |
