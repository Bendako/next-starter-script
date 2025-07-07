/**
 * Security utilities for the Next.js Starter MCP Server
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates app name according to npm package naming rules
 */
export function validateAppName(name: string): ValidationResult {
  if (!name) {
    return { isValid: false, error: 'App name is required' };
  }

  if (name.length < 1 || name.length > 214) {
    return { isValid: false, error: 'App name must be between 1 and 214 characters' };
  }

  if (!/^[a-z0-9-_]+$/.test(name)) {
    return { isValid: false, error: 'App name can only contain lowercase letters, numbers, hyphens, and underscores' };
  }

  if (name.startsWith('-') || name.startsWith('_') || name.startsWith('.')) {
    return { isValid: false, error: 'App name cannot start with -, _, or .' };
  }

  // Reserved names that shouldn't be used
  const reservedNames = [
    'node_modules', 'favicon.ico', 'test', 'www', 'admin', 'api',
    'app', 'src', 'public', 'assets', 'static', 'build', 'dist'
  ];
  
  if (reservedNames.includes(name.toLowerCase())) {
    return { isValid: false, error: `"${name}" is a reserved name` };
  }

  return { isValid: true };
}

/**
 * Validates directory path for security
 */
export function validateDirectory(directory: string): ValidationResult {
  if (!directory) {
    return { isValid: true }; // Optional parameter
  }

  // Prevent path traversal attacks
  if (directory.includes('..') || directory.includes('~')) {
    return { isValid: false, error: 'Directory path cannot contain .. or ~' };
  }

  // Ensure it's an absolute path for better security
  if (!directory.startsWith('/')) {
    return { isValid: false, error: 'Directory must be an absolute path (e.g., /Users/username/projects)' };
  }

  // Prevent writing to system directories
  const dangerousPaths = ['/etc', '/usr', '/bin', '/sbin', '/var', '/sys', '/proc'];
  const isDangerous = dangerousPaths.some(path => directory.startsWith(path));
  
  if (isDangerous) {
    return { isValid: false, error: 'Cannot create projects in system directories' };
  }

  return { isValid: true };
}

/**
 * Validates template name
 */
export function validateTemplate(template: string): ValidationResult {
  const validTemplates = ['default', 'minimal', 'full'];
  
  if (!validTemplates.includes(template)) {
    return { 
      isValid: false, 
      error: `Invalid template "${template}". Must be one of: ${validTemplates.join(', ')}` 
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes input strings to prevent command injection
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[;&|`$(){}[\]\\]/g, '') // Remove shell metacharacters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Validates all project configuration parameters
 */
export function validateProjectConfig(config: {
  name: string;
  directory?: string;
  template?: string;
}): ValidationResult {
  const nameValidation = validateAppName(config.name);
  if (!nameValidation.isValid) {
    return nameValidation;
  }

  if (config.directory) {
    const dirValidation = validateDirectory(config.directory);
    if (!dirValidation.isValid) {
      return dirValidation;
    }
  }

  if (config.template) {
    const templateValidation = validateTemplate(config.template);
    if (!templateValidation.isValid) {
      return templateValidation;
    }
  }

  return { isValid: true };
} 