import PoRequest from '../models/poRequest.model.js';
import { createPOService } from './po.service.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';

export const createPoRequestService = async (req, data) => {
  const poReq = await PoRequest.create({
    ...data,
    createdBy: req.user?._id,
    createdByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
  });

  await logActivity(req, {
    action: 'po_request_created',
    targetModel: 'PoRequest',
    targetId: poReq._id,
    targetName: data?.name || 'PO Request',
    projectId: data?.project,
    description: `${req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'} Sent PO request to Admin`,
    changes: { status: 'pending' },
    metadata: { poRequest: poReq, projectId: data?.project },
  });

  // Also log an explicit "send to admin" event with the exact phrasing expected in UI
  await logActivity(req, {
    action: 'send_po_request_to_admin',
    targetModel: 'PoRequest',
    targetId: poReq._id,
    targetName: data?.name || 'PO Request',
    projectId: data?.project,
    description: 'Planning Engineer send PO to Admin',
    changes: { sentToAdmin: true },
    metadata: { poRequestId: poReq._id, projectId: data?.project },
  });

  return poReq;
};

export const getPoRequestsService = async (req, params) => {
  const query = {};
  
  // Handle project filtering
  if (params.project) {
    query.project = params.project;
  }
  
  // Handle status filtering
  if (params.status) {
    query.status = params.status;
  }
  
  // For Quality Inspectors, we need to get PO requests from projects they have access to
  if (req.user?.role === 'quality-inspector') {
    // Get projects that the Quality Inspector has access to
    const Requirement = (await import('../models/requirement.model.js')).default;
    const projectsWithAccess = await Requirement.find({
      'sharedWith.user': req.user._id,
      'sharedWith.isSeen': { $exists: true }
    }).select('_id');
    
    const projectIds = projectsWithAccess.map(p => p._id);
    
    if (projectIds.length > 0) {
      query.project = { $in: projectIds };
    } else {
      // If no projects shared, return empty array
      return [];
    }
  }
  
  const results = await PoRequest.find(query).sort({ createdAt: -1 });
  return results;
};

export const approvePoRequestService = async (req, id, { createPo = true } = {}) => {
  const poReq = await PoRequest.findById(id);
  if (!poReq) throw new Error('PO Request not found');

  poReq.status = 'approved';
  poReq.approvedBy = req.user?._id;
  poReq.approvedByModel = req.user?.role === 'admin' ? 'Admin' : 'User';
  poReq.approvedAt = new Date();
  await poReq.save();

  await logActivity(req, {
    action: 'po_request_approved',
    targetModel: 'PoRequest',
    targetId: poReq._id,
    targetName: poReq?.name || 'PO Request',
    projectId: poReq?.project,
    description: `Admin Approved PO request`,
    changes: { status: 'approved' },
    metadata: { poRequest: poReq, projectId: poReq?.project },
  });

  let createdPO = null;
  if (createPo) {
    createdPO = await createPOService(req, {
      project: poReq.project,
      vendor: poReq.vendor,
      vendorName: poReq.vendorName,
      vendorWhatsappNumber: poReq.vendorWhatsappNumber,
      name: poReq.name,
      description: poReq.description,
      documents: poReq.documents,
      items: poReq.items,
      originalBomId: poReq.originalBomId,
    });
    poReq.linkedPo = createdPO?._id;
    await poReq.save();

    await logActivity(req, {
      action: 'po_sent_to_vendor',
      targetModel: 'PO',
      targetId: createdPO?._id,
      targetName: createdPO?.name || 'PO',
      projectId: poReq?.project,
      description: `Admin ${req.user?.name || 'Unknown'} Sent PO to vendor ${poReq.vendorName} on WhatsApp`,
      changes: { poCreatedFromRequest: poReq._id },
      metadata: { poId: createdPO?._id, poRequestId: poReq._id, vendorWhatsappNumber: poReq.vendorWhatsappNumber, projectId: poReq?.project },
    });
  }

  return { poRequest: poReq, po: createdPO };
};

export const rejectPoRequestService = async (req, id, { reason } = {}) => {
  const poReq = await PoRequest.findById(id);
  if (!poReq) throw new Error('PO Request not found');
  poReq.status = 'rejected';
  await poReq.save();

  await logActivity(req, {
    action: 'po_request_rejected',
    targetModel: 'PoRequest',
    targetId: poReq._id,
    targetName: poReq?.name || 'PO Request',
    projectId: poReq?.project,
    description: `Admin Rejected PO request: ${poReq?.name}${reason ? ` - ${reason}` : ''}`,
    changes: { status: 'rejected' },
    metadata: { poRequestId: poReq._id, reason, projectId: poReq?.project },
  });

  return poReq;
};


