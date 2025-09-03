const pool = require('../db/dbConnection');

// SQL schema for issues table
const createIssuesTable = `
  CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    github_issue_id INTEGER UNIQUE NOT NULL,
    issue_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    body TEXT,
    state VARCHAR(20) NOT NULL,
    labels JSON,
    assignees JSON,
    milestone JSON,
    repository_name VARCHAR(255) NOT NULL,
    repository_owner VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    github_created_at TIMESTAMP,
    github_updated_at TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_issues_github_id ON issues(github_issue_id);
  CREATE INDEX IF NOT EXISTS idx_issues_repository ON issues(repository_owner, repository_name);
  CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);
`;

// Initialize the table
const initializeIssuesTable = async () => {
  try {
    await pool.query(createIssuesTable);
    console.log('Issues table initialized successfully');
  } catch (error) {
    console.error('Error initializing issues table:', error);
    throw error;
  }
};

// Create or update an issue
const upsertIssue = async (issueData) => {
  const {
    github_issue_id,
    issue_number,
    title,
    body,
    state,
    labels,
    assignees,
    milestone,
    repository_name,
    repository_owner,
    github_created_at,
    github_updated_at
  } = issueData;

  const query = `
    INSERT INTO issues (
      github_issue_id, issue_number, title, body, state, labels, assignees, 
      milestone, repository_name, repository_owner, github_created_at, github_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (github_issue_id) 
    DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      state = EXCLUDED.state,
      labels = EXCLUDED.labels,
      assignees = EXCLUDED.assignees,
      milestone = EXCLUDED.milestone,
      updated_at = CURRENT_TIMESTAMP,
      github_updated_at = EXCLUDED.github_updated_at
    RETURNING *;
  `;

  const values = [
    github_issue_id,
    issue_number,
    title,
    body,
    state,
    JSON.stringify(labels),
    JSON.stringify(assignees),
    JSON.stringify(milestone),
    repository_name,
    repository_owner,
    github_created_at,
    github_updated_at
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting issue:', error);
    throw error;
  }
};

// Get issue by GitHub issue ID
const getIssueByGithubId = async (githubIssueId) => {
  const query = 'SELECT * FROM issues WHERE github_issue_id = $1';
  
  try {
    const result = await pool.query(query, [githubIssueId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching issue by GitHub ID:', error);
    throw error;
  }
};

// Get issues by repository
const getIssuesByRepository = async (owner, repo, state = null) => {
  let query = 'SELECT * FROM issues WHERE repository_owner = $1 AND repository_name = $2';
  let values = [owner, repo];

  if (state) {
    query += ' AND state = $3';
    values.push(state);
  }

  query += ' ORDER BY github_updated_at DESC';

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error fetching issues by repository:', error);
    throw error;
  }
};

// Get issues related to a PR (by issue number references in PR body/title)
const getIssuesRelatedToPR = async (owner, repo, prBody, prTitle) => {
  // Extract issue numbers from PR body and title using regex
  const issueRegex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  const directRefRegex = /#(\d+)/g;
  
  const issueNumbers = new Set();
  
  // Extract from closing keywords
  let match;
  while ((match = issueRegex.exec(prBody || '')) !== null) {
    issueNumbers.add(parseInt(match[1]));
  }
  
  while ((match = issueRegex.exec(prTitle || '')) !== null) {
    issueNumbers.add(parseInt(match[1]));
  }
  
  // Extract direct references
  while ((match = directRefRegex.exec(prBody || '')) !== null) {
    issueNumbers.add(parseInt(match[1]));
  }
  
  while ((match = directRefRegex.exec(prTitle || '')) !== null) {
    issueNumbers.add(parseInt(match[1]));
  }

  if (issueNumbers.size === 0) {
    return [];
  }

  const query = `
    SELECT * FROM issues 
    WHERE repository_owner = $1 AND repository_name = $2 AND issue_number = ANY($3)
    ORDER BY github_updated_at DESC
  `;

  try {
    const result = await pool.query(query, [owner, repo, Array.from(issueNumbers)]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching issues related to PR:', error);
    throw error;
  }
};

module.exports = {
  initializeIssuesTable,
  upsertIssue,
  getIssueByGithubId,
  getIssuesByRepository,
  getIssuesRelatedToPR
};
