# Health Endpoint

## GET `/health`

Render uses this unversioned endpoint as the readiness check.

### Success `200`

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "status": "ok"
  }
}
```

### Database unavailable `503`

```json
{
  "statusCode": 503,
  "message": "Service unavailable"
}
```
