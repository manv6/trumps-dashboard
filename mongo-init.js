/*
 * MongoDB Initialization Script for Docker
 * This file is executed automatically when MongoDB container starts for the first time
 * File runs in MongoDB shell context where 'db' and 'print' are globally available
 */

// Switch to trumps-dashboard database
// eslint-disable-next-line no-undef
db = db.getSiblingDB('trumps-dashboard');

// Create collections explicitly (optional but good practice)
// eslint-disable-next-line no-undef
db.createCollection('users');
// eslint-disable-next-line no-undef
db.createCollection('games');

// Create indexes for performance optimization
// eslint-disable-next-line no-undef
db.users.createIndex({ "username": 1 }, { unique: true });
// eslint-disable-next-line no-undef
db.users.createIndex({ "email": 1 }, { unique: true });
// eslint-disable-next-line no-undef
db.games.createIndex({ "createdAt": -1 });
// eslint-disable-next-line no-undef
db.games.createIndex({ "status": 1 });
// eslint-disable-next-line no-undef
db.games.createIndex({ "host": 1 });

// Insert default admin user for initial access
// Password: admin123 (pre-hashed with bcrypt)
// eslint-disable-next-line no-undef
db.users.insertOne({
    username: "admin",
    email: "admin@trumpsdashboard.com",
    password: "$2a$10$rOiHJV5.XZ8qKKqEeK0yNOyN0v6h9cQgGsOxlI5FhGUYr3.7c.k.K",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date()
});

// MongoDB shell print function
// eslint-disable-next-line no-undef
print("Trumps Dashboard database initialized successfully!");