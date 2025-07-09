const allRoles = {
  user: ['getProjects'], // A customer who can see their project status
  admin: ['getUsers', 'manageUsers', 'getProjects', 'exportLeads', 'manageProjects', 'manageArchitects', 'manageLeads', 'manageSiteVisits', 'getSiteVisits', 'getBoms', 'getProcurementTeam', 'reviewBOM'],
  'sales-admin': ['manageLeads', 'getProjects', 'getSiteVisits'],
  architect: ['manageDrawings', 'getProjects', 'manageProjects'],
  'fabrication-planner': ['manageBOM', 'getProjects'],
  'procurement-team': ['manageVendors', 'getProjects', 'getReusableBOMs', 'createBoms', 'getBoms'],
  'site-engineer': ['manageTasks', 'verifyWork', 'getProjects', 'manageSiteVisits', 'getSiteVisits'],
  worker: ['manageTasks', 'getProjects'],
  'dispatch-installation': ['manageDispatch', 'getProjects'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

export { roles, roleRights };
