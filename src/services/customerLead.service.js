import xlsx from 'xlsx';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import storage from '../factory/storage.factory.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { createCustomerLead, updateCustomerLead } from '../validations/customerLead.validation.js';
import { createProject } from './project.service.js';
import Requirement from '../models/requirement.model.js';


export const createCustomerLeadService = async (req, session) => {
  const { body: leadData } = req;
  const tempFileKeysToDelete = [];
  const { requirements, ...basicLeadInfo } = leadData;

  const requirementIds = [];

  // 1. Create the CustomerLead first
  const leadPayload = {
    ...basicLeadInfo,
    createdBy: req.user.id,
    requirements: [], // will update after creating Requirement docs
  };

  const lead = (await CustomerLead.create([leadPayload], { session }))[0];

  // 2. Process each requirement separately
  for (const reqData of requirements) {
    const requirementId = new mongoose.Types.ObjectId();
    const files = [];

    const fileKeys = {
      imageUrlKeys: reqData.imageUrlKeys || [],
      videoUrlKeys: reqData.videoUrlKeys || [],
      voiceMessageUrlKeys: reqData.voiceMessageUrlKeys || [],
      sketchUrlKeys: reqData.sketchUrlKeys || [],
    };

    for (const [type, keys] of Object.entries(fileKeys)) {
      for (const tempKey of keys) {
        const fileType = type.replace('UrlKeys', '');
        const fileName = tempKey.split('/').pop();
        const permanentKey = `customer-leads/${lead._id}/${requirementId}/${fileType}/${fileName}`;
        await storage.copyFile(tempKey, permanentKey);
        files.push({ fileType, key: permanentKey });
        tempFileKeysToDelete.push(tempKey);
      }
    }

    // 3. Create Requirement document
    const requirement = await Requirement.create([{
      _id: requirementId,
      lead: lead._id,
      projectName: reqData.projectName,
      requirementType: reqData.requirementType,
      otherRequirement: reqData.otherRequirement,
      requirementDescription: reqData.requirementDescription,
      urgency: reqData.urgency,
      budget: reqData.budget,
      scpData: reqData.scpData || {},
      files,
      sharedWith: [],
    }], { session });

    requirementIds.push(requirementId);

    // 4. Create a project and link back to requirement
    const project = await createProject({
      projectName: reqData.projectName,
      requirement: requirementId,
      lead: lead._id,
      budget: reqData.budget ? parseFloat(reqData.budget.replace(/[^0-9.-]+/g, '')) : 0,
      createdBy: req.user.id,
      createdByModel: req.user.constructor.modelName,
    }, session);

    // 5. Update the requirement with the project ID
    await Requirement.findByIdAndUpdate(requirementId, {
      project: project._id,
    }, { session });
  }

  // 6. Update the lead with the array of requirement references
  lead.requirements = requirementIds;
  await lead.save({ session });

  // 7. Clean up temp S3 files after commit
  Promise.all(tempFileKeysToDelete.map(key => storage.deleteFile(key))).catch(err => {
    logger.error(`Failed to delete temporary file during cleanup: ${err.message}`);
  });

  return {
    status: httpStatus.CREATED,
    body: { status: 1, message: 'Customer lead created successfully', data: lead },
  };
};

export const listCustomerLeadsService = async (filter = {}, options = {}) => {
  const { limit = 10, page = 1, sortBy } = options;

  let sort;
  if (typeof sortBy === 'string') {
    const [field, order] = sortBy.split(':');
    sort = { [field]: order === 'desc' ? -1 : 1 };
  } else if (typeof sortBy === 'object' && sortBy !== null) {
    sort = sortBy;
  } else {
    sort = { createdAt: -1 };
  }

  const customerLeads = await CustomerLead.find(filter)
    .populate({
      path: 'requirements',
      populate: { path: 'visits' },
    })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalResults = await CustomerLead.countDocuments(filter);

  return {
    results: customerLeads,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

export const getCustomerLeadByIdService = async (id) => {
  return CustomerLead.findById(id)
    .populate({
      path: 'requirements',
      populate: { path: 'visits' }  // Optional: only if you need visits too
    });
};

export const updateCustomerLeadService = async (id, updateBody) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  const { requirementsToUpdate, ...leadUpdates } = updateBody;

  // Update lead fields
  Object.assign(lead, leadUpdates);
  await lead.save();

  // Update individual requirements if provided
  if (Array.isArray(requirementsToUpdate)) {
    for (const reqUpdate of requirementsToUpdate) {
      if (!reqUpdate._id) continue;
      await Requirement.findOneAndUpdate(
        { _id: reqUpdate._id, lead: lead._id },
        reqUpdate,
        { new: true }
      );
    }
  }

  return lead;
};


export const activateCustomerLeadService = async (id) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }
  lead.isActive = true;
  await lead.save();
  return lead;
};

export const deactivateCustomerLeadService = async (id) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }
  lead.isActive = false;
  await lead.save();
  return lead;
};

export const shareRequirementService = async (leadId, requirementId, userIdToShareWith, adminId) => {
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  const requirement = lead.requirements.id(requirementId);
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found within the lead');
  }

  const isAlreadyShared = requirement.sharedWith.some(share => share.user.toString() === userIdToShareWith);
  if (isAlreadyShared) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Requirement already shared with this user');
  }

  requirement.sharedWith.push({
    user: userIdToShareWith,
    sharedBy: adminId,
  });

  await lead.save();
  return lead;
};

export const shareRequirementWithUsersService = async (leadId, requirementId, userIds, adminId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  let updated = false;

  userIds.forEach(userId => {
    const alreadyShared = requirement.sharedWith.some(share => share.user.toString() === userId);
    if (!alreadyShared) {
      requirement.sharedWith.push({ user: userId, sharedBy: adminId });
      updated = true;
    }
  });

  if (updated) {
    await requirement.save();
  }

  return requirement;
};

export const getSharedRequirementsForUserService = async (userId) => {
  const requirements = await Requirement.find({ 'sharedWith.user': userId })
    .populate('lead', 'customerName mobileNumber email state city') // populate only necessary lead fields
    .lean();

  // Group requirements by lead
  const grouped = {};
  for (const req of requirements) {
    const leadId = req.lead._id.toString();
    if (!grouped[leadId]) {
      grouped[leadId] = {
        leadId,
        customerName: req.lead.customerName,
        mobileNumber: req.lead.mobileNumber,
        email: req.lead.email,
        state: req.lead.state,
        city: req.lead.city,
        requirements: [],
      };
    }
    grouped[leadId].requirements.push(req);
  }

  return Object.values(grouped);
};

const normalizeHeaders = (headers) => {
  const headerMap = {
    // Basic Info
    leadSource: ['leadsource', 'lead source'],
    customerName: ['customername', 'customer name', 'name'],
    mobileNumber: ['mobilenumber', 'mobile number', 'mobile'],
    alternateContactNumber: ['alternatecontactnumber', 'alternate contact'],
    email: ['email', 'email address'],
    state: ['state'],
    city: ['city'],

    // Requirement specific
    requirementType: ['requirementtype', 'requirement type'],
    otherRequirement: ['otherrequirement', 'other requirement'],
    requirementDescription: ['requirementdescription', 'requirement description'],
    urgency: ['urgency'],
    budget: ['budget'],

    // SCP Data
    siteAddress: ['siteaddress', 'site address'],
    googleLocationLink: ['googlelocationlink', 'google maps link'],
    siteType: ['sitetype', 'site type'],
    plotSize: ['plotsize', 'plot size'],
    totalArea: ['totalarea', 'total area'],
    plinthStatus: ['plinthstatus', 'plinth status'],
    structureType: ['structuretype', 'structure type'],
    numUnits: ['numunits', 'number of units'],
    usageType: ['usagetype', 'usage type'],
    avgStayDuration: ['avgstayduration', 'average stay duration'],
    additionalFeatures: ['additionalfeatures', 'additional features'],
    designIdeas: ['designideas', 'design ideas'],
    drawingStatus: ['drawingstatus', 'drawing status'],
    architectStatus: ['architectstatus', 'architect status'],
    roomRequirements: ['roomrequirements', 'room requirements'],
    tokenAdvance: ['tokenadvance', 'token advance'],
    financing: ['financing', 'financing required'],
    roadWidth: ['roadwidth', 'road width'],
    targetCompletionDate: ['targetcompletiondate', 'target completion'],
    siteVisitDate: ['sitevisitdate', 'site visit date'],
    scpRemarks: ['scpremarks', 'scp remarks'],
  };

  const mapping = {};
  headers.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().replace(/\s+/g, '');
    for (const key in headerMap) {
      if (headerMap[key].includes(cleanHeader)) {
        mapping[key] = index;
      }
    }
  });
  return mapping;
};

const parseBoolean = (value) => {
  if (value === null || value === undefined) return undefined;
  const strVal = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(strVal)) return true;
  if (['false', '0', 'no', 'n'].includes(strVal)) return false;
  return undefined;
};

export const importCustomerLeadsService = async (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, cellDates: true, raw: false });

  if (data.length < 2) {
    return { importedCount: 0, errors: [] };
  }

  const headers = data[0];
  const headerMapping = normalizeHeaders(headers);
  const rows = data.slice(1);

  const leadsByCustomer = new Map();
  const errors = [];

  rows.forEach((row, index) => {
    const getVal = (fieldName) => {
      const colIndex = headerMapping[fieldName];
      if (colIndex === undefined) return undefined;
      const cellValue = row[colIndex];
      if (cellValue === null || cellValue === undefined) return undefined;
      // The xlsx library with cellDates:true will return a Date object for dates.
      // For other types it will be string/number.
      if (cellValue instanceof Date) {
        return cellValue;
      }
      return cellValue.toString().trim();
    };

    // Use a unique identifier for the customer, e.g., email or mobile.
    // Fallback to customer name if others are not present.
    const customerId = getVal('email') || getVal('mobileNumber') || getVal('customerName');

    if (!customerId) {
      errors.push({ row: index + 2, error: 'Missing customer identifier (Email, Mobile, or Name).' });
      return;
    }

    if (!leadsByCustomer.has(customerId)) {
      leadsByCustomer.set(customerId, {
        leadSource: getVal('leadSource'),
        customerName: getVal('customerName'),
        mobileNumber: getVal('mobileNumber'),
        alternateContactNumber: getVal('alternateContactNumber'),
        email: getVal('email'),
        state: getVal('state'),
        city: getVal('city'),
        requirements: [],
        _sourceRows: [], // To track original row numbers for better error reporting
      });
    }

    const customerData = leadsByCustomer.get(customerId);
    customerData._sourceRows.push(index + 2); // Store original row number (2-based index)

    const scpData = {
      siteAddress: getVal('siteAddress'),
      googleLocationLink: getVal('googleLocationLink'),
      siteType: getVal('siteType'),
      plotSize: getVal('plotSize'),
      totalArea: getVal('totalArea'),
      plinthStatus: getVal('plinthStatus'),
      structureType: getVal('structureType'),
      numUnits: getVal('numUnits') ? Number(getVal('numUnits')) : undefined,
      usageType: getVal('usageType'),
      avgStayDuration: getVal('avgStayDuration'),
      additionalFeatures: getVal('additionalFeatures'),
      designIdeas: getVal('designIdeas'),
      drawingStatus: getVal('drawingStatus'),
      architectStatus: getVal('architectStatus'),
      roomRequirements: getVal('roomRequirements'),
      tokenAdvance: parseBoolean(getVal('tokenAdvance')),
      financing: parseBoolean(getVal('financing')),
      roadWidth: getVal('roadWidth'),
      targetCompletionDate: getVal('targetCompletionDate'),
      siteVisitDate: getVal('siteVisitDate'),
      scpRemarks: getVal('scpRemarks'),
    };

    const requirement = {
      requirementType: getVal('requirementType'),
      otherRequirement: getVal('otherRequirement'),
      requirementDescription: getVal('requirementDescription'),
      urgency: getVal('urgency'),
      budget: getVal('budget') ? Number(getVal('budget')) : undefined,
      scpData: getVal('requirementType') === 'Cottage / Structure Proposal' ? scpData : {},
    };

    customerData.requirements.push(requirement);
  });

  let importedCount = 0;
  for (const [customerId, leadData] of leadsByCustomer.entries()) {
    const { _sourceRows, ...leadPayload } = leadData;
    const rowIdentifier = `Row(s) ${_sourceRows.join(', ')}`;

    try {
      // Find existing lead by email or mobile.
      const existingLead = await CustomerLead.findOne({
        $or: [{ email: leadPayload.email }, { mobileNumber: leadPayload.mobileNumber }],
      });

      if (existingLead) {
        // If lead exists, add new requirements.
        const { error: validationError } = updateCustomerLead.body.validate({ requirements: leadPayload.requirements });
        if (validationError) {
          errors.push({ customerId, error: validationError.details.map((d) => d.message).join(', '), location: rowIdentifier });
          continue;
        }

        existingLead.requirements.push(...leadPayload.requirements);
        await existingLead.save();

      } else {
        // If lead doesn't exist, create a new one.
        const { error: validationError } = createCustomerLead.body.validate(leadPayload);
        if (validationError) {
          errors.push({ customerId, error: validationError.details.map((d) => d.message).join(', '), location: rowIdentifier });
          continue;
        }

        await CustomerLead.create(leadPayload);
      }

      importedCount++;
    } catch (dbError) {
      const errorMessage = `Failed to process lead. Reason: ${dbError.message}`;
      errors.push({ customerId, error: errorMessage, location: rowIdentifier });
    }
  }

  return { importedCount, errors };
};

export const exportCustomerLeadsService = async (filter = {}) => {
  const customerLeads = await CustomerLead.find(filter).lean();

  if (customerLeads.length === 0) {
    return null;
  }

  const dataToExport = [];
  const headers = [
    // Basic Info
    'Lead ID', 'Lead Source', 'Customer Name', 'Mobile Number', 'Alternate Contact', 'Email', 'State', 'City', 'Is Active', 'Created At',
    // Requirement specific
    'Requirement ID', 'Requirement Type', 'Other Requirement', 'Description', 'Urgency', 'Budget',
    // SCP Data
    'Site Address', 'Google Location', 'Site Type', 'Plot Size', 'Total Area', 'Plinth Status', 'Structure Type', 'Num Units', 'Usage Type',
    'Avg Stay Duration', 'Additional Features', 'Design Ideas', 'Drawing Status', 'Architect Status', 'Room Requirements', 'Token Advance',
    'Financing', 'Road Width', 'Target Completion', 'Site Visit Date', 'SCP Remarks'
  ];

  for (const lead of customerLeads) {
    if (lead.requirements && lead.requirements.length > 0) {
      for (const requirement of lead.requirements) {
        const scpData = requirement.scpData || {};
        const row = {
          'Lead ID': lead._id.toString(),
          'Lead Source': lead.leadSource,
          'Customer Name': lead.customerName,
          'Mobile Number': lead.mobileNumber,
          'Alternate Contact': lead.alternateContactNumber,
          'Email': lead.email,
          'State': lead.state,
          'City': lead.city,
          'Is Active': lead.isActive,
          'Created At': lead.createdAt.toISOString(),

          'Requirement ID': requirement._id.toString(),
          'Requirement Type': requirement.requirementType,
          'Other Requirement': requirement.otherRequirement,
          'Description': requirement.requirementDescription,
          'Urgency': requirement.urgency,
          'Budget': requirement.budget,

          'Site Address': scpData.siteAddress,
          'Google Location': scpData.googleLocationLink,
          'Site Type': scpData.siteType,
          'Plot Size': scpData.plotSize,
          'Total Area': scpData.totalArea,
          'Plinth Status': scpData.plinthStatus,
          'Structure Type': scpData.structureType,
          'Num Units': scpData.numUnits,
          'Usage Type': scpData.usageType,
          'Avg Stay Duration': scpData.avgStayDuration,
          'Additional Features': scpData.additionalFeatures,
          'Design Ideas': scpData.designIdeas,
          'Drawing Status': scpData.drawingStatus,
          'Architect Status': scpData.architectStatus,
          'Room Requirements': scpData.roomRequirements,
          'Token Advance': scpData.tokenAdvance,
          'Financing': scpData.financing,
          'Road Width': scpData.roadWidth,
          'Target Completion': scpData.targetCompletionDate,
          'Site Visit Date': scpData.siteVisitDate,
          'SCP Remarks': scpData.scpRemarks
        };
        dataToExport.push(row);
      }
    } else {
      // Add a row for leads without any requirements
      const row = {
        'Lead ID': lead._id.toString(),
        'Lead Source': lead.leadSource,
        'Customer Name': lead.customerName,
        'Mobile Number': lead.mobileNumber,
        'Alternate Contact': lead.alternateContactNumber,
        'Email': lead.email,
        'State': lead.state,
        'City': lead.city,
        'Is Active': lead.isActive,
        'Created At': lead.createdAt.toISOString(),
      };
      dataToExport.push(row);
    }
  }

  const worksheet = xlsx.utils.json_to_sheet(dataToExport, { header: headers });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Customer Leads');

  return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
};
