---
inclusion: always
---

# IT Asset Management - API Design Guide

This steering document defines REST API design standards and conventions for the IT Infrastructure Asset Management application.

## API Design Principles

1. **RESTful**: Follow REST architectural constraints
2. **Consistent**: Use consistent naming, structure, and patterns
3. **Versioned**: Support API versioning for backward compatibility
4. **Documented**: Provide comprehensive API documentation
5. **Secure**: Implement authentication and authorization
6. **Performant**: Optimize for performance with pagination and caching

## Base URL Structure

```
https://api.example.com/api/v1/{resource}
```

- **Protocol**: HTTPS only (no HTTP)
- **API Prefix**: `/api` to distinguish from web UI routes
- **Version**: `/v1` for version 1 (increment for breaking changes)
- **Resource**: Plural noun (e.g., `/assets`, `/users`, `/tickets`)

## HTTP Methods

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create new resource | No | No |
| PUT | Update entire resource | Yes | No |
| PATCH | Partial update | No | No |
| DELETE | Remove resource | Yes | No |

## Resource Naming Conventions

### Use Plural Nouns

```
✅ GET /api/v1/assets
✅ GET /api/v1/users
✅ GET /api/v1/tickets

❌ GET /api/v1/asset
❌ GET /api/v1/user
❌ GET /api/v1/ticket
```

### Use Kebab-Case for Multi-Word Resources

```
✅ GET /api/v1/audit-logs
✅ GET /api/v1/assignment-history

❌ GET /api/v1/auditLogs
❌ GET /api/v1/assignment_history
```

### Nested Resources for Relationships

```
✅ GET /api/v1/assets/{assetId}/assignment-history
✅ GET /api/v1/tickets/{ticketId}/status-history

❌ GET /api/v1/assignment-history?assetId={assetId}
```

Limit nesting to 2 levels maximum for readability.

## Endpoint Patterns

### Assets API

```java
// List all assets with filtering and pagination
GET /api/v1/assets?text=server&assetType=SERVER&status=IN_USE&page=0&size=20

// Get single asset
GET /api/v1/assets/{id}

// Create new asset
POST /api/v1/assets

// Update asset
PUT /api/v1/assets/{id}

// Partial update
PATCH /api/v1/assets/{id}

// Delete asset
DELETE /api/v1/assets/{id}

// Update asset status
PATCH /api/v1/assets/{id}/status

// Assign asset
POST /api/v1/assets/{id}/assignments

// Get assignment history
GET /api/v1/assets/{id}/assignment-history

// Export assets
GET /api/v1/assets/export?format=csv

// Import assets
POST /api/v1/assets/import
```

### Tickets API

```java
// List tickets
GET /api/v1/tickets?status=PENDING&type=ALLOCATION&priority=HIGH

// Get single ticket
GET /api/v1/tickets/{id}

// Create allocation ticket
POST /api/v1/tickets/allocation

// Create de-allocation ticket
POST /api/v1/tickets/deallocation

// Approve ticket
POST /api/v1/tickets/{id}/approve

// Reject ticket
POST /api/v1/tickets/{id}/reject

// Complete ticket
POST /api/v1/tickets/{id}/complete

// Cancel ticket
POST /api/v1/tickets/{id}/cancel

// Get ticket status history
GET /api/v1/tickets/{id}/status-history

// Get ticket metrics
GET /api/v1/tickets/metrics?from=2024-01-01&to=2024-12-31
```

### Users API

```java
// List users
GET /api/v1/users?role=ADMINISTRATOR

// Get single user
GET /api/v1/users/{id}

// Create user
POST /api/v1/users

// Update user
PUT /api/v1/users/{id}

// Delete user
DELETE /api/v1/users/{id}

// Assign role
POST /api/v1/users/{id}/roles

// Revoke role
DELETE /api/v1/users/{id}/roles/{role}
```

### Authentication API

```java
// Login
POST /api/v1/auth/login

// Logout
POST /api/v1/auth/logout

// Refresh token
POST /api/v1/auth/refresh

// Change password
POST /api/v1/auth/change-password
```

### Reports API

```java
// Asset count by type
GET /api/v1/reports/assets/by-type

// Assets by location
GET /api/v1/reports/assets/by-location

// Assets by status
GET /api/v1/reports/assets/by-status

// End-of-life report
GET /api/v1/reports/assets/end-of-life

// Ticket metrics
GET /api/v1/reports/tickets/metrics
```

## Request/Response Formats

### Request Body (POST/PUT)

```json
{
  "assetType": "SERVER",
  "name": "Production Server 01",
  "serialNumber": "SRV-PROD-001",
  "acquisitionDate": "2024-01-15",
  "status": "ORDERED",
  "location": "Data Center A",
  "notes": "Primary application server"
}
```

### Successful Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "assetType": "SERVER",
  "name": "Production Server 01",
  "serialNumber": "SRV-PROD-001",
  "acquisitionDate": "2024-01-15",
  "status": "ORDERED",
  "location": "Data Center A",
  "notes": "Primary application server",
  "createdAt": "2024-01-15T10:30:00Z",
  "createdBy": "admin",
  "updatedAt": "2024-01-15T10:30:00Z",
  "updatedBy": "admin",
  "readOnly": false
}
```

### Paginated Response

```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Server 01",
      "assetType": "SERVER"
    }
  ],
  "page": {
    "size": 20,
    "number": 0,
    "totalElements": 150,
    "totalPages": 8
  },
  "links": {
    "self": "/api/v1/assets?page=0&size=20",
    "first": "/api/v1/assets?page=0&size=20",
    "next": "/api/v1/assets?page=1&size=20",
    "last": "/api/v1/assets?page=7&size=20"
  }
}
```

### Error Response

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "serialNumber",
        "message": "Serial number is required"
      },
      {
        "field": "acquisitionDate",
        "message": "Acquisition date cannot be in the future"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123456"
  }
}
```

## HTTP Status Codes

### Success Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 OK | Success | GET, PUT, PATCH successful |
| 201 Created | Resource created | POST successful |
| 204 No Content | Success, no body | DELETE successful |

### Client Error Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 400 Bad Request | Invalid request | Validation errors |
| 401 Unauthorized | Not authenticated | Missing/invalid token |
| 403 Forbidden | Not authorized | Insufficient permissions |
| 404 Not Found | Resource not found | Invalid ID |
| 409 Conflict | Resource conflict | Duplicate serial number |
| 422 Unprocessable Entity | Invalid state | Invalid status transition |
| 429 Too Many Requests | Rate limit exceeded | Too many requests |

### Server Error Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 500 Internal Server Error | Server error | Unexpected errors |
| 503 Service Unavailable | Service down | Maintenance mode |

## Query Parameters

### Filtering

```
GET /api/v1/assets?assetType=SERVER&status=IN_USE&location=DataCenter-A
```

Use query parameters for filtering collections:
- Use exact field names from the model
- Support multiple values with comma separation or repeated parameters
- Use clear, descriptive parameter names

### Pagination

```
GET /api/v1/assets?page=0&size=20
```

Standard pagination parameters:
- `page`: Zero-based page number (default: 0)
- `size`: Number of items per page (default: 20, max: 100)

### Sorting

```
GET /api/v1/assets?sort=name,asc&sort=createdAt,desc
```

Sorting parameters:
- `sort`: Field name and direction (asc/desc)
- Support multiple sort fields
- Default sort order should be documented

### Searching

```
GET /api/v1/assets?text=server
```

Full-text search parameter:
- `text`: Search across multiple fields
- Case-insensitive
- Searches name, serial number, location, etc.

### Date Ranges

```
GET /api/v1/assets?acquisitionDateFrom=2024-01-01&acquisitionDateTo=2024-12-31
```

Date range parameters:
- Use ISO 8601 format (YYYY-MM-DD)
- Use `From` and `To` suffixes
- Both parameters are optional (open-ended ranges)

## Request Headers

### Required Headers

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
```

### Optional Headers

```http
X-Request-ID: req-123456
Accept-Language: en-US
If-Match: "etag-value"
```

## Response Headers

### Standard Headers

```http
Content-Type: application/json
X-Request-ID: req-123456
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640000000
```

### Caching Headers

```http
Cache-Control: private, max-age=300
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Wed, 15 Jan 2024 10:30:00 GMT
```

## Validation Rules

### Request Validation

All request bodies must be validated before processing:

```java
@PostMapping
public ResponseEntity<AssetDTO> createAsset(
        @Valid @RequestBody AssetRequest request) {
    // Validation happens automatically via @Valid
}
```

### Validation Annotations

```java
public class AssetRequest {
    @NotNull(message = "Asset type is required")
    private AssetType assetType;
    
    @NotBlank(message = "Name is required")
    @Size(max = 255, message = "Name must not exceed 255 characters")
    private String name;
    
    @NotBlank(message = "Serial number is required")
    @Size(min = 5, max = 100, message = "Serial number must be between 5 and 100 characters")
    private String serialNumber;
    
    @NotNull(message = "Acquisition date is required")
    @PastOrPresent(message = "Acquisition date cannot be in the future")
    private LocalDate acquisitionDate;
    
    @Email(message = "Invalid email format")
    private String assignedUserEmail;
}
```

### Comprehensive Error Responses

Return all validation errors, not just the first:

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      },
      {
        "field": "serialNumber",
        "message": "Serial number must be between 5 and 100 characters"
      },
      {
        "field": "acquisitionDate",
        "message": "Acquisition date cannot be in the future"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123456"
  }
}
```

## Authentication & Authorization

### JWT Token Authentication

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@123456"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 1800
}
```

### Using Access Token

```http
GET /api/v1/assets
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Refresh

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Authorization Errors

```json
{
  "error": {
    "type": "INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to perform this action",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123456"
  }
}
```

## Rate Limiting

Implement rate limiting to prevent abuse:

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640000000
```

When rate limit exceeded:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600

{
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123456"
  }
}
```

## Versioning Strategy

### URL Versioning (Recommended)

```
/api/v1/assets
/api/v2/assets
```

Advantages:
- Clear and explicit
- Easy to route
- Simple to understand

### Version Lifecycle

1. **Current Version (v1)**: Fully supported
2. **Deprecated Version**: Supported with deprecation warnings
3. **Sunset Version**: No longer supported

Deprecation header:
```http
Deprecation: true
Sunset: Wed, 15 Jan 2025 10:30:00 GMT
Link: </api/v2/assets>; rel="successor-version"
```

## API Documentation

### OpenAPI/Swagger

Use OpenAPI 3.0 specification for API documentation:

```java
@Operation(
    summary = "Create a new asset",
    description = "Creates a new asset in the system. Requires ADMINISTRATOR or ASSET_MANAGER role.",
    responses = {
        @ApiResponse(
            responseCode = "201",
            description = "Asset created successfully",
            content = @Content(schema = @Schema(implementation = AssetDTO.class))
        ),
        @ApiResponse(
            responseCode = "400",
            description = "Validation error",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        ),
        @ApiResponse(
            responseCode = "403",
            description = "Insufficient permissions"
        ),
        @ApiResponse(
            responseCode = "409",
            description = "Duplicate serial number"
        )
    }
)
@PostMapping
@PreAuthorize("hasAnyRole('ADMINISTRATOR', 'ASSET_MANAGER')")
public ResponseEntity<AssetDTO> createAsset(
        @Parameter(description = "Asset creation request")
        @Valid @RequestBody AssetRequest request) {
    // Implementation
}
```

### Documentation Requirements

Every endpoint must document:
- Summary and description
- Required roles/permissions
- Request body schema
- Response schemas for all status codes
- Query parameters
- Path parameters
- Example requests and responses

## Performance Optimization

### Pagination

Always paginate large collections:

```java
@GetMapping
public ResponseEntity<Page<AssetDTO>> getAssets(
        @RequestParam(required = false) String text,
        @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) 
        Pageable pageable) {
    
    Page<AssetDTO> assets = assetService.searchAssets(text, pageable);
    return ResponseEntity.ok(assets);
}
```

### Field Selection (Sparse Fieldsets)

Allow clients to request specific fields:

```
GET /api/v1/assets?fields=id,name,serialNumber,status
```

### Caching

Implement caching for frequently accessed, rarely changed data:

```java
@GetMapping("/{id}")
@Cacheable(value = "assets", key = "#id")
public ResponseEntity<AssetDTO> getAsset(@PathVariable UUID id) {
    return assetService.getAsset(id.toString())
        .map(asset -> ResponseEntity
            .ok()
            .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES))
            .eTag(generateETag(asset))
            .body(asset))
        .orElse(ResponseEntity.notFound().build());
}
```

### Compression

Enable GZIP compression for responses:

```properties
server.compression.enabled=true
server.compression.mime-types=application/json,application/xml,text/html,text/xml,text/plain
server.compression.min-response-size=1024
```

## CORS Configuration

Configure CORS for frontend access:

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:4200", "https://app.example.com")
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true)
            .maxAge(3600);
    }
}
```

## Best Practices

1. **Use nouns for resources, not verbs**
   - ✅ `POST /api/v1/assets`
   - ❌ `POST /api/v1/createAsset`

2. **Use HTTP methods correctly**
   - GET for retrieval
   - POST for creation
   - PUT for full update
   - PATCH for partial update
   - DELETE for removal

3. **Return appropriate status codes**
   - 2xx for success
   - 4xx for client errors
   - 5xx for server errors

4. **Provide meaningful error messages**
   - Include error type
   - Provide actionable message
   - List all validation errors

5. **Version your API**
   - Use URL versioning
   - Document breaking changes
   - Provide migration guides

6. **Document everything**
   - Use OpenAPI/Swagger
   - Provide examples
   - Keep documentation up-to-date

7. **Implement security**
   - Use HTTPS only
   - Require authentication
   - Enforce authorization
   - Validate all inputs

8. **Optimize performance**
   - Implement pagination
   - Use caching
   - Enable compression
   - Support field selection

9. **Be consistent**
   - Use consistent naming
   - Follow same patterns
   - Maintain uniform structure

10. **Handle errors gracefully**
    - Return structured errors
    - Include request IDs
    - Log errors server-side
    - Don't expose sensitive data
