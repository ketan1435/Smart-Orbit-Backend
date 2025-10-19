import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import SiteVisit from '../models/siteVisit.model.js';
import Sitework from '../models/sitework.model.js';
import BOM from '../models/bom.model.js';
import PO from '../models/po.model.js';
import ActivityLog from '../models/activityLog.model.js';
import ClientProposal from '../models/clientProposal.model.js';
import Quote from '../models/quote.model.js';
import { createActivityLog } from './activityLog.service.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';

/**
 * Generate comprehensive project report data
 */
const generateProjectReport = async (projectId) => {
    try {
        // Get project with all related data
        const project = await Project.findById(projectId)
            .populate('lead')
            .populate('requirement')
            .populate('createdBy', 'name email role')
            .populate('assignedSiteEngineer', 'name email role')
            .populate('architect', 'name email role')
            .lean();

        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }

        // Get photos and comprehensive documents
        const photos = await getProjectPhotos(projectId);
        const documents = await getAllProjectDocuments(projectId);

        // Get financial data
        const purchaseOrders = await getPurchaseOrders(projectId);
        const boms = await getBOMs(projectId);
        const vendors = await getVendors(projectId);

        // Get timeline/activities
        const timeline = await getProjectTimeline(projectId);

        // Get analytics
        const analytics = await getProjectAnalytics(projectId);

        // Get site work data
        const siteWork = await getSiteWorkData(projectId);

        // Get site visits
        const siteVisits = await getSiteVisits(projectId);

        // Get proposals
        const clientProposals = await getClientProposals(projectId);
        const vendorProposals = await getVendorProposals(projectId);

        return {
            project: {
                ...project,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt
            },
            photos,
            documents,
            purchaseOrders,
            boms,
            vendors,
            timeline,
            analytics,
            siteWork,
            siteVisits,
            clientProposals,
            vendorProposals
        };
    } catch (error) {
        console.error('Error generating project report:', error);
        throw error;
    }
};

/**
 * Get project photos
 */
const getProjectPhotos = async (projectId) => {
    try {
        // Get photos from site visits
        const siteVisits = await SiteVisit.find({ project: projectId })
            .select('photos')
            .lean();

        const photos = [];
        siteVisits.forEach(visit => {
            if (visit.photos && visit.photos.length > 0) {
                visit.photos.forEach(photo => {
                    photos.push({
                        url: photo.url || photo,
                        caption: photo.caption || 'Site visit photo',
                        date: visit.visitDate,
                        type: 'Site Visit'
                    });
                });
            }
        });

        // Get photos from site work
        const siteWorks = await Sitework.find({ project: projectId })
            .select('attachment siteworkDocuments name')
            .lean();

        siteWorks.forEach(sitework => {
            // Get photos from sitework attachments
            if (sitework.attachment && sitework.attachment.files && sitework.attachment.files.length > 0) {
                sitework.attachment.files.forEach(attachment => {
                    if (attachment.fileType === 'image' || attachment.mimetype?.startsWith('image/')) {
                        photos.push({
                            url: attachment.url || attachment.key,
                            caption: attachment.originalName || `Site work photo - ${sitework.name}`,
                            date: attachment.uploadedAt || sitework.attachment.uploadedAt || sitework.createdAt,
                            type: 'Site Work',
                            siteworkName: sitework.name
                        });
                    }
                });
            }

            // Get photos from sitework documents
            if (sitework.siteworkDocuments && sitework.siteworkDocuments.length > 0) {
                sitework.siteworkDocuments.forEach(doc => {
                    if (doc.files && doc.files.length > 0) {
                        doc.files.forEach(file => {
                            if (file.fileType === 'image' || file.mimetype?.startsWith('image/')) {
                                photos.push({
                                    url: file.url || file.key,
                                    caption: file.originalName || `Site work document photo - ${sitework.name}`,
                                    date: file.uploadedAt || doc.addedAt || sitework.createdAt,
                                    type: 'Site Work Document',
                                    siteworkName: sitework.name
                                });
                            }
                        });
                    }
                });
            }
        });

        // Get photos from architect documents
        const project = await Project.findById(projectId)
            .select('architectDocuments')
            .lean();

        if (project && project.architectDocuments && project.architectDocuments.length > 0) {
            project.architectDocuments.forEach(archDoc => {
                if (archDoc.files && archDoc.files.length > 0) {
                    archDoc.files.forEach(file => {
                        if (file.fileType === 'image' || file.mimetype?.startsWith('image/')) {
                            photos.push({
                                url: file.url || file.key,
                                caption: file.originalName || `Architect document - ${file.fileType}`,
                                date: file.uploadedAt || archDoc.submittedAt,
                                type: 'Architect Document',
                                fileType: file.fileType
                            });
                        }
                    });
                }
            });
        }

        return photos;
    } catch (error) {
        console.error('Error getting project photos:', error);
        return [];
    }
};

/**
 * Get project documents
 */
const getAllProjectDocuments = async (projectId) => {
    try {
        const documents = [];

        // Get BOM documents
        const boms = await BOM.find({ project: projectId })
            .select('attachments name')
            .lean();

        boms.forEach(bom => {
            if (bom.attachments && bom.attachments.length > 0) {
                bom.attachments.forEach(attachment => {
                    documents.push({
                        name: attachment.originalName || attachment.name,
                        type: 'BOM Document',
                        url: attachment.url || attachment.key,
                        date: bom.createdAt,
                        size: attachment.size || 'N/A'
                    });
                });
            }
        });

        // Get PO documents
        const pos = await PO.find({ project: projectId })
            .select('attachments poNumber')
            .lean();

        pos.forEach(po => {
            if (po.attachments && po.attachments.length > 0) {
                po.attachments.forEach(attachment => {
                    documents.push({
                        name: attachment.originalName || attachment.name,
                        type: 'PO Document',
                        url: attachment.url || attachment.key,
                        date: po.createdAt,
                        size: attachment.size || 'N/A'
                    });
                });
            }
        });

        // Get Sitework documents
        const siteworks = await Sitework.find({ project: projectId })
            .select('attachment siteworkDocuments name')
            .lean();

        siteworks.forEach(sitework => {
            // Get documents from sitework attachments
            if (sitework.attachment && sitework.attachment.files && sitework.attachment.files.length > 0) {
                sitework.attachment.files.forEach(attachment => {
                    documents.push({
                        name: attachment.originalName || attachment.name,
                        type: 'Sitework Attachment',
                        url: attachment.url || attachment.key,
                        date: attachment.uploadedAt || sitework.attachment.uploadedAt || sitework.createdAt,
                        size: attachment.size || 'N/A',
                        siteworkName: sitework.name
                    });
                });
            }

            // Get documents from sitework documents
            if (sitework.siteworkDocuments && sitework.siteworkDocuments.length > 0) {
                sitework.siteworkDocuments.forEach(doc => {
                    if (doc.files && doc.files.length > 0) {
                        doc.files.forEach(file => {
                            documents.push({
                                name: file.originalName || file.name,
                                type: 'Sitework Document',
                                url: file.url || file.key,
                                date: file.uploadedAt || doc.addedAt || sitework.createdAt,
                                size: file.size || 'N/A',
                                siteworkName: sitework.name
                            });
                        });
                    }
                });
            }
        });

        // Get Architect documents from project
        const project = await Project.findById(projectId)
            .select('architectDocuments')
            .lean();

        if (project && project.architectDocuments && project.architectDocuments.length > 0) {
            project.architectDocuments.forEach(archDoc => {
                if (archDoc.files && archDoc.files.length > 0) {
                    archDoc.files.forEach(file => {
                        documents.push({
                            name: file.originalName || file.name || `Architect Document ${file.fileType}`,
                            type: 'Architect Document',
                            url: file.url || file.key,
                            date: file.uploadedAt || archDoc.submittedAt,
                            size: file.size || 'N/A',
                            fileType: file.fileType
                        });
                    });
                }
            });
        }

        // Get SCP Collection documents from requirement
        const requirement = await Project.findById(projectId)
            .populate('requirement', 'files scpData')
            .select('requirement')
            .lean();

        if (requirement && requirement.requirement && requirement.requirement.files && requirement.requirement.files.length > 0) {
            requirement.requirement.files.forEach(file => {
                documents.push({
                    name: file.originalName || file.name,
                    type: 'SCP Collection Document',
                    url: file.url || file.key,
                    date: file.uploadedAt || requirement.requirement.createdAt,
                    size: file.size || 'N/A'
                });
            });
        }

        return documents;
    } catch (error) {
        console.error('Error getting all project documents:', error);
        return [];
    }
};

/**
 * Get purchase orders
 */
const getPurchaseOrders = async (projectId) => {
    try {
        const pos = await PO.find({ project: projectId })
            .populate('vendor', 'name email')
            .select('poNumber vendor totalAmount status createdAt')
            .lean();

        return pos.map(po => ({
            poNumber: po.poNumber,
            vendor: po.vendor?.name || 'N/A',
            amount: po.totalAmount || 0,
            status: po.status || 'Pending',
            date: po.createdAt
        }));
    } catch (error) {
        console.error('Error getting purchase orders:', error);
        return [];
    }
};

/**
 * Get BOMs
 */
const getBOMs = async (projectId) => {
    try {
        const boms = await BOM.find({ project: projectId })
            .populate('createdBy', 'name email')
            .select('name totalCost status createdAt')
            .lean();

        return boms.map(bom => ({
            name: bom.name,
            totalCost: bom.totalCost || 0,
            status: bom.status || 'Draft',
            date: bom.createdAt
        }));
    } catch (error) {
        console.error('Error getting BOMs:', error);
        return [];
    }
};

/**
 * Get vendors
 */
const getVendors = async (projectId) => {
    try {
        // Get vendors from POs
        const pos = await PO.find({ project: projectId })
            .populate('vendor', 'name email phone')
            .select('vendor')
            .lean();

        const vendors = pos.map(po => po.vendor).filter(Boolean);
        
        // Remove duplicates
        const uniqueVendors = vendors.filter((vendor, index, self) => 
            index === self.findIndex(v => v._id.toString() === vendor._id.toString())
        );

        return uniqueVendors.map(vendor => ({
            name: vendor.name,
            email: vendor.email,
            phone: vendor.phone,
            status: 'Active'
        }));
    } catch (error) {
        console.error('Error getting vendors:', error);
        return [];
    }
};

/**
 * Get project timeline
 */
const getProjectTimeline = async (projectId) => {
    try {
        const activities = await ActivityLog.find({ projectId: projectId })
            .populate('user', 'name')
            .select('action description timestamp user')
            .sort({ timestamp: -1 })
            .limit(20)
            .lean();

        return activities.map(activity => ({
            title: activity.description || activity.action,
            description: `Action: ${activity.action}`,
            date: activity.timestamp,
            user: activity.user?.name || 'System'
        }));
    } catch (error) {
        console.error('Error getting project timeline:', error);
        return [];
    }
};

/**
 * Get project analytics
 */
const getProjectAnalytics = async (projectId) => {
    try {
        const project = await Project.findById(projectId).lean();
        const activities = await ActivityLog.find({ projectId: projectId }).lean();
        
        const createdDate = new Date(project.createdAt);
        const currentDate = new Date();
        const daysActive = Math.ceil((currentDate - createdDate) / (1000 * 60 * 60 * 24));

        return {
            progress: calculateProjectProgress(project),
            daysActive,
            totalActivities: activities.length,
            completedTasks: activities.filter(a => a.action.includes('complete')).length
        };
    } catch (error) {
        console.error('Error getting project analytics:', error);
        return {
            progress: 0,
            daysActive: 0,
            totalActivities: 0,
            completedTasks: 0
        };
    }
};

/**
 * Calculate project progress based on status
 */
const calculateProjectProgress = (project) => {
    const statusProgress = {
        'active': 10,
        'inprogress': 50,
        'complete': 90,
        'close': 100
    };
    
    return statusProgress[project.status] || 0;
};

/**
 * Get site work data
 */
const getSiteWorkData = async (projectId) => {
    try {
        const siteWorks = await Sitework.find({ project: projectId })
            .populate('assignedUsers.user', 'name email')
            .select('name description status startDate endDate assignedUsers')
            .lean();

        return siteWorks.map(work => ({
            name: work.name,
            description: work.description,
            status: work.status,
            startDate: work.startDate,
            endDate: work.endDate,
            assignedWorkers: work.assignedUsers?.length || 0
        }));
    } catch (error) {
        console.error('Error getting site work data:', error);
        return [];
    }
};

/**
 * Get site visits
 */
const getSiteVisits = async (projectId) => {
    try {
        const visits = await SiteVisit.find({ project: projectId })
            .populate('siteEngineer', 'name email')
            .select('visitDate status notes photos siteEngineer')
            .lean();

        return visits.map(visit => ({
            date: visit.visitDate,
            status: visit.status,
            engineer: visit.siteEngineer?.name || 'N/A',
            notes: visit.notes,
            photosCount: visit.photos?.length || 0
        }));
    } catch (error) {
        console.error('Error getting site visits:', error);
        return [];
    }
};

/**
 * Get client proposals
 */
const getClientProposals = async (projectId) => {
    try {
        const proposals = await ClientProposal.find({ project: projectId })
            .populate('createdBy', 'name email')
            .populate('customerInfo')
            .lean();

        return proposals.map(proposal => ({
            _id: proposal._id,
            proposalNumber: proposal.proposalNumber,
            proposalFor: proposal.proposalFor,
            projectLocation: proposal.projectLocation,
            projectType: proposal.projectType,
            status: proposal.status,
            totalAmount: proposal.totalAmount || 0,
            unitCost: proposal.unitCost,
            additionalFeatures: proposal.additionalFeatures,
            manufacturingSupply: proposal.manufacturingSupply,
            projectOverview: proposal.projectOverview,
            cottageSpecifications: proposal.cottageSpecifications,
            materialDetails: proposal.materialDetails,
            costBreakdown: proposal.costBreakdown,
            keyDurabilityFeatures: proposal.keyDurabilityFeatures,
            paymentTerms: proposal.paymentTerms,
            salesTerms: proposal.salesTerms,
            contactInformation: proposal.contactInformation,
            customerInfo: proposal.customerInfo,
            createdBy: proposal.createdBy,
            createdAt: proposal.createdAt,
            updatedAt: proposal.updatedAt
        }));
    } catch (error) {
        console.error('Error getting client proposals:', error);
        return [];
    }
};

/**
 * Get vendor proposals (quotes)
 */
const getVendorProposals = async (projectId) => {
    try {
        const quotes = await Quote.find({ projectId: projectId })
            .populate('vendorId', 'name storeName')
            .select('vendorId totalAmount status createdAt quoteTitle')
            .lean();

        return quotes.map(quote => ({
            vendor: quote.vendorId?.name || quote.vendorId?.storeName || 'N/A',
            amount: quote.totalAmount || 0,
            status: quote.status,
            title: quote.quoteTitle || 'Quote',
            date: quote.createdAt
        }));
    } catch (error) {
        console.error('Error getting vendor proposals:', error);
        return [];
    }
};

/**
 * Generate PDF report
 */
const generatePDFReport = async (projectId, user) => {
    try {
        const reportData = await generateProjectReport(projectId);
        
        // Debug user object
        console.log('generatePDFReport - User object:', user);
        console.log('generatePDFReport - User name:', user?.name);
        console.log('generatePDFReport - User email:', user?.email);
        
        // Log the PDF generation activity
        await createActivityLog({
            user: user._id,
            userModel: 'User',
            userName: user.name || user.firstName || user.username || 'Unknown User',
            userEmail: user.email || user.emailAddress || 'unknown@example.com',
            targetModel: 'Project',
            targetId: projectId,
            targetName: reportData.project.projectName,
            action: 'custom_action',
            actionType: 'System',
            description: `${user.name || user.firstName || user.username || 'Unknown User'} generated PDF report for project "${reportData.project.projectName}"`,
            metadata: {
                reportType: 'PDF',
                generatedAt: new Date().toISOString()
            }
        });

        // Here you would integrate with a PDF generation library like Puppeteer or jsPDF
        // For now, we'll return a placeholder
        return {
            success: true,
            message: 'PDF generation initiated',
            reportData
        };
    } catch (error) {
        console.error('Error generating PDF report:', error);
        throw error;
    }
};

/**
 * Share report
 */
const shareReport = async (projectId, user) => {
    try {
        // Generate a shareable link (you might want to store this in database)
        const crypto = await import('crypto');
        const shareToken = crypto.randomBytes(32).toString('hex');
        const shareUrl = `${process.env.FRONTEND_URL}/shared-report/${shareToken}`;
        
        // Log the sharing activity
        await createActivityLog({
            user: user._id,
            userModel: 'User',
            userName: user.name || user.firstName || user.username || 'Unknown User',
            userEmail: user.email || user.emailAddress || 'unknown@example.com',
            targetModel: 'Project',
            targetId: projectId,
            targetName: 'Project Report',
            action: 'share',
            actionType: 'System',
            description: `${user.name || user.firstName || user.username || 'Unknown User'} shared report for project`,
            metadata: {
                shareToken,
                shareUrl,
                sharedAt: new Date().toISOString()
            }
        });

        return {
            success: true,
            shareUrl,
            shareToken
        };
    } catch (error) {
        console.error('Error sharing report:', error);
        throw error;
    }
};

/**
 * Send project report to customer
 */
const sendReportToCustomer = async (projectId, customerId, message, user) => {
    try {
        console.log('sendReportToCustomer - projectId:', projectId);
        console.log('sendReportToCustomer - customerId:', customerId);
        console.log('sendReportToCustomer - message:', message);
        console.log('sendReportToCustomer - user:', user);

        // Get project to verify it exists and get customer info
        const project = await Project.findById(projectId)
            .populate('lead')
            .lean();

        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }

        // Generate the complete report data
        const reportData = await generateProjectReport(projectId);
        
        console.log('sendReportToCustomer - Generated report data:', {
            hasOverview: !!reportData.project,
            hasDocuments: !!reportData.documents,
            hasPhotos: !!reportData.photos,
            hasClientProposals: !!reportData.clientProposals,
            hasTimeline: !!reportData.timeline,
            documentsCount: reportData.documents?.length || 0,
            photosCount: reportData.photos?.length || 0,
            proposalsCount: reportData.clientProposals?.length || 0
        });
        
        // Create received report record
        const ReceivedReport = (await import('../models/receivedReport.model.js')).default;
        
        const receivedReport = await ReceivedReport.create({
            project: projectId,
            sentBy: user._id,
            sentTo: customerId,
            reportData,
            message: message || `Project report for ${project.projectName} has been sent to you.`,
            metadata: {
                projectName: project.projectName,
                projectCode: project.projectCode,
                customerName: project.lead.customerName,
                customerEmail: project.lead.email,
                sentBy: user.name || user.firstName || user.username || 'Unknown User',
                sentAt: new Date().toISOString()
            }
        });

        console.log('sendReportToCustomer - Created received report:', receivedReport);
        
        // Log the sending activity
        await createActivityLog({
            user: user._id,
            userModel: 'User',
            userName: user.name || user.firstName || user.username || 'Unknown User',
            userEmail: user.email || user.emailAddress || 'unknown@example.com',
            targetModel: 'Project',
            targetId: projectId,
            targetName: 'Project Report',
            action: 'send',
            actionType: 'System',
            description: `${user.name || user.firstName || user.username || 'Unknown User'} sent report for project "${project.projectName}" to customer`,
            metadata: {
                receivedReportId: receivedReport._id,
                customerId: customerId,
                sentAt: new Date().toISOString()
            }
        });

        return {
            success: true,
            receivedReportId: receivedReport._id,
            projectName: project.projectName,
            customerName: project.lead.customerName,
            sentAt: receivedReport.createdAt
        };
    } catch (error) {
        console.error('Error sending report to customer:', error);
        throw error;
    }
};

/**
 * Get received reports for customer
 */
const getReceivedReportsForCustomer = async (customerId) => {
    try {
        console.log('getReceivedReportsForCustomer - customerId:', customerId);
        console.log('getReceivedReportsForCustomer - customerId type:', typeof customerId);
        
        const ReceivedReport = (await import('../models/receivedReport.model.js')).default;
        
        const receivedReports = await ReceivedReport.find({
            sentTo: customerId
        })
        .populate('project', 'projectName projectCode status')
        .populate('sentBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

        console.log('getReceivedReportsForCustomer - found reports:', receivedReports.length);
        console.log('getReceivedReportsForCustomer - reports:', receivedReports);

        return receivedReports.map(report => ({
            _id: report._id,
            project: report.project,
            sentBy: report.sentBy,
            reportData: report.reportData,
            message: report.message,
            createdAt: report.createdAt,
            metadata: report.metadata
        }));
    } catch (error) {
        console.error('Error getting received reports for customer:', error);
        throw error;
    }
};

/**
 * Get received report by ID for customer
 */
const getReceivedReportById = async (reportId, customerId) => {
    try {
        console.log('getReceivedReportById - reportId:', reportId);
        console.log('getReceivedReportById - customerId:', customerId);
        
        const ReceivedReport = (await import('../models/receivedReport.model.js')).default;
        
        const receivedReport = await ReceivedReport.findOne({
            _id: reportId,
            sentTo: customerId
        })
        .populate('project', 'projectName projectCode status')
        .populate('sentBy', 'name email')
        .lean();

        if (!receivedReport) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Report not found or access denied');
        }

        console.log('getReceivedReportById - found report:', !!receivedReport);

        return {
            _id: receivedReport._id,
            project: receivedReport.project,
            sentBy: receivedReport.sentBy,
            reportData: receivedReport.reportData,
            message: receivedReport.message,
            createdAt: receivedReport.createdAt,
            metadata: receivedReport.metadata
        };
    } catch (error) {
        console.error('Error getting received report by ID:', error);
        throw error;
    }
};

export {
    generateProjectReport,
    generatePDFReport,
    shareReport,
    sendReportToCustomer,
    getReceivedReportsForCustomer,
    getReceivedReportById
};