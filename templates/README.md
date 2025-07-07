# Templates Directory

This directory contains template files and configurations used by the `create-next-starter.sh` script.

## Structure

```
templates/
├── minimal/           # Minimal template files
│   ├── components/    # Basic components
│   ├── styles/        # Basic styles
│   └── configs/       # Minimal configurations
├── default/           # Default template files
│   ├── components/    # Standard components
│   ├── styles/        # Standard styles
│   └── configs/       # Standard configurations
└── full/              # Full-featured template files
    ├── components/    # Advanced components
    ├── styles/        # Full styles
    └── configs/       # Full configurations
```

## Usage

These templates are automatically used by the main script when creating new projects. The script selects the appropriate template based on the `--template` flag or interactive selection.

## Contributing

To add new templates or modify existing ones:

1. Create/modify files in the appropriate template directory
2. Ensure your templates follow the naming conventions
3. Test with the main script using `--dry-run`
4. Submit a pull request with your changes

## Template Variables

Templates can use these variables for substitution:
- `{{APP_NAME}}` - The application name
- `{{AUTHOR}}` - The author name
- `{{DESCRIPTION}}` - Project description
- `{{VERSION}}` - Initial version

Templates are processed during project creation to replace these variables with actual values. 