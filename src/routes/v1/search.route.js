import express from 'express';
import auth from '../../middlewares/auth.js';
import {
    globalSearch,
    searchCustomers,
    searchProjects,
    getSearchSuggestions,
    advancedSearch
} from '../../controllers/search.controller.js';

const router = express.Router();

// Global search for customers and projects
router.get('/global', auth(), globalSearch);

// Search customers only
router.get('/customers', auth(), searchCustomers);

// Search projects only
router.get('/projects', auth(), searchProjects);

// Get search suggestions (autocomplete)
router.get('/suggestions', auth(), getSearchSuggestions);

// Advanced search with multiple criteria
router.get('/advanced', auth(), advancedSearch);

export default router;
