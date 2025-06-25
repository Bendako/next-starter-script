# Contributing to Next.js Starter MCP 🤝

Thank you for your interest in contributing! This project welcomes contributions from developers of all skill levels.

## 🚀 Ways to Contribute

### 1. **Report Issues**
- Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
- Include detailed reproduction steps
- Share your environment details

### 2. **Suggest Features**
- Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
- Explain the use case and benefits
- Consider backward compatibility

### 3. **Improve Documentation**
- Fix typos and clarify instructions
- Add examples and use cases
- Improve installation guides

### 4. **Enhance the Script**
- Add new template options
- Improve error handling
- Optimize performance
- Add new integrations

### 5. **Extend MCP Server**
- Add new tools/commands
- Improve Claude Desktop experience
- Enhanced error messages

## 🛠️ Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/next-starter.git
   cd next-starter
   ```

2. **Test the Script**
   ```bash
   chmod +x create-next-starter.sh
   ./create-next-starter.sh --test
   ```

3. **Test MCP Server**
   ```bash
   cd mcp-server
   npm install
   npm run build
   npm run dev
   ```

## 📋 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Test thoroughly

3. **Test your changes**
   - Run script tests: `./create-next-starter.sh --test`
   - Test MCP server functionality
   - Verify documentation updates

4. **Submit Pull Request**
   - Use clear, descriptive title
   - Explain what changes and why
   - Reference related issues

## ✅ Code Standards

### **Script Guidelines**
- Use clear, descriptive variable names
- Add error handling for all operations
- Include helpful user messages
- Maintain backward compatibility

### **MCP Server Guidelines**
- Follow TypeScript best practices
- Use proper error handling
- Add JSDoc comments
- Maintain type safety

### **Documentation Guidelines**
- Use clear, concise language
- Include code examples
- Keep instructions up-to-date
- Test all commands

## 🎯 Priority Areas

We're especially interested in contributions for:

- **New Templates**: Blog, e-commerce, portfolio variants
- **Framework Integrations**: Prisma, Supabase, Firebase
- **Developer Experience**: Better error messages, progress indicators
- **Claude Integration**: Enhanced natural language processing
- **Testing**: Automated testing, validation improvements

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community chat
- **Documentation**: Check README and MCP server docs first

## 🏆 Recognition

Contributors will be:
- Listed in our README contributors section
- Credited in release notes
- Invited to our contributor Discord (coming soon)

Thank you for helping make Next.js development faster and more accessible! 🙏 