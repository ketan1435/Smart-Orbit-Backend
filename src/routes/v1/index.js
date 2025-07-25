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
import poRoute from './po.route.js';
import siteworkRoute from './sitework.route.js';

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
    path: '/',
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
    path: '/pos',
    route: poRoute,
  },
  {
    path: '/siteworks',
    route: siteworkRoute,
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
