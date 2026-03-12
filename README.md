# gassist

A CLI tool for managing git repositories, branches, and workflows interactively with a user-friendly interface.

## Install

### From npm (Recommended)

```bash
npm install -g gassist
```

**Linux users (one-time setup):**

If you get permission errors, configure npm once:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

After this one-time setup, you can use `npm install -g` for any package without sudo or permission issues.

### From source

For development or to install from source:

```bash
git clone https://github.com/aikengunay/gasi.git
cd gasi
npm install -g .
```

The `-g` flag installs the package globally, making `gassist` available from any directory in your terminal.

## Usage

```bash
gassist
```

Run `gassist` from within any git repository directory. The tool will show your current status and guide you through git workflows and branch management.

**Examples:**

```bash
# Interactive git workflow management
gassist

# Show version
gassist --version

# Show help
gassist --help
```

## Features

- View repository status (current branch, ahead/behind commits, uncommitted changes)
- Fetch latest changes from remote
- Pull latest changes for current branch
- Interactive branch switching with local/remote indicators
- Create new branches with conventional naming (feature/, fix/, chore/, docs/, refactor/, test/, style/, perf/, hotfix/)
- Merge branches into main/master with conflict detection
- Delete branches (local and remote) after merging
- Automatic branch creation from remote if needed
- Stash uncommitted changes before switching/merging (optional)
- Branch name validation (kebab-case format)
- Colored output for better UX
- Cross-platform support (Windows, macOS, Linux)

## Requirements

- Node.js 14 or higher
- Git
- npm

## Platform Support

### Windows

Full support via Git for Windows

### macOS

Full support

### Linux

Full support (for npm global installs, configure npm prefix to avoid permission errors - see Install section)

## Uninstall

```bash
npm uninstall -g gassist
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
