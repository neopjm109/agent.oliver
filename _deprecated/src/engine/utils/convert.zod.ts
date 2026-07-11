import { z, ZodType } from "zod";

export interface ParameterSchema {
  type: "string" | "number" | "boolean" | "object" | "array";

  description?: string;

  required?: boolean;

  enum?: string[];

  properties?: Record<string, ParameterSchema>;

  items?: ParameterSchema;
}

export function convertToZodSchema(
  properties: Record<string, ParameterSchema>,
) {
  const shape: Record<string, ZodType> = {};

  for (const [key, schema] of Object.entries(properties)) {
    let field = createZodField(schema);

    if (schema.description) {
      field = field.describe(schema.description);
    }

    if (!schema.required) {
      field = field.optional().nullable();
    }

    shape[key] = field;
  }

  return z.object(shape);
}

function createZodField(schema: ParameterSchema): ZodType {
  switch (schema.type) {
    case "string": {
      if (schema.enum?.length) {
        return z.enum(schema.enum as [string, ...string[]]);
      }

      return z.string();
    }

    case "number":
      return z.number();

    case "boolean":
      return z.boolean();

    case "array": {
      if (!schema.items) {
        return z.array(z.any());
      }

      return z.array(createZodField(schema.items));
    }

    case "object": {
      const nestedShape: Record<string, ZodType> = {};

      for (const [key, value] of Object.entries(schema.properties ?? {})) {
        let field = createZodField(value);

        if (value.description) {
          field = field.describe(value.description);
        }

        if (!value.required) {
          field = field.optional().nullable();
        }

        nestedShape[key] = field;
      }

      return z.object(nestedShape);
    }

    default:
      return z.any();
  }
}
