import express from 'express';
import docsRoute from './docs.route.js';
import config from '../../config/config.js';

import customerLeadRoute from './customerLead.route.js';
import adminRoute from './admin.route.js';
import fileRoute from './file.route.js';
import userRoute from './user.route.js';
import authRoute from './auth.route.js';
import siteVisitRoute from './siteVisit.route.js';
import projectRoute from './project.route.js';
import bomRoute from './bom.route.js';
import clientProposalRoute from './clientProposal.route.js';
import vendorRoute from './vendor.route.js';
import quoteRoute from './quote.route.js';
import poRoute from './po.route.js';
import poRequestRoute from './poRequest.route.js';
import poVerificationRoute from './poVerification.route.js';
import deliveryScheduleRoute from './deliverySchedule.route.js';
import siteworkRoute from './sitework.route.js';
import projectAssignmentPaymentRoute from './projectAssignmentPayment.route.js';
import walletTransactionRoute from './walletTransaction.route.js';
import messageRoute from './message.route.js';
import socketRoute from './socket.route.js';
import attendanceRoute from './attendance.route.js';
import activityLogRoute from './activityLog.route.js';
import remarkRoute from './remark.route.js';
import attachmentRoute from './attachment.route.js';
import serviceRoute from './service.route.js';
import projectWaterfallRoute from './projectWaterfall.route.js';
import adminReviewRoute from './adminReview.route.js';
import projectReviewRoute from './projectReview.route.js';
import scpDataSendRoute from './scpDataSend.route.js';
import customerConfirmationRoute from './customerConfirmation.route.js';

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/customer-leads',
    route: customerLeadRoute,
  },
  // {
  //   path: '/superadmin/',
  //   route: superAdminRoute,
  // },
  {
    path: '/admin/',
    route: adminRoute,
  },
  {
    path: '/files',
    route: fileRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/site-visits',
    route: siteVisitRoute,
  },
  {
    path: '/projects',
    route: projectRoute,
  },
  {
    path: '/boms',
    route: bomRoute,
  },
  {
    path: '/client-proposals',
    route: clientProposalRoute,
  },
  {
    path: '/vendors',
    route: vendorRoute,
  },
  {
    path: '/quotes',
    route: quoteRoute,
  },
  {
    path: '/pos',
    route: poRoute,
  },
  {
    path: '/po-requests',
    route: poRequestRoute,
  },
  {
    path: '/po-verifications',
    route: poVerificationRoute,
  },
  {
    path: '/delivery-schedules',
    route: deliveryScheduleRoute,
  },
  {
    path: '/siteworks',
    route: siteworkRoute,
  },
  {
    path: '/project-assignment-payments',
    route: projectAssignmentPaymentRoute,
  },
  {
    path: '/wallet-transactions',
    route: walletTransactionRoute,
  },
  {
    path: '/messages',
    route: messageRoute,
  },
  {
    path: '/socket',
    route: socketRoute,
  },
  {
    path: '/attendance',
    route: attendanceRoute,
  },
  {
    path: '/activity-logs',
    route: activityLogRoute,
  },
  {
    path: '/remarks',
    route: remarkRoute,
  },
  {
    path: '/attachments',
    route: attachmentRoute,
  },
  {
    path: '/services',
    route: serviceRoute,
  },
  {
    path: '/project-waterfall',
    route: projectWaterfallRoute,
  },
  {
    path: '/admin-review',
    route: adminReviewRoute,
  },
  {
    path: '/project-review',
    route: projectReviewRoute,
  },
  {
    path: '/scp-data-send',
    route: scpDataSendRoute,
  },
  {
    path: '/customer-confirmation',
    route: customerConfirmationRoute,
  },
  // {
  //   path: '/income',
  //   route: incomeRoute,
  // },
  // {
  //   path: '/expense',
  //   route: expenseRoute,
  // },
  // {
  //   path: '/daily-entries',
  //   route: dailyEntriesRoute,
  // },
  // {
  //   path: '/subscription-plans',
  //   route: subscriptionPlanRoute,
  // },
  // {
  //   path: '/graph',
  //   route: graphRoute,
  // },
  // {
  //   path: '/purchase-order',
  //   route: purchaseOrderRoute,
  // },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

export default router;
