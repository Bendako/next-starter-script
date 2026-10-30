# Contributing to Next.js Starter MCP

Thank you for your interest in contributing to Next.js Starter MCP! This guide will help you get started.

## 🚀 Quick Start for Contributors

1. **Fork and Clone**
   ```bash
   git clone https://github.com/Bendako/next-starter-script.git
   cd next-starter-script
   ```

2. **Set Up Development Environment**
   ```bash
   # Make script executable
   chmod +x create-next-starter.sh
   
   # Set up MCP server for development
   cd mcp-server
   npm install
   npm run build
   ```

3. **Test Your Changes**
   ```bash
   # Test the main script
   ./create-next-starter.sh --test
   ./create-next-starter.sh --dry-run test-project
   
   # Test MCP server
   cd mcp-server
   npm run lint
   npm test
   ```

## 🎯 Types of Contributions

### 1. **Script Improvements**
- Bug fixes in `create-next-starter.sh`
- New command-line options
- Better error handling
- Performance optimizations
- Cross-platform compatibility

### 2. **MCP Server Enhancements**
- New MCP tools/commands
- Better error handling
- Improved Claude Desktop integration
- TypeScript improvements

### 3. **Templates**
- New project templates
- Component libraries
- Style variations
- Configuration presets

### 4. **Documentation**
- README improvements
- Usage examples
- API documentation
- Tutorial content

## 📋 Development Guidelines

### **Code Style**

**Bash Script (`create-next-starter.sh`):**
- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Follow existing function naming patterns
- Include error handling for all operations
- Use meaningful variable names

**TypeScript (MCP Server):**
- Follow ESLint rules (run `npm run lint`)
- Use TypeScript strict mode
- Add type annotations for complex objects
- Include JSDoc comments for public functions

### **Testing Requirements**

Before submitting a PR, ensure:

1. **Script tests pass:**
   ```bash
   ./create-next-starter.sh --test
   ./create-next-starter.sh --dry-run test-app
   ```

2. **MCP server builds and runs:**
   ```bash
   cd mcp-server
   npm run build
   npm test
   ```

3. **Manual testing:**
   - Test with different template options
   - Test error scenarios
   - Test on different operating systems (if possible)

### **Commit Guidelines**

Use conventional commit messages:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test improvements
- `chore:` Maintenance tasks

Examples:
```
feat: add blog template option
fix: resolve path issues on Windows
docs: improve MCP server setup guide
```

## 🔧 Development Areas

### **High-Priority Improvements**

1. **Template System Enhancement**
   - Add more template varieties (blog, e-commerce, portfolio)
   - Template inheritance system
   - Custom template creation tools

2. **MCP Server Features**
   - Template browser in Claude Desktop
   - Project configuration wizard
   - Integration with popular services

3. **Error Handling**
   - Better error messages
   - Recovery suggestions
   - Automatic retry mechanisms

4. **Performance**
   - Parallel dependency installation
   - Caching mechanisms
   - Faster template processing

### **Feature Requests**

Check our [Issues](https://github.com/Bendako/next-starter-script/issues) for:
- Feature requests labeled `enhancement`
- Bug reports labeled `bug`
- Help wanted items labeled `help wanted`

## 📤 Submitting Changes

### **Pull Request Process**

1. **Create a Feature Branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the development guidelines
   - Add tests if applicable
   - Update documentation

3. **Test Thoroughly**
   ```bash
   # Run all tests
   ./create-next-starter.sh --test
   cd mcp-server && npm run lint && npm test
   ```

4. **Submit Pull Request**
   - Clear title and description
   - Reference related issues
   - Include testing instructions
   - Add screenshots for UI changes

### **PR Review Process**

- Maintainers will review within 48 hours
- Address feedback promptly
- Ensure CI passes
- Squash commits if requested

## 🏗️ Project Architecture

### **Main Script Structure**
```
create-next-starter.sh
├── Configuration & Setup (lines 1-200)
├── Utility Functions (lines 200-800)
├── Core Logic (lines 800-2000)
├── Template Processing (lines 2000-2500)
└── Main Execution (lines 2500-2741)
```

### **MCP Server Structure**
```
mcp-server/
├── src/index.ts          # Main server implementation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── dist/                 # Built output
```

## 🐛 Reporting Issues

When reporting bugs, include:

1. **Environment Details**
   - Operating system
   - Node.js version
   - npm version
   - Script version

2. **Reproduction Steps**
   - Exact commands used
   - Expected vs actual behavior
   - Error messages and logs

3. **Additional Context**
   - Screenshots if applicable
   - Related configuration files
   - Any workarounds found

## 🆘 Getting Help

- **GitHub Discussions**: General questions and ideas
- **Issues**: Bug reports and feature requests
- **Discord**: Real-time community chat (coming soon)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Ready to contribute?** Check out our [Good First Issues](https://github.com/Bendako/next-starter-script/labels/good%20first%20issue) to get started! 🚀 