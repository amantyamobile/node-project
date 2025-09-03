const { Octokit } = require('@octokit/rest');
const issueModel = require('../models/issueModel');

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }

  // Fetch a single issue from GitHub
  async fetchIssueFromGitHub(owner, repo, issueNumber) {
    try {
      const response = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });

      return this.formatIssueData(response.data, owner, repo);
    } catch (error) {
      console.error(`Error fetching issue #${issueNumber} from GitHub:`, error);
      throw error;
    }
  }

  // Fetch all issues from a repository
  async fetchAllIssuesFromRepository(owner, repo, state = 'all') {
    try {
      const issues = [];
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await this.octokit.rest.issues.listForRepo({
          owner,
          repo,
          state,
          per_page: 100,
          page
        });

        // Filter out pull requests (GitHub API includes PRs in issues endpoint)
        const actualIssues = response.data.filter(issue => !issue.pull_request);
        issues.push(...actualIssues);

        hasNextPage = response.data.length === 100;
        page++;
      }

      return issues.map(issue => this.formatIssueData(issue, owner, repo));
    } catch (error) {
      console.error(`Error fetching issues from repository ${owner}/${repo}:`, error);
      throw error;
    }
  }

  // Fetch pull request details
  async fetchPullRequest(owner, repo, prNumber) {
    try {
      const response = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching PR #${prNumber}:`, error);
      throw error;
    }
  }

  // Get issues related to a specific PR
  async getIssuesForPR(owner, repo, prNumber) {
    try {
      // First, get the PR details
      const pr = await this.fetchPullRequest(owner, repo, prNumber);
      
      // Get issues from database that are related to this PR
      const relatedIssues = await issueModel.getIssuesRelatedToPR(
        owner, 
        repo, 
        pr.body, 
        pr.title
      );

      // If no issues found in database, try to fetch from GitHub and sync
      if (relatedIssues.length === 0) {
        await this.syncRepositoryIssues(owner, repo);
        return await issueModel.getIssuesRelatedToPR(owner, repo, pr.body, pr.title);
      }

      return relatedIssues;
    } catch (error) {
      console.error(`Error getting issues for PR #${prNumber}:`, error);
      throw error;
    }
  }

  // Sync repository issues with local database
  async syncRepositoryIssues(owner, repo) {
    try {
      console.log(`Syncing issues for repository ${owner}/${repo}`);
      
      const issues = await this.fetchAllIssuesFromRepository(owner, repo);
      
      for (const issue of issues) {
        await issueModel.upsertIssue(issue);
      }

      console.log(`Successfully synced ${issues.length} issues for ${owner}/${repo}`);
      return issues.length;
    } catch (error) {
      console.error(`Error syncing repository issues for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  // Sync a specific issue
  async syncIssue(owner, repo, issueNumber) {
    try {
      const issueData = await this.fetchIssueFromGitHub(owner, repo, issueNumber);
      return await issueModel.upsertIssue(issueData);
    } catch (error) {
      console.error(`Error syncing issue #${issueNumber}:`, error);
      throw error;
    }
  }

  // Format GitHub issue data for database storage
  formatIssueData(githubIssue, owner, repo) {
    return {
      github_issue_id: githubIssue.id,
      issue_number: githubIssue.number,
      title: githubIssue.title,
      body: githubIssue.body,
      state: githubIssue.state,
      labels: githubIssue.labels,
      assignees: githubIssue.assignees,
      milestone: githubIssue.milestone,
      repository_name: repo,
      repository_owner: owner,
      github_created_at: new Date(githubIssue.created_at),
      github_updated_at: new Date(githubIssue.updated_at)
    };
  }

  // Create a review comment on a PR
  async createPRReviewComment(owner, repo, prNumber, body, commitSha, path, line) {
    try {
      const response = await this.octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        body,
        commit_id: commitSha,
        path,
        line
      });

      return response.data;
    } catch (error) {
      console.error('Error creating PR review comment:', error);
      throw error;
    }
  }

  // Create a PR review
  async createPRReview(owner, repo, prNumber, event, body, comments = []) {
    try {
      const response = await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event, // 'APPROVE', 'REQUEST_CHANGES', 'COMMENT'
        body,
        comments
      });

      return response.data;
    } catch (error) {
      console.error('Error creating PR review:', error);
      throw error;
    }
  }

  // Get PR files
  async getPRFiles(owner, repo, prNumber) {
    try {
      const response = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      return response.data;
    } catch (error) {
      console.error('Error getting PR files:', error);
      throw error;
    }
  }
}

module.exports = GitHubService;
