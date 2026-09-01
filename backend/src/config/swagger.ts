import { Express } from "express"
import swaggerUi from "swagger-ui-express"
import swaggerJsdoc from "swagger-jsdoc"

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "NeuroStack AI Developer Platform API",
      version: "1.0.0",
      description: `
Welcome to the NeuroStack AI Developer API.
This API allows developers to programmatically upload knowledge documents, perform semantic search, initiate chat sessions with context, and execute modular workspace tools.

### Authentication
The API supports two authentication mechanisms:
1. **API Keys**: Pass your API Key in the \`X-API-Key\` header. API keys start with the prefix \`ns_\`.
2. **Bearer Token**: Pass your JWT token in the \`Authorization: Bearer <TOKEN>\` header.
      `,
    },
    servers: [
      {
        url: "/api",
        description: "Main API Prefix",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Developer API Key with 'ns_' prefix",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Client JWT token",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error description" },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // scan routes directory for jsdoc comments
}

const swaggerSpec = swaggerJsdoc(options)

export function setupSwagger(app: Express): void {
  // Only serve Swagger UI in development/test
  if (process.env.NODE_ENV !== "production") {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
    console.log("📝 Swagger documentation available at http://localhost:5000/api-docs")
  }
}
