import express from 'express';
import docsRoute from './docs.route.js';
import config from '../../config/config.js';

import customerLeadRoute from './customerLead.route.js';
import adminRoute from './admin.route.js';

const router = express.Router();

const defaultRoutes = [
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
  // {
  //   path: '/stores',
  //   route: storeRoute,
  // },
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
  //   path: '/vendors',
  //   route: vendorRoute,
  // },
  // {
  //   path: '/files',
  //   route: fileRoute,
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
