import mongoose from "mongoose";
import autoIncrement from "mongoose-auto-increment"

autoIncrement.initialize(mongoose.connection);

const socialLinksSchema = new mongoose.Schema({
    facebook: {
        type: String,
        default: "",
    },
    instagram: {
        type: String,
        default: "",
    },
    linkedin: {
        type: String,
        default: "",
    },
    twitter: {
        type: String,
        default: "",
    },
    tiktok: {
        type: String,
        default: "",
    },
}, {
    _id: false,
});

const contactDataSchema = new mongoose.Schema({
    company_commercial_name: {
        type: String,
        default: "",
    },
    company_legal_name: {
        type: String,
        default: "",
    },
    company_all_Available_names: {
        type: [String],
        default: [],
    },
    url: {
        type: String,
        required: true,
    },
    phones: {
        type: [String],
        required: true,
    },
    socials: {
        type: socialLinksSchema,
        required: true,
    },
    address: {
        type: String,
        default: "",
    },
    coords: {
        type: Object,
        default: {},
    },
    success: {
        type: Boolean,
        required: true,
    },
    error: {
        type: String,
        default: "",
    },
}, {
    timestamps: true,
});

contactDataSchema.plugin(autoIncrement.plugin, {
    model: "fields",
    field: "id",
    startAt: 1,
    incrementBy: 1,
});

contactDataSchema.index({
    company_commercial_name: "text",
    company_legal_name: "text",
    url: "text",
    address: "text",
    "socials.facebook": "text",
    "socials.instagram": "text",
    "socials.linkedin": "text",
    "socials.twitter": "text",
    "socials.tiktok": "text",
});

const contactDataModel = mongoose.model("contacts", contactDataSchema);

export {
    contactDataModel,
}