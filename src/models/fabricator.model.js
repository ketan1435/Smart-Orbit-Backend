import mongoose from 'mongoose';

const fabricatorSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    mobileNumber: { 
        type: String, 
        required: true,
        trim: true
    },
    email: { 
        type: String, 
        required: true,
        lowercase: true,
        trim: true
    },
    address: { 
        type: String, 
        required: true,
        trim: true
    },
    city: { 
        type: String, 
        required: true,
        trim: true
    },
    state: { 
        type: String, 
        required: true,
        trim: true
    },
    country: { 
        type: String, 
        required: true,
        trim: true
    },
    specialization: [{ 
        type: String,
        trim: true
    }],
    experience: { 
        type: Number, 
        required: true,
        min: 0
    },
    hourlyRate: { 
        type: Number, 
        required: true,
        min: 0
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }
}, {
    timestamps: true,
});

const Fabricator = mongoose.model('Fabricator', fabricatorSchema);
export default Fabricator; 