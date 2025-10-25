import PerformanceRating from '../models/performanceRating.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import { createActivityLog } from './activityLog.service.js';

// Create performance rating
const createPerformanceRatingService = async (ratingData, userId) => {
    try {
        console.log('🔍 Performance Rating Service Debug:', {
            userId,
            userIdType: typeof userId,
            ratingData
        });
        
        // Test: Check if any users exist in the database
        const allUsers = await User.find({}).limit(3);
        const allAdmins = await Admin.find({}).limit(3);
        console.log('🔍 All users in DB:', {
            userCount: allUsers.length,
            users: allUsers.map(u => ({ id: u._id, name: u.name, email: u.email })),
            adminCount: allAdmins.length,
            admins: allAdmins.map(a => ({ id: a._id, name: a.name, email: a.email }))
        });
        
        // Get user details - check both User and Admin models
        let user = await User.findById(userId);
        if (!user) {
            user = await Admin.findById(userId);
        }
        
        console.log('🔍 User found:', {
            user,
            userExists: !!user,
            userIdFromDB: user?._id,
            searchUserId: userId,
            userType: user ? (user.constructor.modelName || 'Unknown') : 'Not found'
        });
        
        if (!user) {
            throw new Error('User not found');
        }

        // Verify project exists
        const project = await Project.findById(ratingData.projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Check if rating already exists for this project by this user
        const existingRating = await PerformanceRating.findOne({
            projectId: ratingData.projectId,
            ratedBy: userId
        });

        let rating;
        if (existingRating) {
            // Update existing rating
            rating = await PerformanceRating.findByIdAndUpdate(
                existingRating._id,
                {
                    rating: ratingData.rating,
                    comments: ratingData.comments,
                    ratingType: ratingData.ratingType || 'overall'
                },
                { new: true }
            );
        } else {
            // Create new rating
            rating = new PerformanceRating({
                ...ratingData,
                ratedBy: userId,
                ratedByName: user.name || user.firstName || user.username || 'Unknown User'
            });
            await rating.save();
        }

        // Create activity log
        await createActivityLog({
            projectId: ratingData.projectId,
            user: userId,
            userModel: 'User',
            userName: user.name || user.firstName || user.username || 'Unknown User',
            userEmail: user.email || 'unknown@example.com',
            targetModel: 'PerformanceRating',
            targetId: rating._id,
            targetName: `Performance Rating: ${ratingData.rating}/10`,
            action: 'performance_rating_added',
            actionType: 'Rating',
            description: `${user.name || user.firstName || user.username} added performance rating: ${ratingData.rating}/10 for project "${project.projectName}"`,
            metadata: {
                ratingId: rating._id,
                rating: ratingData.rating,
                ratingType: ratingData.ratingType || 'overall',
                comments: ratingData.comments,
                userName: user.name || user.firstName || user.username,
                userRole: user.role
            }
        });

        return {
            success: true,
            message: 'Performance rating added successfully',
            data: rating
        };
    } catch (error) {
        console.error('Error in createPerformanceRatingService:', error);
        throw error;
    }
};

// Get performance ratings for a project
const getPerformanceRatingsForProjectService = async (projectId) => {
    try {
        const ratings = await PerformanceRating.find({ projectId })
            .populate('ratedBy', 'name firstName username email role')
            .sort({ createdAt: -1 });

        return {
            success: true,
            data: ratings
        };
    } catch (error) {
        console.error('Error in getPerformanceRatingsForProjectService:', error);
        throw error;
    }
};

// Get all performance ratings (admin only)
const getAllPerformanceRatingsService = async (filters = {}) => {
    try {
        const query = {};
        
        if (filters.projectId) {
            query.projectId = filters.projectId;
        }
        
        if (filters.ratedBy) {
            query.ratedBy = filters.ratedBy;
        }
        
        if (filters.ratingType) {
            query.ratingType = filters.ratingType;
        }

        const ratings = await PerformanceRating.find(query)
            .populate('projectId', 'projectName projectCode')
            .populate('ratedBy', 'name firstName username email role')
            .sort({ createdAt: -1 });

        return {
            success: true,
            data: ratings
        };
    } catch (error) {
        console.error('Error in getAllPerformanceRatingsService:', error);
        throw error;
    }
};

// Update performance rating
const updatePerformanceRatingService = async (ratingId, updateData, userId) => {
    try {
        const rating = await PerformanceRating.findById(ratingId);
        if (!rating) {
            throw new Error('Performance rating not found');
        }

        // Check if user is the one who created the rating or is an admin
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (rating.ratedBy.toString() !== userId && user.role !== 'Admin') {
            throw new Error('Unauthorized to update this rating');
        }

        const updatedRating = await PerformanceRating.findByIdAndUpdate(
            ratingId,
            updateData,
            { new: true }
        ).populate('ratedBy', 'name firstName username email role');

        return {
            success: true,
            message: 'Performance rating updated successfully',
            data: updatedRating
        };
    } catch (error) {
        console.error('Error in updatePerformanceRatingService:', error);
        throw error;
    }
};

// Delete performance rating
const deletePerformanceRatingService = async (ratingId, userId) => {
    try {
        const rating = await PerformanceRating.findById(ratingId);
        if (!rating) {
            throw new Error('Performance rating not found');
        }

        // Check if user is the one who created the rating or is an admin
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (rating.ratedBy.toString() !== userId && user.role !== 'Admin') {
            throw new Error('Unauthorized to delete this rating');
        }

        await PerformanceRating.findByIdAndDelete(ratingId);

        return {
            success: true,
            message: 'Performance rating deleted successfully'
        };
    } catch (error) {
        console.error('Error in deletePerformanceRatingService:', error);
        throw error;
    }
};

export {
    createPerformanceRatingService,
    getPerformanceRatingsForProjectService,
    getAllPerformanceRatingsService,
    updatePerformanceRatingService,
    deletePerformanceRatingService
};
