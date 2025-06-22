import xlsx from 'xlsx';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';
import path from 'path';
import storage from '../factory/storage.factory.js';
import logger from '../config/logger.js';

export const createCustomerLeadService = async (req, session) => {
  const { body } = req;
  const {
    leadSource,
    customerName,
    mobileNumber,
    whatsappNumber,
    email,
    preferredLanguage,
    state,
    city,
    googleLocationLink,
    requirementType,
    otherRequirement,
    requirementDescription,
    urgency,
    budget,
    hasDrawing,
    needsArchitect,
    requestSiteVisit,
    imageUrlKey,
    videoUrlKey,
    voiceMessageUrlKey,
  } = body;

  // 1. Create the lead document first to reserve an ID
  const leadPayload = {
    leadSource,
    customerName,
    mobileNumber,
    whatsappNumber,
    email,
    preferredLanguage,
    state,
    city,
    googleLocationLink,
    requirementType,
    otherRequirement,
    requirementDescription,
    urgency,
    budget,
    hasDrawing: hasDrawing === 'Yes',
    needsArchitect: needsArchitect === 'Yes',
    requestSiteVisit: requestSiteVisit === 'on' || requestSiteVisit === true,
  };
  const lead = (await CustomerLead.create([leadPayload], { session }))[0];

  const filesToProcess = [
    { field: 'imageUrl', tempKey: imageUrlKey, category: 'images' },
    { field: 'videoUrl', tempKey: videoUrlKey, category: 'videos' },
    { field: 'voiceMessageUrl', tempKey: voiceMessageUrlKey, category: 'voice-messages' },
  ].filter((f) => f.tempKey);

  if (filesToProcess.length === 0) {
    // If no files, the operation is complete
    return { status: 201, body: { success: true, status: 1, lead } };
  }

  const permanentLocations = {};
  const successfullyCopiedKeys = [];

  try {
    // 2. Perform all S3 copy operations
    for (const file of filesToProcess) {
      const extension = path.extname(file.tempKey);
      const permanentKey = `customer-leads/${lead._id}/${file.category}${extension}`;

      await storage.copyFile(file.tempKey, permanentKey);
      successfullyCopiedKeys.push(permanentKey); // Track for potential cleanup
      permanentLocations[file.field] = permanentKey; // Using key, could be URL
    }

    // 3. If all copies succeed, update the lead document with permanent keys/URLs
    Object.assign(lead, permanentLocations);
    await lead.save({ session });

    // 4. Clean up original temporary files from S3
    const tempKeysToDelete = filesToProcess.map((f) => f.tempKey);
    const deletePromises = tempKeysToDelete.map((key) => storage.deleteFile(key));
    await Promise.allSettled(deletePromises); // Non-critical, just log errors if they fail
  } catch (s3Error) {
    logger.error(`S3 file processing failed for lead ${lead._id}. Cleaning up orphaned permanent files.`, s3Error);
    // 5. COMPENSATING ACTION: If any S3 op failed, delete any files that were successfully copied
    if (successfullyCopiedKeys.length > 0) {
      const deletePromises = successfullyCopiedKeys.map((key) => storage.deleteFile(key));
      await Promise.allSettled(deletePromises);
    }
    // Re-throw the original error to be caught by the transactional middleware,
    // which will abort the DB transaction (rolling back the lead creation).
    throw s3Error;
  }

  return {
    status: 201,
    body: {
      success: true,
      status: 1,
      lead,
    },
  };
};

export const listCustomerLeadsService = async (filter = {}, options = {}) => {
  const { limit, skip, sortBy } = options;
  const customerLeads = await CustomerLead.find(filter)
    .sort(sortBy || { createdAt: -1 })
    .skip(skip || 0)
    .limit(limit || 10);

  const count = await CustomerLead.countDocuments(filter);

  return {
    results: customerLeads,
    totalResults: count,
    page: (skip || 0) / (limit || 10) + 1,
    limit: limit || 10,
    totalPages: Math.ceil(count / (limit || 10)),
  };
};

export const getCustomerLeadByIdService = async (id) => {
  return CustomerLead.findById(id);
};

export const activateCustomerLeadService = async (id) => {
  return CustomerLead.findByIdAndUpdate(id, { isActive: true }, { new: true });
};

export const deactivateCustomerLeadService = async (id) => {
  return CustomerLead.findByIdAndUpdate(id, { isActive: false }, { new: true });
};

const normalizeHeaders = (headers) => {
  const headerMap = {
    leadSource: ['leadsource', 'lead source'],
    customerName: ['customername', 'customer name', 'name'],
    mobileNumber: ['mobilenumber', 'mobile number', 'mobile'],
    whatsappNumber: ['whatsappnumber', 'whatsapp number', 'whatsapp'],
    email: ['email', 'email address'],
    preferredLanguage: ['preferredlanguage', 'preferred language'],
    state: ['state'],
    city: ['city'],
    googleLocationLink: ['googlelocationlink', 'google location link', 'location'],
    requirementType: ['requirementtype', 'requirement type'],
    otherRequirement: ['otherrequirement', 'other requirement'],
    requirementDescription: ['requirementdescription', 'requirement description'],
    urgency: ['urgency'],
    budget: ['budget'],
    hasDrawing: ['hasdrawing(yes/no)', 'hasdrawing', 'has drawing'],
    needsArchitect: ['needsarchitect(yes/no)', 'needsarchitect', 'needs architect'],
    requestSiteVisit: ['requestsitevisit(yes/no)', 'requestsitevisit', 'request site visit'],
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
  const leadsToInsert = [];
  const errors = [];

  for (let R = headerRowIndex + 1; R <= range.e.r; ++R) {
    const getCell = (colIndex) => worksheet[xlsx.utils.encode_cell({ c: colIndex, r: R })];

    const getVal = (fieldName) => {
      const colIndex = headerMapping[fieldName];
      if (colIndex === undefined) return undefined;

      const cell = getCell(colIndex);
      if (!cell || cell.v === null || cell.v === undefined) return undefined;

      if (cell.l && cell.l.Target) {
        if (fieldName === 'email') return cell.l.Target.replace(/^mailto:/i, '');
        if (fieldName === 'googleLocationLink') return cell.l.Target;
      }
      return cell.w || cell.v;
    };

    const leadData = {
      leadSource: getVal('leadSource'),
      customerName: getVal('customerName'),
      mobileNumber: getVal('mobileNumber'),
      whatsappNumber: getVal('whatsappNumber'),
      email: getVal('email'),
      preferredLanguage: getVal('preferredLanguage'),
      state: getVal('state'),
      city: getVal('city'),
      googleLocationLink: getVal('googleLocationLink'),
      requirementType: getVal('requirementType'),
      otherRequirement: getVal('otherRequirement'),
      requirementDescription: getVal('requirementDescription'),
      urgency: getVal('urgency'),
      budget: getVal('budget'),
      hasDrawing: parseBoolean(getVal('hasDrawing')),
      needsArchitect: parseBoolean(getVal('needsArchitect')),
      requestSiteVisit: parseBoolean(getVal('requestSiteVisit')),
    };

    if (Object.values(leadData).every((v) => v === undefined || v === '')) {
      continue;
    }

    if (!leadData.customerName || !leadData.mobileNumber) {
      errors.push({ row: R + 1, error: 'Missing required fields: customerName or mobileNumber' });
      continue;
    }

    leadsToInsert.push(leadData);
  }

  if (leadsToInsert.length === 0) {
    return { importedCount: 0, errors };
  }

  let result = [];
  try {
    const insertResult = await CustomerLead.insertMany(leadsToInsert, { ordered: false });
    result = insertResult;
  } catch (e) {
    if (e.name === 'MongoBulkWriteError') {
      result = e.result.insertedDocs;
      e.writeErrors.forEach((err) => {
        const failedDoc = err.op;
        errors.push({
          row: `Name: ${failedDoc.customerName}`,
          error: `DB Error: ${err.errmsg}`,
        });
      });
    } else {
      throw e;
    }
  }

  return { importedCount: result.length, errors };
};

export const exportCustomerLeadsService = async (filter = {}) => {
  // Fetch all leads matching the filter, without pagination
  const leads = await CustomerLead.find(filter).sort({ createdAt: -1 }).lean();

  if (leads.length === 0) {
    return null;
  }

  // Define headers and map data to the desired format
  const data = leads.map((lead) => ({
    'Lead Source': lead.leadSource,
    'Customer Name': lead.customerName,
    'Mobile Number': lead.mobileNumber,
    'WhatsApp Number': lead.whatsappNumber,
    Email: lead.email,
    'Preferred Language': lead.preferredLanguage,
    State: lead.state,
    City: lead.city,
    'Google Location Link': lead.googleLocationLink,
    'Requirement Type': lead.requirementType,
    'Other Requirement': lead.otherRequirement,
    'Requirement Description': lead.requirementDescription,
    Urgency: lead.urgency,
    Budget: lead.budget,
    'Has Drawing': lead.hasDrawing ? 'Yes' : 'No',
    'Needs Architect': lead.needsArchitect ? 'Yes' : 'No',
    'Request Site Visit': lead.requestSiteVisit ? 'Yes' : 'No',
    Status: lead.isActive ? 'Active' : 'Inactive',
    'Created At': lead.createdAt.toISOString(),
  }));

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'CustomerLeads');

  // Write to a buffer instead of a file
  return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
};

export const updateCustomerLeadService = async (req, session) => {
  const { id } = req.params;
  const updateBody = req.body;

  const lead = await CustomerLead.findById(id).session(session);
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }

  Object.assign(lead, updateBody);
  await lead.save({ session });

  return lead;
};
