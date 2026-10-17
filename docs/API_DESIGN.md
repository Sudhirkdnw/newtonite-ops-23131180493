# Newtonite API Design Specification

## 1. Overview & Protocol Conventions

The Newtonite API is a RESTful JSON API versioned under the `/api/v1` prefix.

- **Content-Type**: `application/json`
- **Correlation ID**: All requests accept and return `X-Request-Id` (UUID v4) for end-to-end tracing.
- **Idempotency**: All mutating operations (`POST`, `PUT`, `PATCH`) support an `Idempotency-Key` header.
- **Optimistic Concurrency**: Mutating updates to versioned resources support the `If-Match` header containing the integer version string.
- **Envelope Standard**: All responses strictly follow the standardized success/error envelope.

---

## 2. Standard Response Envelopes

### Success Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "5dbd135c-3724-45a7-8aaa-33e79d2ebc31",
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  }
}
```

### Error Envelope

```json
{
  "success": false,
  "error": {
    "message": "Resource state conflict",
    "code": "CONFLICT",
    "statusCode": 409,
    "requestId": "f1c95225-2699-4f66-bcb8-7e0904bb003e",
    "details": [
      {
        "field": "version",
        "message": "Resource has been modified by another concurrent request"
      }
    ]
  }
}
```

---

## 3. Foundational Endpoints (Step 1)

### `GET /health`

Liveness probe for load balancers, container orchestration, and monitoring.

- **Status Code**: `200 OK`
- **Response**:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-10-17T06:14:51.502Z",
    "uptimeSeconds": 142.8,
    "environment": "development",
    "version": "0.1.0"
  },
  "meta": {
    "requestId": "5dbd135c-3724-45a7-8aaa-33e79d2ebc31"
  }
}
```

---

### `GET /ready`

Readiness probe verifying PostgreSQL connectivity and query execution latency.

- **Status Codes**:
  - `200 OK`: Database connected and responsive.
  - `503 Service Unavailable`: Database unreachable or query timed out.
- **Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "status": "ready",
    "database": "connected",
    "latencyMs": 8,
    "timestamp": "2026-10-17T06:14:51.772Z"
  },
  "meta": {
    "requestId": "97cc73f6-9b3d-4bf9-8ab5-82341f283e5d"
  }
}
```

- **Response (503 Service Unavailable)**:

```json
{
  "success": false,
  "error": {
    "message": "Database connection is unavailable",
    "code": "DATABASE_UNAVAILABLE",
    "statusCode": 503,
    "requestId": "40664687-35c3-421c-b541-cab7bcb2e38d",
    "details": [{ "message": "Connection terminated unexpectedly" }]
  }
}
```

---

## 4. Planned Endpoints for Subsequent Steps

The following routes are designed in the schema and will be implemented in subsequent steps:

### Authentication & Identity (Step 2)

- `POST /api/v1/auth/login`: Issue signed JWT for demo/seeded users.
- `GET /api/v1/auth/me`: Retrieve current user profile and team memberships.

### Work Items & Concurrency (Step 3 & 4)

- `GET /api/v1/teams/:teamId/work-items`: Team-scoped list with cursor/keyset pagination.
- `POST /api/v1/teams/:teamId/work-items`: Create work item (enforcing `Idempotency-Key`).
- `POST /api/v1/work-items/:id/claim`: Atomic conditional claim (only one claimant succeeds).
- `PATCH /api/v1/work-items/:id`: Optimistic locking update (requires matching `version`).
- `POST /api/v1/work-items/:id/approve`: Server-enforced Lead-only workflow approval.
- `GET /api/v1/work-items/:id/activity`: Append-only audit history timeline.
