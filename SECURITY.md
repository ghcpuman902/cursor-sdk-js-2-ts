# Security Policy

## ⚠️ Important Security Notice

**Multi-Repo Agent Manager is designed for LOCAL USE ONLY.**

This application gives AI agents file system access to modify code in your repositories. Please understand the security implications before using this tool.

## 🔒 Security Considerations

### File System Access

- **Home Directory Access**: By default, agents can access your entire home directory (`~/Users/username` on Mac, `C:\Users\username` on Windows)
- **Write Permissions**: Agents have full read/write access to modify files in their working directories
- **No Sandboxing**: Agents are not sandboxed and can execute shell commands

### Risk Mitigation

To use this tool safely:

1. **✅ Always Use Version Control**
   - Ensure all repositories are under git version control
   - Review all changes made by agents before committing
   - Use `git diff` to inspect modifications

2. **✅ Restrict Agent Access**
   - Open `app/api/agent/route.ts`
   - Find the line: `// Gets ~/Users/username on Mac, C:\Users\username on Windows`
   - Update to a specific controlled directory (e.g., `~/dev/ai-safe-projects`)

3. **✅ Test on Non-Critical Projects First**
   - Don't run agents on production codebases initially
   - Test with copied/cloned repositories
   - Verify agent behavior on expendable projects

4. **✅ Monitor Agent Activity**
   - Watch the real-time streaming output
   - Check what files the agent is modifying
   - Stop agents if they behave unexpectedly

5. **✅ Review Before Committing**
   - Never blindly commit agent changes
   - Read through all modifications
   - Test that the code still works as expected

### What Agents Can Do

Agents have capabilities to:
- ✏️ Read and modify files
- 🗑️ Delete files
- 📁 Create new files and directories
- 🔧 Run shell commands (npm install, git commands, etc.)
- 📦 Modify package.json and install dependencies

### What Agents Cannot Do

- 🚫 Access network resources (beyond API calls to Cursor)
- 🚫 Modify files outside the specified working directory (unless you give broader permissions)
- 🚫 Access system files (unless running with elevated permissions)

## 🛡️ Recommended Setup

### For Maximum Safety

```bash
# Create a dedicated directory for AI agent work
mkdir -p ~/dev/ai-workspace

# Clone repositories to this dedicated space
cd ~/dev/ai-workspace
git clone <repo-url>

# Update app/api/agent/route.ts to point to this directory
# Then only scan/work within ~/dev/ai-workspace
```

### Environment Isolation

Consider running the app in a:
- Virtual machine
- Docker container
- Dedicated user account with limited permissions

## 🐛 Reporting Security Vulnerabilities

If you discover a security vulnerability in Multi-Repo Agent Manager:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to: [your-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work on a fix.

## 📋 Security Checklist

Before using Multi-Repo Agent Manager:

- [ ] I understand agents have file system access
- [ ] All my repositories are under version control (git)
- [ ] I will review all changes before committing
- [ ] I have considered restricting agent access to a specific folder
- [ ] I will not use this on production codebases without testing first
- [ ] I have backups of important code
- [ ] I accept the risks of using AI agents with code modification capabilities

## 📝 Disclaimer

This software is provided "as is" without warranty of any kind. Use at your own risk. The authors and contributors are not responsible for any damage, data loss, or security issues resulting from the use of this software.

By using Multi-Repo Agent Manager, you acknowledge that:
- You understand the security implications
- You take full responsibility for any modifications made by AI agents
- You will not hold the authors liable for any issues

## 🔄 Updates

This security policy may be updated as new features are added or security considerations are identified. Please check back regularly.

---

**Last Updated**: December 10, 2025
