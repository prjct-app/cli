# Security Checklist

> ALWAYS ON - Applies to ALL applications

## Input/Output
- [ ] All user input validated and sanitized
- [ ] Output encoded appropriately (prevent injection)
- [ ] File uploads restricted and scanned
- [ ] No sensitive data in logs or error messages

## Authentication & Authorization
- [ ] Strong authentication mechanism
- [ ] Proper session management
- [ ] Authorization checked at every access point
- [ ] Principle of least privilege applied

## Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] Secure transmission (TLS/HTTPS)
- [ ] PII handled according to regulations
- [ ] Data retention policies followed

## Dependencies
- [ ] Dependencies from trusted sources
- [ ] Known vulnerabilities checked
- [ ] Minimal dependency surface
- [ ] Regular security updates planned

## API Security
- [ ] Rate limiting implemented
- [ ] Authentication required for sensitive endpoints
- [ ] CORS properly configured
- [ ] API keys/tokens secured
