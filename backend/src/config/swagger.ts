import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title:       'Smart Attendance System API',
      version,
      description: 'Multi-factor attendance verification: QR + Face + Geofence',
      contact: {
        name:  'Engineering Team',
        email: 'engineering@greenfield.edu',
      },
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Development' },
      { url: 'https://api.attendance.greenfield.edu', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'Access token from POST /api/auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:            { type: 'string', format: 'uuid' },
            email:         { type: 'string', format: 'email' },
            firstName:     { type: 'string' },
            lastName:      { type: 'string' },
            role:          { type: 'string', enum: ['student', 'faculty', 'admin', 'parent'] },
            status:        { type: 'string', enum: ['active', 'inactive', 'suspended', 'pending_verification'] },
            emailVerified: { type: 'boolean' },
            lastLoginAt:   { type: 'string', format: 'date-time', nullable: true },
            createdAt:     { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code:    { type: 'string' },
              },
            },
          },
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string' },
            refreshToken: { type: 'string' },
            expiresAt:    { type: 'string', format: 'date-time' },
            sessionId:    { type: 'string', format: 'uuid' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid token',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    tags: [
      { name: 'Auth',  description: 'Authentication and session management' },
      { name: 'Users', description: 'User profile and admin management' },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
