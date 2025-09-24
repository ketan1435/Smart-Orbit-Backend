import mongoose from 'mongoose';

const clientProposalFileSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProposal', index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

const ClientProposalFile = mongoose.model('ClientProposalFile', clientProposalFileSchema);

export default ClientProposalFile;


