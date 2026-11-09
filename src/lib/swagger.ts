import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AmazeCC API Documentation',
      version: '1.0.0',
      description: 'API documentation for the AmazeCC backend services.',
    },
    servers: [
      {
        url: 'https://api.amazecc.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local server',
      },
    ],
  },
  // Scan all API routes in the app folder for JSDoc comments
  // plus the shared components in src/lib/openapi.
  apis: ['./src/app/api/**/*.ts', './src/app/api/**/*.js', './src/lib/openapi/*.ts'],
};

export const getApiDocs = () => {
  return swaggerJsdoc(options);
};
