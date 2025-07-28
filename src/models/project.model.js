import mongoose from 'mongoose';
import { fileSchema } from './requirement.model.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     ArchitectProposal:
 *       type: object
 *       properties:
 *         architect:
 *           type: string
 *           description: The ID of the architect user
 *         email:
 *           type: string
 *           format: email
 *           description: Email of the architect
 *         proposedCharges:
 *           type: number
 *           description: The charges proposed by the architect
 *         deliveryTimelineDays:
 *           type: number
 *           description: Number of days proposed for delivery
 *         portfolioLink:
 *           type: string
 *           description: Link to architect's portfolio
 *         remarks:
 *           type: string
 *           description: Additional remarks from the architect
 *         status:
 *           type: string
 *           enum: [Pending, Responded, Withdrawn, Expired, Accepted, Rejected]
 *           description: Current status of the proposal
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           description: When the proposal was submitted
 *       example:
 *         architect: "60d0fe4f5311236168a109ca"
 *         email: "architect@example.com"
 *         proposedCharges: 5000
 *         deliveryTimelineDays: 7
 *         portfolioLink: "https://portfolio.example.com"
 *         remarks: "I can deliver high-quality designs within the timeline"
 *         status: "Pending"
 *         submittedAt: "2023-01-01T12:00:00.000Z"
 * 
 *     ArchitectDocument:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The document ID
 *         architect:
 *           type: object
 *           description: The architect who submitted the document
 *         files:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               fileType:
 *                 type: string
 *                 enum: [image, video, sketch, pdf, document]
 *               key:
 *                 type: string
 *               uploadedAt:
 *                 type: string
 *                 format: date-time
 *         notes:
 *           type: string
 *           description: Notes from the architect about the documents
 *         adminStatus:
 *           type: string
 *           enum: [Pending, Approved, Rejected]
 *           description: Status of admin review
 *         customerStatus:
 *           type: string
 *           enum: [Pending, Approved, Rejected]
 *           description: Status of customer review
 *         adminRemarks:
 *           type: string
 *           description: Remarks from admin review
 *         customerRemarks:
 *           type: string
 *           description: Remarks from customer review
 *         sentToCustomer:
 *           type: boolean
 *           description: Whether the document has been sent to customer for review
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           description: When the document was submitted
 *         adminReviewedAt:
 *           type: string
 *           format: date-time
 *           description: When the admin reviewed the document
 *         customerReviewedAt:
 *           type: string
 *           format: date-time
 *           description: When the customer reviewed the document
 *         version:
 *           type: number
 *           description: Version number of the document
 *       example:
 *         _id: "60d0fe4f5311236168a109cb"
 *         architect:
 *           _id: "60d0fe4f5311236168a109ca"
 *           name: "Architect Name"
 *           email: "architect@example.com"
 *         files:
 *           - fileType: "pdf"
 *             key: "projects/123/architect-docs/design-v1.pdf"
 *             uploadedAt: "2023-01-01T12:00:00.000Z"
 *         notes: "Final design documents for review"
 *         adminStatus: "Approved"
 *         customerStatus: "Pending"
 *         adminRemarks: "Looks good, ready for customer review"
 *         customerRemarks: ""
 *         sentToCustomer: true
 *         submittedAt: "2023-01-01T12:00:00.000Z"
 *         adminReviewedAt: "2023-01-02T10:00:00.000Z"
 *         version: 1
 *
 *     Project:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         projectName:
 *           type: string
 *         projectCode:
 *           type: string
 *         lead:
 *           type: object
 *           description: Populated customer lead information
 *         architect:
 *           type: object
 *           description: Populated architect user information
 *         requirement:
 *           type: object
 *           description: Populated requirement information
 *         status:
 *           type: string
 *           enum: [Draft, Pending, Active, OnHold, Completed, Cancelled]
 *         proposals:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ArchitectProposal'
 *         architectDocuments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ArchitectDocument'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const architectProposalSchema = mongoose.Schema({
    architect: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
    },
    proposedCharges: {
        type: Number,
        required: true,
    },
    deliveryTimelineDays: {
        type: Number,
        required: true,
    },
    portfolioLink: String,
    remarks: String,
    status: {
        type: String,
        enum: ['Pending', 'Open', 'Responded', 'Withdrawn', 'Expired', 'Accepted', 'Rejected', 'Archived'],
        default: 'Pending',
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    acceptedAt: Date,
    rejectedAt: Date,
    withdrawnAt: Date,
});

const architectDocumentSchema = mongoose.Schema({
    architect: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    files: [fileSchema],
    notes: {
        type: String,
        trim: true,
    },
    adminStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    customerStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    adminRemarks: {
        type: String,
        trim: true,
    },
    customerRemarks: {
        type: String,
        trim: true,
    },
    sentToCustomer: {
        type: Boolean,
        default: false,
    },
    sentToProcurement: {
        type: Boolean,
        default: false,
    },
    procurementSentAt: Date,
    sentToProcurementBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    adminReviewedAt: Date,
    customerReviewedAt: Date,
    version: {
        type: Number,
        default: 1,
    },
});

const projectSchema = new mongoose.Schema(
    {
        projectName: {
            type: String,
            required: true,
            trim: true,
        },
        projectCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerLead',
            required: true,
        },
        architect: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        requirement: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
        status: {
            type: String,
            enum: ['Draft', 'Pending', 'Open', 'OnHold', 'Completed', 'Cancelled'],
            default: 'Draft',
        },
        siteVisits: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'SiteVisit',
        },
        startDate: {
            type: Date,
        },
        assignedSiteEngineer: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        estimatedCompletionDate: {
            type: Date,
        },
        actualCompletionDate: {
            type: Date,
        },
        budget: {
            type: String,
        },
        files: [fileSchema],
        notes: {
            type: String,
            trim: true,
        },
        proposals: [architectProposalSchema],
        architectDocuments: [architectDocumentSchema],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'createdByModel',
            required: true,
        },
        createdByModel: {
            type: String,
            enum: ['User', 'Admin'],
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Project = mongoose.model('Project', projectSchema);

export default Project;

