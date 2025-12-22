/**
 * =============================================================================
 * AUTHENTICATION MIDDLEWARE
 * =============================================================================
 * Middleware untuk proteksi route dengan session
 */

/**
 * Middleware: Cek apakah user sudah login
 */
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        console.log(`[Auth] ✅ User authenticated: ${req.session.username}`);
        return next();
    }
    
    console.log('[Auth] ⚠️ Unauthorized access attempt');
    res.redirect('/login');
};

/**
 * Middleware: Cek apakah user adalah admin
 */
const isAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        console.log(`[Auth] ✅ Admin access granted: ${req.session.username}`);
        return next();
    }
    
    console.log('[Auth] ⚠️ Admin access denied');
    res.status(403).render('error', { 
        title: 'Access Denied',
        message: 'Anda tidak memiliki akses ke halaman ini',
        user: req.session
    });
};

/**
 * Middleware: Redirect jika sudah login
 */
const redirectIfAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        console.log(`[Auth] 🔄 Already authenticated, redirecting to home`);
        return res.redirect('/');
    }
    next();
};

/**
 * Middleware: Attach user info ke locals untuk views
 */
const attachUserToLocals = (req, res, next) => {
    res.locals.user = req.session.userId ? {
        id: req.session.userId,
        username: req.session.username,
        displayName: req.session.displayName,
        role: req.session.role
    } : null;
    res.locals.isAuthenticated = !!req.session.userId;
    res.locals.isAdmin = req.session.role === 'admin';
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
    redirectIfAuthenticated,
    attachUserToLocals
};
