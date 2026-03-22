const Notification = require("../models/Notification");

exports.createNotification = async (userId, title, message, type, refId) => {
  try {
    await Notification.create({
      userId,
      notificationTitle: title,
      notificationMessage: message,
      type,
      referenceId: refId
    });
  } catch (err) {
    console.log("Notification error:", err.message);
  }
};