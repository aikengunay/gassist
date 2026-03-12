#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const inquirer = require('inquirer');
const inquirerAutocompletePrompt = require('inquirer-autocomplete-prompt');
const chalk = require('chalk');

// Register the autocomplete prompt
inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt);

// Logging utilities
function log(message, type = 'info') {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
  };
  console.log(colors[type](message));
}

function error(message) {
  log(message, 'error');
  process.exit(1);
}

function success(message) {
  log(message, 'success');
}

// Git utilities
function checkGitInstalled() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function isGitRepository() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch (err) {
    return null;
  }
}

function getBranchStatus() {
  try {
    const branch = getCurrentBranch();
    if (!branch) return null;

    // Check if branch has upstream
    let upstream = null;
    try {
      upstream = execSync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { encoding: 'utf8', stdio: 'ignore' }).trim();
    } catch (err) {
      // No upstream configured
    }

    if (!upstream) {
      return { branch, ahead: 0, behind: 0, upstream: null };
    }

    // Get ahead/behind counts
    const status = execSync(`git rev-list --left-right --count ${branch}...${upstream}`, { encoding: 'utf8' }).trim();
    const [ahead, behind] = status.split('\t').map(Number);

    return { branch, ahead, behind, upstream };
  } catch (err) {
    return null;
  }
}

function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    return status.length > 0;
  } catch (err) {
    return false;
  }
}

function getUncommittedFiles() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (!status) return [];
    
    return status.split('\n').map(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      return { status, file };
    });
  } catch (err) {
    return [];
  }
}

function getLocalBranches() {
  try {
    const branches = execSync('git branch --format="%(refname:short)"', { encoding: 'utf8' }).trim();
    return branches ? branches.split('\n').filter(b => b.trim()) : [];
  } catch (err) {
    return [];
  }
}

function getRemoteBranches() {
  try {
    const branches = execSync('git branch -r --format="%(refname:short)"', { encoding: 'utf8' }).trim();
    return branches ? branches.split('\n').filter(b => b.trim() && !b.includes('HEAD')).map(b => b.trim()) : [];
  } catch (err) {
    return [];
  }
}

function getAllBranches() {
  const local = getLocalBranches();
  const remote = getRemoteBranches();
  
  // Remove 'origin/' prefix and deduplicate
  const remoteNames = remote.map(b => b.replace(/^origin\//, ''));
  const allBranches = [...new Set([...local, ...remoteNames])];
  
  return {
    local,
    remote: remoteNames,
    all: allBranches.sort()
  };
}

function fetchRemote() {
  try {
    log('Fetching latest changes from remote...', 'info');
    const result = spawnSync('git', ['fetch'], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      throw new Error(`Git fetch failed with exit code ${result.status}`);
    }
    
    success('✓ Fetch completed');
    return true;
  } catch (err) {
    error(`✗ Fetch failed: ${err.message}`);
    return false;
  }
}

function pullCurrentBranch() {
  try {
    const branch = getCurrentBranch();
    log(`Pulling latest changes for ${branch}...`, 'info');
    
    const result = spawnSync('git', ['pull'], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      throw new Error(`Git pull failed with exit code ${result.status}`);
    }
    
    success(`✓ Pull completed for ${branch}`);
    return true;
  } catch (err) {
    error(`✗ Pull failed: ${err.message}`);
    return false;
  }
}

function switchBranch(branchName) {
  try {
    log(`Switching to branch: ${branchName}...`, 'info');
    
    const result = spawnSync('git', ['checkout', branchName], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      // Try to create branch from remote if it doesn't exist locally
      const remoteBranches = getRemoteBranches();
      const remoteBranch = remoteBranches.find(b => b.includes(branchName));
      
      if (remoteBranch) {
        log(`Branch not found locally. Creating from ${remoteBranch}...`, 'info');
        const createResult = spawnSync('git', ['checkout', '-b', branchName, remoteBranch], {
          stdio: 'inherit',
        });
        
        if (createResult.status !== 0) {
          throw new Error(`Failed to create branch from ${remoteBranch}`);
        }
      } else {
        throw new Error(`Branch ${branchName} not found`);
      }
    }
    
    success(`✓ Switched to branch: ${branchName}`);
    return true;
  } catch (err) {
    error(`✗ Failed to switch branch: ${err.message}`);
    return false;
  }
}

function showStatus() {
  const status = getBranchStatus();
  const hasChanges = hasUncommittedChanges();
  const currentBranch = getCurrentBranch();
  
  console.log('\n' + chalk.bold('Repository Status:'));
  console.log(chalk.gray('─'.repeat(50)));
  
  if (status) {
    console.log(`Current branch: ${chalk.cyan(status.branch)}`);
    
    if (status.upstream) {
      if (status.ahead > 0) {
        console.log(chalk.yellow(`  ↑ ${status.ahead} commit(s) ahead of ${status.upstream}`));
      }
      if (status.behind > 0) {
        console.log(chalk.yellow(`  ↓ ${status.behind} commit(s) behind ${status.upstream}`));
      }
      if (status.ahead === 0 && status.behind === 0) {
        console.log(chalk.green(`  ✓ Up to date with ${status.upstream}`));
      }
    } else {
      console.log(chalk.yellow(`  ⚠ No upstream branch configured`));
    }
  } else {
    console.log(`Current branch: ${chalk.cyan(currentBranch || 'unknown')}`);
  }
  
  if (hasChanges) {
    const files = getUncommittedFiles();
    console.log(chalk.yellow(`\n⚠ Uncommitted changes:`));
    files.slice(0, 5).forEach(({ status, file }) => {
      const statusColor = status.includes('??') ? chalk.blue : chalk.yellow;
      console.log(`  ${statusColor(status)} ${file}`);
    });
    if (files.length > 5) {
      console.log(chalk.gray(`  ... and ${files.length - 5} more file(s)`));
    }
  } else {
    console.log(chalk.green(`\n✓ Working directory clean`));
  }
  
  console.log(chalk.gray('─'.repeat(50)) + '\n');
}

function showVersion() {
  const pkg = require('../package.json');
  console.log(pkg.version);
}

function showHelp() {
  console.log(`
${chalk.bold('gassist')} - Interactive git workflow and branch management

${chalk.bold('Usage:')}
  gassist                     Interactive git workflow management
  gassist --version           Show version
  gassist --help              Show this help message

${chalk.bold('Features:')}
  • View repository status (branch, ahead/behind, uncommitted changes)
  • Fetch latest changes from remote
  • Pull latest changes for current branch
  • Interactive branch switching with search
  • Create new branches with conventional naming (feature/, fix/, etc.)
  • Merge branches into main/master with conflict detection
  • Delete branches (local and remote) after merging
  • Automatic branch creation from remote if needed
`);
}

// Branch type definitions
const BRANCH_TYPES = [
  { name: 'feature', description: 'New feature', prefix: 'feature/' },
  { name: 'fix', description: 'Bug fix', prefix: 'fix/' },
  { name: 'hotfix', description: 'Urgent production fix', prefix: 'hotfix/' },
  { name: 'chore', description: 'Maintenance task', prefix: 'chore/' },
  { name: 'docs', description: 'Documentation changes', prefix: 'docs/' },
  { name: 'refactor', description: 'Code refactoring', prefix: 'refactor/' },
  { name: 'test', description: 'Adding/updating tests', prefix: 'test/' },
  { name: 'style', description: 'Code style changes', prefix: 'style/' },
  { name: 'perf', description: 'Performance improvements', prefix: 'perf/' },
];

function validateBranchName(name) {
  if (!name || name.trim() === '') {
    return 'Branch name cannot be empty';
  }
  
  const trimmed = name.trim();
  
  // Check for invalid characters
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    return 'Branch name must be lowercase and use kebab-case (e.g., add-user-authentication)';
  }
  
  // Check length
  if (trimmed.length > 50) {
    return 'Branch name is too long (max 50 characters)';
  }
  
  return true;
}

function branchExists(branchName) {
  try {
    const branches = getLocalBranches();
    return branches.includes(branchName);
  } catch (err) {
    return false;
  }
}

function createBranch(branchName) {
  try {
    log(`Creating branch: ${branchName}...`, 'info');
    
    const result = spawnSync('git', ['checkout', '-b', branchName], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      throw new Error(`Failed to create branch: ${branchName}`);
    }
    
    success(`✓ Created and switched to branch: ${branchName}`);
    return true;
  } catch (err) {
    error(`✗ Failed to create branch: ${err.message}`);
    return false;
  }
}

async function promptCreateBranch() {
  // Select branch type with autocomplete search
  const choices = BRANCH_TYPES.map(type => ({
    name: `${type.prefix}${chalk.gray(` - ${type.description}`)}`,
    value: type,
    short: type.prefix,
  }));
  
  const { branchType } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'branchType',
      message: 'Select branch type (type to search):',
      source: (answersSoFar, input) => {
        if (!input) {
          return choices;
        }
        
        const searchTerm = input.toLowerCase();
        return choices.filter(choice => {
          const type = choice.value;
          return (
            type.name.toLowerCase().includes(searchTerm) ||
            type.prefix.toLowerCase().includes(searchTerm) ||
            type.description.toLowerCase().includes(searchTerm)
          );
        });
      },
      pageSize: 10,
    },
  ]);

  // Enter branch name
  const { branchName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'branchName',
      message: 'Enter branch name (kebab-case, e.g., add-user-auth):',
      validate: validateBranchName,
      filter: (input) => input.trim().toLowerCase(),
    },
  ]);

  const fullBranchName = `${branchType.prefix}${branchName}`;

  // Check if branch already exists
  if (branchExists(fullBranchName)) {
    log(`Branch "${fullBranchName}" already exists. Switching to it...`, 'info');
    switchBranch(fullBranchName);
    
    // Show status after switching
    const newStatus = getBranchStatus();
    if (newStatus) {
      console.log('\n');
      showStatus();
    }
    return;
  }

  // Auto-create branch (no confirmation needed - user already provided valid name)
  createBranch(fullBranchName);
  
  // Show status after creating
  const newStatus = getBranchStatus();
  if (newStatus) {
    console.log('\n');
    showStatus();
  }
}

function getDefaultTargetBranch() {
  // Try to find main or master branch
  const branches = getLocalBranches();
  if (branches.includes('main')) {
    return 'main';
  }
  if (branches.includes('master')) {
    return 'master';
  }
  return null;
}

function isBranchMerged(branchName, targetBranch) {
  try {
    // Check if branch is merged into target
    const result = execSync(`git branch --merged ${targetBranch}`, { encoding: 'utf8' });
    const mergedBranches = result.split('\n').map(b => b.trim().replace(/^\*\s*/, ''));
    return mergedBranches.includes(branchName);
  } catch (err) {
    return false;
  }
}

function hasMergeConflicts(sourceBranch, targetBranch) {
  try {
    const currentBranch = getCurrentBranch();
    
    // If we're not on target branch, switch temporarily
    let switched = false;
    if (currentBranch !== targetBranch) {
      try {
        execSync(`git checkout ${targetBranch}`, { stdio: 'ignore' });
        switched = true;
      } catch (err) {
        // Can't switch, assume conflicts
        return true;
      }
    }
    
    try {
      // Try a test merge to detect conflicts
      execSync(`git merge --no-commit --no-ff ${sourceBranch}`, { stdio: 'ignore' });
      // If we get here, no conflicts - abort the test merge
      execSync('git merge --abort', { stdio: 'ignore' });
      
      // Switch back if we switched
      if (switched) {
        execSync(`git checkout ${currentBranch}`, { stdio: 'ignore' });
      }
      
      return false;
    } catch (err) {
      // Abort the test merge
      try {
        execSync('git merge --abort', { stdio: 'ignore' });
      } catch (e) {
        // Ignore abort errors
      }
      
      // Switch back if we switched
      if (switched) {
        try {
          execSync(`git checkout ${currentBranch}`, { stdio: 'ignore' });
        } catch (e) {
          // If we can't switch back, that's a problem but continue
        }
      }
      
      // Assume conflicts if test merge failed
      return true;
    }
  } catch (err) {
    // On any error, assume conflicts to be safe
    return true;
  }
}

function mergeBranch(sourceBranch, targetBranch) {
  try {
    log(`Merging ${sourceBranch} into ${targetBranch}...`, 'info');
    
    const result = spawnSync('git', ['merge', '--no-ff', sourceBranch], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      throw new Error(`Merge failed with exit code ${result.status}`);
    }
    
    success(`✓ Successfully merged ${sourceBranch} into ${targetBranch}`);
    return true;
  } catch (err) {
    error(`✗ Merge failed: ${err.message}`);
    log('You may need to resolve conflicts manually.', 'warning');
    return false;
  }
}

function pushBranch(branchName) {
  try {
    log(`Pushing ${branchName} to remote...`, 'info');
    
    const result = spawnSync('git', ['push'], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      throw new Error(`Push failed with exit code ${result.status}`);
    }
    
    success(`✓ Successfully pushed ${branchName}`);
    return true;
  } catch (err) {
    error(`✗ Push failed: ${err.message}`);
    return false;
  }
}

function deleteLocalBranch(branchName) {
  // Safety check: Never allow deleting main/master branches
  if (branchName === 'main' || branchName === 'master') {
    error(`Cannot delete protected branch: ${branchName}. This branch is protected for safety.`);
    return false;
  }
  
  try {
    log(`Deleting local branch: ${branchName}...`, 'info');
    
    const result = spawnSync('git', ['branch', '-d', branchName], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      // Try force delete if normal delete fails
      const forceResult = spawnSync('git', ['branch', '-D', branchName], {
        stdio: 'inherit',
      });
      
      if (forceResult.status !== 0) {
        throw new Error(`Failed to delete branch: ${branchName}`);
      }
    }
    
    success(`✓ Deleted local branch: ${branchName}`);
    return true;
  } catch (err) {
    error(`✗ Failed to delete local branch: ${err.message}`);
    return false;
  }
}

function deleteRemoteBranch(branchName) {
  // Safety check: Never allow deleting main/master branches
  if (branchName === 'main' || branchName === 'master') {
    error(`Cannot delete protected branch: ${branchName}. This branch is protected for safety.`);
    return false;
  }
  
  try {
    // Get remote name (usually 'origin')
    let remote = 'origin';
    try {
      const remoteResult = execSync('git remote', { encoding: 'utf8' }).trim();
      if (remoteResult) {
        remote = remoteResult.split('\n')[0];
      }
    } catch (err) {
      // Use default 'origin'
    }
    
    log(`Deleting remote branch: ${remote}/${branchName}...`, 'info');
    
    const result = spawnSync('git', ['push', remote, '--delete', branchName], {
      stdio: 'inherit',
    });
    
    if (result.status !== 0) {
      throw new Error(`Failed to delete remote branch: ${branchName}`);
    }
    
    success(`✓ Deleted remote branch: ${remote}/${branchName}`);
    return true;
  } catch (err) {
    error(`✗ Failed to delete remote branch: ${err.message}`);
    return false;
  }
}

function branchExistsOnRemote(branchName) {
  try {
    const remoteBranches = getRemoteBranches();
    return remoteBranches.some(b => b.includes(branchName));
  } catch (err) {
    return false;
  }
}

async function promptMergeBranch() {
  const currentBranch = getCurrentBranch();
  
  if (!currentBranch) {
    error('Could not determine current branch.');
  }
  
  // Don't allow merging main/master into itself
  if (currentBranch === 'main' || currentBranch === 'master') {
    error('Cannot merge main/master branch into itself. Switch to a feature branch first.');
  }
  
  // Get default target branch
  const defaultTarget = getDefaultTargetBranch();
  
  if (!defaultTarget) {
    error('Could not find main or master branch. Please ensure one exists.');
  }
  
  // Fetch to get latest branches
  log('Fetching latest branches...', 'info');
  fetchRemote();
  
  const branches = getAllBranches();
  
  // Select target branch (default to main/master)
  const { targetBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetBranch',
      message: `Select target branch to merge ${chalk.cyan(currentBranch)} into:`,
      choices: branches.all.filter(b => b !== currentBranch).map(b => ({
        name: b === defaultTarget ? `${b} ${chalk.gray('(default)')}` : b,
        value: b,
      })),
      default: branches.all.indexOf(defaultTarget),
      pageSize: 15,
    },
  ]);
  
  // Check if already merged
  if (isBranchMerged(currentBranch, targetBranch)) {
    log(`Branch ${currentBranch} is already merged into ${targetBranch}.`, 'info');
    
    const hasRemote = branchExistsOnRemote(currentBranch);
    const deleteOptions = [];
    if (hasRemote) {
      deleteOptions.push('Delete local and remote branch');
      deleteOptions.push('Delete local branch only');
    } else {
      deleteOptions.push('Delete local branch');
    }
    deleteOptions.push('Keep branch');
    
    const { deleteAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'deleteAction',
        message: 'What would you like to do?',
        choices: deleteOptions,
        default: 0,
      },
    ]);
    
    if (deleteAction.includes('local and remote')) {
      if (hasUncommittedChanges()) {
        try {
          execSync('git stash', { stdio: 'inherit' });
          success('Changes stashed');
        } catch (err) {
          error(`Failed to stash changes: ${err.message}`);
        }
      }
      switchBranch(targetBranch);
      deleteLocalBranch(currentBranch);
      deleteRemoteBranch(currentBranch);
    } else if (deleteAction.includes('local only') || deleteAction === 'Delete local branch') {
      if (hasUncommittedChanges()) {
        try {
          execSync('git stash', { stdio: 'inherit' });
          success('Changes stashed');
        } catch (err) {
          error(`Failed to stash changes: ${err.message}`);
        }
      }
      switchBranch(targetBranch);
      deleteLocalBranch(currentBranch);
    }
    
    return;
  }
  
  // Check for potential conflicts (just warn, don't block)
  log('Checking for potential merge conflicts...', 'info');
  const hasConflicts = hasMergeConflicts(currentBranch, targetBranch);
  
  if (hasConflicts) {
    log(chalk.yellow('⚠ Potential merge conflicts detected. You may need to resolve them manually.'), 'warning');
  }
  
  // Single confirmation with preview
  const hasRemote = branchExistsOnRemote(currentBranch);
  const deleteChoices = [
    'Delete local and remote branch',
    'Delete local branch only',
    'Keep branch',
  ].filter((choice, index) => {
    if (index === 0 && !hasRemote) return false; // Skip "local and remote" if no remote
    if (index === 1 && !hasRemote) return false; // Skip "local only" if no remote
    return true;
  });
  
  console.log(`\n${chalk.bold('Merge Preview:')}`);
  console.log(`  From: ${chalk.cyan(currentBranch)}`);
  console.log(`  Into: ${chalk.cyan(targetBranch)}`);
  console.log(`  Action: Merge, push, and cleanup\n`);
  
  const { confirm, deleteAfterMerge } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with merge?',
      default: true,
    },
    {
      type: 'list',
      name: 'deleteAfterMerge',
      message: 'After merging:',
      choices: deleteChoices,
      default: 0,
      when: (answers) => answers.confirm,
    },
  ]);
  
  if (!confirm) {
    log('Merge cancelled.', 'info');
    return;
  }
  
  // Auto-handle uncommitted changes (stash automatically)
  if (hasUncommittedChanges()) {
    try {
      execSync('git stash', { stdio: 'inherit' });
      success('Changes stashed automatically');
    } catch (err) {
      log(`Warning: Could not stash changes: ${err.message}`, 'warning');
    }
  }
  
  // Auto-switch to target branch
  log(`Switching to ${targetBranch}...`, 'info');
  switchBranch(targetBranch);
  
  // Auto-pull latest changes
  log(`Pulling latest changes for ${targetBranch}...`, 'info');
  pullCurrentBranch();
  
  // Merge the branch
  const mergeSuccess = mergeBranch(currentBranch, targetBranch);
  
  if (!mergeSuccess) {
    log('Merge failed. Please resolve conflicts manually.', 'error');
    return;
  }
  
  // Auto-push merge (safe operation)
  log(`Pushing merge to remote ${targetBranch}...`, 'info');
  pushBranch(targetBranch);
  
  // Handle branch deletion based on user choice
  if (deleteAfterMerge === 'Delete local and remote branch') {
    deleteLocalBranch(currentBranch);
    deleteRemoteBranch(currentBranch);
  } else if (deleteAfterMerge === 'Delete local branch only' || deleteAfterMerge === 'Delete local branch') {
    deleteLocalBranch(currentBranch);
  }
  
  // Show final status
  console.log('\n');
  showStatus();
  
  success('\n✓ Merge completed successfully!');
}

async function promptMainAction(status) {
  const actions = [
    {
      name: 'Pull latest changes',
      value: 'pull',
      disabled: status && status.behind === 0 && status.upstream ? 'Already up to date' : false,
    },
    {
      name: 'Fetch from remote',
      value: 'fetch',
    },
    {
      name: 'Switch branch',
      value: 'switch',
    },
    {
      name: 'Create new branch',
      value: 'create',
    },
    {
      name: 'Merge branch',
      value: 'merge',
    },
    {
      name: 'Show status only',
      value: 'status',
    },
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: actions,
    },
  ]);

  return action;
}

async function promptBranchSelection(branches) {
  const currentBranch = getCurrentBranch();
  
  // Filter out current branch from the list
  const availableBranches = branches.all.filter(b => b !== currentBranch);
  
  if (availableBranches.length === 0) {
    log('No other branches available.', 'warning');
    return null;
  }

  // Format branch choices with indicators
  const choices = availableBranches.map(b => {
    const isLocal = branches.local.includes(b);
    const indicator = isLocal ? chalk.gray('(local)') : chalk.gray('(remote)');
    return {
      name: `${b} ${indicator}`,
      value: b,
    };
  });

  const { branch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'branch',
      message: 'Select a branch to switch to:',
      choices: choices,
      pageSize: 15,
    },
  ]);

  return branch;
}

async function main() {
  const args = process.argv.slice(2);

  // Handle command-line arguments
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }

  // Check if git is installed
  if (!checkGitInstalled()) {
    error('Git is not installed or not found in PATH. Please install Git first.');
  }

  // Check if we're in a git repository
  if (!isGitRepository()) {
    error('Not a git repository. Please run this command in a git repository directory.');
  }

  // Show current status
  const status = getBranchStatus();
  showStatus();

  // Check for uncommitted changes before operations
  const hasChanges = hasUncommittedChanges();
  
  if (hasChanges) {
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'You have uncommitted changes. Continue anyway?',
        default: false,
      },
    ]);
    
    if (!proceed) {
      log('Operation cancelled.', 'info');
      process.exit(0);
    }
  }

  // Main action selection
  const action = await promptMainAction(status);

  switch (action) {
    case 'pull':
      if (status && status.behind > 0) {
        pullCurrentBranch();
      } else {
        log('Branch is already up to date.', 'info');
      }
      break;

    case 'fetch':
      fetchRemote();
      // Show updated status after fetch
      const newStatus = getBranchStatus();
      if (newStatus) {
        console.log('\n');
        showStatus();
      }
      break;

    case 'switch':
      // Fetch first to get latest branches
      log('Fetching branches...', 'info');
      fetchRemote();
      
      const branches = getAllBranches();
      const selectedBranch = await promptBranchSelection(branches);
      
      if (selectedBranch) {
        // Auto-stash uncommitted changes (like merge does)
        if (hasUncommittedChanges()) {
          try {
            execSync('git stash', { stdio: 'inherit' });
            success('Changes stashed automatically');
          } catch (err) {
            log(`Warning: Could not stash changes: ${err.message}`, 'warning');
          }
        }
        
        switchBranch(selectedBranch);
        
        // Show status after switching
        const newStatus = getBranchStatus();
        if (newStatus) {
          console.log('\n');
          showStatus();
        }
      }
      break;

    case 'create':
      await promptCreateBranch();
      break;

    case 'merge':
      await promptMergeBranch();
      break;

    case 'status':
      // Status already shown, nothing to do
      break;
  }
}

// Run the main function
main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
});
