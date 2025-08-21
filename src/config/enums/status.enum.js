/**
 * Common status enum for customers and projects
 */
export const STATUS_ENUM = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  INPROGRESS: 'inprogress',
  COMPLETE: 'complete',
  DRAFT: 'draft',
  CLOSE: 'close',
};

export const STATUS_VALUES = Object.values(STATUS_ENUM);

export const STATUS_DESCRIPTIONS = {
  [STATUS_ENUM.ACTIVE]: 'The item is currently active and operational.',
  [STATUS_ENUM.INACTIVE]: 'The item is not currently active.',
  [STATUS_ENUM.INPROGRESS]: 'The item is currently in progress.',
  [STATUS_ENUM.COMPLETE]: 'The item has been completed.',
  [STATUS_ENUM.DRAFT]: 'The item is a draft and not yet finalized.',
  [STATUS_ENUM.CLOSE]: 'The item has been closed.',
};

export const STATUS_COLORS = {
  [STATUS_ENUM.ACTIVE]: 'green',
  [STATUS_ENUM.INACTIVE]: 'gray',
  [STATUS_ENUM.INPROGRESS]: 'blue',
  [STATUS_ENUM.COMPLETE]: 'green',
  [STATUS_ENUM.DRAFT]: 'gray',
  [STATUS_ENUM.CLOSE]: 'red',
};

export const STATUS_VARIANTS = {
  [STATUS_ENUM.ACTIVE]: 'default',
  [STATUS_ENUM.INACTIVE]: 'secondary',
  [STATUS_ENUM.INPROGRESS]: 'default',
  [STATUS_ENUM.COMPLETE]: 'default',
  [STATUS_ENUM.DRAFT]: 'secondary',
  [STATUS_ENUM.CLOSE]: 'destructive',
};

// Status hierarchy for determining customer status from project statuses
export const STATUS_HIERARCHY = {
  [STATUS_ENUM.ACTIVE]: 1,
  [STATUS_ENUM.INPROGRESS]: 2,
  [STATUS_ENUM.DRAFT]: 3,
  [STATUS_ENUM.COMPLETE]: 4,
  [STATUS_ENUM.CLOSE]: 5,
  [STATUS_ENUM.INACTIVE]: 6,
};

export const getStatusColor = (status) => STATUS_COLORS[status] || 'gray';
export const getStatusVariant = (status) => STATUS_VARIANTS[status] || 'secondary';
export const getStatusDescription = (status) => STATUS_DESCRIPTIONS[status] || 'No description available.';

// Function to determine customer status based on project statuses
export const getCustomerStatusFromProjects = (projectStatuses) => {
  if (!projectStatuses || projectStatuses.length === 0) {
    return STATUS_ENUM.DRAFT;
  }

  // Get the highest priority status (lowest number in hierarchy)
  const statuses = projectStatuses.map(status => STATUS_HIERARCHY[status]).filter(Boolean);
  if (statuses.length === 0) {
    return STATUS_ENUM.DRAFT;
  }

  const highestPriority = Math.min(...statuses);
  const customerStatus = Object.keys(STATUS_HIERARCHY).find(
    status => STATUS_HIERARCHY[status] === highestPriority
  );

  return customerStatus || STATUS_ENUM.DRAFT;
};
