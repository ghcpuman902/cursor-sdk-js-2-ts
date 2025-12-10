# Contributing to Multi-Repo Agent Manager

Thank you for your interest in contributing to Multi-Repo Agent Manager! We appreciate your support and welcome contributions of all kinds.

## 🌟 Ways to Contribute

- 🐛 **Report bugs** - Help us identify and fix issues
- ✨ **Suggest features** - Share your ideas for improvements
- 📝 **Improve documentation** - Make our docs clearer and more comprehensive
- 🔧 **Submit code** - Fix bugs or implement new features
- 🎨 **Design improvements** - Enhance the UI/UX
- 🧪 **Write tests** - Improve code reliability

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm package manager
- Git
- Cursor API key (for testing)

### Development Setup

1. **Fork the repository**

   Click the "Fork" button at the top right of the repository page.

2. **Clone your fork**

   ```bash
   git clone https://github.com/your-username/multi-repo-agent-manager.git
   cd multi-repo-agent-manager
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/cursor-ai/multi-repo-agent-manager.git
   ```

4. **Install dependencies**

   ```bash
   pnpm install
   ```

5. **Create environment file**

   ```bash
   echo "CURSOR_API_KEY=your_key_here" > .env.local
   ```

6. **Start development server**

   ```bash
   pnpm dev
   ```

   Open http://localhost:3088 in your browser.

## 🔧 Development Workflow

### Creating a Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes
- `chore/` - Maintenance tasks

### Making Changes

1. **Write clean code**
   - Follow existing code style
   - Use TypeScript types
   - Keep functions small and focused
   - Add comments for complex logic

2. **Follow conventions**
   - Use `const` for function declarations
   - Name event handlers with `handle` prefix (e.g., `handleClick`)
   - Use descriptive variable names
   - Follow early return pattern

3. **Test your changes**
   - Test all affected functionality
   - Check for console errors
   - Test with multiple repositories
   - Verify database persistence

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "type: brief description"
   ```

   Commit message types:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Test additions or changes
   - `chore:` - Maintenance tasks

   Example:
   ```bash
   git commit -m "feat: add support for Vue.js detection"
   git commit -m "fix: resolve database locking issue"
   git commit -m "docs: improve installation instructions"
   ```

### Submitting a Pull Request

1. **Push your branch**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create pull request**

   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template

3. **PR Title Format**

   ```
   type: brief description
   ```

   Example:
   ```
   feat: add Python repository detection
   fix: resolve SSE connection timeout
   docs: add troubleshooting section
   ```

4. **PR Description**

   Include:
   - **What**: What changes did you make?
   - **Why**: Why are these changes needed?
   - **How**: How did you implement the changes?
   - **Testing**: How did you test the changes?
   - **Screenshots**: Add screenshots if UI changes

5. **Wait for review**

   - Maintainers will review your PR
   - Address feedback if requested
   - Once approved, we'll merge it!

## 📝 Code Style Guidelines

### TypeScript

```typescript
// Good: Use const for functions
const handleSubmit = async (data: FormData) => {
  // Implementation
};

// Good: Use descriptive names
const fetchRepositoryMetadata = async (path: string) => {
  // Implementation
};

// Good: Use early returns
const validatePath = (path: string) => {
  if (!path) return false;
  if (!isDirectory(path)) return false;
  return true;
};

// Good: Type everything
interface Repository {
  name: string;
  path: string;
  framework: string;
  isTypeScript: boolean;
}
```

### React Components

```typescript
// Good: Destructure props
const RepoCard = ({ name, path, framework }: RepoCardProps) => {
  // Implementation
};

// Good: Use descriptive event handler names
const handleScanClick = () => {
  // Implementation
};

// Good: Keep components focused
const TaskTab = ({ task, onSelect }: TaskTabProps) => {
  return (
    <button onClick={handleSelect}>
      {task.name}
    </button>
  );
};
```

### Tailwind CSS

```typescript
// Good: Use Tailwind utility classes
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">

// Good: Use semantic color variables
<div className="text-primary bg-primary-foreground">

// Avoid: Hardcoded colors
<div className="text-[#000000] bg-[#ffffff]">
```

## 🐛 Reporting Bugs

Found a bug? Help us fix it!

### Before Reporting

1. **Search existing issues** - Your bug might already be reported
2. **Try latest version** - The bug might already be fixed
3. **Verify it's reproducible** - Can you make it happen again?

### Bug Report Template

```markdown
**Description**
A clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
What should happen?

**Actual Behavior**
What actually happens?

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g., macOS 14.0]
- Node.js: [e.g., 20.10.0]
- pnpm: [e.g., 8.15.0]
- Browser: [e.g., Chrome 120]

**Additional Context**
Any other relevant information.
```

## ✨ Feature Requests

Have an idea? We'd love to hear it!

### Feature Request Template

```markdown
**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How would you implement this?

**Alternatives Considered**
What other approaches did you think about?

**Use Cases**
Who would benefit from this feature?

**Additional Context**
Any mockups, examples, or references?
```

## 📖 Documentation

Documentation improvements are always welcome!

### Areas to Improve

- **Installation guides** - Make setup easier
- **Tutorials** - Step-by-step guides
- **API documentation** - Better endpoint docs
- **Troubleshooting** - Common issues and solutions
- **Examples** - More use case examples

## 🧪 Testing

Currently, we don't have automated tests (contributions welcome!).

### Manual Testing Checklist

- [ ] Repository scanning works correctly
- [ ] All pre-built actions execute successfully
- [ ] Custom prompts work as expected
- [ ] Task persistence survives app restart
- [ ] Multiple agents can run simultaneously
- [ ] UI updates in real-time
- [ ] No console errors
- [ ] Database operations complete without errors

## 🎨 UI/UX Contributions

Design improvements are welcome!

### Guidelines

- **Consistency** - Follow existing design patterns
- **Accessibility** - Ensure WCAG 2.1 AA compliance
- **Responsiveness** - Test on different screen sizes
- **Performance** - Avoid heavy animations
- **Dark mode** - Support both light and dark themes

## 📞 Getting Help

Need assistance?

- **GitHub Discussions** - Ask questions and share ideas
- **GitHub Issues** - Report bugs and request features
- **Documentation** - Check the docs first

## 📜 Code of Conduct

Be respectful and inclusive:

- Use welcoming and inclusive language
- Respect differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You

Your contributions make this project better for everyone. Thank you for taking the time to contribute!

---

**Happy coding! 🚀**
