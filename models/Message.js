const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
{
    groupId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    groupName: {
        type: String,
        required: true
    },

    members: [{
        employeeId: String,
        role: {
            type: String,
            enum: ["admin", "member"],
            default: "member"
        }
    }]

},
{ timestamps: true }
);

const messageSchema = new mongoose.Schema(
{
    senderEmployeeId: {
        type: String,
        required: true,
        index: true
    },

    receiverEmployeeId: {
        type: String,
        default: null
    },

    groupId: {
        type: String,
        default: null,
        index: true
    },

    message: {
        type: String,
        default: ""
    },

    fileUrl: {
        type: String,
        default: null
    },

    fileName: {
        type: String,
        default: null
    },

    readBy: [String]

},
{
    timestamps: true
});

const Group = mongoose.model("Group", groupSchema);
const Message = mongoose.model("Message", messageSchema);

module.exports = { Group, Message };