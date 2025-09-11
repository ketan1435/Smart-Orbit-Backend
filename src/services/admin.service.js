import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';
import BOM from '../models/bom.model.js';
import Project from '../models/project.model.js';
import Sitework from '../models/sitework.model.js';
import ApiError from '../utils/ApiError.js';
// import { Store } from '../models/store.model.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const register = async (data) => {
  if (await Admin.isEmailTaken(data.email)) {
    throw new ApiError(409, 'Email already taken');
  }

  data.password = await bcrypt.hash(data.password, 10);

  const admin = await Admin.create(data);
  return admin;
};

export const login = async ({ email, password }) => {
  const admin = await Admin.findOne({ email });
  if (!admin) throw new ApiError(404, 'Admin not found');

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) throw new ApiError(401, 'Invalid credentials');

  const token = jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '7d' });

  return {
    status: 1,
    message: 'Login successful',
    token,
    admin: {
      id: admin._id,
      email: admin.email,
      adminName: admin.adminName,
      role: admin.role,
    },
  };
};

export const updateProfile = async (adminId, data) => {
  const admin = await Admin.findByIdAndUpdate(adminId, data, { new: true });
  if (!admin) throw new ApiError(404, 'Admin not found');
  return admin;
};

export const getPendingApprovalsCount = async () => {
  try {
    // Count BOM documents with status 'submitted'
    const bomCount = await BOM.countDocuments({ status: 'submitted' });

    // Count architect documents with adminStatus 'Pending'
    const architectDocumentsCount = await Project.aggregate([
      { $unwind: '$architectDocuments' },
      { $match: { 'architectDocuments.adminStatus': 'Pending' } },
      { $count: 'total' }
    ]);

    // Count architect proposals with status 'Pending'
    const architectProposalsCount = await Project.aggregate([
      { $unwind: '$proposals' },
      { $match: { 'proposals.status': 'Pending' } },
      { $count: 'total' }
    ]);

    // Count sitework documents with adminStatus 'Pending'
    const siteworkDocumentsCount = await Sitework.aggregate([
      { $unwind: '$siteworkDocuments' },
      { $match: { 'siteworkDocuments.adminStatus': 'Pending' } },
      { $count: 'total' }
    ]);

    const counts = {
      bomDocuments: bomCount || 0,
      architectDocuments: architectDocumentsCount.length > 0 ? architectDocumentsCount[0].total : 0,
      architectProposals: architectProposalsCount.length > 0 ? architectProposalsCount[0].total : 0,
      siteworkDocuments: siteworkDocumentsCount.length > 0 ? siteworkDocumentsCount[0].total : 0,
    };

    counts.total = counts.bomDocuments + counts.architectDocuments + counts.architectProposals + counts.siteworkDocuments;

    return counts;
  } catch (error) {
    throw new ApiError(500, 'Failed to fetch pending approvals count');
  }
};

export const getInProgressProjectsStats = async () => {
  try {
    console.log('getInProgressProjectsStats service called');
    // Get projects with status 'inprogress' or 'active'
    const projects = await Project.find({
      status: { $in: ['inprogress', 'active'] }
    })
      .populate('lead', 'customerName')
      .populate('requirement', 'requirementType')
      .sort({ createdAt: -1 })
      .lean();

    console.log('Found projects:', projects.length);

    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const inprogress = total - active;

    // Get projects breakdown by requirement type
    const projectsByType = await Project.aggregate([
      { $match: { status: { $in: ['inprogress', 'active'] } } },
      {
        $lookup: {
          from: 'requirements', // The collection name for Requirement model
          localField: 'requirement',
          foreignField: '_id',
          as: 'requirementInfo'
        }
      },
      { $unwind: { path: '$requirementInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$requirementInfo.requirementType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent projects (last 5)
    const recentProjects = projects.slice(0, 5).map(p => ({
      _id: p._id,
      projectName: p.projectName,
      projectCode: p.projectCode,
      customerName: p.lead?.customerName || 'Unknown',
      status: p.status,
      requirementType: p.requirement?.requirementType || 'Unknown',
      createdAt: p.createdAt,
    }));

    return {
      total,
      active,
      inprogress,
      projectsByType,
      recentProjects,
    };
  } catch (error) {
    console.error('Error fetching in-progress projects stats:', error);
    throw new ApiError(500, 'Failed to fetch in-progress projects stats');
  }
};

// Combined dashboard summary
export const getDashboardSummary = async () => {
  try {
    const [pendingApprovals, inProgress] = await Promise.all([
      getPendingApprovalsCount(),
      getInProgressProjectsStats(),
    ]);

    return {
      pendingApprovals,
      inProgress,
    };
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    throw new ApiError(500, 'Failed to fetch dashboard summary');
  }
};
