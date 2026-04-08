---
inclusion: always
---

# IT Asset Management - Testing Guide

This steering document provides comprehensive testing guidelines for the IT Infrastructure Asset Management application.

## Testing Philosophy

The application uses a multi-layered testing approach:

1. **Property-Based Tests**: Verify universal correctness properties across randomized inputs
2. **Unit Tests**: Test individual components in isolation with specific examples
3. **Integration Tests**: Verify component interactions and database operations
4. **End-to-End Tests**: Test complete user workflows
5. **Performance Tests**: Validate performance requirements with large datasets
6. **Security Tests**: Verify authentication, authorization, and security controls

## Property-Based Testing

### Overview

Property-based testing validates that correctness properties hold true across a wide range of randomly generated inputs. This approach catches edge cases that example-based tests might miss.

### Framework

**Backend (Java)**: jqwik
**Frontend (TypeScript)**: fast-check

### Property Test Structure

Each property test should:
1. Define generators for test data
2. State the property being tested
3. Verify the property holds for all generated inputs
4. Be tagged with feature name and property number

### Backend Property Test Example (jqwik)

```java
@Group
@Label("Feature: it-infrastructure-asset-management")
class AssetPropertyTests {
    
    @Property
    @Label("Property 7: Valid asset creation generates unique identifier")
    void validAssetCreationGeneratesUniqueIdentifier(
            @ForAll("validAssetRequests") AssetRequest request) {
        
        // Given: A valid asset request
        AssetService assetService = createAssetService();
        String userId = "test-user-id";
        
        // When: Creating the asset
        AssetDTO result = assetService.createAsset(userId, request);
        
        // Then: Asset has unique ID and all fields are persisted
        assertThat(result.getId()).isNotNull();
        assertThat(result.getAssetType()).isEqualTo(request.getAssetType());
        assertThat(result.getName()).isEqualTo(request.getName());
        assertThat(result.getSerialNumber()).isEqualTo(request.getSerialNumber());
        assertThat(result.getAcquisitionDate()).isEqualTo(request.getAcquisitionDate());
        assertThat(result.getStatus()).isEqualTo(request.getStatus());
    }
    
    @Property
    @Label("Property 9: Serial number uniqueness enforcement")
    void serialNumberUniquenessEnforcement(
            @ForAll("validAssetRequests") AssetRequest request1,
            @ForAll("validAssetRequests") AssetRequest request2) {
        
        // Given: Two assets with the same serial number
        request2.setSerialNumber(request1.getSerialNumber());
        AssetService assetService = createAssetService();
        String userId = "test-user-id";
        
        // When: Creating first asset succeeds
        assetService.createAsset(userId, request1);
        
        // Then: Creating second asset with duplicate serial number fails
        assertThatThrownBy(() -> assetService.createAsset(userId, request2))
            .isInstanceOf(DuplicateSerialNumberException.class)
            .hasMessageContaining(request1.getSerialNumber());
    }
    
    @Provide
    Arbitrary<AssetRequest> validAssetRequests() {
        return Combinators.combine(
            Arbitraries.of(AssetType.values()),
            Arbitraries.strings().alpha().ofMinLength(1).ofMaxLength(100),
            Arbitraries.strings().alpha().numeric().ofMinLength(5).ofMaxLength(50),
            Arbitraries.dates().atTheEarliest(LocalDate.of(2000, 1, 1))
                              .atTheLatest(LocalDate.now()),
            Arbitraries.of(LifecycleStatus.values())
        ).as((type, name, serial, date, status) -> 
            AssetRequest.builder()
                .assetType(type)
                .name(name)
                .serialNumber(serial)
                .acquisitionDate(date)
                .status(status)
                .build()
        );
    }
    
    @Provide
    Arbitrary<AssetRequest> invalidAssetRequests() {
        return Combinators.combine(
            Arbitraries.of(AssetType.values()).optional(),
            Arbitraries.strings().optional(),
            Arbitraries.strings().optional(),
            Arbitraries.dates().optional(),
            Arbitraries.of(LifecycleStatus.values()).optional()
        ).as((type, name, serial, date, status) -> 
            AssetRequest.builder()
                .assetType(type.orElse(null))
                .name(name.orElse(null))
                .serialNumber(serial.orElse(null))
                .acquisitionDate(date.orElse(null))
                .status(status.orElse(null))
                .build()
        ).filter(req -> 
            req.getAssetType() == null || 
            req.getName() == null || 
            req.getSerialNumber() == null ||
            req.getAcquisitionDate() == null ||
            req.getStatus() == null
        );
    }
}
```

### Frontend Property Test Example (fast-check)

```typescript
describe('Feature: it-infrastructure-asset-management', () => {
  
  describe('Property 16: Search returns matching assets', () => {
    it('should return all and only assets matching search criteria', () => {
      fc.assert(
        fc.property(
          fc.array(validAssetGen(), { minLength: 10, maxLength: 100 }),
          searchQueryGen(),
          (assets: Asset[], query: SearchQuery) => {
            // Given: A collection of assets and a search query
            const service = new AssetService(mockHttp);
            mockHttp.get.mockReturnValue(of(assets));
            
            // When: Searching with the query
            let results: Asset[] = [];
            service.searchAssets(query).subscribe(r => results = r);
            
            // Then: Results match the query criteria
            results.forEach(asset => {
              if (query.text) {
                const matchesText = 
                  asset.name.includes(query.text) ||
                  asset.serialNumber.includes(query.text) ||
                  asset.location?.includes(query.text);
                expect(matchesText).toBe(true);
              }
              
              if (query.filters?.assetTypes?.length) {
                expect(query.filters.assetTypes).toContain(asset.assetType);
              }
              
              if (query.filters?.statuses?.length) {
                expect(query.filters.statuses).toContain(asset.status);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Generators
const validAssetGen = () => fc.record({
  id: fc.uuid(),
  assetType: fc.constantFrom(...Object.values(AssetType)),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  serialNumber: fc.string({ minLength: 5, maxLength: 50 }),
  acquisitionDate: fc.date({ max: new Date() }),
  status: fc.constantFrom(...Object.values(LifecycleStatus)),
  location: fc.option(fc.string()),
  assignedUser: fc.option(fc.string())
});

const searchQueryGen = () => fc.record({
  text: fc.option(fc.string()),
  filters: fc.option(fc.record({
    assetTypes: fc.option(fc.array(fc.constantFrom(...Object.values(AssetType)))),
    statuses: fc.option(fc.array(fc.constantFrom(...Object.values(LifecycleStatus)))),
    location: fc.option(fc.array(fc.string()))
  }))
});
```

### Property Test Configuration

**Minimum iterations**: 100 runs per property test
**Seed management**: Use fixed seeds for reproducible failures
**Shrinking**: Enable automatic shrinking to find minimal failing cases

## Unit Testing

### Backend Unit Tests (JUnit 5 + Mockito)

```java
@ExtendWith(MockitoExtension.class)
class AssetServiceImplTest {
    
    @Mock
    private AssetRepository assetRepository;
    
    @Mock
    private AuditService auditService;
    
    @Mock
    private AuthorizationService authorizationService;
    
    @InjectMocks
    private AssetServiceImpl assetService;
    
    @Test
    @DisplayName("Should create asset when user has permission and data is valid")
    void shouldCreateAssetWhenAuthorizedAndValid() {
        // Given
        String userId = "user-123";
        AssetRequest request = AssetRequest.builder()
            .assetType(AssetType.SERVER)
            .name("Test Server")
            .serialNumber("SRV-001")
            .acquisitionDate(LocalDate.now())
            .status(LifecycleStatus.ORDERED)
            .build();
        
        when(authorizationService.hasPermission(userId, Action.CREATE_ASSET))
            .thenReturn(true);
        when(assetRepository.existsBySerialNumber(request.getSerialNumber()))
            .thenReturn(false);
        when(assetRepository.save(any(Asset.class)))
            .thenAnswer(invocation -> {
                Asset asset = invocation.getArgument(0);
                asset.setId(UUID.randomUUID());
                return asset;
            });
        
        // When
        AssetDTO result = assetService.createAsset(userId, request);
        
        // Then
        assertThat(result).isNotNull();
        assertThat(result.getId()).isNotNull();
        assertThat(result.getName()).isEqualTo("Test Server");
        
        verify(assetRepository).save(any(Asset.class));
        verify(auditService).logEvent(any(AuditEvent.class));
    }
    
    @Test
    @DisplayName("Should throw InsufficientPermissionsException when user lacks permission")
    void shouldThrowExceptionWhenUnauthorized() {
        // Given
        String userId = "user-123";
        AssetRequest request = createValidAssetRequest();
        
        when(authorizationService.hasPermission(userId, Action.CREATE_ASSET))
            .thenReturn(false);
        
        // When/Then
        assertThatThrownBy(() -> assetService.createAsset(userId, request))
            .isInstanceOf(InsufficientPermissionsException.class);
        
        verify(assetRepository, never()).save(any());
        verify(auditService, never()).logEvent(any());
    }
    
    @Test
    @DisplayName("Should throw DuplicateSerialNumberException when serial number exists")
    void shouldThrowExceptionWhenSerialNumberDuplicate() {
        // Given
        String userId = "user-123";
        AssetRequest request = createValidAssetRequest();
        
        when(authorizationService.hasPermission(userId, Action.CREATE_ASSET))
            .thenReturn(true);
        when(assetRepository.existsBySerialNumber(request.getSerialNumber()))
            .thenReturn(true);
        
        // When/Then
        assertThatThrownBy(() -> assetService.createAsset(userId, request))
            .isInstanceOf(DuplicateSerialNumberException.class)
            .hasMessageContaining(request.getSerialNumber());
    }
    
    @Test
    @DisplayName("Should throw ValidationException when required fields are missing")
    void shouldThrowValidationExceptionWhenFieldsMissing() {
        // Given
        String userId = "user-123";
        AssetRequest request = AssetRequest.builder()
            .assetType(AssetType.SERVER)
            // Missing name, serialNumber, etc.
            .build();
        
        when(authorizationService.hasPermission(userId, Action.CREATE_ASSET))
            .thenReturn(true);
        
        // When/Then
        assertThatThrownBy(() -> assetService.createAsset(userId, request))
            .isInstanceOf(ValidationException.class)
            .satisfies(ex -> {
                ValidationException vex = (ValidationException) ex;
                assertThat(vex.getErrors()).hasSizeGreaterThan(0);
                assertThat(vex.getErrors()).extracting("field")
                    .contains("name", "serialNumber");
            });
    }
}
```

### Frontend Unit Tests (Jasmine + Karma)

```typescript
describe('AssetService', () => {
  let service: AssetService;
  let httpMock: HttpTestingController;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AssetService]
    });
    
    service = TestBed.inject(AssetService);
    httpMock = TestBed.inject(HttpTestingController);
  });
  
  afterEach(() => {
    httpMock.verify();
  });
  
  describe('getAssets', () => {
    it('should return assets from API', () => {
      const mockAssets: Asset[] = [
        { id: '1', name: 'Asset 1', assetType: AssetType.SERVER, /* ... */ },
        { id: '2', name: 'Asset 2', assetType: AssetType.WORKSTATION, /* ... */ }
      ];
      
      service.getAssets().subscribe(assets => {
        expect(assets).toEqual(mockAssets);
        expect(assets.length).toBe(2);
      });
      
      const req = httpMock.expectOne('/api/v1/assets');
      expect(req.request.method).toBe('GET');
      req.flush(mockAssets);
    });
    
    it('should handle error responses', () => {
      service.getAssets().subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          expect(error.message).toContain('Error Code: 500');
        }
      });
      
      const req = httpMock.expectOne('/api/v1/assets');
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });
  
  describe('createAsset', () => {
    it('should create asset via POST request', () => {
      const request: AssetRequest = {
        assetType: AssetType.SERVER,
        name: 'New Server',
        serialNumber: 'SRV-001',
        acquisitionDate: new Date(),
        status: LifecycleStatus.ORDERED
      };
      
      const mockResponse: Asset = { id: '123', ...request };
      
      service.createAsset(request).subscribe(asset => {
        expect(asset.id).toBe('123');
        expect(asset.name).toBe('New Server');
      });
      
      const req = httpMock.expectOne('/api/v1/assets');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockResponse);
    });
  });
});
```

## Integration Testing

### Backend Integration Tests (Spring Boot Test)

```java
@SpringBootTest
@AutoConfigureTestDatabase
@Transactional
class AssetIntegrationTest {
    
    @Autowired
    private AssetService assetService;
    
    @Autowired
    private AssetRepository assetRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private AuditLogRepository auditLogRepository;
    
    private User testUser;
    
    @BeforeEach
    void setUp() {
        testUser = userRepository.save(User.builder()
            .username("testuser")
            .email("test@example.com")
            .passwordHash("hashed")
            .build());
        
        userRepository.save(testUser);
    }
    
    @Test
    @DisplayName("Should persist asset to database and create audit log entry")
    void shouldPersistAssetAndCreateAuditLog() {
        // Given
        AssetRequest request = AssetRequest.builder()
            .assetType(AssetType.SERVER)
            .name("Integration Test Server")
            .serialNumber("INT-SRV-001")
            .acquisitionDate(LocalDate.now())
            .status(LifecycleStatus.ORDERED)
            .build();
        
        // When
        AssetDTO result = assetService.createAsset(testUser.getId().toString(), request);
        
        // Then - Asset is persisted
        Optional<Asset> savedAsset = assetRepository.findById(UUID.fromString(result.getId()));
        assertThat(savedAsset).isPresent();
        assertThat(savedAsset.get().getName()).isEqualTo("Integration Test Server");
        assertThat(savedAsset.get().getSerialNumber()).isEqualTo("INT-SRV-001");
        
        // Then - Audit log entry is created
        List<AuditEntry> auditEntries = auditLogRepository
            .findByResourceId(result.getId());
        assertThat(auditEntries).hasSize(1);
        assertThat(auditEntries.get(0).getActionType()).isEqualTo(ActionType.CREATE);
        assertThat(auditEntries.get(0).getResourceType()).isEqualTo(ResourceType.ASSET);
    }
    
    @Test
    @DisplayName("Should enforce unique serial number constraint at database level")
    void shouldEnforceUniqueSerialNumberConstraint() {
        // Given
        AssetRequest request1 = createAssetRequest("SRV-UNIQUE-001");
        AssetRequest request2 = createAssetRequest("SRV-UNIQUE-001");
        
        // When
        assetService.createAsset(testUser.getId().toString(), request1);
        
        // Then
        assertThatThrownBy(() -> 
            assetService.createAsset(testUser.getId().toString(), request2))
            .isInstanceOf(DuplicateSerialNumberException.class);
    }
}
```

### Performance Integration Tests

```java
@SpringBootTest
@AutoConfigureTestDatabase
class AssetPerformanceTest {
    
    @Autowired
    private AssetService assetService;
    
    @Autowired
    private AssetRepository assetRepository;
    
    @Test
    @DisplayName("Search should complete within 2 seconds for 100,000 assets")
    void searchPerformanceTest() {
        // Given: 100,000 assets in database
        seedDatabase(100_000);
        
        SearchQuery query = SearchQuery.builder()
            .text("server")
            .filters(SearchFilters.builder()
                .assetTypes(List.of(AssetType.SERVER))
                .build())
            .build();
        
        // When: Executing search
        long startTime = System.currentTimeMillis();
        Page<AssetDTO> results = assetService.searchAssets(query, PageRequest.of(0, 20));
        long duration = System.currentTimeMillis() - startTime;
        
        // Then: Completes within 2 seconds
        assertThat(duration).isLessThan(2000);
        assertThat(results.getContent()).isNotEmpty();
    }
    
    @Test
    @DisplayName("Report generation should complete within 10 seconds for 100,000 assets")
    void reportGenerationPerformanceTest() {
        // Given: 100,000 assets in database
        seedDatabase(100_000);
        
        // When: Generating report
        long startTime = System.currentTimeMillis();
        Report report = reportService.generateAssetCountByType();
        long duration = System.currentTimeMillis() - startTime;
        
        // Then: Completes within 10 seconds
        assertThat(duration).isLessThan(10_000);
        assertThat(report.getData()).isNotNull();
    }
    
    private void seedDatabase(int count) {
        // Batch insert assets for performance
        List<Asset> assets = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            assets.add(createTestAsset(i));
            
            if (assets.size() >= 1000) {
                assetRepository.saveAll(assets);
                assets.clear();
            }
        }
        if (!assets.isEmpty()) {
            assetRepository.saveAll(assets);
        }
    }
}
```

## End-to-End Testing

### Frontend E2E Tests (Cypress)

```typescript
describe('Asset Management Workflow', () => {
  beforeEach(() => {
    cy.login('admin', 'Admin@123456');
  });
  
  it('should create, view, update, and delete an asset', () => {
    // Navigate to assets page
    cy.visit('/assets');
    cy.get('h1').should('contain', 'Assets');
    
    // Create new asset
    cy.get('[data-cy=create-asset-btn]').click();
    cy.get('[data-cy=asset-type-select]').select('SERVER');
    cy.get('[data-cy=asset-name-input]').type('E2E Test Server');
    cy.get('[data-cy=serial-number-input]').type('E2E-SRV-001');
    cy.get('[data-cy=acquisition-date-input]').type('2024-01-15');
    cy.get('[data-cy=status-select]').select('ORDERED');
    cy.get('[data-cy=submit-btn]').click();
    
    // Verify asset appears in list
    cy.get('[data-cy=asset-list]').should('contain', 'E2E Test Server');
    cy.get('[data-cy=asset-list]').should('contain', 'E2E-SRV-001');
    
    // View asset details
    cy.contains('E2E Test Server').click();
    cy.get('[data-cy=asset-detail]').should('contain', 'E2E Test Server');
    cy.get('[data-cy=asset-detail]').should('contain', 'SERVER');
    
    // Update asset
    cy.get('[data-cy=edit-asset-btn]').click();
    cy.get('[data-cy=status-select]').select('RECEIVED');
    cy.get('[data-cy=submit-btn]').click();
    cy.get('[data-cy=asset-detail]').should('contain', 'RECEIVED');
    
    // Delete asset
    cy.get('[data-cy=delete-asset-btn]').click();
    cy.get('[data-cy=confirm-delete-btn]').click();
    cy.url().should('include', '/assets');
    cy.get('[data-cy=asset-list]').should('not.contain', 'E2E Test Server');
  });
  
  it('should enforce authorization for asset creation', () => {
    cy.logout();
    cy.login('viewer', 'Viewer@123456');
    
    cy.visit('/assets');
    cy.get('[data-cy=create-asset-btn]').should('not.exist');
  });
});
```

## Security Testing

### Authentication Tests

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class AuthenticationSecurityTest {
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Test
    @DisplayName("Should reject requests without authentication token")
    void shouldRejectUnauthenticatedRequests() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/v1/assets", 
            String.class
        );
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
    
    @Test
    @DisplayName("Should lock account after 5 failed login attempts")
    void shouldLockAccountAfterFailedAttempts() {
        String username = "testuser";
        String wrongPassword = "wrongpassword";
        
        // Attempt login 5 times with wrong password
        for (int i = 0; i < 5; i++) {
            LoginRequest request = new LoginRequest(username, wrongPassword);
            ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/v1/auth/login",
                request,
                String.class
            );
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }
        
        // 6th attempt should return account locked
        LoginRequest request = new LoginRequest(username, wrongPassword);
        ResponseEntity<ErrorResponse> response = restTemplate.postForEntity(
            "/api/v1/auth/login",
            request,
            ErrorResponse.class
        );
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().getType()).isEqualTo("ACCOUNT_LOCKED");
    }
}
```

## Test Data Management

### Test Fixtures

```java
public class AssetFixtures {
    
    public static Asset createServerAsset() {
        return Asset.builder()
            .id(UUID.randomUUID())
            .assetType(AssetType.SERVER)
            .name("Test Server")
            .serialNumber("TST-SRV-001")
            .acquisitionDate(LocalDate.now())
            .status(LifecycleStatus.IN_USE)
            .build();
    }
    
    public static AssetRequest createValidAssetRequest() {
        return AssetRequest.builder()
            .assetType(AssetType.SERVER)
            .name("Test Server")
            .serialNumber("TST-SRV-" + UUID.randomUUID().toString().substring(0, 8))
            .acquisitionDate(LocalDate.now())
            .status(LifecycleStatus.ORDERED)
            .build();
    }
}
```

## Test Coverage Requirements

- **Unit Test Coverage**: Minimum 80% line coverage
- **Property Test Coverage**: All 43 correctness properties must have tests
- **Integration Test Coverage**: All repository methods and service interactions
- **E2E Test Coverage**: All critical user workflows
- **Security Test Coverage**: All authentication and authorization paths

## Continuous Integration

### CI Pipeline Configuration

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          
      - name: Run unit tests
        run: ./mvnw test
        
      - name: Run property-based tests
        run: ./mvnw test -Dtest=**/*PropertyTest
        
      - name: Run integration tests
        run: ./mvnw verify -P integration-tests
        
      - name: Generate coverage report
        run: ./mvnw jacoco:report
        
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is being tested
2. **Test Independence**: Each test should be independent and not rely on other tests
3. **Test Data**: Use factories and builders for creating test data
4. **Assertions**: Use specific assertions with clear error messages
5. **Mocking**: Mock external dependencies, test real implementations
6. **Performance**: Keep unit tests fast (< 100ms each)
7. **Cleanup**: Clean up test data after each test
8. **Documentation**: Document complex test scenarios
