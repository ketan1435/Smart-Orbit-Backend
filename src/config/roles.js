const allRoles = {
  user: [
    'getProjects',
    'getSiteworkDocumentsForCustomer',
    'customerReviewSiteworkDocument',
    'getSiteworks',
    'manageSiteworkDocuments',
    'convert-to-work-order',
  ],

  Admin: [
    'getUsers',
    'manageUsers',
    'resetPassword',
    'getProjects',
    'exportLeads',
    'manageProjects',
    'manageArchitects',
    'manageLeads',
    'manageSiteVisits',
    'getSiteVisits',
    'getBoms',
    'getProcurementTeam',
    'reviewBOM',
    'getSiteworks',
    'manageSiteworks',
    'getWorkers',
    'manageWorkers',
    'getSiteworkDocuments',
    'manageSiteworkDocuments',
    'sendSiteworkDocumentToCustomer',
    'updateProjectStatus',
    'acceptProposal',
    'rejectProposal',
    'getSiteEngineers',
    'assignBOMToSiteEngineer',
    'getSiteEngineerBOMs',
    'updateBOMBySiteEngineer',
    'submitUpdatedBOMToPlanning',
    'getRoughBOMsForPlanning',
    'procurement',
    'send-to-planning-engineer',
    'manageAttendance',
    'getAttendance',
    'admin',
    'manageVendors',
    'manageDispatch',
  ],

  'sales-admin': [
    'manageLeads',
    'getProjects',
    'getSiteVisits',
    'sendSiteworkDocumentToCustomer',
    'updateProjectStatus',
    'admin',
    'manageVendors',
  ],

  architect: [
    'manageDrawings',
    'getProjects',
    'manageProjects',
  ],

  fabricator: [
    'manageBOM',
    'getProjects',
    'getSiteworks',
    'manageSiteworks',
    'getWorkers',
    'manageWorkers',
    'getSiteworkDocuments',
    'manageSiteworkDocuments',
    'getUsers',
    'manageAttendance',
    'getAttendance',
  ],

  'planning-engineer': [
    'manageVendors',
    'getReusableBOMs',
    'createBoms',
    'getBoms',
    'submitBOM',
    'getSiteEngineers',
    'assignBOMToSiteEngineer',
    'getRoughBOMsForPlanning',
    'procurement',
    'getSiteEngineers',
    'getProcurementTeam',
    'createFinalizedBOM',
    'getSiteworks',
    'manageTasks',
    'verifyWork',
    'getProjects',
    'manageSiteVisits',
    'getSiteVisits',
    'manageSiteworks',
    'getWorkers',
    'manageWorkers',
    'getSiteworkDocuments',
    'manageSiteworkDocuments',
    'getUsers',
    'getSiteEngineerBOMs',
    'updateBOMBySiteEngineer',
    'submitUpdatedBOMToPlanning',
    'manageVendors',
    'updateBOM',
  ],

  'site-engineer': [
    'manageVendors',
    'resetPassword',
    'procurement',
    'getSiteworks',
    'manageTasks',
    'verifyWork',
    'getProjects',
    'manageSiteVisits',
    'getSiteVisits',
    'manageSiteworks',
    'getWorkers',
    'manageWorkers',
    'getSiteworkDocuments',
    'manageSiteworkDocuments',
    'getUsers',
    'getSiteEngineerBOMs',
    'updateBOMBySiteEngineer',
    'submitUpdatedBOMToPlanning',
    'getBoms',
    'manageVendors',
    'manageAttendance',
    'getAttendance',
  ],

  worker: [
    'manageTasks',
    'getProjects',
    'getSiteworks',
    'manageSiteworks',
    'getWorkers',
    'manageWorkers',
    'getSiteworkDocuments',
    'manageSiteworkDocuments',
    'manageAttendance',
    'getAttendance',
  ],

  'dispatch-installation': [
    'manageDispatch',
    'getProjects',
  ],

  'quality-inspector': [
    'getProjects',
    'getSiteworks',
    'getSiteworkDocuments',
    'manageSiteworkDocuments',
    'procurement', // Required to access Purchase Orders
    'getBoms', // May be needed for PO context
    'manageProjects', // Required to access project sharing functionality
  ],

  'dispatch-team': [
    'manageDispatch',
    'getProjects',
    'procurement',
  ],

  'supervisor': [
    'manageTasks',
    'getProjects',
    'getSiteworks',
    'getWorkers',
    'manageWorkers',
  ],

  'accounts': [
    'getProjects',
  ],

  'scp-user': [
    'getProjects',
    'getBoms',
    'admin',
    'acceptProposal',
    'rejectProposal',
    'manageProjects',
  ],
};

// Function to get role permissions - handles custom roles by mapping them to fabricator permissions
const getRolePermissions = (role, subRole = null) => {
  if (allRoles[role]) {
    return allRoles[role];
  }
  if (role === 'custom') {
    return allRoles['fabricator'];
  }
  return allRoles['fabricator'];
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

export { roles, roleRights, getRolePermissions };
