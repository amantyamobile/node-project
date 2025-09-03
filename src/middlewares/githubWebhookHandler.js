const crypto = require('crypto');
const BugbotReviewService = require('../service/bugbotReviewService');

class GitHubWebhookHandler {
  constructor() {
    this.bugbotService = new BugbotReviewService();
  }

  // Verify GitHub webhook signature
  verifySignature(payload, signature) {
    if (!process.env.GITHUB_WEBHOOK_SECRET) {
      console.warn('GITHUB_WEBHOOK_SECRET not set, skipping signature verification');
      return true;
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Main webhook handler middleware
  async handleWebhook(req, res, next) {
    try {
      const signature = req.get('X-Hub-Signature-256');
      const event = req.get('X-GitHub-Event');
      
      // Verify signature if secret is configured
      if (signature && !this.verifySignature(JSON.stringify(req.body), signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      console.log(`Received GitHub webhook: ${event}`);

      // Handle different webhook events
      switch (event) {
        case 'pull_request':
          await this.handlePullRequestEvent(req.body);
          break;
        case 'issues':
          await this.handleIssuesEvent(req.body);
          break;
        case 'issue_comment':
          await this.handleIssueCommentEvent(req.body);
          break;
        case 'pull_request_review':
          await this.handlePullRequestReviewEvent(req.body);
          break;
        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle pull request events
  async handlePullRequestEvent(payload) {
    const { action, pull_request, repository } = payload;
    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = pull_request.number;

    console.log(`PR Event: ${action} for PR #${prNumber} in ${owner}/${repo}`);

    // Trigger bugbot review for specific actions
    if (['opened', 'synchronize', 'reopened'].includes(action)) {
      try {
        // Small delay to ensure GitHub has processed the PR
        setTimeout(async () => {
          await this.bugbotService.performPRReview(owner, repo, prNumber);
        }, 2000);
      } catch (error) {
        console.error(`Error triggering bugbot review for PR #${prNumber}:`, error);
      }
    }

    // Handle PR closure (sync related issues if they're being closed)
    if (action === 'closed' && pull_request.merged) {
      try {
        const relatedIssues = await this.bugbotService.getIssueAnalysisForPR(owner, repo, prNumber);
        console.log(`PR #${prNumber} merged, found ${relatedIssues.totalIssues} related issues`);
        
        // You could add logic here to automatically close related issues
        // or perform other actions when PRs are merged
      } catch (error) {
        console.error(`Error handling merged PR #${prNumber}:`, error);
      }
    }
  }

  // Handle issues events
  async handleIssuesEvent(payload) {
    const { action, issue, repository } = payload;
    const owner = repository.owner.login;
    const repo = repository.name;
    const issueNumber = issue.number;

    console.log(`Issue Event: ${action} for issue #${issueNumber} in ${owner}/${repo}`);

    // Sync issue data when issues are created, updated, or reopened
    if (['opened', 'edited', 'reopened', 'closed', 'labeled', 'unlabeled'].includes(action)) {
      try {
        await this.bugbotService.githubService.syncIssue(owner, repo, issueNumber);
        console.log(`Synced issue #${issueNumber} to local database`);
      } catch (error) {
        console.error(`Error syncing issue #${issueNumber}:`, error);
      }
    }
  }

  // Handle issue comment events
  async handleIssueCommentEvent(payload) {
    const { action, issue, comment, repository } = payload;
    
    // Skip if this is a PR comment (not an issue comment)
    if (issue.pull_request) return;

    const owner = repository.owner.login;
    const repo = repository.name;
    const issueNumber = issue.number;

    console.log(`Issue Comment Event: ${action} for issue #${issueNumber} in ${owner}/${repo}`);

    // Check if the comment contains bugbot commands
    if (action === 'created' && comment.body) {
      await this.handleBugbotCommands(comment.body, owner, repo, issueNumber);
    }
  }

  // Handle pull request review events
  async handlePullRequestReviewEvent(payload) {
    const { action, review, pull_request, repository } = payload;
    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = pull_request.number;

    console.log(`PR Review Event: ${action} for PR #${prNumber} in ${owner}/${repo}`);

    // You could add logic here to respond to reviews or update analysis
  }

  // Handle bugbot commands in comments
  async handleBugbotCommands(commentBody, owner, repo, issueNumber) {
    const commands = this.extractBugbotCommands(commentBody);
    
    for (const command of commands) {
      try {
        await this.executeBugbotCommand(command, owner, repo, issueNumber);
      } catch (error) {
        console.error(`Error executing bugbot command "${command.action}":`, error);
      }
    }
  }

  // Extract bugbot commands from comment
  extractBugbotCommands(commentBody) {
    const commands = [];
    const bugbotRegex = /@bugbot\s+(\w+)(?:\s+(.+))?/gi;
    
    let match;
    while ((match = bugbotRegex.exec(commentBody)) !== null) {
      commands.push({
        action: match[1].toLowerCase(),
        args: match[2] ? match[2].trim() : null
      });
    }
    
    return commands;
  }

  // Execute bugbot commands
  async executeBugbotCommand(command, owner, repo, targetNumber) {
    switch (command.action) {
      case 'sync':
        await this.bugbotService.githubService.syncRepositoryIssues(owner, repo);
        console.log(`Synced all issues for ${owner}/${repo}`);
        break;
      
      case 'review':
        if (command.args) {
          const prNumber = parseInt(command.args);
          if (prNumber) {
            await this.bugbotService.performPRReview(owner, repo, prNumber);
            console.log(`Performed review for PR #${prNumber}`);
          }
        }
        break;
      
      case 'analyze':
        if (command.args) {
          const prNumber = parseInt(command.args);
          if (prNumber) {
            const analysis = await this.bugbotService.getIssueAnalysisForPR(owner, repo, prNumber);
            console.log(`Analysis for PR #${prNumber}:`, analysis);
          }
        }
        break;
      
      default:
        console.log(`Unknown bugbot command: ${command.action}`);
    }
  }
}

// Export middleware function
const githubWebhookHandler = new GitHubWebhookHandler();

module.exports = {
  handleWebhook: githubWebhookHandler.handleWebhook.bind(githubWebhookHandler),
  GitHubWebhookHandler
};
