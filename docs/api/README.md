# API Documentation

This folder contains the API documentation for the RealWorld application.

**Base URL:** `/api`
**API Version Prefix:** `/v1`

## Authentication Header
All authenticated endpoints require:
```
Authorization: Token jwt.token.here
```

## Common Response Format

All API responses follow a standardized format:

### Success Response
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": { ... }
}
```

### Success Response with Pagination
```json
{
  "statusCode": 200,
  "message": "Success",
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

### Error Response
```json
{
  "statusCode": 422,
  "message": "Validation Error",
  "errors": {
    "email": "email must be an email",
    "password": "password is too short"
  }
}
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
