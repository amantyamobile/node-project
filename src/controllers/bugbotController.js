const BugbotReviewService = require('../service/bugbotReviewService');
const GitHubService = require('../service/githubService');
const issueModel = require('../models/issueModel');
const { validationResult } = require('express-validator');

class BugbotController {
  constructor() {
    this.bugbotService = new BugbotReviewService();
    this.githubService = new GitHubService();
  }

  // Get issues for a specific PR
  async getIssuesForPR(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { owner, repo, prNumber } = req.params;
      
      const issues = await this.githubService.getIssuesForPR(owner, repo, parseInt(prNumber));
      
      res.status(200).json({
        success: true,
        message: `Found ${issues.length} issues related to PR #${prNumber}`,
        data: {
          pr_number: prNumber,
          repository: `${owner}/${repo}`,
          issue_count: issues.length,
          issues: issues
        }
      });
    } catch (error) {
      console.error('Error fetching issues for PR:', error);
      next(error);
    }
  }

  // Perform bugbot review on a PR
  async reviewPR(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { owner, repo, prNumber } = req.params;
      
      const reviewResult = await this.bugbotService.performPRReview(owner, repo, parseInt(prNumber));
      
      res.status(200).json({
        success: true,
        message: `Bugbot review completed for PR #${prNumber}`,
        data: reviewResult
      });
    } catch (error) {
      console.error('Error performing PR review:', error);
      next(error);
    }
  }

  // Get issue analysis for a PR
  async getIssueAnalysis(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { owner, repo, prNumber } = req.params;
      
      const analysis = await this.bugbotService.getIssueAnalysisForPR(owner, repo, parseInt(prNumber));
      
      res.status(200).json({
        success: true,
        message: `Issue analysis completed for PR #${prNumber}`,
        data: analysis
      });
    } catch (error) {
      console.error('Error getting issue analysis:', error);
      next(error);
    }
  }

  // Sync repository issues
  async syncRepositoryIssues(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { owner, repo } = req.params;
      
      const syncedCount = await this.githubService.syncRepositoryIssues(owner, repo);
      
      res.status(200).json({
        success: true,
        message: `Successfully synced ${syncedCount} issues for ${owner}/${repo}`,
        data: {
          repository: `${owner}/${repo}`,
          synced_issues: syncedCount
        }
      });
    } catch (error) {
      console.error('Error syncing repository issues:', error);
      next(error);
    }
  }

  // Get issues by repository
  async getRepositoryIssues(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { owner, repo } = req.params;
      const { state } = req.query;
      
      const issues = await issueModel.getIssuesByRepository(owner, repo, state);
      
      res.status(200).json({
        success: true,
        message: `Found ${issues.length} issues in ${owner}/${repo}`,
        data: {
          repository: `${owner}/${repo}`,
          state: state || 'all',
          issue_count: issues.length,
          issues: issues
        }
      });
    } catch (error) {
      console.error('Error fetching repository issues:', error);
      next(error);
    }
  }

  // Get specific issue details
  async getIssue(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { owner, repo, issueNumber } = req.params;
      
      // Try to get from local database first
      let issue = await issueModel.getIssuesByRepository(owner, repo);
      issue = issue.find(i => i.issue_number === parseInt(issueNumber));
      
      // If not found locally, fetch from GitHub and sync
      if (!issue) {
        await this.githubService.syncIssue(owner, repo, parseInt(issueNumber));
        issue = await issueModel.getIssuesByRepository(owner, repo);
        issue = issue.find(i => i.issue_number === parseInt(issueNumber));
      }
      
      if (!issue) {
        return res.status(404).json({
          success: false,
          message: `Issue #${issueNumber} not found in ${owner}/${repo}`
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Issue #${issueNumber} details`,
        data: issue
      });
    } catch (error) {
      console.error('Error fetching issue:', error);
      next(error);
    }
  }

  // Initialize database tables
  async initializeDatabase(req, res, next) {
    try {
      await issueModel.initializeIssuesTable();
      
      res.status(200).json({
        success: true,
        message: 'Database initialized successfully',
        data: {
          tables_created: ['issues']
        }
      });
    } catch (error) {
      console.error('Error initializing database:', error);
      next(error);
    }
  }

  // Get bugbot status and configuration
  async getBugbotStatus(req, res, next) {
    try {
      const status = {
        service: 'Bugbot Review Service',
        version: '1.0.0',
        status: 'active',
        features: {
          pr_review: true,
          issue_analysis: true,
          webhook_support: true,
          github_integration: !!process.env.GITHUB_TOKEN
        },
        configuration: {
          auto_review: process.env.BUGBOT_AUTO_REVIEW === 'true',
          webhook_secret_configured: !!process.env.GITHUB_WEBHOOK_SECRET,
          github_token_configured: !!process.env.GITHUB_TOKEN
        }
      };
      
      res.status(200).json({
        success: true,
        message: 'Bugbot service status',
        data: status
      });
    } catch (error) {
      console.error('Error getting bugbot status:', error);
      next(error);
    }
  }

  // Bulk operation: Review multiple PRs
  async bulkReviewPRs(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { owner, repo } = req.params;
      const { pr_numbers } = req.body;
      
      if (!Array.isArray(pr_numbers) || pr_numbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'pr_numbers must be a non-empty array'
        });
      }

      const results = [];
      
      for (const prNumber of pr_numbers) {
        try {
          const reviewResult = await this.bugbotService.performPRReview(owner, repo, prNumber);
          results.push({
            pr_number: prNumber,
            status: 'success',
            data: reviewResult
          });
        } catch (error) {
          results.push({
            pr_number: prNumber,
            status: 'error',
            error: error.message
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: `Bulk review completed for ${pr_numbers.length} PRs`,
        data: {
          repository: `${owner}/${repo}`,
          total_prs: pr_numbers.length,
          successful_reviews: results.filter(r => r.status === 'success').length,
          failed_reviews: results.filter(r => r.status === 'error').length,
          results: results
        }
      });
    } catch (error) {
      console.error('Error performing bulk PR review:', error);
      next(error);
    }
  }
}

module.exports = new BugbotController();
