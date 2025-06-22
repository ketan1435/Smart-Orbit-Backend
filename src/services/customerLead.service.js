import xlsx from 'xlsx';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import storage from '../factory/storage.factory.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js';

export const createCustomerLeadService = async (req, session) => {
  const { body: leadData } = req;
  const tempFileKeysToDelete = [];

  const { requirements, ...basicLeadInfo } = leadData;
  const leadPayload = {
    ...basicLeadInfo,
    createdBy: req.user.id,
    requirements: [],
  };

  const lead = (await CustomerLead.create([leadPayload], { session }))[0];

  try {
    for (const reqData of requirements) {
      const requirementId = new mongoose.Types.ObjectId();
      
      // Manually construct the requirement object to avoid saving unwanted fields
      const newRequirement = {
        _id: requirementId,
        requirementType: reqData.requirementType,
        otherRequirement: reqData.otherRequirement,
        requirementDescription: reqData.requirementDescription,
        urgency: reqData.urgency,
        budget: reqData.budget,
        scpData: reqData.scpData || {},
        files: [],
        sharedWith: [],
      };

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
          
          newRequirement.files.push({ fileType, key: permanentKey });
          tempFileKeysToDelete.push(tempKey);
        }
      }
      lead.requirements.push(newRequirement);
    }

    await lead.save({ session });

    // This part runs after the transaction is committed.
    // If the server crashes here, S3 lifecycle policy will clean up the temp files.
    Promise.all(tempFileKeysToDelete.map(key => storage.deleteFile(key))).catch(err => {
      // Log this error, but don't fail the request since the lead was already created.
      logger.error(`Failed to delete temporary file during cleanup: ${err.message}`);
    });

    return {
      status: httpStatus.CREATED,
      body: { status: 1, message: 'Customer lead created successfully', data: lead },
    };
  } catch (error) {
    // If an error occurred (e.g., file copy failed), the transactional middleware
    // will abort the database transaction. We just need to re-throw the error.
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to process lead files: ${error.message}`);
  }
};

export const listCustomerLeadsService = async (filter = {}, options = {}) => {
  const { limit = 10, page = 1, sortBy } = options;
  const sort = sortBy || { createdAt: -1 };

  const customerLeads = await CustomerLead.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

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
  return CustomerLead.findById(id);
};

export const updateCustomerLeadService = async (id, updateBody) => {
    const lead = await getCustomerLeadByIdService(id);
    if (!lead) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
    }
    Object.assign(lead, updateBody);
    await lead.save();
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

export const getSharedRequirementsForUserService = async (userId) => {
    const leads = await CustomerLead.find({ 'requirements.sharedWith.user': userId }).lean();

    const sharedRequirements = leads.map(lead => {
        const relevantRequirements = lead.requirements.filter(req =>
            req.sharedWith.some(share => share.user.toString() === userId.toString())
        );

        return {
            leadId: lead._id,
            customerName: lead.customerName,
            mobileNumber: lead.mobileNumber,
            email: lead.email,
            state: lead.state,
            city: lead.city,
            requirements: relevantRequirements,
        };
    }).filter(l => l.requirements.length > 0);

    return sharedRequirements;
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
    if (!header) return;
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key in headerMap) {
      const variants = headerMap[key].map((v) => v.replace(/[^a-z0-9]/g, ''));
      if (variants.includes(normalizedHeader)) {
        mapping[key] = index;
        break;
      }
    }
  });
  return mapping;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  const strValue = String(value).toLowerCase().trim();
  return ['yes', 'true', '1', 'y'].includes(strValue);
};

export const importCustomerLeadsService = async (filePath) => {
  const workbook = xlsx.readFile(filePath, { cellFormula: false, cellHTML: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const range = xlsx.utils.decode_range(worksheet['!ref']);
  if (!range) {
    return { importedCount: 0, errors: [{ row: 1, error: 'Sheet is empty or invalid.' }] };
  }

  const headerRowIndex = range.s.r;
  const rawHeaders = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[xlsx.utils.encode_cell({ c: C, r: headerRowIndex })];
    rawHeaders.push(cell && cell.v ? String(cell.v).trim() : '');
  }

  const headerMapping = normalizeHeaders(rawHeaders);
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: headerRowIndex + 1 });

  let importedCount = 0;
  const errors = [];
  const leadsToInsert = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + headerRowIndex + 2;

    const getVal = (fieldName) => {
        const index = headerMapping[fieldName];
        return index !== undefined && row[index] !== undefined ? String(row[index]).trim() : undefined;
    }
    
    const leadData = {
      leadSource: getVal('leadSource'),
      customerName: getVal('customerName'),
      mobileNumber: getVal('mobileNumber'),
      alternateContactNumber: getVal('alternateContactNumber'),
      email: getVal('email'),
      state: getVal('state'),
      city: getVal('city'),
      requirements: [],
    };
    
    // For simplicity, we'll assume one row in the CSV corresponds to one requirement.
    const requirementData = {
        requirementType: getVal('requirementType'),
        otherRequirement: getVal('otherRequirement'),
        requirementDescription: getVal('requirementDescription'),
        urgency: getVal('urgency'),
        budget: getVal('budget'),
        scpData: {
            siteAddress: getVal('siteAddress'),
            googleLocationLink: getVal('googleLocationLink'),
            siteType: getVal('siteType'),
            plotSize: getVal('plotSize'),
            totalArea: getVal('totalArea'),
            plinthStatus: getVal('plinthStatus'),
            structureType: getVal('structureType'),
            numUnits: getVal('numUnits'),
            usageType: getVal('usageType'),
            avgStayDuration: getVal('avgStayDuration'),
            additionalFeatures: getVal('additionalFeatures'),
            designIdeas: getVal('designIdeas'),
            drawingStatus: getVal('drawingStatus'),
            architectStatus: getVal('architectStatus'),
            roomRequirements: getVal('roomRequirements'),
            tokenAdvance: getVal('tokenAdvance'),
            financing: getVal('financing'),
            roadWidth: getVal('roadWidth'),
            targetCompletionDate: getVal('targetCompletionDate'),
            siteVisitDate: getVal('siteVisitDate'),
            scpRemarks: getVal('scpRemarks'),
        }
    };
    
    // Only add requirement if there is a requirement type specified
    if (requirementData.requirementType) {
        leadData.requirements.push(requirementData);
    }

    if (!leadData.customerName || !leadData.mobileNumber || !leadData.leadSource) {
      errors.push({ row: rowNum, error: 'Missing required fields: Customer Name, Mobile Number, and Lead Source.' });
      continue;
    }

    leadsToInsert.push(leadData);
  }

  if (leadsToInsert.length > 0) {
    try {
      const result = await CustomerLead.insertMany(leadsToInsert, { ordered: false });
      importedCount = result.length;
    } catch (dbError) {
      if (dbError.writeErrors) {
        importedCount = dbError.result.nInserted;
        dbError.writeErrors.forEach((writeError) => {
          errors.push({
            row: data[writeError.index].rowNum, // We need to attach rowNum to data items
            error: `Database error: ${writeError.errmsg}`,
          });
        });
      } else {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'A database error occurred during import.');
      }
    }
  }

  return { importedCount, errors };
};

export const exportCustomerLeadsService = async (filter = {}) => {
  const leads = await CustomerLead.find(filter).lean();
  
  if (leads.length === 0) {
    return null;
  }

  const dataToExport = [];
  const headers = [
      // Basic Info
      'leadSource', 'customerName', 'mobileNumber', 'alternateContactNumber', 'email', 'state', 'city', 'isActive', 'createdAt',
      // Requirement specific (assuming first requirement)
      'requirementType', 'otherRequirement', 'requirementDescription', 'urgency', 'budget',
      // SCP Data (assuming first requirement)
      'siteAddress', 'googleLocationLink', 'siteType', 'plotSize', 'totalArea', 'plinthStatus', 'structureType', 'numUnits', 'usageType',
      'avgStayDuration', 'additionalFeatures', 'designIdeas', 'drawingStatus', 'architectStatus', 'roomRequirements', 'tokenAdvance',
      'financing', 'roadWidth', 'targetCompletionDate', 'siteVisitDate', 'scpRemarks'
  ];

  for (const lead of leads) {
      const firstRequirement = lead.requirements?.[0] || {};
      const scpData = firstRequirement.scpData || {};

      const row = {
        leadSource: lead.leadSource,
        customerName: lead.customerName,
        mobileNumber: lead.mobileNumber,
        alternateContactNumber: lead.alternateContactNumber,
        email: lead.email,
        state: lead.state,
        city: lead.city,
        isActive: lead.isActive,
        createdAt: lead.createdAt.toISOString(),
        
        requirementType: firstRequirement.requirementType,
        otherRequirement: firstRequirement.otherRequirement,
        requirementDescription: firstRequirement.requirementDescription,
        urgency: firstRequirement.urgency,
        budget: firstRequirement.budget,

        siteAddress: scpData.siteAddress,
        googleLocationLink: scpData.googleLocationLink,
        siteType: scpData.siteType,
        plotSize: scpData.plotSize,
        totalArea: scpData.totalArea,
        plinthStatus: scpData.plinthStatus,
        structureType: scpData.structureType,
        numUnits: scpData.numUnits,
        usageType: scpData.usageType,
        avgStayDuration: scpData.avgStayDuration,
        additionalFeatures: scpData.additionalFeatures,
        designIdeas: scpData.designIdeas,
        drawingStatus: scpData.drawingStatus,
        architectStatus: scpData.architectStatus,
        roomRequirements: scpData.roomRequirements,
        tokenAdvance: scpData.tokenAdvance,
        financing: scpData.financing,
        roadWidth: scpData.roadWidth,
        targetCompletionDate: scpData.targetCompletionDate,
        siteVisitDate: scpData.siteVisitDate,
        scpRemarks: scpData.scpRemarks
      };
      dataToExport.push(row);
  }

  const worksheet = xlsx.utils.json_to_sheet(dataToExport, { header: headers });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Customer Leads');

  return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
};
