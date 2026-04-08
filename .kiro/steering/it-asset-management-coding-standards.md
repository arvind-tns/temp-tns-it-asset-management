---
inclusion: always
---

# IT Asset Management - Coding Standards

This steering document defines coding standards and best practices for the IT Infrastructure Asset Management application.

## Technology Stack

- **Frontend**: Angular 17+ (TypeScript)
- **Backend**: Spring Boot 3.x (Java 17+)
- **Database**: Microsoft SQL Server 2019+
- **Authentication**: Spring Security with JWT
- **ORM**: Spring Data JPA with Hibernate

## Backend (Spring Boot) Standards

### Project Structure

```
src/main/java/com/company/assetmanagement/
├── config/              # Configuration classes
├── controller/          # REST controllers
├── service/             # Business logic services
├── repository/          # JPA repositories
├── model/              # Domain entities
├── dto/                # Data transfer objects
├── exception/          # Custom exceptions
├── security/           # Security configuration
└── util/               # Utility classes
```

### Naming Conventions

**Classes:**
- Controllers: `{Entity}Controller` (e.g., `AssetController`)
- Services: `{Entity}Service` (e.g., `AssetService`)
- Service Implementations: `{Entity}ServiceImpl`
- Repositories: `{Entity}Repository`
- Entities: Singular noun (e.g., `Asset`, `User`)
- DTOs: `{Entity}DTO` or `{Entity}Request`/`{Entity}Response`

**Methods:**
- Use camelCase
- Start with verb: `createAsset()`, `findAssetById()`, `updateAssetStatus()`
- Boolean methods: `isAccountLocked()`, `hasPermission()`

### Entity Design

```java
@Entity
@Table(name = "Assets", indexes = {
    @Index(name = "IX_Assets_SerialNumber", columnList = "serialNumber"),
    @Index(name = "IX_Assets_Status", columnList = "status")
})
public class Asset {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;
    
    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private AssetType assetType;
    
    @Column(nullable = false, length = 255)
    private String name;
    
    @Column(nullable = false, unique = true, length = 100, updatable = false)
    private String serialNumber;
    
    @Column(nullable = false)
    private LocalDate acquisitionDate;
    
    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private LifecycleStatus status;
    
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "createdBy", nullable = false, updatable = false)
    private User createdBy;
    
    // Getters, setters, equals, hashCode
}
```

### Service Layer Pattern

```java
@Service
@Transactional
public class AssetServiceImpl implements AssetService {
    
    private final AssetRepository assetRepository;
    private final AuditService auditService;
    private final AuthorizationService authorizationService;
    
    public AssetServiceImpl(AssetRepository assetRepository, 
                           AuditService auditService,
                           AuthorizationService authorizationService) {
        this.assetRepository = assetRepository;
        this.auditService = auditService;
        this.authorizationService = authorizationService;
    }
    
    @Override
    public AssetDTO createAsset(String userId, AssetRequest request) {
        // 1. Authorization check
        if (!authorizationService.hasPermission(userId, Action.CREATE_ASSET)) {
            throw new InsufficientPermissionsException();
        }
        
        // 2. Validation
        validateAssetRequest(request);
        
        // 3. Business logic
        if (assetRepository.existsBySerialNumber(request.getSerialNumber())) {
            throw new DuplicateSerialNumberException(request.getSerialNumber());
        }
        
        // 4. Persistence
        Asset asset = mapToEntity(request);
        asset.setCreatedBy(userRepository.findById(UUID.fromString(userId))
            .orElseThrow(() -> new UserNotFoundException(userId)));
        Asset savedAsset = assetRepository.save(asset);
        
        // 5. Audit logging
        auditService.logEvent(AuditEvent.builder()
            .userId(userId)
            .actionType(ActionType.CREATE)
            .resourceType(ResourceType.ASSET)
            .resourceId(savedAsset.getId().toString())
            .build());
        
        // 6. Return DTO
        return mapToDTO(savedAsset);
    }
    
    private void validateAssetRequest(AssetRequest request) {
        List<ValidationError> errors = new ArrayList<>();
        
        if (request.getName() == null || request.getName().isBlank()) {
            errors.add(new ValidationError("name", "Name is required"));
        }
        
        if (request.getSerialNumber() == null || request.getSerialNumber().isBlank()) {
            errors.add(new ValidationError("serialNumber", "Serial number is required"));
        }
        
        if (request.getAcquisitionDate() != null && 
            request.getAcquisitionDate().isAfter(LocalDate.now())) {
            errors.add(new ValidationError("acquisitionDate", 
                "Acquisition date cannot be in the future"));
        }
        
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }
}
```

### Controller Pattern

```java
@RestController
@RequestMapping("/api/v1/assets")
@Validated
public class AssetController {
    
    private final AssetService assetService;
    
    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }
    
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'ASSET_MANAGER')")
    public ResponseEntity<AssetDTO> createAsset(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody AssetRequest request) {
        
        AssetDTO asset = assetService.createAsset(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(asset);
    }
    
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'ASSET_MANAGER', 'VIEWER')")
    public ResponseEntity<AssetDTO> getAsset(@PathVariable UUID id) {
        return assetService.getAsset(id.toString())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'ASSET_MANAGER', 'VIEWER')")
    public ResponseEntity<Page<AssetDTO>> searchAssets(
            @RequestParam(required = false) String text,
            @RequestParam(required = false) List<AssetType> assetTypes,
            @RequestParam(required = false) List<LifecycleStatus> statuses,
            Pageable pageable) {
        
        SearchQuery query = SearchQuery.builder()
            .text(text)
            .assetTypes(assetTypes)
            .statuses(statuses)
            .build();
            
        Page<AssetDTO> results = assetService.searchAssets(query, pageable);
        return ResponseEntity.ok(results);
    }
}
```

### Exception Handling

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            ValidationException ex, HttpServletRequest request) {
        
        ErrorResponse error = ErrorResponse.builder()
            .type("VALIDATION_ERROR")
            .message("Validation failed")
            .details(ex.getErrors())
            .timestamp(LocalDateTime.now())
            .requestId(request.getHeader("X-Request-ID"))
            .build();
            
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }
    
    @ExceptionHandler(DuplicateSerialNumberException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateSerialNumber(
            DuplicateSerialNumberException ex, HttpServletRequest request) {
        
        ErrorResponse error = ErrorResponse.builder()
            .type("DUPLICATE_SERIAL_NUMBER")
            .message("Asset with serial number already exists")
            .details(Map.of("serialNumber", ex.getSerialNumber()))
            .timestamp(LocalDateTime.now())
            .requestId(request.getHeader("X-Request-ID"))
            .build();
            
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }
    
    @ExceptionHandler(InsufficientPermissionsException.class)
    public ResponseEntity<ErrorResponse> handleInsufficientPermissions(
            InsufficientPermissionsException ex, HttpServletRequest request) {
        
        ErrorResponse error = ErrorResponse.builder()
            .type("INSUFFICIENT_PERMISSIONS")
            .message("You do not have permission to perform this action")
            .timestamp(LocalDateTime.now())
            .requestId(request.getHeader("X-Request-ID"))
            .build();
            
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
    }
}
```

## Frontend (Angular) Standards

### Project Structure

```
src/app/
├── core/                    # Singleton services, guards, interceptors
│   ├── auth/
│   ├── guards/
│   ├── interceptors/
│   └── services/
├── shared/                  # Shared components, directives, pipes
│   ├── components/
│   ├── directives/
│   ├── pipes/
│   └── models/
├── features/                # Feature modules
│   ├── assets/
│   │   ├── components/
│   │   ├── services/
│   │   ├── models/
│   │   └── assets.module.ts
│   ├── tickets/
│   └── reports/
└── app.component.ts
```

### Component Pattern

```typescript
@Component({
  selector: 'app-asset-list',
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetListComponent implements OnInit, OnDestroy {
  assets$ = new BehaviorSubject<Asset[]>([]);
  loading$ = new BehaviorSubject<boolean>(false);
  error$ = new BehaviorSubject<string | null>(null);
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private assetService: AssetService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit(): void {
    this.loadAssets();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  loadAssets(): void {
    this.loading$.next(true);
    this.error$.next(null);
    
    this.assetService.getAssets()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading$.next(false))
      )
      .subscribe({
        next: (assets) => this.assets$.next(assets),
        error: (error) => {
          this.error$.next('Failed to load assets');
          this.snackBar.open('Failed to load assets', 'Close', {
            duration: 3000
          });
        }
      });
  }
  
  onAssetClick(asset: Asset): void {
    this.router.navigate(['/assets', asset.id]);
  }
}
```

### Service Pattern

```typescript
@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private readonly apiUrl = '/api/v1/assets';
  
  constructor(private http: HttpClient) {}
  
  getAssets(query?: SearchQuery): Observable<Asset[]> {
    const params = this.buildQueryParams(query);
    return this.http.get<Asset[]>(this.apiUrl, { params })
      .pipe(
        catchError(this.handleError)
      );
  }
  
  getAsset(id: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }
  
  createAsset(asset: AssetRequest): Observable<Asset> {
    return this.http.post<Asset>(this.apiUrl, asset)
      .pipe(
        catchError(this.handleError)
      );
  }
  
  updateAsset(id: string, updates: Partial<Asset>): Observable<Asset> {
    return this.http.put<Asset>(`${this.apiUrl}/${id}`, updates)
      .pipe(
        catchError(this.handleError)
      );
  }
  
  private buildQueryParams(query?: SearchQuery): HttpParams {
    let params = new HttpParams();
    
    if (query?.text) {
      params = params.set('text', query.text);
    }
    
    if (query?.assetTypes?.length) {
      query.assetTypes.forEach(type => {
        params = params.append('assetTypes', type);
      });
    }
    
    return params;
  }
  
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.message || `Error Code: ${error.status}`;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}
```

### Form Validation

```typescript
@Component({
  selector: 'app-asset-form',
  templateUrl: './asset-form.component.html'
})
export class AssetFormComponent implements OnInit {
  assetForm: FormGroup;
  
  constructor(
    private fb: FormBuilder,
    private assetService: AssetService
  ) {
    this.assetForm = this.fb.group({
      assetType: ['', Validators.required],
      name: ['', [Validators.required, Validators.maxLength(255)]],
      serialNumber: ['', [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(100)
      ]],
      acquisitionDate: ['', [
        Validators.required,
        this.dateNotInFutureValidator()
      ]],
      status: ['', Validators.required],
      location: ['', Validators.maxLength(255)],
      notes: ['']
    });
  }
  
  dateNotInFutureValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      
      const inputDate = new Date(control.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return inputDate > today 
        ? { futureDate: { value: control.value } }
        : null;
    };
  }
  
  onSubmit(): void {
    if (this.assetForm.valid) {
      this.assetService.createAsset(this.assetForm.value)
        .subscribe({
          next: (asset) => {
            // Handle success
          },
          error: (error) => {
            // Handle error
          }
        });
    } else {
      this.assetForm.markAllAsTouched();
    }
  }
}
```

## Code Quality Standards

### General Principles

1. **SOLID Principles**: Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
2. **DRY**: Don't Repeat Yourself - extract common logic into reusable methods/components
3. **KISS**: Keep It Simple, Stupid - prefer simple solutions over complex ones
4. **YAGNI**: You Aren't Gonna Need It - don't add functionality until it's needed

### Code Review Checklist

- [ ] Code follows naming conventions
- [ ] All methods have single responsibility
- [ ] No magic numbers or strings (use constants/enums)
- [ ] Proper error handling with specific exceptions
- [ ] All public methods have JavaDoc/JSDoc comments
- [ ] No commented-out code
- [ ] No console.log statements in production code
- [ ] Proper null/undefined checks
- [ ] Authorization checks before operations
- [ ] Audit logging for state changes
- [ ] Unit tests for new functionality
- [ ] Integration tests for API endpoints

### Documentation

**JavaDoc for public methods:**
```java
/**
 * Creates a new asset in the system.
 *
 * @param userId the ID of the user creating the asset
 * @param request the asset creation request containing asset details
 * @return the created asset DTO
 * @throws InsufficientPermissionsException if user lacks CREATE_ASSET permission
 * @throws DuplicateSerialNumberException if serial number already exists
 * @throws ValidationException if request data is invalid
 */
public AssetDTO createAsset(String userId, AssetRequest request);
```

**JSDoc for TypeScript:**
```typescript
/**
 * Retrieves an asset by its ID.
 * 
 * @param id - The unique identifier of the asset
 * @returns Observable that emits the asset or throws an error
 * @throws Error if asset is not found or user lacks permission
 */
getAsset(id: string): Observable<Asset>
```

## Security Standards

### Authentication

- Use JWT tokens with 30-minute expiration
- Store tokens in HttpOnly cookies (not localStorage)
- Implement refresh token mechanism
- Hash passwords with BCrypt (strength 10+)

### Authorization

- Check permissions at both controller and service layers
- Use Spring Security's `@PreAuthorize` annotations
- Implement Angular route guards for all protected routes
- Never trust client-side authorization alone

### Input Validation

- Validate all inputs at API boundary
- Use Bean Validation annotations (`@Valid`, `@NotNull`, etc.)
- Sanitize user inputs to prevent XSS
- Use parameterized queries to prevent SQL injection

### Audit Logging

- Log all state-changing operations
- Include user ID, timestamp, action type, and resource ID
- Never log sensitive data (passwords, tokens)
- Make audit logs immutable (no updates or deletes)

## Performance Standards

### Database

- Use indexes on frequently queried columns
- Implement pagination for large result sets
- Use lazy loading for entity relationships
- Optimize N+1 query problems with JOIN FETCH

### API

- Implement caching for frequently accessed data
- Use compression for large responses
- Implement rate limiting to prevent abuse
- Return appropriate HTTP status codes

### Frontend

- Use OnPush change detection strategy
- Implement virtual scrolling for large lists
- Lazy load feature modules
- Optimize bundle size with tree shaking
- Use trackBy functions in *ngFor loops

## Testing Standards

See the separate testing steering document for comprehensive testing guidelines.
