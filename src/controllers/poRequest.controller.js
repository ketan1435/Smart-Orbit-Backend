import catchAsync from '../utils/catchAsync.js';
import { createPoRequestService, getPoRequestsService, approvePoRequestService, rejectPoRequestService } from '../services/poRequest.service.js';

export const createPoRequest = catchAsync(async (req, res) => {
  const poReq = await createPoRequestService(req, req.body);
  res.status(201).send({ status: 1, message: 'PO Request created', data: poReq });
});

export const getPoRequests = catchAsync(async (req, res) => {
  const results = await getPoRequestsService(req, req.query || {});
  res.send({ status: 1, message: 'PO Requests fetched', data: results });
});

export const approvePoRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await approvePoRequestService(req, id, req.body || {});
  res.send({ status: 1, message: 'PO Request approved', data: result });
});

export const rejectPoRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await rejectPoRequestService(req, id, req.body || {});
  res.send({ status: 1, message: 'PO Request rejected', data: result });
});


