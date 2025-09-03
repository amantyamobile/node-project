module.exports = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    const payload = { error: message };

    if (process.env.NODE_ENV !== 'production') {
        payload.stack = err.stack;
    }

    res.status(status).json(payload);
};