const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const bugbotController = require('../controllers/bugbotController');
const { handleWebhook } = require('../middlewares/githubWebhookHandler');

// Validation middleware
const validateRepoParams = [
  param('owner').isAlphanumeric().withMessage('Owner must be alphanumeric'),
  param('repo').isLength({ min: 1 }).withMessage('Repository name is required')
];

const validatePRParams = [
  ...validateRepoParams,
  param('prNumber').isInt({ min: 1 }).withMessage('PR number must be a positive integer')
];

const validateIssueParams = [
  ...validateRepoParams,
  param('issueNumber').isInt({ min: 1 }).withMessage('Issue number must be a positive integer')
];

// GitHub webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Convert raw buffer to JSON for webhook handler
  req.body = JSON.parse(req.body);
  next();
}, handleWebhook);

// Bugbot service status
router.get('/status', bugbotController.getBugbotStatus);

// Initialize database
router.post('/init', bugbotController.initializeDatabase);

// Repository-level operations
router.get('/repos/:owner/:repo/issues', 
  validateRepoParams,
  query('state').optional().isIn(['open', 'closed']).withMessage('State must be "open" or "closed"'),
  bugbotController.getRepositoryIssues
);

router.post('/repos/:owner/:repo/sync', 
  validateRepoParams,
  bugbotController.syncRepositoryIssues
);

// PR-related endpoints
router.get('/repos/:owner/:repo/pulls/:prNumber/issues', 
  validatePRParams,
  bugbotController.getIssuesForPR
);

router.post('/repos/:owner/:repo/pulls/:prNumber/review', 
  validatePRParams,
  bugbotController.reviewPR
);

router.get('/repos/:owner/:repo/pulls/:prNumber/analysis', 
  validatePRParams,
  bugbotController.getIssueAnalysis
);

// Bulk operations
router.post('/repos/:owner/:repo/pulls/bulk-review', 
  validateRepoParams,
  body('pr_numbers').isArray({ min: 1 }).withMessage('pr_numbers must be a non-empty array'),
  body('pr_numbers.*').isInt({ min: 1 }).withMessage('Each PR number must be a positive integer'),
  bugbotController.bulkReviewPRs
);

// Issue-specific endpoints
router.get('/repos/:owner/:repo/issues/:issueNumber', 
  validateIssueParams,
  bugbotController.getIssue
);

// Documentation endpoint
router.get('/docs', (req, res) => {
  const documentation = {
    service: 'Bugbot Review Service API',
    version: '1.0.0',
    description: 'API for automated PR review and issue correlation',
    endpoints: {
      status: {
        method: 'GET',
        path: '/api/bugbot/status',
        description: 'Get service status and configuration'
      },
      init: {
        method: 'POST',
        path: '/api/bugbot/init',
        description: 'Initialize database tables'
      },
      webhook: {
        method: 'POST',
        path: '/api/bugbot/webhook',
        description: 'GitHub webhook endpoint for automated reviews',
        headers: {
          'X-GitHub-Event': 'GitHub event type',
          'X-Hub-Signature-256': 'Webhook signature (if secret configured)'
        }
      },
      repository_issues: {
        method: 'GET',
        path: '/api/bugbot/repos/:owner/:repo/issues',
        description: 'Get all issues for a repository',
        query_params: {
          state: 'Filter by issue state (open/closed)'
        }
      },
      sync_repository: {
        method: 'POST',
        path: '/api/bugbot/repos/:owner/:repo/sync',
        description: 'Sync repository issues with GitHub'
      },
      pr_issues: {
        method: 'GET',
        path: '/api/bugbot/repos/:owner/:repo/pulls/:prNumber/issues',
        description: 'Get issues related to a specific PR'
      },
      pr_review: {
        method: 'POST',
        path: '/api/bugbot/repos/:owner/:repo/pulls/:prNumber/review',
        description: 'Perform bugbot review on a PR'
      },
      pr_analysis: {
        method: 'GET',
        path: '/api/bugbot/repos/:owner/:repo/pulls/:prNumber/analysis',
        description: 'Get issue analysis for a PR'
      },
      bulk_review: {
        method: 'POST',
        path: '/api/bugbot/repos/:owner/:repo/pulls/bulk-review',
        description: 'Review multiple PRs in bulk',
        body: {
          pr_numbers: 'Array of PR numbers to review'
        }
      },
      issue_details: {
        method: 'GET',
        path: '/api/bugbot/repos/:owner/:repo/issues/:issueNumber',
        description: 'Get specific issue details'
      }
    },
    usage_examples: {
      get_pr_issues: 'GET /api/bugbot/repos/octocat/hello-world/pulls/1/issues',
      review_pr: 'POST /api/bugbot/repos/octocat/hello-world/pulls/1/review',
      bulk_review: {
        url: 'POST /api/bugbot/repos/octocat/hello-world/pulls/bulk-review',
        body: { pr_numbers: [1, 2, 3] }
      }
    },
    configuration: {
      required_env_vars: [
        'GITHUB_TOKEN - GitHub personal access token',
        'DB_* - Database connection parameters'
      ],
      optional_env_vars: [
        'GITHUB_WEBHOOK_SECRET - For webhook signature verification',
        'BUGBOT_AUTO_REVIEW - Enable automatic reviews (true/false)'
      ]
    }
  };

  res.status(200).json({
    success: true,
    data: documentation
  });
});

module.exports = router;
