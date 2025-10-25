import CustomerLead from '../models/customerLead.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import Requirement from '../models/requirement.model.js';

// Global search service for customers and projects
const globalSearchService = async (searchQuery, filters = {}) => {
    try {
        console.log('🔍 Global Search Service Called:', { searchQuery, filters });
        
        const query = searchQuery?.trim();
        
        if (!query || query.length < 2) {
            console.log('🔍 Search query too short or empty:', query);
            return {
                success: true,
                data: {
                    customers: [],
                    projects: [],
                    totalResults: 0,
                    searchQuery: query
                }
            };
        }

        const searchRegex = new RegExp(query, 'i');
        
        // Search customers
        const customerSearchCriteria = {
            $or: [
                { customerName: searchRegex },
                { email: searchRegex },
                { phoneNumber: searchRegex },
                { mobileNumber: searchRegex },
                { state: searchRegex },
                { city: searchRegex },
                { address: searchRegex },
                { companyName: searchRegex },
                { status: searchRegex }
            ]
        };

        // Search projects
        const projectSearchCriteria = {
            $or: [
                { projectName: searchRegex },
                { projectCode: searchRegex },
                { status: searchRegex },
                { 'lead.customerName': searchRegex },
                { 'lead.email': searchRegex },
                { 'lead.phoneNumber': searchRegex },
                { 'lead.mobileNumber': searchRegex },
                { 'lead.state': searchRegex },
                { 'lead.city': searchRegex },
                { 'lead.address': searchRegex },
                { 'lead.companyName': searchRegex },
                { 'requirement.type': searchRegex },
                { 'requirement.description': searchRegex },
                { 'requirement.location': searchRegex },
                { 'createdBy.name': searchRegex },
                { 'assignedEngineer.name': searchRegex }
            ]
        };

        // Apply additional filters if provided
        if (filters.customerStatus) {
            customerSearchCriteria.status = filters.customerStatus;
        }
        
        if (filters.projectStatus) {
            projectSearchCriteria.status = filters.projectStatus;
        }

        if (filters.dateFrom || filters.dateTo) {
            const dateFilter = {};
            if (filters.dateFrom) {
                dateFilter.$gte = new Date(filters.dateFrom);
            }
            if (filters.dateTo) {
                dateFilter.$lte = new Date(filters.dateTo);
            }
            customerSearchCriteria.createdAt = dateFilter;
            projectSearchCriteria.createdAt = dateFilter;
        }

        // Execute searches in parallel
        const [customers, projects] = await Promise.all([
            CustomerLead.find(customerSearchCriteria)
                .select('customerName email phoneNumber mobileNumber state city address companyName status createdAt')
                .sort({ createdAt: -1 })
                .limit(filters.limit || 50),
            
            Project.find(projectSearchCriteria)
                .populate('lead', 'customerName email phoneNumber mobileNumber state city address companyName')
                .populate('createdBy', 'name email')
                .populate('assignedEngineer', 'name email')
                .select('projectName projectCode status lead createdBy assignedEngineer requirement createdAt')
                .sort({ createdAt: -1 })
                .limit(filters.limit || 50)
        ]);

        // Calculate total results
        const totalResults = customers.length + projects.length;

        // Format results with search highlights
        const formattedCustomers = customers.map(customer => ({
            _id: customer._id,
            type: 'customer',
            customerName: customer.customerName,
            email: customer.email,
            phoneNumber: customer.phoneNumber,
            mobileNumber: customer.mobileNumber,
            state: customer.state,
            city: customer.city,
            address: customer.address,
            companyName: customer.companyName,
            status: customer.status,
            createdAt: customer.createdAt,
            // Add search relevance score
            relevanceScore: calculateRelevanceScore(customer, query)
        }));

        const formattedProjects = projects.map(project => ({
            _id: project._id,
            type: 'project',
            projectName: project.projectName,
            projectCode: project.projectCode,
            status: project.status,
            lead: project.lead,
            createdBy: project.createdBy,
            assignedEngineer: project.assignedEngineer,
            requirement: project.requirement,
            createdAt: project.createdAt,
            // Add search relevance score
            relevanceScore: calculateRelevanceScore(project, query)
        }));

        // Sort by relevance score (highest first)
        const allResults = [...formattedCustomers, ...formattedProjects]
            .sort((a, b) => b.relevanceScore - a.relevanceScore);

        return {
            success: true,
            data: {
                customers: formattedCustomers,
                projects: formattedProjects,
                allResults,
                totalResults,
                searchQuery: query,
                filters: filters
            }
        };

    } catch (error) {
        console.error('Error in globalSearchService:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            searchQuery,
            filters
        });
        throw error;
    }
};

// Calculate relevance score for search results
const calculateRelevanceScore = (item, query) => {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Check each field and assign scores based on match type
    const fields = [
        { value: item.customerName || item.projectName, weight: 10 },
        { value: item.email, weight: 8 },
        { value: item.phoneNumber || item.mobileNumber, weight: 6 },
        { value: item.state || item.city, weight: 4 },
        { value: item.status, weight: 3 },
        { value: item.companyName, weight: 5 }
    ];

    fields.forEach(field => {
        if (field.value) {
            const valueLower = field.value.toLowerCase();
            
            // Exact match gets highest score
            if (valueLower === queryLower) {
                score += field.weight * 3;
            }
            // Starts with query gets high score
            else if (valueLower.startsWith(queryLower)) {
                score += field.weight * 2;
            }
            // Contains query gets medium score
            else if (valueLower.includes(queryLower)) {
                score += field.weight;
            }
        }
    });

    return score;
};

// Search customers only
const searchCustomersService = async (searchQuery, filters = {}) => {
    try {
        const query = searchQuery?.trim();
        
        if (!query || query.length < 2) {
            return {
                success: true,
                data: {
                    customers: [],
                    totalResults: 0,
                    searchQuery: query
                }
            };
        }

        const searchRegex = new RegExp(query, 'i');
        
        const searchCriteria = {
            $or: [
                { customerName: searchRegex },
                { email: searchRegex },
                { phoneNumber: searchRegex },
                { mobileNumber: searchRegex },
                { state: searchRegex },
                { city: searchRegex },
                { address: searchRegex },
                { companyName: searchRegex },
                { status: searchRegex }
            ]
        };

        // Apply filters
        if (filters.status) {
            searchCriteria.status = filters.status;
        }

        if (filters.dateFrom || filters.dateTo) {
            const dateFilter = {};
            if (filters.dateFrom) {
                dateFilter.$gte = new Date(filters.dateFrom);
            }
            if (filters.dateTo) {
                dateFilter.$lte = new Date(filters.dateTo);
            }
            searchCriteria.createdAt = dateFilter;
        }

        const customers = await CustomerLead.find(searchCriteria)
            .select('customerName email phoneNumber mobileNumber state city address companyName status createdAt')
            .sort({ createdAt: -1 })
            .limit(filters.limit || 50);

        return {
            success: true,
            data: {
                customers,
                totalResults: customers.length,
                searchQuery: query
            }
        };

    } catch (error) {
        console.error('Error in searchCustomersService:', error);
        throw error;
    }
};

// Search projects only
const searchProjectsService = async (searchQuery, filters = {}) => {
    try {
        console.log('🔍 Search Projects Service Called:', { searchQuery, filters });
        
        const query = searchQuery?.trim();
        
        if (!query || query.length < 2) {
            console.log('🔍 Search query too short or empty:', query);
            return {
                success: true,
                data: {
                    projects: [],
                    totalResults: 0,
                    searchQuery: query
                }
            };
        }

        const searchRegex = new RegExp(query, 'i');

        // Find matching referenced documents first (CustomerLead, User/Admin)
        const [matchedLeads, matchedUsers, matchedAdmins, matchedRequirements] = await Promise.all([
            CustomerLead.find({
                $or: [
                    { customerName: searchRegex },
                    { email: searchRegex },
                    { mobileNumber: searchRegex },
                    { alternateContactNumber: searchRegex },
                    { whatsappNumber: searchRegex },
                    { state: searchRegex },
                    { city: searchRegex },
                    { address: searchRegex },
                    { companyName: searchRegex },
                ],
            }).select('_id').lean(),
            User.find({ name: searchRegex }).select('_id').lean(),
            Admin.find({ name: searchRegex }).select('_id').lean(),
            Requirement.find({
                $or: [
                    { requirementType: searchRegex },
                    { requirementDescription: searchRegex },
                ],
            }).select('_id').lean(),
        ]);

        const matchedLeadIds = matchedLeads.map((d) => d._id);
        const matchedUserOrAdminIds = [...matchedUsers, ...matchedAdmins].map((d) => d._id);

        const matchedRequirementIds = matchedRequirements.map((d) => d._id);

        // Build candidate project ids from multiple sources
        const [directProjects, projectsByLead, projectsByCreator, projectsByEngineer, projectsByRequirement] = await Promise.all([
            Project.find({
                $or: [
                    { projectName: searchRegex },
                    { projectCode: searchRegex },
                    { status: searchRegex },
                ],
            }).select('_id').lean(),
            matchedLeadIds.length > 0 ? Project.find({ lead: { $in: matchedLeadIds } }).select('_id').lean() : Promise.resolve([]),
            matchedUserOrAdminIds.length > 0 ? Project.find({ createdBy: { $in: matchedUserOrAdminIds } }).select('_id').lean() : Promise.resolve([]),
            matchedUserOrAdminIds.length > 0 ? Project.find({ assignedSiteEngineer: { $in: matchedUserOrAdminIds } }).select('_id').lean() : Promise.resolve([]),
            matchedRequirementIds.length > 0 ? Project.find({ requirement: { $in: matchedRequirementIds } }).select('_id').lean() : Promise.resolve([]),
        ]);

        const candidateIds = new Set([
            ...directProjects.map(d => String(d._id)),
            ...projectsByLead.map(d => String(d._id)),
            ...projectsByCreator.map(d => String(d._id)),
            ...projectsByEngineer.map(d => String(d._id)),
            ...projectsByRequirement.map(d => String(d._id)),
        ]);

        console.log('🔍 Candidate project id counts:', {
            direct: directProjects.length,
            byLead: projectsByLead.length,
            byCreator: projectsByCreator.length,
            byEngineer: projectsByEngineer.length,
            byRequirement: projectsByRequirement.length,
            unique: candidateIds.size,
        });

        const finalCriteria = candidateIds.size > 0 ? { _id: { $in: Array.from(candidateIds) } } : { _id: null };
        console.log('🔍 Final criteria:', finalCriteria);

        const projects = await Project.find(finalCriteria)
            .populate('lead', 'customerName email phoneNumber mobileNumber state city address companyName status')
            .populate('createdBy', 'name email')
            .populate('assignedSiteEngineer', 'name email')
            .populate('requirement', 'requirementType requirementDescription scpData')
            .select('projectName projectCode status lead createdBy assignedSiteEngineer requirement createdAt')
            .sort({ createdAt: -1 })
            .limit(filters.limit || 50);
            
        console.log('🔍 Found projects:', projects.length);

        return {
            success: true,
            data: {
                projects,
                totalResults: projects.length,
                searchQuery: query
            }
        };

    } catch (error) {
        console.error('Error in searchProjectsService:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            searchQuery,
            filters
        });
        throw error;
    }
};

// Get search suggestions (autocomplete)
const getSearchSuggestionsService = async (searchQuery, type = 'all') => {
    try {
        const query = searchQuery?.trim();
        
        if (!query || query.length < 1) {
            return {
                success: true,
                data: {
                    suggestions: [],
                    searchQuery: query
                }
            };
        }

        const searchRegex = new RegExp(query, 'i');
        const suggestions = [];

        if (type === 'all' || type === 'customers') {
            const customerSuggestions = await CustomerLead.find({
                $or: [
                    { customerName: searchRegex },
                    { email: searchRegex },
                    { companyName: searchRegex }
                ]
            })
            .select('customerName email companyName')
            .limit(10);

            suggestions.push(...customerSuggestions.map(c => ({
                type: 'customer',
                text: c.customerName,
                subtitle: c.email,
                value: c._id
            })));
        }

        if (type === 'all' || type === 'projects') {
            const projectSuggestions = await Project.find({
                $or: [
                    { projectName: searchRegex },
                    { projectCode: searchRegex }
                ]
            })
            .select('projectName projectCode')
            .limit(10);

            suggestions.push(...projectSuggestions.map(p => ({
                type: 'project',
                text: p.projectName,
                subtitle: p.projectCode,
                value: p._id
            })));
        }

        return {
            success: true,
            data: {
                suggestions: suggestions.slice(0, 20), // Limit total suggestions
                searchQuery: query
            }
        };

    } catch (error) {
        console.error('Error in getSearchSuggestionsService:', error);
        throw error;
    }
};

export {
    globalSearchService,
    searchCustomersService,
    searchProjectsService,
    getSearchSuggestionsService
};
