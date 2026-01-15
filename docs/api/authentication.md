# Authentication

## Registration (Sign Up)
Creates a new user account.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/users` |
| **Auth** | No |

**Request Body:**
```json
{
  "username": "jacob",
  "email": "jake@jake.jake",
  "password": "jakejake"
}
```

**Required Fields:** `email`, `username`, `password`

**Response:**
```json
{
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "email": "jake@jake.jake",
    "token": "jwt.token.here",
    "username": "jake",
    "bio": null,
    "image": null
  }
}
```

---

## Login
Authenticates an existing user.

| | |
|---|---|
| **Method** | `POST` |
| **Endpoint** | `/users/login` |
| **Auth** | No |

**Request Body:**
```json
{
  "email": "jake@jake.jake",
  "password": "jakejake"
}
```

**Required Fields:** `email`, `password`

**Response:**
```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "email": "jake@jake.jake",
    "token": "jwt.token.here",
    "username": "jake",
    "bio": "I work at statefarm",
    "image": null
  }
}
```
