const allRoles = {
  user: ['getProjects', 'getSiteworkDocumentsForCustomer', 'customerReviewSiteworkDocument', 'getSiteworks', 'manageSiteworkDocuments'], // A customer who can see their project status
  admin: ['getUsers', 'manageUsers', 'getProjects', 'exportLeads', 'manageProjects', 'manageArchitects', 'manageLeads', 'manageSiteVisits', 'getSiteVisits', 'getBoms', 'getProcurementTeam', 'reviewBOM', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'sendSiteworkDocumentToCustomer', 'getUsers', 'updateProjectStatus'],
  'sales-admin': ['manageLeads', 'getProjects', 'getSiteVisits', 'sendSiteworkDocumentToCustomer', 'updateProjectStatus'],
  architect: ['manageDrawings', 'getProjects', 'manageProjects'],
  'fabricator': ['manageBOM', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'getUsers'],
  'procurement-team': ['manageVendors', 'getProjects', 'getReusableBOMs', 'createBoms', 'getBoms', 'submitBOM'],
  'site-engineer': ['manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers', 'getUsers'],
  worker: ['manageTasks', 'getProjects', 'getSiteworks', 'manageSiteworks', 'getWorkers', 'manageWorkers', 'getSiteworkDocuments', 'manageSiteworkDocuments', 'manageWorkers'],
  'dispatch-installation': ['manageDispatch', 'getProjects'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

export { roles, roleRights };
