// models/Message.js
import mongoose from 'mongoose';
import { fileSchema } from './requirement.model.js';
const messageSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'senderModel',
        required: true
    },
    senderModel: {
        type: String,
        enum: ['User', 'Admin'],
        required: true
    },
    files: [fileSchema],
    content: {
        type: String,
    },
    isRead: {
        type: Boolean,
        default: false
    },
},
    {
        timestamps: true
    }
);

const Message = mongoose.model('Message', messageSchema);

export default Message;
