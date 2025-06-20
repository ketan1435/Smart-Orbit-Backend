import xlsx from 'xlsx';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';

export const createCustomerLeadService = async (data) => {
  return await CustomerLead.create(data);
};

export const listCustomerLeadsService = async (filter = {}, options = {}) => {
  const customerLeads = await CustomerLead.find(filter)
    .sort(options.sortBy || { createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 10);

  const count = await CustomerLead.countDocuments(filter);

  return {
    results: customerLeads,
    totalResults: count,
    page: options.page || 1,
    limit: options.limit || 10,
    totalPages: Math.ceil(count / (options.limit || 10)),
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
