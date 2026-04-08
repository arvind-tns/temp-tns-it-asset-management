---
inclusion: always
---

# IT Asset Management - Deployment & Database Management Guide

This steering document provides guidelines for database management, deployment strategies, and operational practices for the IT Infrastructure Asset Management application.

## Database Management

### Database Migration Strategy

Use **Flyway** for database version control and migrations.

#### Migration File Naming Convention

```
V{version}__{description}.sql

Examples:
V1__initial_schema.sql
V2__add_tickets_table.sql
V3__add_custom_fields_column.sql
V4__create_indexes_for_performance.sql
```

#### Migration File Location

```
src/main/resources/db/migration/
├── V1__initial_schema.sql
├── V2__add_tickets_table.sql
├── V3__add_custom_fields_column.sql
└── V4__create_indexes_for_performance.sql
```

#### Example Migration File

```sql
-- V1__initial_schema.sql
-- Initial database schema for IT Asset Management

-- Users table
CREATE TABLE Users (
  Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  Username NVARCHAR(100) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(255) NOT NULL,
  Email NVARCHAR(255) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  LastLoginAt DATETIME2 NULL,
  AccountLocked BIT NOT NULL DEFAULT 0,
  LockUntil DATETIME2 NULL,
  FailedLoginAttempts INT NOT NULL DEFAULT 0,
  IsActive BIT NOT NULL DEFAULT 1
);

CREATE INDEX IX_Users_Username ON Users(Username);
CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_AccountLocked ON Users(AccountLocked);

-- UserRoles table
CREATE TABLE UserRoles (
  Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  UserId UNIQUEIDENTIFIER NOT NULL,
  Role NVARCHAR(50) NOT NULL,
  AssignedBy UNIQUEIDENTIFIER NOT NULL,
  AssignedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  
  CONSTRAINT FK_UserRoles_UserId FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
  CONSTRAINT FK_UserRoles_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES Users(Id),
  CONSTRAINT CHK_UserRoles_Role CHECK (Role IN ('Administrator', 'Asset_Manager', 'Viewer'))
);

CREATE INDEX IX_UserRoles_UserId ON UserRoles(UserId);
CREATE INDEX IX_UserRoles_Role ON UserRoles(Role);

-- Continue with other tables...
```

#### Flyway Configuration

```properties
# application.properties
spring.flyway.enabled=true
spring.flyway.baseline-on-migrate=true
spring.flyway.locations=classpath:db/migration
spring.flyway.sql-migration-prefix=V
spring.flyway.sql-migration-separator=__
spring.flyway.sql-migration-suffixes=.sql
spring.flyway.validate-on-migrate=true
```

### Database Backup Strategy

#### Backup Schedule

- **Full Backup**: Daily at 2:00 AM
- **Differential Backup**: Every 6 hours
- **Transaction Log Backup**: Every 15 minutes
- **Retention**: 30 days for full backups, 7 days for differential

#### Backup Script Example

```sql
-- Full backup
BACKUP DATABASE ITAssetManagement
TO DISK = 'C:\Backups\ITAssetManagement_Full_20240115.bak'
WITH FORMAT, COMPRESSION, STATS = 10;

-- Differential backup
BACKUP DATABASE ITAssetManagement
TO DISK = 'C:\Backups\ITAssetManagement_Diff_20240115_0800.bak'
WITH DIFFERENTIAL, COMPRESSION, STATS = 10;

-- Transaction log backup
BACKUP LOG ITAssetManagement
TO DISK = 'C:\Backups\ITAssetManagement_Log_20240115_0815.trn'
WITH COMPRESSION, STATS = 10;
```

#### Automated Backup with SQL Server Agent

```sql
-- Create backup job
USE msdb;
GO

EXEC dbo.sp_add_job
    @job_name = N'ITAssetManagement_FullBackup',
    @enabled = 1,
    @description = N'Daily full backup of IT Asset Management database';

EXEC dbo.sp_add_jobstep
    @job_name = N'ITAssetManagement_FullBackup',
    @step_name = N'Backup Database',
    @subsystem = N'TSQL',
    @command = N'
        DECLARE @BackupFile NVARCHAR(500);
        SET @BackupFile = ''C:\Backups\ITAssetManagement_Full_'' + 
                         CONVERT(VARCHAR(8), GETDATE(), 112) + ''.bak'';
        
        BACKUP DATABASE ITAssetManagement
        TO DISK = @BackupFile
        WITH FORMAT, COMPRESSION, STATS = 10;
    ';

EXEC dbo.sp_add_jobschedule
    @job_name = N'ITAssetManagement_FullBackup',
    @name = N'Daily at 2 AM',
    @freq_type = 4,  -- Daily
    @freq_interval = 1,
    @active_start_time = 020000;  -- 2:00 AM
```

### Database Performance Optimization

#### Index Maintenance

```sql
-- Rebuild fragmented indexes
DECLARE @TableName NVARCHAR(255);
DECLARE @IndexName NVARCHAR(255);
DECLARE @Fragmentation FLOAT;

DECLARE index_cursor CURSOR FOR
SELECT 
    OBJECT_NAME(ips.object_id) AS TableName,
    i.name AS IndexName,
    ips.avg_fragmentation_in_percent AS Fragmentation
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 10
AND i.name IS NOT NULL;

OPEN index_cursor;
FETCH NEXT FROM index_cursor INTO @TableName, @IndexName, @Fragmentation;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF @Fragmentation > 30
    BEGIN
        -- Rebuild if fragmentation > 30%
        EXEC('ALTER INDEX ' + @IndexName + ' ON ' + @TableName + ' REBUILD');
    END
    ELSE
    BEGIN
        -- Reorganize if fragmentation between 10-30%
        EXEC('ALTER INDEX ' + @IndexName + ' ON ' + @TableName + ' REORGANIZE');
    END
    
    FETCH NEXT FROM index_cursor INTO @TableName, @IndexName, @Fragmentation;
END

CLOSE index_cursor;
DEALLOCATE index_cursor;
```

#### Update Statistics

```sql
-- Update statistics for all tables
EXEC sp_updatestats;

-- Update statistics for specific table with full scan
UPDATE STATISTICS Assets WITH FULLSCAN;
```

#### Query Performance Monitoring

```sql
-- Find slow queries
SELECT TOP 20
    qs.execution_count,
    qs.total_elapsed_time / 1000000.0 AS total_elapsed_time_sec,
    qs.total_elapsed_time / qs.execution_count / 1000000.0 AS avg_elapsed_time_sec,
    SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(qt.text)
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset)/2)+1) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
ORDER BY qs.total_elapsed_time DESC;
```

### Database Connection Pooling

```properties
# application.properties
spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=ITAssetManagement;encrypt=true;trustServerCertificate=true
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
spring.datasource.driver-class-name=com.microsoft.sqlserver.jdbc.SQLServerDriver

# HikariCP connection pool settings
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.pool-name=ITAssetManagementPool
```

## Application Configuration

### Environment-Specific Configuration

#### application.properties (Base)

```properties
# Application
spring.application.name=it-asset-management
server.port=8080

# Database
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.SQLServerDialect

# Logging
logging.level.root=INFO
logging.level.com.company.assetmanagement=DEBUG
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} - %msg%n
logging.pattern.file=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n

# Security
jwt.secret=${JWT_SECRET}
jwt.expiration=1800000
jwt.refresh-expiration=86400000

# File Upload
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB
```

#### application-dev.properties

```properties
# Development environment
spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=ITAssetManagement_Dev
spring.jpa.show-sql=true

# Logging
logging.level.org.springframework.web=DEBUG
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE

# CORS
cors.allowed-origins=http://localhost:4200

# Disable security for development (optional)
# spring.security.enabled=false
```

#### application-test.properties

```properties
# Test environment
spring.datasource.url=jdbc:sqlserver://test-db-server:1433;databaseName=ITAssetManagement_Test

# Logging
logging.level.root=WARN
logging.level.com.company.assetmanagement=INFO

# CORS
cors.allowed-origins=http://test.example.com
```

#### application-prod.properties

```properties
# Production environment
spring.datasource.url=jdbc:sqlserver://prod-db-server:1433;databaseName=ITAssetManagement

# Logging
logging.level.root=WARN
logging.level.com.company.assetmanagement=INFO
logging.file.name=/var/log/it-asset-management/application.log
logging.file.max-size=10MB
logging.file.max-history=30

# CORS
cors.allowed-origins=https://app.example.com

# Actuator
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.health.show-details=when-authorized
```

### Environment Variables

```bash
# Database
export DB_USERNAME=assetmgmt_user
export DB_PASSWORD=SecurePassword123!

# JWT
export JWT_SECRET=YourVeryLongAndSecureSecretKeyHere

# Application
export SPRING_PROFILES_ACTIVE=prod
export SERVER_PORT=8080
```

## Deployment Strategies

### Docker Deployment

#### Dockerfile (Backend)

```dockerfile
# Multi-stage build
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/it-asset-management-*.jar app.jar

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### Dockerfile (Frontend)

```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --prod

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist/it-asset-management /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  database:
    image: mcr.microsoft.com/mssql/server:2019-latest
    container_name: it-asset-db
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=YourStrong@Passw0rd
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    volumes:
      - sqldata:/var/opt/mssql
    networks:
      - asset-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: it-asset-backend
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      - DB_USERNAME=sa
      - DB_PASSWORD=YourStrong@Passw0rd
      - JWT_SECRET=YourVeryLongAndSecureSecretKeyHere
      - SPRING_DATASOURCE_URL=jdbc:sqlserver://database:1433;databaseName=ITAssetManagement
    ports:
      - "8080:8080"
    depends_on:
      - database
    networks:
      - asset-network
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: it-asset-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - asset-network
    restart: unless-stopped

volumes:
  sqldata:

networks:
  asset-network:
    driver: bridge
```

### Kubernetes Deployment

#### backend-deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: it-asset-backend
  labels:
    app: it-asset-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: it-asset-backend
  template:
    metadata:
      labels:
        app: it-asset-backend
    spec:
      containers:
      - name: backend
        image: your-registry/it-asset-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: it-asset-backend-service
spec:
  selector:
    app: it-asset-backend
  ports:
  - protocol: TCP
    port: 8080
    targetPort: 8080
  type: ClusterIP
```

#### frontend-deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: it-asset-frontend
  labels:
    app: it-asset-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: it-asset-frontend
  template:
    metadata:
      labels:
        app: it-asset-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/it-asset-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: it-asset-frontend-service
spec:
  selector:
    app: it-asset-frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: LoadBalancer
```

#### secrets.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:
  username: assetmgmt_user
  password: SecurePassword123!
---
apiVersion: v1
kind: Secret
metadata:
  name: jwt-secret
type: Opaque
stringData:
  secret: YourVeryLongAndSecureSecretKeyHere
```

### CI/CD Pipeline

#### GitHub Actions Workflow

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
    
    - name: Run tests
      run: ./mvnw test
    
    - name: Run property-based tests
      run: ./mvnw test -Dtest=**/*PropertyTest
    
    - name: Generate coverage report
      run: ./mvnw jacoco:report
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
    
    - name: Build with Maven
      run: ./mvnw clean package -DskipTests
    
    - name: Build Docker image
      run: docker build -t your-registry/it-asset-backend:${{ github.sha }} .
    
    - name: Push Docker image
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push your-registry/it-asset-backend:${{ github.sha }}
        docker tag your-registry/it-asset-backend:${{ github.sha }} your-registry/it-asset-backend:latest
        docker push your-registry/it-asset-backend:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v4
      with:
        manifests: |
          k8s/backend-deployment.yaml
          k8s/frontend-deployment.yaml
        images: |
          your-registry/it-asset-backend:${{ github.sha }}
        kubectl-version: 'latest'
```

## Monitoring and Logging

### Application Monitoring with Spring Boot Actuator

```properties
# application.properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.health.show-details=when-authorized
management.metrics.export.prometheus.enabled=true
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'it-asset-management'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['backend:8080']
```

### Grafana Dashboard

Create dashboards to monitor:
- Request rate and latency
- Error rates
- Database connection pool metrics
- JVM memory and CPU usage
- Custom business metrics (assets created, tickets processed)

### Centralized Logging with ELK Stack

#### Logback Configuration

```xml
<!-- logback-spring.xml -->
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
    </appender>
    
    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>/var/log/it-asset-management/application.log</file>
        <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>/var/log/it-asset-management/application-%d{yyyy-MM-dd}.log</fileNamePattern>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
    </appender>
    
    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="FILE"/>
    </root>
</configuration>
```

## Security Best Practices

### SSL/TLS Configuration

```properties
# application.properties
server.ssl.enabled=true
server.ssl.key-store=classpath:keystore.p12
server.ssl.key-store-password=${KEYSTORE_PASSWORD}
server.ssl.key-store-type=PKCS12
server.ssl.key-alias=tomcat
```

### Security Headers

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .headers()
                .contentSecurityPolicy("default-src 'self'")
                .and()
                .xssProtection()
                .and()
                .frameOptions().deny()
                .and()
                .httpStrictTransportSecurity()
                    .maxAgeInSeconds(31536000)
                    .includeSubDomains(true);
        
        return http.build();
    }
}
```

### Secrets Management

Use environment variables or secret management services (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) for sensitive data:

```java
@Configuration
public class DatabaseConfig {
    
    @Value("${DB_USERNAME}")
    private String username;
    
    @Value("${DB_PASSWORD}")
    private String password;
    
    // Configuration
}
```

## Disaster Recovery

### Recovery Time Objective (RTO)

Target: 4 hours

### Recovery Point Objective (RPO)

Target: 15 minutes (transaction log backup frequency)

### Disaster Recovery Plan

1. **Database Restore**
   - Restore latest full backup
   - Apply differential backup
   - Apply transaction log backups

2. **Application Deployment**
   - Deploy application from container registry
   - Configure environment variables
   - Verify health checks

3. **Verification**
   - Test critical workflows
   - Verify data integrity
   - Monitor error logs

### DR Testing Schedule

- **Quarterly**: Full DR drill
- **Monthly**: Database restore test
- **Weekly**: Backup verification

## Best Practices

1. **Database**
   - Use migrations for schema changes
   - Maintain regular backups
   - Monitor performance metrics
   - Optimize indexes regularly

2. **Deployment**
   - Use containerization
   - Implement blue-green deployments
   - Automate with CI/CD
   - Version all artifacts

3. **Monitoring**
   - Set up alerts for critical metrics
   - Monitor application and database health
   - Track business metrics
   - Centralize logs

4. **Security**
   - Use HTTPS everywhere
   - Rotate secrets regularly
   - Keep dependencies updated
   - Implement rate limiting

5. **Disaster Recovery**
   - Test backups regularly
   - Document recovery procedures
   - Maintain off-site backups
   - Practice DR drills
