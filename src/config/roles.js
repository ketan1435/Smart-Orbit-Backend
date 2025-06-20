const allRoles = {
  user: [],
  admin: ['getUsers', 'manageUsers', 'exportLeads'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

export { roles, roleRights };
