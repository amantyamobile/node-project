const GitHubService = require('./githubService');
const issueModel = require('../models/issueModel');

class BugbotReviewService {
  constructor() {
    this.githubService = new GitHubService();
  }

  // Main method to perform bugbot review on a PR
  async performPRReview(owner, repo, prNumber) {
    try {
      console.log(`Starting bugbot review for PR #${prNumber} in ${owner}/${repo}`);

      // Get PR details
      const pr = await this.githubService.fetchPullRequest(owner, repo, prNumber);
      
      // Get related issues
      const relatedIssues = await this.githubService.getIssuesForPR(owner, repo, prNumber);
      
      // Analyze the PR and generate review
      const reviewAnalysis = await this.analyzePRWithIssues(pr, relatedIssues);
      
      // Generate review comments
      const reviewComments = this.generateReviewComments(reviewAnalysis);
      
      // Create the review (if configured to do so automatically)
      if (process.env.BUGBOT_AUTO_REVIEW === 'true') {
        await this.submitPRReview(owner, repo, prNumber, reviewComments, reviewAnalysis);
      }

      return {
        pr,
        relatedIssues,
        reviewAnalysis,
        reviewComments
      };
    } catch (error) {
      console.error(`Error performing bugbot review for PR #${prNumber}:`, error);
      throw error;
    }
  }

  // Analyze PR in context of related issues
  async analyzePRWithIssues(pr, relatedIssues) {
    const analysis = {
      prNumber: pr.number,
      prTitle: pr.title,
      prBody: pr.body,
      relatedIssueCount: relatedIssues.length,
      relatedIssues: relatedIssues,
      checks: [],
      severity: 'info',
      recommendations: []
    };

    // Check 1: PR should reference at least one issue
    if (relatedIssues.length === 0) {
      analysis.checks.push({
        name: 'issue_reference',
        status: 'warning',
        message: 'PR does not reference any issues. Consider linking to related issues using #issue_number.',
        severity: 'warning'
      });
      analysis.severity = 'warning';
      analysis.recommendations.push('Link this PR to related issues for better traceability');
    } else {
      analysis.checks.push({
        name: 'issue_reference',
        status: 'pass',
        message: `PR references ${relatedIssues.length} issue(s)`,
        severity: 'info'
      });
    }

    // Check 2: Analyze issue types and labels
    if (relatedIssues.length > 0) {
      const bugIssues = relatedIssues.filter(issue => 
        this.hasLabel(issue.labels, ['bug', 'defect', 'error'])
      );
      
      const featureIssues = relatedIssues.filter(issue => 
        this.hasLabel(issue.labels, ['feature', 'enhancement', 'improvement'])
      );

      if (bugIssues.length > 0) {
        analysis.checks.push({
          name: 'bug_fix_analysis',
          status: 'info',
          message: `PR addresses ${bugIssues.length} bug(s). Ensure proper testing and validation.`,
          severity: 'info',
          details: bugIssues.map(issue => ({
            issueNumber: issue.issue_number,
            title: issue.title,
            labels: issue.labels
          }))
        });
        analysis.recommendations.push('Verify that bug fixes include appropriate tests');
        analysis.recommendations.push('Consider adding regression tests for bug fixes');
      }

      if (featureIssues.length > 0) {
        analysis.checks.push({
          name: 'feature_analysis',
          status: 'info',
          message: `PR implements ${featureIssues.length} feature(s).`,
          severity: 'info',
          details: featureIssues.map(issue => ({
            issueNumber: issue.issue_number,
            title: issue.title,
            labels: issue.labels
          }))
        });
        analysis.recommendations.push('Ensure new features include proper documentation');
        analysis.recommendations.push('Verify feature implementation matches requirements');
      }
    }

    // Check 3: Verify closed issues are being addressed
    const closedIssues = relatedIssues.filter(issue => issue.state === 'closed');
    if (closedIssues.length > 0) {
      analysis.checks.push({
        name: 'closed_issue_reference',
        status: 'warning',
        message: `PR references ${closedIssues.length} already closed issue(s)`,
        severity: 'warning',
        details: closedIssues.map(issue => ({
          issueNumber: issue.issue_number,
          title: issue.title
        }))
      });
      analysis.recommendations.push('Review if referencing closed issues is intentional');
    }

    // Check 4: High priority issues
    const highPriorityIssues = relatedIssues.filter(issue => 
      this.hasLabel(issue.labels, ['critical', 'high-priority', 'urgent', 'hotfix'])
    );
    
    if (highPriorityIssues.length > 0) {
      analysis.checks.push({
        name: 'high_priority_analysis',
        status: 'attention',
        message: `PR addresses ${highPriorityIssues.length} high-priority issue(s)`,
        severity: 'attention',
        details: highPriorityIssues.map(issue => ({
          issueNumber: issue.issue_number,
          title: issue.title,
          labels: issue.labels
        }))
      });
      analysis.severity = 'attention';
      analysis.recommendations.push('Prioritize thorough testing for high-priority fixes');
      analysis.recommendations.push('Consider additional review from senior team members');
    }

    return analysis;
  }

  // Generate review comments based on analysis
  generateReviewComments(analysis) {
    const comments = [];

    // Main review comment
    let reviewBody = `## 🤖 Bugbot Review\n\n`;
    reviewBody += `**Analysis Summary:**\n`;
    reviewBody += `- Related Issues: ${analysis.relatedIssueCount}\n`;
    reviewBody += `- Severity: ${analysis.severity.toUpperCase()}\n\n`;

    if (analysis.relatedIssues.length > 0) {
      reviewBody += `**Referenced Issues:**\n`;
      analysis.relatedIssues.forEach(issue => {
        const labels = issue.labels ? JSON.parse(issue.labels).map(l => l.name).join(', ') : 'none';
        reviewBody += `- #${issue.issue_number}: ${issue.title} (${issue.state}) [${labels}]\n`;
      });
      reviewBody += `\n`;
    }

    if (analysis.checks.length > 0) {
      reviewBody += `**Checks:**\n`;
      analysis.checks.forEach(check => {
        const icon = this.getCheckIcon(check.status);
        reviewBody += `${icon} **${check.name}**: ${check.message}\n`;
      });
      reviewBody += `\n`;
    }

    if (analysis.recommendations.length > 0) {
      reviewBody += `**Recommendations:**\n`;
      analysis.recommendations.forEach(rec => {
        reviewBody += `- ${rec}\n`;
      });
      reviewBody += `\n`;
    }

    reviewBody += `---\n`;
    reviewBody += `*This review was automatically generated by Bugbot. For questions, contact the development team.*`;

    comments.push({
      type: 'main_review',
      body: reviewBody,
      event: this.getReviewEvent(analysis.severity)
    });

    return comments;
  }

  // Submit the PR review
  async submitPRReview(owner, repo, prNumber, comments, analysis) {
    try {
      const mainComment = comments.find(c => c.type === 'main_review');
      
      if (mainComment) {
        await this.githubService.createPRReview(
          owner,
          repo,
          prNumber,
          mainComment.event,
          mainComment.body
        );
        
        console.log(`Successfully submitted bugbot review for PR #${prNumber}`);
      }
    } catch (error) {
      console.error(`Error submitting PR review for #${prNumber}:`, error);
      throw error;
    }
  }

  // Helper method to check if issue has specific labels
  hasLabel(labelsJson, labelNames) {
    if (!labelsJson) return false;
    
    try {
      const labels = typeof labelsJson === 'string' ? JSON.parse(labelsJson) : labelsJson;
      const labelNamesLower = labelNames.map(name => name.toLowerCase());
      
      return labels.some(label => 
        labelNamesLower.includes(label.name.toLowerCase())
      );
    } catch (error) {
      console.error('Error parsing labels:', error);
      return false;
    }
  }

  // Get icon for check status
  getCheckIcon(status) {
    switch (status) {
      case 'pass': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'attention': return '🔍';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  }

  // Get review event type based on severity
  getReviewEvent(severity) {
    switch (severity) {
      case 'error': return 'REQUEST_CHANGES';
      case 'warning': return 'COMMENT';
      case 'attention': return 'COMMENT';
      default: return 'COMMENT';
    }
  }

  // Get issue analysis for bugbot dashboard
  async getIssueAnalysisForPR(owner, repo, prNumber) {
    try {
      const relatedIssues = await this.githubService.getIssuesForPR(owner, repo, prNumber);
      
      return {
        prNumber,
        totalIssues: relatedIssues.length,
        issueBreakdown: {
          open: relatedIssues.filter(issue => issue.state === 'open').length,
          closed: relatedIssues.filter(issue => issue.state === 'closed').length,
          bugs: relatedIssues.filter(issue => this.hasLabel(issue.labels, ['bug', 'defect'])).length,
          features: relatedIssues.filter(issue => this.hasLabel(issue.labels, ['feature', 'enhancement'])).length,
          highPriority: relatedIssues.filter(issue => this.hasLabel(issue.labels, ['critical', 'high-priority'])).length
        },
        issues: relatedIssues
      };
    } catch (error) {
      console.error(`Error getting issue analysis for PR #${prNumber}:`, error);
      throw error;
    }
  }
}

module.exports = BugbotReviewService;
