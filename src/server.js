const dotenv = require("dotenv");
dotenv.config();

process.env.NODE_ENV = "development";
const PORT = process.env.PORT || 3000; 

const app = require('./app');
const issueModel = require('./models/issueModel');

// Initialize database tables on startup
const initializeDatabase = async () => {
    try {
        await issueModel.initializeIssuesTable();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        // Don't exit the process, just log the error
    }
};

const startServer = async () => {
    // Initialize database first
    await initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server listening on http://localhost:${PORT}`);
        console.log(`📝 API Documentation: http://localhost:${PORT}/api/bugbot/docs`);
        console.log(`🔧 Bugbot Status: http://localhost:${PORT}/api/bugbot/status`);
    });
};

startServer().catch(console.error);
