// Runs before every test file (jest "setupFiles"). Test-only values, never real secrets.
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';
