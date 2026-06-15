const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

// GET Login Page
router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', { 
        title: 'Login', 
        error: null 
    });
});

// POST Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
            [email]
        );

        if (result.rows.length === 0) {
            return res.render('login', { 
                title: 'Login', 
                error: 'Invalid email or password' 
            });
        }

        const user = result.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.render('login', { 
                title: 'Login', 
                error: 'Invalid email or password' 
            });
        }

        // Create session
        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userRole = user.role;

        res.redirect('/');

    } catch (err) {
        console.error(err);
        res.render('login', { 
            title: 'Login', 
            error: 'Something went wrong. Please try again.' 
        });
    }
});

// Better Logout using regenerate (more reliable)
router.get('/logout', (req, res) => {
    req.session.regenerate((err) => {
        if (err) {
            console.error(err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;