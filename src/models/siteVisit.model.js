import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { fileSchema } from './requirement.model.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     SiteVisitDocument:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Document ID
 *         status:
 *           type: string
 *           enum: [Pending, Approved, Rejected]
 *           description: Review status of the document
 *         files:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/File'
 *           description: Files uploaded for this document
 *         addedAt:
 *           type: string
 *           format: date-time
 *           description: When the document was added
 *         adminFeedback:
 *           type: string
 *           description: Feedback from admin review
 *         feedbackBy:
 *           type: string
 *           description: ID of the user who provided feedback
 *         feedbackByModel:
 *           type: string
 *           enum: [User, Admin]
 *           description: Type of user who provided feedback
 *         engineerFeedback:
 *           type: string
 *           description: Feedback from the site engineer
 *         engineerFeedbackBy:
 *           type: string
 *           description: ID of the site engineer who provided feedback
 *       example:
 *         _id: "60d0fe4f5311236168a109cb"
 *         status: "Pending"
 *         files: []
 *         addedAt: "2024-01-15T10:00:00.000Z"
 *         adminFeedback: ""
 *         engineerFeedback: "Site photos uploaded"
 *         engineerFeedbackBy: "60d0fe4f5311236168a109ca"
 *
 *     SiteVisit:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Site visit ID
 *         project:
 *           type: string
 *           description: Reference to the project
 *         requirement:
 *           type: string
 *           description: Reference to the requirement
 *         hasRequirementEditAccess:
 *           type: boolean
 *           description: Whether the site engineer can edit the requirement
 *         siteEngineer:
 *           type: string
 *           description: Reference to the assigned site engineer
 *         visitDate:
 *           type: string
 *           format: date-time
 *           description: Single visit date (for backward compatibility)
 *         visitStartDate:
 *           type: string
 *           format: date-time
 *           description: Start date for visit range
 *         visitEndDate:
 *           type: string
 *           format: date-time
 *           description: End date for visit range
 *         documents:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SiteVisitDocument'
 *           description: Documents uploaded during the visit
 *         status:
 *           type: string
 *           enum: [Scheduled, InProgress, Completed, Cancelled, Outdated]
 *           description: Current status of the visit
 *         updatedData:
 *           type: object
 *           description: SCP data updated during the visit
 *         reviewedBy:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs of users who reviewed the visit
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *           description: When the visit was reviewed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the visit was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the visit was last updated
 *       example:
 *         _id: "60d0fe4f5311236168a109cc"
 *         project: "60d0fe4f5311236168a109cd"
 *         requirement: "60d0fe4f5311236168a109ce"
 *         hasRequirementEditAccess: true
 *         siteEngineer: "60d0fe4f5311236168a109ca"
 *         visitDate: "2024-08-15T10:00:00.000Z"
 *         visitStartDate: "2024-08-15T10:00:00.000Z"
 *         visitEndDate: "2024-08-17T18:00:00.000Z"
 *         documents: []
 *         status: "Scheduled"
 *         updatedData: null
 *         reviewedBy: []
 *         reviewedAt: null
 *         createdAt: "2024-01-15T10:00:00.000Z"
 *         updatedAt: "2024-01-15T10:00:00.000Z"
 *
 *     SiteVisitPaginated:
 *       type: object
 *       properties:
 *         docs:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SiteVisit'
 *         totalDocs:
 *           type: integer
 *           example: 25
 *         limit:
 *           type: integer
 *           example: 10
 *         page:
 *           type: integer
 *           example: 1
 *         totalPages:
 *           type: integer
 *           example: 3
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *         hasPrevPage:
 *           type: boolean
 *           example: false
 *         nextPage:
 *           type: integer
 *           example: 2
 *         prevPage:
 *           type: integer
 *           example: null
 */

const documentSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    files: {
        type: [fileSchema],
        default: [],
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
    adminFeedback: {
        type: String,
        trim: true,
    },
    feedbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'feedbackByModel',
    },
    feedbackByModel: {
        type: String,
        enum: ['User', 'Admin'],
    },
    engineerFeedback: {
        type: String,
        trim: true,
    },
    engineerFeedbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
});

const siteVisitSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    requirement: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Requirement',
        required: true,
    },
    hasRequirementEditAccess: {
        type: Boolean,
        default: false,
    },
    siteEngineer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    visitDate: {
        type: Date,
    },
    visitStartDate: {
        type: Date,
    },
    visitEndDate: {
        type: Date,
    },
    documents: {
        type: [documentSchema],
        default: [],
    },
    status: {
        type: String,
        enum: ['Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Outdated'],
        default: 'Scheduled',
    },
    updatedData: {
        type: Object, // Stores the snapshot of scpData proposed by the engineer
        default: null,
    },
    reviewedBy: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
},
    {
        timestamps: true,
    });

// add plugin that converts mongoose to json
siteVisitSchema.plugin(mongoosePaginate);

/**
 * @typedef SiteVisit
 */
const SiteVisit = mongoose.model('SiteVisit', siteVisitSchema);

export default SiteVisit;
