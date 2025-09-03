const pool = require('../db/dbConnection');

const getAllUsers = async (limit) => {
  const result = await pool.query('SELECT * FROM users.user LIMIT $1', [limit]);
  return result;
};

const createUser = async (name, email) => {
  const result = await pool.query(
    'INSERT INTO users.user (name, email) VALUES ($1, $2) RETURNING *',
    [name, email]
  );
  return result.rows[0];
};

module.exports = { getAllUsers, createUser };
