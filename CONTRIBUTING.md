# Contributing to Firebase Crashlytics MCP Server

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/mcp-crashlytics-server.git
   cd mcp-crashlytics-server
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Build the project**:
   ```bash
   npm run build
   ```

## 🛠️ Development Workflow

### Setting up Development Environment

1. **Create a test Firebase project** for development
2. **Set up your `.env` file** with test credentials
3. **Run in development mode**:
   ```bash
   npm run dev
   ```

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards:
   - Use TypeScript
   - Follow existing code style
   - Add JSDoc comments for public functions
   - Keep functions small and focused

3. **Test your changes**:
   ```bash
   npm run build
   npm test
   npm run lint
   ```

### Commit Guidelines

Use clear, descriptive commit messages:

```bash
git commit -m "feat: add support for iOS crash analysis"
git commit -m "fix: handle empty crash data gracefully"
git commit -m "docs: update README with new installation steps"
```

**Commit Types:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation updates
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions/updates
- `chore:` - Maintenance tasks

## 📝 Code Standards

### TypeScript
- Use strict TypeScript settings
- Provide proper type annotations
- Avoid `any` types when possible

### Code Organization
- Keep related functionality together
- Use meaningful variable and function names
- Follow the existing file structure

### Error Handling
- Always handle BigQuery API errors
- Provide helpful error messages
- Log errors appropriately

## 🧪 Testing

### Running Tests
```bash
npm test                # Run all tests
npm test -- --watch     # Run tests in watch mode
npm test -- --coverage  # Run with coverage
```

### Writing Tests
- Add tests for new functionality
- Test error conditions
- Use descriptive test names

## 📖 Documentation

### README Updates
- Update the README for new features
- Include usage examples
- Keep troubleshooting section current

### Code Documentation
- Add JSDoc comments for public APIs
- Document complex logic
- Include parameter types and descriptions

## 🔍 Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Ensure all tests pass**:
   ```bash
   npm run build
   npm test
   npm run lint
   ```

4. **Create a Pull Request** with:
   - Clear title describing the change
   - Detailed description of what changed
   - References to any related issues
   - Screenshots if UI changes

5. **Respond to feedback** during code review

## 🐛 Reporting Issues

### Bug Reports
Include:
- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (Node.js version, OS)
- Error messages or logs
- Firebase project setup details

### Feature Requests
Include:
- Clear description of the feature
- Use case explaining why it's needed
- Possible implementation approaches
- Examples of expected usage

## 🔒 Security

- Never commit credentials or API keys
- Follow secure coding practices
- Report security issues privately

## 📞 Getting Help

- **Questions?** Open a [Discussion](https://github.com/your-username/mcp-crashlytics-server/discussions)
- **Bug?** Open an [Issue](https://github.com/your-username/mcp-crashlytics-server/issues)
- **Feature idea?** Open a [Feature Request](https://github.com/your-username/mcp-crashlytics-server/issues/new)

## 📜 Code of Conduct

Be respectful, inclusive, and collaborative. We welcome contributions from everyone regardless of experience level.

---

Thank you for contributing! 🎉