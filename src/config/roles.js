const allRoles = {
  user: ['getProjects'], // A customer who can see their project status
  admin: ['getUsers', 'manageUsers','getUsers', 'exportLeads', 'manageProjects', 'manageArchitects','manageLeads'],
  'sales-admin': ['manageLeads', 'getProjects'],
  architect: ['manageDrawings', 'getProjects'],
  'fabrication-planner': ['manageBOM', 'getProjects'],
  'procurement-team': ['manageVendors', 'getProjects'],
  'site-engineer': ['manageTasks', 'verifyWork', 'getProjects'],
  worker: ['manageTasks', 'getProjects'],
  'dispatch-installation': ['manageDispatch', 'getProjects'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

export { roles, roleRights };
