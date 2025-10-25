import Feedback from '../models/feedback.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import { createActivityLog } from './activityLog.service.js';

// Create feedback
const createFeedbackService = async (feedbackData, userId) => {
    try {
        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Verify project exists
        const project = await Project.findById(feedbackData.projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Create feedback
        const feedback = new Feedback({
            ...feedbackData,
            userId,
            userRole: user.role,
            userName: user.name || user.firstName || user.username || 'Unknown User'
        });

        await feedback.save();

        // Create activity log
        await createActivityLog({
            projectId: feedbackData.projectId,
            user: userId,
            userModel: 'User',
            userName: user.name || user.firstName || user.username || 'Unknown User',
            userEmail: user.email || 'unknown@example.com',
            targetModel: 'Feedback',
            targetId: feedback._id,
            targetName: feedbackData.title,
            action: 'feedback_submitted',
            actionType: 'Communication',
            description: `${user.name || user.firstName || user.username} submitted feedback: "${feedbackData.title}"`,
            metadata: {
                feedbackId: feedback._id,
                feedbackType: feedbackData.feedbackType,
                rating: feedbackData.rating,
                userName: user.name || user.firstName || user.username,
                userRole: user.role
            }
        });

        return {
            success: true,
            message: 'Feedback submitted successfully',
            data: feedback
        };
    } catch (error) {
        console.error('Create feedback error:', error);
        throw new Error(error.message || 'Failed to create feedback');
    }
};

// Get feedbacks for a project (with role-based filtering)
const getFeedbacksForProjectService = async (projectId, userRole, userId) => {
    try {
        let query = { projectId };

        // Role-based filtering
        if (userRole === 'user') {
            // Customers can only see their own feedbacks
            query.userId = userId;
        } else if (userRole === 'architect') {
            // Architects can see customer feedbacks and their own
            query.$or = [
                { userRole: 'user' },
                { userId }
            ];
        }
        // Admins can see all feedbacks (no additional filtering)

        const feedbacks = await Feedback.find(query)
            .populate('userId', 'name firstName username email role')
            .populate('adminResponseBy', 'name firstName username')
            .sort({ createdAt: -1 });

        return {
            success: true,
            data: feedbacks
        };
    } catch (error) {
        console.error('Get feedbacks error:', error);
        throw new Error(error.message || 'Failed to get feedbacks');
    }
};

// Get all feedbacks for admin dashboard
const getAllFeedbacksService = async (filters = {}) => {
    try {
        let query = {};

        // Apply filters
        if (filters.projectId) {
            query.projectId = filters.projectId;
        }
        if (filters.userRole) {
            query.userRole = filters.userRole;
        }
        if (filters.status) {
            query.status = filters.status;
        }
        if (filters.feedbackType) {
            query.feedbackType = filters.feedbackType;
        }
        if (filters.rating) {
            query.rating = filters.rating;
        }

        const feedbacks = await Feedback.find(query)
            .populate('projectId', 'projectName projectCode')
            .populate('userId', 'name firstName username email role')
            .populate('adminResponseBy', 'name firstName username')
            .sort({ createdAt: -1 });

        return {
            success: true,
            data: feedbacks
        };
    } catch (error) {
        console.error('Get all feedbacks error:', error);
        throw new Error(error.message || 'Failed to get feedbacks');
    }
};

// Update feedback status and add admin response
const updateFeedbackService = async (feedbackId, updateData, adminUserId) => {
    try {
        const admin = await User.findById(adminUserId);
        if (!admin) {
            throw new Error('Admin user not found');
        }

        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            throw new Error('Feedback not found');
        }

        // Update feedback
        const updatedFeedback = await Feedback.findByIdAndUpdate(
            feedbackId,
            {
                ...updateData,
                adminResponseBy: adminUserId,
                adminResponseAt: new Date()
            },
            { new: true }
        ).populate('projectId', 'projectName projectCode')
         .populate('userId', 'name firstName username email role')
         .populate('adminResponseBy', 'name firstName username');

        // Create activity log
        await createActivityLog({
            projectId: feedback.projectId,
            user: adminUserId,
            userModel: 'Admin',
            userName: admin.name || admin.firstName || admin.username || 'Admin',
            userEmail: admin.email || 'admin@example.com',
            targetModel: 'Feedback',
            targetId: feedback._id,
            targetName: feedback.title,
            action: 'feedback_updated',
            actionType: 'Communication',
            description: `${admin.name || admin.firstName || admin.username} ${updateData.status === 'reviewed' ? 'reviewed' : 'responded to'} feedback: "${feedback.title}"`,
            metadata: {
                feedbackId: feedback._id,
                previousStatus: feedback.status,
                newStatus: updateData.status,
                adminName: admin.name || admin.firstName || admin.username,
                adminRole: admin.role
            }
        });

        return {
            success: true,
            message: 'Feedback updated successfully',
            data: updatedFeedback
        };
    } catch (error) {
        console.error('Update feedback error:', error);
        throw new Error(error.message || 'Failed to update feedback');
    }
};

// Get feedback statistics
const getFeedbackStatsService = async (projectId = null) => {
    try {
        let matchQuery = {};
        if (projectId) {
            matchQuery.projectId = projectId;
        }

        const stats = await Feedback.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalFeedbacks: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    ratingDistribution: {
                        $push: '$rating'
                    },
                    feedbackTypeDistribution: {
                        $push: '$feedbackType'
                    },
                    statusDistribution: {
                        $push: '$status'
                    }
                }
            },
            {
                $project: {
                    totalFeedbacks: 1,
                    averageRating: { $round: ['$averageRating', 2] },
                    ratingDistribution: 1,
                    feedbackTypeDistribution: 1,
                    statusDistribution: 1
                }
            }
        ]);

        return {
            success: true,
            data: stats[0] || {
                totalFeedbacks: 0,
                averageRating: 0,
                ratingDistribution: [],
                feedbackTypeDistribution: [],
                statusDistribution: []
            }
        };
    } catch (error) {
        console.error('Get feedback stats error:', error);
        throw new Error(error.message || 'Failed to get feedback statistics');
    }
};

export {
    createFeedbackService,
    getFeedbacksForProjectService,
    getAllFeedbacksService,
    updateFeedbackService,
    getFeedbackStatsService
};

