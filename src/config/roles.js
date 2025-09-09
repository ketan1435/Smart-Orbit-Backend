const allRoles = {
  user: ['getProjects', 'getSiteworkDocumentsForCustomer', 'customerReviewSiteworkDocument', 'getSiteworks', 'manageSiteworkDocuments'], // A customer who can see their project status
  Admin: ['getUsers', 'manageUsers', 'getProjects', 'exportLeads', 'manageProjects', 'manageArchitects', 'manageLeads', 'manageSiteVisits', 'getSiteVisits', 'getBoms', 'getProcurementTeam', 'reviewBOM', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'sendSiteworkDocumentToCustomer', 'getUsers', 'updateProjectStatus', 'acceptProposal', 'rejectProposal', 'getSiteEngineers', 'assignBOMToSiteEngineer', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getRoughBOMsForPlanning', 'procurement', 'manageAttendance', 'getAttendance'],
  'sales-admin': ['manageLeads', 'getProjects', 'getSiteVisits', 'sendSiteworkDocumentToCustomer', 'updateProjectStatus'],
  architect: ['manageDrawings', 'getProjects', 'manageProjects'],
  'fabricator': ['manageBOM', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'getUsers', 'manageAttendance', 'getAttendance'],
  'planning-engineer': ['manageVendors', 'getReusableBOMs', 'createBoms', 'getBoms', 'submitBOM', 'getSiteEngineers', 'assignBOMToSiteEngineer', 'getRoughBOMsForPlanning', 'procurement', 'getProcurementTeam', 'createFinalizedBOM','getSiteworks','manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning'],
  'site-engineer': ['manageVendors', 'getSiteworks','manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers', 'getSiteEngineerBOMs', 'updateBOMBySiteEngineer', 'submitUpdatedBOMToPlanning', 'getBoms'],
  worker: ['manageTasks', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers'],
  'dispatch-installation': ['manageDispatch', 'getProjects'],
  'scp-user': ['getProjects', 'getBoms', 'acceptProposal', 'rejectProposal','manageProjects'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

export { roles, roleRights };
