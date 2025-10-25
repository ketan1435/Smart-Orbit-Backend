import {
    globalSearchService,
    searchCustomersService,
    searchProjectsService,
    getSearchSuggestionsService
} from '../services/search.service.js';

// Global search for customers and projects
export const globalSearch = async (req, res) => {
    try {
        const { q: searchQuery, type, status, dateFrom, dateTo, limit } = req.query;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const filters = {
            type,
            status,
            dateFrom,
            dateTo,
            limit: limit ? parseInt(limit) : 50
        };

        const result = await globalSearchService(searchQuery, filters);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in globalSearch:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to perform global search'
        });
    }
};

// Search customers only
export const searchCustomers = async (req, res) => {
    try {
        const { q: searchQuery, status, dateFrom, dateTo, limit } = req.query;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const filters = {
            status,
            dateFrom,
            dateTo,
            limit: limit ? parseInt(limit) : 50
        };

        const result = await searchCustomersService(searchQuery, filters);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in searchCustomers:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to search customers'
        });
    }
};

// Search projects only
export const searchProjects = async (req, res) => {
    try {
        console.log('🔍 Search Projects Controller Called:', req.query);
        
        const { q: searchQuery, status, dateFrom, dateTo, limit } = req.query;

        if (!searchQuery) {
            console.log('🔍 No search query provided');
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const filters = {
            status,
            dateFrom,
            dateTo,
            limit: limit ? parseInt(limit) : 50
        };

        const result = await searchProjectsService(searchQuery, filters);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in searchProjects:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to search projects'
        });
    }
};

// Get search suggestions (autocomplete)
export const getSearchSuggestions = async (req, res) => {
    try {
        const { q: searchQuery, type = 'all' } = req.query;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const result = await getSearchSuggestionsService(searchQuery, type);

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSearchSuggestions:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get search suggestions'
        });
    }
};

// Advanced search with multiple criteria
export const advancedSearch = async (req, res) => {
    try {
        const {
            q: searchQuery,
            type, // 'customers', 'projects', 'all'
            status,
            dateFrom,
            dateTo,
            limit,
            sortBy = 'relevance', // 'relevance', 'date', 'name'
            sortOrder = 'desc' // 'asc', 'desc'
        } = req.query;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const filters = {
            type,
            status,
            dateFrom,
            dateTo,
            limit: limit ? parseInt(limit) : 50,
            sortBy,
            sortOrder
        };

        let result;
        
        if (type === 'customers') {
            result = await searchCustomersService(searchQuery, filters);
        } else if (type === 'projects') {
            result = await searchProjectsService(searchQuery, filters);
        } else {
            result = await globalSearchService(searchQuery, filters);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in advancedSearch:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to perform advanced search'
        });
    }
};
