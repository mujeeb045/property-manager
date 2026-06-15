// middleware/auth.js

function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next(); // User is logged in, proceed
    }
    
    // User is not logged in
    res.redirect('/login');
}

module.exports = { isAuthenticated };