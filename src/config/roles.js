const allRoles = {
  user: ['getProjects', 'getSiteworkDocumentsForCustomer', 'customerReviewSiteworkDocument', 'getSiteworks', 'manageSiteworkDocuments'], // A customer who can see their project status
  Admin: ['getUsers', 'manageUsers', 'getProjects', 'exportLeads', 'manageProjects', 'manageArchitects', 'manageLeads', 'manageSiteVisits', 'getSiteVisits', 'getBoms', 'getProcurementTeam', 'reviewBOM', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'sendSiteworkDocumentToCustomer', 'getUsers', 'updateProjectStatus', 'acceptProposal', 'rejectProposal', 'getSiteEngineers', 'assignBOMToSiteEngineer', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getRoughBOMsForPlanning', 'procurement', 'manageAttendance', 'getAttendance', 'manageAttendance', 'getAttendance', 'admin'],
  user: ['getProjects', 'getSiteworkDocumentsForCustomer', 'customerReviewSiteworkDocument', 'getSiteworks', 'manageSiteworkDocuments', 'convert-to-work-order'], // A customer who can see their project status
  Admin: ['getUsers', 'manageUsers', 'getProjects', 'exportLeads', 'manageProjects', 'manageArchitects', 'manageLeads', 'manageSiteVisits', 'getSiteVisits', 'getBoms', 'getProcurementTeam', 'reviewBOM', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'sendSiteworkDocumentToCustomer', 'getUsers', 'updateProjectStatus', 'acceptProposal', 'rejectProposal', 'getSiteEngineers', 'assignBOMToSiteEngineer', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getRoughBOMsForPlanning', 'procurement', 'send-to-planning-engineer', 'admin'],
  user: ['getProjects', 'getSiteworkDocumentsForCustomer', 'customerReviewSiteworkDocument', 'getSiteworks', 'manageSiteworkDocuments', 'convert-to-work-order'],
  Admin: ['getUsers', 'manageUsers', 'getProjects', 'exportLeads', 'manageProjects', 'manageArchitects', 'manageLeads', 'manageSiteVisits', 'getSiteVisits', 'getBoms', 'getProcurementTeam', 'reviewBOM', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'sendSiteworkDocumentToCustomer', 'updateProjectStatus', 'acceptProposal', 'rejectProposal', 'getSiteEngineers', 'assignBOMToSiteEngineer', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getRoughBOMsForPlanning', 'procurement', 'manageAttendance', 'getAttendance', 'send-to-planning-engineer'],
  'sales-admin': ['manageLeads', 'getProjects', 'getSiteVisits', 'sendSiteworkDocumentToCustomer', 'updateProjectStatus'],
  architect: ['manageDrawings', 'getProjects', 'manageProjects'],
  'fabricator': ['manageBOM', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'getUsers', 'manageAttendance', 'getAttendance'],
  'planning-engineer': ['manageVendors', 'getReusableBOMs', 'createBoms', 'getBoms', 'submitBOM', 'getSiteEngineers', 'assignBOMToSiteEngineer', 'getRoughBOMsForPlanning', 'procurement', 'getProcurementTeam', 'createFinalizedBOM', 'getSiteworks', 'manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning'],
  'site-engineer': ['manageVendors', 'getSiteworks', 'manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getBoms'],
  'fabricator': ['manageBOM', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'getUsers', 'manageAttendance', 'getAttendance'],
  'planning-engineer': ['manageVendors', 'getReusableBOMs', 'createBoms', 'getBoms', 'submitBOM', 'getSiteEngineers', 'assignBOMToSiteEngineer', 'getRoughBOMsForPlanning', 'procurement', 'getProcurementTeam', 'createFinalizedBOM', 'getSiteworks', 'manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning'],
  'site-engineer': ['manageVendors', 'getSiteworks', 'manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getBoms'],
  worker: ['manageTasks', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'manageAttendance', 'getAttendance'],
  'site-engineer': ['manageVendors', 'procurement', 'getSiteworks', 'manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getBoms'],
  worker: ['manageTasks', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers'],
  'dispatch-installation': ['manageDispatch', 'getProjects'],
  'scp-user': ['getProjects', 'getBoms', 'acceptProposal', 'rejectProposal', 'manageProjects'],
};

// Function to get role permissions - handles custom roles by mapping them to fabricator permissions
const getRolePermissions = (role, subRole = null) => {
  // If role exists in predefined roles, return its permissions
  if (allRoles[role]) {
    return allRoles[role];
  }

  // For custom role, return fabricator permissions (subRole is just for display/identification)
  if (role === 'custom') {
    return allRoles['fabricator'];
  }

  // Fallback to fabricator permissions for any other case
  return allRoles['fabricator'];
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

export { roles, roleRights, getRolePermissions };
