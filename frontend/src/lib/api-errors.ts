import { PASSWORD_MIN_LENGTH } from "@/lib/validation";



const GIN_VALIDATION_RE =

  /Key:\s*'[^']*'\s*Error:Field validation for '([^']+)' failed on the '([^']+)' tag/g;



/** Known backend constraints (gin binding tags in backend/internal/users/users.go). */

const FIELD_MIN_LENGTH: Record<string, number> = {

  Password: PASSWORD_MIN_LENGTH,

  NewPassword: PASSWORD_MIN_LENGTH,

  new_password: PASSWORD_MIN_LENGTH,

};



const FIELD_ONE_OF: Record<string, string> = {

  Role: "admin or viewer",

  role: "admin or viewer",

};



function humanizeFieldName(field: string): string {

  const name = field.includes(".") ? (field.split(".").pop() ?? field) : field;

  const spaced = name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);

}



function formatValidationIssue(field: string, tag: string): string {

  const label = humanizeFieldName(field);



  switch (tag) {

    case "required":

      return `${label} is required.`;

    case "min": {

      const min = FIELD_MIN_LENGTH[field];

      return min

        ? `${label} must be at least ${min} characters.`

        : `${label} is too short.`;

    }

    case "max":

      return `${label} is too long.`;

    case "oneof": {

      const allowed = FIELD_ONE_OF[field];

      return allowed

        ? `${label} must be ${allowed}.`

        : `${label} has an invalid value.`;

    }

    case "email":

      return `${label} must be a valid email address.`;

    default:

      return `${label} is invalid.`;

  }

}



function parseGinValidationErrors(message: string): string[] {

  const issues: string[] = [];

  for (const match of message.matchAll(GIN_VALIDATION_RE)) {

    const [, field, tag] = match;

    if (field && tag) issues.push(formatValidationIssue(field, tag));

  }

  return issues;

}



/**

 * Converts raw API error strings (especially Gin validator output) into user-friendly text.

 */

export function formatApiErrorMessage(raw: string): string {

  const message = raw.trim();

  if (!message) return "Something went wrong. Please try again.";



  const validationIssues = parseGinValidationErrors(message);

  if (validationIssues.length > 0) {

    return validationIssues.join("\n");

  }



  return message;

}



export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {

  if (err instanceof Error && err.message.trim()) {

    return formatApiErrorMessage(err.message);

  }

  return fallback;

}

