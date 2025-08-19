/**
 * Common status enum for customers and projects
 */
export const STATUS_ENUM = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  HOLD: 'Hold',
  DRAFT: 'Draft',
  COMPLETE: 'Complete',
  INPROGRESS: 'InProgress',
  CANCELLED: 'Cancelled',
};

export const STATUS_VALUES = Object.values(STATUS_ENUM);

export const STATUS_DESCRIPTIONS = {
  [STATUS_ENUM.ACTIVE]: 'The item is currently active and operational.',
  [STATUS_ENUM.INACTIVE]: 'The item is not currently active.',
  [STATUS_ENUM.HOLD]: 'The item is temporarily on hold.',
  [STATUS_ENUM.DRAFT]: 'The item is a draft and not yet finalized.',
  [STATUS_ENUM.COMPLETE]: 'The item has been completed.',
  [STATUS_ENUM.INPROGRESS]: 'The item is currently in progress.',
  [STATUS_ENUM.CANCELLED]: 'The item has been cancelled.',
};

export const STATUS_COLORS = {
  [STATUS_ENUM.ACTIVE]: 'blue',
  [STATUS_ENUM.INACTIVE]: 'gray',
  [STATUS_ENUM.HOLD]: 'yellow',
  [STATUS_ENUM.DRAFT]: 'gray',
  [STATUS_ENUM.COMPLETE]: 'green',
  [STATUS_ENUM.INPROGRESS]: 'blue',
  [STATUS_ENUM.CANCELLED]: 'red',
};

export const STATUS_VARIANTS = {
    [STATUS_ENUM.ACTIVE]: 'blue',
    [STATUS_ENUM.INACTIVE]: 'secondary',
    [STATUS_ENUM.HOLD]: 'yellow',
    [STATUS_ENUM.DRAFT]: 'secondary',
    [STATUS_ENUM.COMPLETE]: 'green',
    [STATUS_ENUM.INPROGRESS]: 'blue',
    [STATUS_ENUM.CANCELLED]: 'red',
};

export const getStatusColor = (status) => STATUS_COLORS[status] || 'gray';
export const getStatusVariant = (status) => STATUS_VARIANTS[status] || 'secondary';
export const getStatusDescription = (status) => STATUS_DESCRIPTIONS[status] || 'No description available.';
